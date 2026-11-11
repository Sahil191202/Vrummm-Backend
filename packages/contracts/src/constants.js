export const API_BASE_PATH = '/api/v1';
export const REQUEST_ID_HEADER = 'x-request-id';
export const CURRENCY = 'INR';
export const TIME_ZONE_DISPLAY = 'Asia/Kolkata';
export const VEHICLE_TYPES = Object.freeze(['BIKE', 'AUTO', 'CAB']);
export const BOOKING_MODES = Object.freeze(['INSTANT', 'SCHEDULED']);

export const REVENUE_PLAN_TYPES = Object.freeze(['COMMISSION', 'SUBSCRIPTION']);
export const SUBSCRIPTION_BILLING_PERIODS = Object.freeze(['DAILY', 'WEEKLY', 'MONTHLY']);
export const PAYMENT_STATUSES = Object.freeze([
  'PENDING',
  'CAPTURED',
  'FAILED',
  'REFUNDED_SIMULATED',
]);
export const PAYMENT_PROVIDERS = Object.freeze(['MOCK', 'RAZORPAY']);
export const LEDGER_ACCOUNT_TYPES = Object.freeze(['CUSTOMER', 'CAPTAIN', 'PLATFORM']);
export const LEDGER_ENTRY_TYPES = Object.freeze([
  'FARE_COLLECTED',
  'COMMISSION_EARNED',
  'CAPTAIN_EARNING',
  'CAPTAIN_PAYOUT_SIMULATED',
  'ADJUSTMENT',
  'SUBSCRIPTION_FEE_SIMULATED',
]);
export const LEDGER_DIRECTIONS = Object.freeze(['CREDIT', 'DEBIT']);
