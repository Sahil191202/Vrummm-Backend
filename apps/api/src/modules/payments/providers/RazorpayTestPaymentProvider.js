import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { PaymentProvider } from './PaymentProvider.js';
import { errors } from '../../../shared/AppError.js';

export class RazorpayTestPaymentProvider extends PaymentProvider {
  constructor({ keyId, keySecret, webhookSecret }) {
    super();
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keyId and keySecret are required');
    }
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    this.name = 'RAZORPAY';

    this.client = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  async createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
    try {
      const order = await this.client.orders.create({
        amount: amountPaise,
        currency,
        receipt: receipt ? String(receipt).slice(0, 40) : undefined,
        notes,
      });

      return {
        providerOrderId: order.id,
        amountPaise: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        keyId: this.keyId,
        notes: order.notes,
      };
    } catch (err) {
      throw errors.unavailable('Failed to create Razorpay test order', {
        detail: err.message ?? String(err),
      });
    }
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!signature || !providerOrderId || !providerPaymentId) return false;

    const payload = `${providerOrderId}|${providerPaymentId}`;
    const expected = crypto.createHmac('sha256', this.keySecret).update(payload).digest('hex');

    try {
      const expectedBuf = Buffer.from(expected, 'utf8');
      const sigBuf = Buffer.from(signature, 'utf8');
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature({ rawBody, signature }) {
    if (!signature || !this.webhookSecret) return false;

    try {
      const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      return Razorpay.validateWebhookSignature(payloadStr, signature, this.webhookSecret);
    } catch {
      return false;
    }
  }
}
