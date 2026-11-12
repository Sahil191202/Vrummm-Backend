import { z } from 'zod';
import {
  objectIdSchema,
  positivePaiseSchema,
  incentiveTargetTypeSchema,
  paginationQuerySchema,
} from '@vrumm/validation';

export const campaignIdParamSchema = z.object({
  campaignId: objectIdSchema,
});

export const createIncentiveCampaignSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  targetType: incentiveTargetTypeSchema,
  targetCount: z.number().int().positive(),
  rewardAmountPaise: positivePaiseSchema,
  startsAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }),
});

export const evaluateIncentiveSchema = z.object({
  campaignId: objectIdSchema,
  periodKey: z.string().trim().min(3).max(50),
  progressCount: z.number().int().nonnegative(),
});

export const queryCampaignsSchema = paginationQuerySchema.extend({
  targetType: incentiveTargetTypeSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
