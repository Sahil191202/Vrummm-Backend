import { z } from 'zod';
import {
  objectIdSchema,
  paiseSchema,
  positivePaiseSchema,
  vehicleTypeSchema,
  promotionDiscountTypeSchema,
  paginationQuerySchema,
} from '@vrumm/validation';
import { VEHICLE_TYPES } from '@vrumm/contracts';

export const promotionIdParamSchema = z.object({
  promotionId: objectIdSchema,
});

export const createPromotionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(20)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'Code must contain only alphanumeric characters, dashes, or underscores',
      )
      .transform((c) => c.toUpperCase()),
    description: z.string().trim().max(300).optional(),
    discountType: promotionDiscountTypeSchema,
    discountValue: z.number().positive(),
    maxDiscountPaise: positivePaiseSchema.optional(),
    minRideFarePaise: paiseSchema.default(0),
    firstRideOnly: z.boolean().default(false),
    allowedVehicleTypes: z.array(vehicleTypeSchema).default(VEHICLE_TYPES),
    maxTotalRedemptions: z.number().int().positive().optional(),
    maxPerUserRedemptions: z.number().int().positive().default(1),
    startsAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'PERCENTAGE') {
      if (data.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountValue'],
          message: 'Percentage discount cannot exceed 100%',
        });
      }
    } else if (data.discountType === 'FLAT') {
      if (!Number.isInteger(data.discountValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountValue'],
          message: 'Flat discount must be an integer in paise',
        });
      }
    }
    if (data.startsAt && new Date(data.startsAt) >= new Date(data.expiresAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'expiresAt must be after startsAt',
      });
    }
  });

export const applyPromotionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .transform((c) => c.toUpperCase()),
  rideFarePaise: positivePaiseSchema,
  vehicleType: vehicleTypeSchema,
  rideId: objectIdSchema.optional(),
});

export const queryPromotionsSchema = paginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
