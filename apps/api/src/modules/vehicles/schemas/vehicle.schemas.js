import { z } from 'zod';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const currentYear = new Date().getFullYear();

export const registerVehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(2000).max(currentYear + 1),
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/, 'Invalid Indian registration plate e.g. MH01AB1234'),
  color: z.string().trim().max(30).optional(),
});

export const updateVehicleSchema = z
  .object({
    make: z.string().trim().min(1).max(50).optional(),
    model: z.string().trim().min(1).max(50).optional(),
    year: z.coerce.number().int().min(2000).max(currentYear + 1).optional(),
    color: z.string().trim().max(30).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });