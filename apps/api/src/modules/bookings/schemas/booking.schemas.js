import { z } from 'zod';
import { VEHICLE_TYPES, BOOKING_MODES } from '@vrumm/contracts';

const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180), // longitude
  z.number().min(-90).max(90),   // latitude
]);

const locationSchema = z.object({
  coordinates: coordinatesSchema,
  address: z.string().trim().min(1).max(300).optional(),
});

export const createBookingSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/, 'idempotencyKey must be alphanumeric with _ and - only'),
    vehicleType: z.enum(VEHICLE_TYPES),
    mode: z.enum(BOOKING_MODES).default('INSTANT'),
    pickup: locationSchema,
    drop: locationSchema,
    zone: z.string().trim().min(1).max(50).default('mumbai'),
    // Required for SCHEDULED bookings
    scheduledFor: z.string().datetime().optional(),
  })
  .refine(
    (d) => d.mode !== 'SCHEDULED' || d.scheduledFor,
    { message: 'scheduledFor is required for SCHEDULED bookings', path: ['scheduledFor'] },
  )
  .refine(
    (d) => {
      if (!d.scheduledFor) return true;
      return new Date(d.scheduledFor) > new Date(Date.now() + 30 * 60 * 1000);
    },
    { message: 'scheduledFor must be at least 30 minutes in the future', path: ['scheduledFor'] },
  );

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

export const bookingIdParamSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid booking id'),
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_CAPTAIN'])
    .optional(),
});