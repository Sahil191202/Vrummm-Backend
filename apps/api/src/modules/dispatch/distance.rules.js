import { haversineMetres } from '../../shared/haversine.js';
import { DISPATCH_CONFIG } from './dispatch.config.js';

// Rule A: captain must be within the configured max pickup radius.
// Returns { pass: bool, distanceMetres: number, reason?: string }
export function checkPickupRadius(captainCoordinates, pickupCoordinates, maxRadiusMetres) {
  const distanceMetres = haversineMetres(captainCoordinates, pickupCoordinates);
  if (distanceMetres <= maxRadiusMetres) {
    return { pass: true, distanceMetres };
  }
  return {
    pass: false,
    distanceMetres,
    reason: `captain is ${Math.round(distanceMetres)}m from pickup, exceeds radius of ${maxRadiusMetres}m`,
  };
}

// Rule B (experimental): captain-to-drop must be farther than captain-to-pickup.
// The idea: captains closer to the drop than to the pickup are heading in the wrong direction.
// Returns { pass: bool, distanceToDropMetres: number, reason?: string }
export function checkRelativeDistance(
  captainCoordinates,
  pickupCoordinates,
  dropCoordinates,
  vehicleType,
) {
  const enabled = DISPATCH_CONFIG.distanceRuleBEnabled[vehicleType] ?? false;
  const distanceToPickup = haversineMetres(captainCoordinates, pickupCoordinates);
  const distanceToDrop = haversineMetres(captainCoordinates, dropCoordinates);

  if (!enabled) {
    return { pass: true, distanceToDropMetres: distanceToDrop, ruleEnabled: false };
  }

  if (distanceToDrop > distanceToPickup) {
    return { pass: true, distanceToDropMetres: distanceToDrop, ruleEnabled: true };
  }

  return {
    pass: false,
    distanceToDropMetres: distanceToDrop,
    ruleEnabled: true,
    reason: `captain is closer to drop (${Math.round(distanceToDrop)}m) than pickup (${Math.round(distanceToPickup)}m)`,
  };
}

// Combine both rules. Returns { eligible, distanceToPickupMetres, distanceToDropMetres, reason? }
export function evaluateCaptainEligibility(
  captainCoordinates,
  pickupCoordinates,
  dropCoordinates,
  vehicleType,
  maxRadiusMetres,
) {
  const ruleA = checkPickupRadius(captainCoordinates, pickupCoordinates, maxRadiusMetres);
  if (!ruleA.pass) {
    return {
      eligible: false,
      distanceToPickupMetres: Math.round(ruleA.distanceMetres),
      distanceToDropMetres: null,
      reason: ruleA.reason,
      failedRule: 'A',
    };
  }

  const ruleB = checkRelativeDistance(
    captainCoordinates,
    pickupCoordinates,
    dropCoordinates,
    vehicleType,
  );
  if (!ruleB.pass) {
    return {
      eligible: false,
      distanceToPickupMetres: Math.round(ruleA.distanceMetres),
      distanceToDropMetres: Math.round(ruleB.distanceToDropMetres),
      reason: ruleB.reason,
      failedRule: 'B',
    };
  }

  return {
    eligible: true,
    distanceToPickupMetres: Math.round(ruleA.distanceMetres),
    distanceToDropMetres: Math.round(ruleB.distanceToDropMetres),
  };
}