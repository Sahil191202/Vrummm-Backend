import { z } from 'zod';

export const updateCustomerProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    phone: z
      .string()
      .regex(/^\+\d{10,15}$/, 'Phone must be in E.164 format e.g. +919876543210')
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const addSavedPlaceSchema = z.object({
  label: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(300),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

export const placeIdParamSchema = z.object({
  placeId: z.string().min(1),
});