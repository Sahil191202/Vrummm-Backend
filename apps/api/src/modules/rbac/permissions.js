// Single source of truth for every permission string.
export const PERMISSIONS = Object.freeze({
  RIDES_READ: 'rides.read',
  RIDES_RESOLVE: 'rides.resolve',
  CAPTAINS_READ: 'captains.read',
  CAPTAINS_APPROVE: 'captains.approve',
  DOCUMENTS_REVIEW: 'documents.review',
  FARES_READ: 'fares.read',
  FARES_WRITE: 'fares.write',
  REVENUE_PLANS_READ: 'revenuePlans.read',
  REVENUE_PLANS_WRITE: 'revenuePlans.write',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_REFUND_SIMULATE: 'payments.refund.simulate',
  PROMOTIONS_READ: 'promotions.read',
  PROMOTIONS_WRITE: 'promotions.write',
  INCIDENTS_READ: 'incidents.read',
  INCIDENTS_RESOLVE: 'incidents.resolve',
  AUDIT_READ: 'audit.read',
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
});

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATIONS: 'OPERATIONS',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  MARKETING: 'MARKETING',
  COMPLIANCE: 'COMPLIANCE',
  CUSTOMER: 'CUSTOMER',
  CAPTAIN: 'CAPTAIN',
});

const P = PERMISSIONS;
const R = ROLES;

export const ROLE_PERMISSIONS = Object.freeze({
  [R.SUPER_ADMIN]: new Set(Object.values(P)),
  [R.OPERATIONS]: new Set([
    P.RIDES_READ,
    P.RIDES_RESOLVE,
    P.CAPTAINS_READ,
    P.CAPTAINS_APPROVE,
    P.DOCUMENTS_REVIEW,
    P.FARES_READ,
    P.FARES_WRITE,
    P.REVENUE_PLANS_READ,
    P.REVENUE_PLANS_WRITE,
    P.INCIDENTS_READ,
    P.INCIDENTS_RESOLVE,
    P.SETTINGS_READ,
    P.SETTINGS_WRITE,
    P.USERS_READ,
    P.AUDIT_READ,
  ]),
  [R.SUPPORT]: new Set([
    P.RIDES_READ,
    P.RIDES_RESOLVE,
    P.CAPTAINS_READ,
    P.INCIDENTS_READ,
    P.INCIDENTS_RESOLVE,
    P.USERS_READ,
  ]),
  [R.FINANCE]: new Set([
    P.PAYMENTS_READ,
    P.PAYMENTS_REFUND_SIMULATE,
    P.REVENUE_PLANS_READ,
    P.RIDES_READ,
    P.AUDIT_READ,
  ]),
  [R.MARKETING]: new Set([P.PROMOTIONS_READ, P.PROMOTIONS_WRITE, P.RIDES_READ]),
  [R.COMPLIANCE]: new Set([P.DOCUMENTS_REVIEW, P.CAPTAINS_READ, P.AUDIT_READ, P.RIDES_READ]),
  [R.CUSTOMER]: new Set(),
  [R.CAPTAIN]: new Set(),
});

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
