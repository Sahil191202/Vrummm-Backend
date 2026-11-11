import { MockPaymentProvider } from './MockPaymentProvider.js';
import { RazorpayTestPaymentProvider } from './RazorpayTestPaymentProvider.js';

export function createPaymentProviderRegistry({ razorpayConfig } = {}) {
  const mockProvider = new MockPaymentProvider();
  let razorpayProvider = null;

  if (razorpayConfig?.keyId && razorpayConfig?.keySecret) {
    try {
      razorpayProvider = new RazorpayTestPaymentProvider({
        keyId: razorpayConfig.keyId,
        keySecret: razorpayConfig.keySecret,
        webhookSecret: razorpayConfig.webhookSecret,
      });
    } catch {
      // Keep null if credentials invalid
    }
  }

  function getProvider(providerName = 'MOCK') {
    if (providerName === 'RAZORPAY') {
      if (!razorpayProvider) {
        throw new Error('Razorpay payment provider is not configured with valid test keys');
      }
      return razorpayProvider;
    }
    return mockProvider;
  }

  return {
    getProvider,
    mockProvider,
    razorpayProvider,
  };
}
