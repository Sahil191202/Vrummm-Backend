import { z } from 'zod';
import {
  objectIdSchema,
  incidentTypeSchema,
  incidentSeveritySchema,
  incidentStatusSchema,
  supportTicketCategorySchema,
  supportTicketStatusSchema,
  supportTicketPrioritySchema,
  paginationQuerySchema,
} from '@vrumm/validation';

export const incidentIdParamSchema = z.object({
  incidentId: objectIdSchema,
});

export const ticketIdParamSchema = z.object({
  ticketId: objectIdSchema,
});

export const tokenParamSchema = z.object({
  token: z.string().trim().min(16).max(64),
});

export const triggerSosSchema = z.object({
  rideId: objectIdSchema,
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
  description: z.string().trim().max(500).optional(),
});

export const createIncidentSchema = z.object({
  rideId: objectIdSchema.optional(),
  type: incidentTypeSchema,
  severity: incidentSeveritySchema.default('MEDIUM'),
  description: z.string().trim().min(5).max(1000),
});

export const resolveIncidentSchema = z.object({
  status: incidentStatusSchema,
  resolutionNotes: z.string().trim().min(5).max(1000),
});

export const createTripShareSchema = z.object({
  rideId: objectIdSchema,
  ttlHours: z.number().int().min(1).max(72).default(24),
});

export const createSupportTicketSchema = z.object({
  rideId: objectIdSchema.optional(),
  subject: z.string().trim().min(3).max(200),
  category: supportTicketCategorySchema.default('OTHER'),
  priority: supportTicketPrioritySchema.default('NORMAL'),
  message: z.string().trim().min(5).max(2000),
});

export const addTicketMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const updateTicketStatusSchema = z.object({
  status: supportTicketStatusSchema,
});

export const queryIncidentsSchema = paginationQuerySchema.extend({
  status: incidentStatusSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  type: incidentTypeSchema.optional(),
  rideId: objectIdSchema.optional(),
});

export const querySupportTicketsSchema = paginationQuerySchema.extend({
  status: supportTicketStatusSchema.optional(),
  category: supportTicketCategorySchema.optional(),
  priority: supportTicketPrioritySchema.optional(),
  userId: objectIdSchema.optional(),
});
