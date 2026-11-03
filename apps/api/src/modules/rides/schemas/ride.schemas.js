import { z } from 'zod';

export const rideIdParamSchema = z.object({
  rideId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ride id'),
});

export const verifyPinSchema = z.object({
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const locationSampleSchema = z.object({
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
  recordedAt: z.string().datetime({ message: 'recordedAt must be ISO 8601' }),
});

export const completeRideSchema = z.object({
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
});

export const cancelRideSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});