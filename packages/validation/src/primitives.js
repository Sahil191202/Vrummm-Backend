import { z } from 'zod';
import {
  BOOKING_MODES,
  VEHICLE_TYPES,
  REVENUE_PLAN_TYPES,
  SUBSCRIPTION_BILLING_PERIODS,
  PAYMENT_STATUSES,
  PAYMENT_PROVIDERS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_ENTRY_TYPES,
  LEDGER_DIRECTIONS,
  PROMOTION_DISCOUNT_TYPES,
  INCENTIVE_TARGET_TYPES,
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
} from '@vrumm/contracts';

// Money: integer paise only. Never floats.
export const paiseSchema = z.number().int().safe().nonnegative();
export const positivePaiseSchema = z.number().int().safe().positive();

// Basis points for commission: 300 to 350 (3.00% to 3.50%)
export const commissionBpsSchema = z.number().int().min(300).max(350);

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character id');

export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);
export const bookingModeSchema = z.enum(BOOKING_MODES);

export const revenuePlanTypeSchema = z.enum(REVENUE_PLAN_TYPES);
export const subscriptionBillingPeriodSchema = z.enum(SUBSCRIPTION_BILLING_PERIODS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export const ledgerAccountTypeSchema = z.enum(LEDGER_ACCOUNT_TYPES);
export const ledgerEntryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);
export const ledgerDirectionSchema = z.enum(LEDGER_DIRECTIONS);

export const promotionDiscountTypeSchema = z.enum(PROMOTION_DISCOUNT_TYPES);
export const incentiveTargetTypeSchema = z.enum(INCENTIVE_TARGET_TYPES);
export const incidentTypeSchema = z.enum(INCIDENT_TYPES);
export const incidentSeveritySchema = z.enum(INCIDENT_SEVERITIES);
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export const supportTicketCategorySchema = z.enum(SUPPORT_TICKET_CATEGORIES);
export const supportTicketStatusSchema = z.enum(SUPPORT_TICKET_STATUSES);
export const supportTicketPrioritySchema = z.enum(SUPPORT_TICKET_PRIORITIES);

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
