import { z } from 'zod';
import { BOOKING_MODES, VEHICLE_TYPES } from '@vrumm/contracts';

// Money: integer paise only. Never floats.
export const paiseSchema = z.number().int().safe().nonnegative();

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character id');

export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);
export const bookingModeSchema = z.enum(BOOKING_MODES);

// GeoJSON Point. Coordinates are [longitude, latitude].
export const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90), // latitude
  ]),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});
