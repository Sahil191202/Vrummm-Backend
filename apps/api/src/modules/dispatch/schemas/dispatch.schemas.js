import { z } from 'zod';

export const offerIdParamSchema = z.object({
  offerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid offer id'),
});

export const bookingIdParamSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid booking id'),
});