import { z } from 'zod';
import {
  objectIdSchema,
  paymentProviderSchema,
  paymentStatusSchema,
  paginationQuerySchema,
} from '@vrumm/validation';

export const paymentIdParamSchema = z.object({
  paymentId: objectIdSchema,
});

export const rideIdParamSchema = z.object({
  rideId: objectIdSchema,
});

export const createPaymentOrderSchema = z.object({
  rideId: objectIdSchema,
  provider: paymentProviderSchema.optional().default('MOCK'),
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});

export const verifyPaymentSchema = z.object({
  paymentId: objectIdSchema,
  providerPaymentId: z.string().trim().min(1),
  providerSignature: z.string().trim().min(1),
});

export const simulateRefundSchema = z.object({
  reason: z.string().trim().min(5, 'A detailed reason is required for refund simulation').max(500),
});

export const queryPaymentsSchema = paginationQuerySchema.extend({
  status: paymentStatusSchema.optional(),
  customerUserId: objectIdSchema.optional(),
  captainUserId: objectIdSchema.optional(),
  rideId: objectIdSchema.optional(),
});
