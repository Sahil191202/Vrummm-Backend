// Pure functions — no DB, no side effects, fully testable.
// All inputs and outputs are integer paise unless stated.

import { haversineMetres } from '../../shared/haversine.js';

// Build a transparent fare breakdown from a config and trip inputs.
// distanceMetres: straight-line haversine distance of the passenger's route.
// durationMinutes: estimated trip duration (passed in; can be 0 for instant quote).
export function calculateFare({ config, distanceMetres, durationMinutes = 0 }) {
  const billableDistanceMetres = Math.max(
    distanceMetres,
    config.minimumBillableDistanceMetres,
  );
  const billableDistanceKm = billableDistanceMetres / 1000;

  const baseFare = config.baseFarePaise;
  const distanceCharge = Math.round(billableDistanceKm * config.perKmPaise);
  const timeCharge = Math.round(durationMinutes * config.perMinutePaise);

  let subtotal = baseFare + distanceCharge + timeCharge;

  // Apply minimum fare floor.
  const minimumApplied = subtotal < config.minimumFarePaise;
  if (minimumApplied) subtotal = config.minimumFarePaise;

  // Taxes applied to the subtotal.
  const taxLines = (config.taxes ?? []).map((t) => ({
    label: t.label,
    basisPoints: t.basisPoints,
    amountPaise: Math.round((subtotal * t.basisPoints) / 10000),
  }));
  const totalTaxPaise = taxLines.reduce((sum, t) => sum + t.amountPaise, 0);

  const totalPaise = subtotal + totalTaxPaise;

  return {
    breakdown: {
      baseFarePaise: baseFare,
      distanceCharge: { distanceMetres: billableDistanceMetres, ratePerKmPaise: config.perKmPaise, amountPaise: distanceCharge },
      timeCharge: { durationMinutes, ratePerMinutePaise: config.perMinutePaise, amountPaise: timeCharge },
      minimumApplied,
      subtotalPaise: subtotal,
      taxes: taxLines,
      totalTaxPaise,
    },
    totalPaise,
    // Snapshot the config version so this quote can be audited later.
    fareConfigVersion: config.version,
    fareConfigId: config._id,
  };
}

// Compute haversine distance between pickup and drop for a fare quote.
export function routeDistanceMetres(pickupCoordinates, dropCoordinates) {
  return haversineMetres(pickupCoordinates, dropCoordinates);
}