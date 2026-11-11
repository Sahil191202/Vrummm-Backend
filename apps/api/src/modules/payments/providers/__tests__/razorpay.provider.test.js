import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { RazorpayTestPaymentProvider } from '../RazorpayTestPaymentProvider.js';

vi.mock('razorpay', () => {
  function RazorpayMock() {
    this.orders = {
      create: vi.fn(async (opts) => ({
        id: 'order_rzp_mock_123',
        amount: opts.amount,
        currency: opts.currency,
        receipt: opts.receipt,
        notes: opts.notes,
      })),
    };
  }
  RazorpayMock.validateWebhookSignature = vi.fn((body, sig, secret) => {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === sig;
  });
  return { default: RazorpayMock };
});

const provider = new RazorpayTestPaymentProvider({
  keyId: 'rzp_test_key123',
  keySecret: 'secret_key_456',
  webhookSecret: 'webhook_secret_789',
});

describe('RazorpayTestPaymentProvider', () => {
  it('creates order with amount in paise and returns order details', async () => {
    const order = await provider.createOrder({
      amountPaise: 15000,
      currency: 'INR',
      receipt: 'ride_1',
      notes: { rideId: 'ride_1' },
    });

    expect(order.providerOrderId).toBe('order_rzp_mock_123');
    expect(order.amountPaise).toBe(15000);
    expect(order.currency).toBe('INR');
    expect(order.keyId).toBe('rzp_test_key123');
  });

  it('validates genuine checkout payment signature', () => {
    const orderId = 'order_rzp_mock_123';
    const paymentId = 'pay_rzp_mock_456';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', 'secret_key_456')
      .update(payload)
      .digest('hex');

    const isValid = provider.verifyPaymentSignature({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: validSignature,
    });

    expect(isValid).toBe(true);
  });

  it('detects tampered checkout payment signature', () => {
    const isValid = provider.verifyPaymentSignature({
      providerOrderId: 'order_rzp_mock_123',
      providerPaymentId: 'pay_rzp_mock_456',
      signature: 'bad_tampered_signature',
    });

    expect(isValid).toBe(false);
  });

  it('validates webhook signature against raw request body', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured' });
    const signature = crypto
      .createHmac('sha256', 'webhook_secret_789')
      .update(rawBody)
      .digest('hex');

    const isValid = provider.verifyWebhookSignature({
      rawBody,
      signature,
    });

    expect(isValid).toBe(true);
  });
});
