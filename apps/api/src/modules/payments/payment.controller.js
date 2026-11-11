import { sendSuccess } from '../../shared/respond.js';
import { logAudit } from '../audit/audit.service.js';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.ip) ?? 'unknown';
}

export function createPaymentController({ paymentService }) {
  return {
    async createPaymentOrder(req, res) {
      const { rideId, provider, idempotencyKey } = req.validated.body;
      const order = await paymentService.createPaymentOrder({
        rideId,
        customerUserId: req.user.sub,
        providerName: provider,
        idempotencyKey,
      });
      return sendSuccess(req, res, order, { status: 201 });
    },

    async verifyPayment(req, res) {
      const { paymentId, providerPaymentId, providerSignature } = req.validated.body;
      const payment = await paymentService.verifyPayment({
        paymentId,
        customerUserId: req.user.sub,
        providerPaymentId,
        providerSignature,
      });
      return sendSuccess(req, res, payment);
    },

    async handleWebhook(req, res) {
      // Signature from Razorpay header: x-razorpay-signature
      const signature =
        req.headers['x-razorpay-signature'] ||
        req.headers['x-mock-signature'] ||
        req.headers['x-signature'];

      const eventId =
        req.headers['x-razorpay-event-id'] ||
        req.headers['x-mock-event-id'] ||
        req.headers['x-event-id'];

      // Note: req.rawBody was captured by express middleware before parsing
      const rawBody = req.rawBody || req.body;

      const result = await paymentService.processWebhook({
        rawBody,
        signature,
        eventId,
        providerName: req.headers['x-razorpay-signature'] ? 'RAZORPAY' : 'MOCK',
      });

      return sendSuccess(req, res, result);
    },

    async simulateRefund(req, res) {
      const { paymentId } = req.validated.params;
      const { reason } = req.validated.body;

      const refund = await paymentService.simulateRefund({
        paymentId,
        reason,
        actorUserId: req.user.sub,
      });

      await logAudit({
        actorUserId: req.user.sub,
        action: 'PAYMENT_REFUND_SIMULATED',
        targetType: 'PAYMENT',
        targetId: paymentId,
        reason,
        requestId: req.id,
        ip: clientIp(req),
        after: { status: 'REFUNDED_SIMULATED', amountPaise: refund.amountPaise },
      });

      return sendSuccess(req, res, refund);
    },

    async getPaymentForRide(req, res) {
      const payment = await paymentService.getPaymentByRide(req.validated.params.rideId);
      return sendSuccess(req, res, payment);
    },

    async listPayments(req, res) {
      const { page, limit, ...filter } = req.validated.query;
      const result = await paymentService.listPayments(filter, { page, limit });
      return sendSuccess(req, res, result.payments, { meta: result.pagination });
    },
  };
}
