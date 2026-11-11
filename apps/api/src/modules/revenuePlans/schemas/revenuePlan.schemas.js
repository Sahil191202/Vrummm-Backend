import { z } from 'zod';
import {
  objectIdSchema,
  revenuePlanTypeSchema,
  subscriptionBillingPeriodSchema,
  commissionBpsSchema,
  positivePaiseSchema,
} from '@vrumm/validation';

export const planIdParamSchema = z.object({
  planId: objectIdSchema,
});

export const createRevenuePlanSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    type: revenuePlanTypeSchema,
    commissionBps: commissionBpsSchema.optional(),
    subscriptionPricePaise: positivePaiseSchema.optional(),
    subscriptionBillingPeriod: subscriptionBillingPeriodSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'COMMISSION') {
      if (data.commissionBps === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commissionBps'],
          message:
            'commissionBps is required for COMMISSION plans and must be between 300 and 350 (3.00% to 3.50%)',
        });
      }
    } else if (data.type === 'SUBSCRIPTION') {
      if (data.subscriptionPricePaise === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subscriptionPricePaise'],
          message: 'subscriptionPricePaise is required for SUBSCRIPTION plans',
        });
      }
    }
  });

export const updateRevenuePlanSchema = z.object({
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const assignPlanSchema = z.object({
  planId: objectIdSchema,
  effectiveFrom: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine((v) => !v || new Date(v).getTime() >= Date.now() - 60_000, {
      message: 'effectiveFrom cannot be in the past',
    }),
});
