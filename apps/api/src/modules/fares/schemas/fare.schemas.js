import { z } from 'zod';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const paiseSchema = z.number().int().nonnegative();
const basisPointsSchema = z.number().int().min(0).max(5000); // max 50%

export const createFareConfigSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  zone: z.string().trim().min(1).max(50).default('mumbai'),
  effectiveFrom: z.string().datetime({ message: 'effectiveFrom must be ISO 8601' }),
  baseFarePaise: paiseSchema,
  perKmPaise: paiseSchema,
  perMinutePaise: paiseSchema,
  minimumFarePaise: paiseSchema,
  minimumBillableDistanceMetres: z.number().int().min(0),
  waitingGracePeriodMinutes: z.number().int().min(0).default(3),
  waitingChargePerMinutePaise: paiseSchema.default(0),
  surgeEnabled: z.boolean().default(false),
  surgeMultiplierMax: z.number().min(1.0).max(3.0).default(1.0),
  taxes: z
    .array(z.object({ label: z.string().trim().min(1), basisPoints: basisPointsSchema }))
    .default([]),
  reason: z.string().trim().min(1).max(500),
});

export const fareQuoteQuerySchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  pickupLng: z.coerce.number().min(-180).max(180),
  pickupLat: z.coerce.number().min(-90).max(90),
  dropLng: z.coerce.number().min(-180).max(180),
  dropLat: z.coerce.number().min(-90).max(90),
  zone: z.string().trim().min(1).max(50).default('mumbai'),
});

export const fareConfigIdParamSchema = z.object({
  configId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid config id'),
});

export const listFareConfigsQuerySchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  zone: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});