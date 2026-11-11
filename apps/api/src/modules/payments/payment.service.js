import mongoose from 'mongoose';
import { Payment } from './schemas/payment.schema.js';
import { WebhookEvent } from './schemas/webhookEvent.schema.js';
import { Ride } from '../rides/schemas/ride.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';
import { emit } from '../socket/socket.service.js';
import { SOCKET_EVENTS } from '@vrumm/contracts';

export function createPaymentService({
  paymentProviderRegistry,
  revenuePlanService,
  ledgerService,
  io = null,
}) {
  async function createPaymentOrder({
    rideId,
    customerUserId,
    providerName = 'MOCK',
    idempotencyKey = null,
  }) {
    const ride = await Ride.findById(rideId);
    if (!ride) throw errors.notFound('Ride not found');

    if (String(ride.customerUserId) !== String(customerUserId)) {
      throw errors.forbidden('You can only pay for your own rides');
    }

    if (ride.status !== 'COMPLETED') {
      throw errors.businessRule(
        `Ride must be completed before payment can be initiated (current status: ${ride.status})`,
      );
    }

    if (ride.paymentStatus === 'PAID') {
      throw errors.conflict('This ride has already been paid');
    }

    // Authoritative fare calculation from server-persisted quote snapshot (never from client)
    const amountPaise = ride.fareSnapshot?.totalPaise;
    if (!amountPaise || amountPaise <= 0) {
      throw errors.internal('Authoritative ride fare is missing or invalid');
    }

    // Check existing pending payment with idempotencyKey or for this ride
    if (idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey });
      if (existing) {
        if (existing.status === 'CAPTURED') {
          throw errors.conflict('Payment already processed for this idempotency key');
        }
        return {
          paymentId: existing._id,
          providerOrderId: existing.providerOrderId,
          amountPaise: existing.amountPaise,
          currency: existing.currency,
          keyId: paymentProviderRegistry.getProvider(existing.provider).keyId,
          provider: existing.provider,
        };
      }
    }

    const provider = paymentProviderRegistry.getProvider(providerName);
    const order = await provider.createOrder({
      amountPaise,
      currency: 'INR',
      receipt: rideId,
      notes: { rideId: String(rideId), customerUserId: String(customerUserId) },
    });

    const payment = await Payment.create({
      rideId: ride._id,
      bookingId: ride.bookingId,
      customerUserId: ride.customerUserId,
      captainUserId: ride.captainUserId,
      amountPaise,
      currency: order.currency ?? 'INR',
      status: 'PENDING',
      provider: providerName,
      providerOrderId: order.providerOrderId,
      idempotencyKey,
      metadata: order.notes,
    });

    await Ride.updateOne(
      { _id: rideId },
      { $set: { paymentStatus: 'PENDING', paymentId: payment._id } },
    );

    return {
      paymentId: payment._id,
      providerOrderId: order.providerOrderId,
      amountPaise,
      currency: payment.currency,
      keyId: order.keyId,
      provider: providerName,
    };
  }

  async function verifyPayment({
    paymentId,
    customerUserId,
    providerPaymentId,
    providerSignature,
  }) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw errors.notFound('Payment not found');

    if (String(payment.customerUserId) !== String(customerUserId)) {
      throw errors.forbidden('You can only verify payments for your own rides');
    }

    if (payment.status === 'CAPTURED') {
      return payment; // Idempotent return
    }

    const provider = paymentProviderRegistry.getProvider(payment.provider);
    const isValid = provider.verifyPaymentSignature({
      providerOrderId: payment.providerOrderId,
      providerPaymentId,
      signature: providerSignature,
    });

    if (!isValid) {
      await Payment.updateOne(
        { _id: paymentId },
        {
          $inc: { attempts: 1 },
          $set: { errorReason: 'Invalid signature provided during checkout verification' },
        },
      );
      throw errors.badRequest('Invalid payment signature');
    }

    const session = await mongoose.startSession();
    let updatedPayment;

    try {
      await session.withTransaction(async () => {
        updatedPayment = await Payment.findOneAndUpdate(
          { _id: paymentId, status: 'PENDING' },
          {
            $set: {
              status: 'CAPTURED',
              providerPaymentId,
              providerSignature,
              capturedAt: new Date(),
            },
          },
          { new: true, session },
        );

        if (!updatedPayment) {
          throw errors.conflict('Payment was processed concurrently');
        }

        const ride = await Ride.findById(payment.rideId).session(session);

        // Calculate commission and captain earnings
        const settlement = await revenuePlanService.calculateRideCommission({
          totalPaise: payment.amountPaise,
          captainId: ride.captainId,
        });

        // Post to append-only ledger
        await ledgerService.recordRideSettlement({
          rideId: payment.rideId,
          paymentId: payment._id,
          customerUserId: payment.customerUserId,
          captainUserId: payment.captainUserId,
          totalFarePaise: payment.amountPaise,
          commissionPaise: settlement.commissionPaise,
          captainEarningsPaise: settlement.captainEarningsPaise,
          session,
          actorUserId: customerUserId,
        });

        // Update Ride paymentStatus
        await Ride.updateOne(
          { _id: payment.rideId },
          { $set: { paymentStatus: 'PAID', revenuePlanSnapshot: settlement.planSnapshot } },
          { session },
        );

        // Update Captain totalEarnedPaise
        await Captain.updateOne(
          { _id: ride.captainId },
          { $inc: { totalEarnedPaise: settlement.captainEarningsPaise } },
          { session },
        );

        // Emit socket events
        await emit.toUser(
          io,
          String(payment.customerUserId),
          SOCKET_EVENTS.PAYMENT_STATUS,
          {
            paymentId: payment._id,
            rideId: payment.rideId,
            status: 'CAPTURED',
            amountPaise: payment.amountPaise,
          },
          session,
        );

        await emit.toUser(
          io,
          String(payment.captainUserId),
          SOCKET_EVENTS.PAYMENT_STATUS,
          {
            paymentId: payment._id,
            rideId: payment.rideId,
            status: 'CAPTURED',
            amountPaise: payment.amountPaise,
            captainEarningsPaise: settlement.captainEarningsPaise,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    return updatedPayment;
  }

  async function processWebhook({ rawBody, signature, eventId, providerName = 'RAZORPAY' }) {
    if (!eventId) throw errors.badRequest('Missing webhook event id');

    // Deduplicate event ID
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing) {
      return { received: true, duplicate: true, status: existing.status };
    }

    let payload;
    try {
      const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      payload = JSON.parse(payloadStr);
    } catch {
      throw errors.badRequest('Malformed JSON in webhook body');
    }

    const eventType = payload.event ?? 'unknown';

    const provider = paymentProviderRegistry.getProvider(providerName);
    const isValid = provider.verifyWebhookSignature({ rawBody, signature });

    const webhookRecord = await WebhookEvent.create({
      eventId,
      provider: providerName,
      eventType,
      payload,
      status: isValid ? 'RECEIVED' : 'FAILED',
      errorMessage: isValid ? undefined : 'Signature verification failed',
    });

    if (!isValid) {
      throw errors.badRequest('Invalid webhook signature');
    }

    // Process event types
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity ?? payload.payload?.order?.entity;
      const providerOrderId = paymentEntity?.order_id ?? paymentEntity?.id;
      const providerPaymentId = paymentEntity?.id;

      if (providerOrderId) {
        const payment = await Payment.findOne({ providerOrderId, status: 'PENDING' });
        if (payment) {
          const ride = await Ride.findById(payment.rideId);
          if (ride) {
            const settlement = await revenuePlanService.calculateRideCommission({
              totalPaise: payment.amountPaise,
              captainId: ride.captainId,
            });

            const session = await mongoose.startSession();
            try {
              await session.withTransaction(async () => {
                await Payment.updateOne(
                  { _id: payment._id },
                  {
                    $set: {
                      status: 'CAPTURED',
                      providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
                      capturedAt: new Date(),
                    },
                  },
                  { session },
                );

                await ledgerService.recordRideSettlement({
                  rideId: payment.rideId,
                  paymentId: payment._id,
                  customerUserId: payment.customerUserId,
                  captainUserId: payment.captainUserId,
                  totalFarePaise: payment.amountPaise,
                  commissionPaise: settlement.commissionPaise,
                  captainEarningsPaise: settlement.captainEarningsPaise,
                  session,
                  actorUserId: payment.customerUserId,
                });

                await Ride.updateOne(
                  { _id: payment.rideId },
                  { $set: { paymentStatus: 'PAID' } },
                  { session },
                );
              });
            } finally {
              await session.endSession();
            }
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      if (providerOrderId) {
        await Payment.updateOne(
          { providerOrderId, status: 'PENDING' },
          {
            $set: {
              status: 'FAILED',
              errorReason: paymentEntity?.error_description ?? 'Payment failed at gateway',
            },
          },
        );
      }
    }

    await WebhookEvent.updateOne(
      { _id: webhookRecord._id },
      { $set: { status: 'PROCESSED', processedAt: new Date() } },
    );

    return { received: true, eventId };
  }

  async function simulateRefund({ paymentId, reason, actorUserId }) {
    if (!reason || reason.trim().length < 5) {
      throw errors.badRequest('A detailed reason is required for simulated refunds');
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) throw errors.notFound('Payment not found');

    if (payment.status !== 'CAPTURED') {
      throw errors.businessRule(
        `Only captured payments can be refunded (current status: ${payment.status})`,
      );
    }

    const session = await mongoose.startSession();
    let updated;

    try {
      await session.withTransaction(async () => {
        updated = await Payment.findOneAndUpdate(
          { _id: paymentId, status: 'CAPTURED' },
          {
            $set: {
              status: 'REFUNDED_SIMULATED',
              refundSimulatedAt: new Date(),
              refundSimulatedReason: reason,
            },
          },
          { new: true, session },
        );

        if (!updated) {
          throw errors.conflict('Payment state changed concurrently');
        }

        // Post simulated refund adjustments to ledger
        await ledgerService.createAdjustment({
          accountUserId: payment.customerUserId,
          accountType: 'CUSTOMER',
          direction: 'CREDIT',
          amountPaise: payment.amountPaise,
          reason,
          description: `Simulated refund for ride ${payment.rideId}`,
          actorUserId,
          rideId: payment.rideId,
          paymentId: payment._id,
          session,
        });

        await ledgerService.createAdjustment({
          accountUserId: actorUserId,
          accountType: 'PLATFORM',
          direction: 'DEBIT',
          amountPaise: payment.amountPaise,
          reason,
          description: `Simulated refund clearing for ride ${payment.rideId}`,
          actorUserId,
          rideId: payment.rideId,
          paymentId: payment._id,
          session,
        });

        await Ride.updateOne(
          { _id: payment.rideId },
          { $set: { paymentStatus: 'REFUNDED' } },
          { session },
        );

        await emit.toUser(
          io,
          String(payment.customerUserId),
          SOCKET_EVENTS.PAYMENT_STATUS,
          {
            paymentId: payment._id,
            rideId: payment.rideId,
            status: 'REFUNDED_SIMULATED',
            amountPaise: payment.amountPaise,
            reason,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    return updated;
  }

  async function getPaymentByRide(rideId) {
    const payment = await Payment.findOne({ rideId }).sort({ createdAt: -1 });
    if (!payment) throw errors.notFound('No payment found for this ride');
    return payment;
  }

  async function listPayments(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.customerUserId) query.customerUserId = filter.customerUserId;
    if (filter.captainUserId) query.captainUserId = filter.captainUserId;
    if (filter.rideId) query.rideId = filter.rideId;

    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  return {
    createPaymentOrder,
    verifyPayment,
    processWebhook,
    simulateRefund,
    getPaymentByRide,
    listPayments,
  };
}
