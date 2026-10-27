import { z } from 'zod';
import { VEHICLE_TYPES } from '@vrumm/contracts';

export const updateCaptainProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    phone: z
      .string()
      .regex(/^\+\d{10,15}$/, 'Phone must be in E.164 format e.g. +919876543210')
      .optional(),
    vehicleType: z.enum(VEHICLE_TYPES).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const setAvailabilitySchema = z.object({
  isOnline: z.boolean(),
});

export const captainIdParamSchema = z.object({
  captainId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid captain id'),
});

export const setApprovalStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const listCaptainsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
});