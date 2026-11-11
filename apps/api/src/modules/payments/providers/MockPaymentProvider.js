import crypto from 'node:crypto';
import { PaymentProvider } from './PaymentProvider.js';

export class MockPaymentProvider extends PaymentProvider {
  constructor({ keyId = 'mock_rzp_key_id', keySecret = 'mock_rzp_key_secret' } = {}) {
    super();
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.name = 'MOCK';
  }

  async createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
    const providerOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
    return {
      providerOrderId,
      amountPaise,
      currency,
      receipt,
      keyId: this.keyId,
      notes,
    };
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!signature) return false;
    if (signature === 'mock_valid_signature') return true;

    // Deterministic mock signature formula
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    try {
      const expBuf = Buffer.from(expected);
      const sigBuf = Buffer.from(signature);
      if (expBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expBuf, sigBuf);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature({ rawBody, signature }) {
    if (!signature) return false;
    if (signature === 'mock_valid_webhook_signature') return true;

    const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const expected = crypto.createHmac('sha256', this.keySecret).update(payloadStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
