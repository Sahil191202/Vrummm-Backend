import { z } from 'zod';
import {
  objectIdSchema,
  positivePaiseSchema,
  ledgerAccountTypeSchema,
  ledgerEntryTypeSchema,
  ledgerDirectionSchema,
  paginationQuerySchema,
} from '@vrumm/validation';

export const queryLedgerSchema = paginationQuerySchema.extend({
  accountType: ledgerAccountTypeSchema.optional(),
  accountUserId: objectIdSchema.optional(),
  rideId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  entryType: ledgerEntryTypeSchema.optional(),
});

export const createAdjustmentSchema = z.object({
  accountUserId: objectIdSchema,
  accountType: ledgerAccountTypeSchema,
  direction: ledgerDirectionSchema,
  amountPaise: positivePaiseSchema,
  reason: z.string().trim().min(5, 'Reason is required for manual adjustments').max(500),
  description: z.string().trim().min(3).max(500),
});

export const simulatePayoutSchema = z.object({
  amountPaise: positivePaiseSchema,
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});
