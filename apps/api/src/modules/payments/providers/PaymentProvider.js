// Abstract base payment provider interface
export class PaymentProvider {
  async createOrder(_opts) {
    throw new Error('PaymentProvider.createOrder is not implemented');
  }

  verifyPaymentSignature(_opts) {
    throw new Error('PaymentProvider.verifyPaymentSignature is not implemented');
  }

  verifyWebhookSignature(_opts) {
    throw new Error('PaymentProvider.verifyWebhookSignature is not implemented');
  }
}
