// All dispatch tunables in one place. Exposed via admin settings in Phase 8.
// Values here are the hard-coded defaults.

export const DISPATCH_CONFIG = Object.freeze({
  // How long each offer round stays open (seconds).
  offerDurationSeconds: 10,

  // Initial search radius per vehicle type (metres).
  initialRadiusMetres: {
    BIKE: 2000,
    AUTO: 3000,
    CAB: 4000,
  },

  // Radius expansion steps. Each attempt adds this many metres.
  radiusExpansionMetres: {
    BIKE: 1000,
    AUTO: 1500,
    CAB: 2000,
  },

  // Maximum search radius (metres). Search stops here even if no captain found.
  maxRadiusMetres: {
    BIKE: 6000,
    AUTO: 8000,
    CAB: 10000,
  },

  // Maximum number of dispatch rounds before giving up.
  maxRounds: 3,

  // Distance rule B: captain-to-drop must be > captain-to-pickup.
  // This is an experimental product requirement. Configurable per vehicle type.
  // Set to false to disable for a vehicle type.
  distanceRuleBEnabled: {
    BIKE: true,
    AUTO: true,
    CAB: false, // Cabs are exempt by default.
  },

  // Scheduled ride: how many minutes before scheduledFor to open the dispatch window.
  scheduledDispatchWindowMinutes: 15,

  // Scheduled worker: poll interval (ms).
  scheduledWorkerPollIntervalMs: 30_000,

  // Worker lock TTL (seconds). If a worker holds a lock longer than this, it is dead.
  workerLockTtlSeconds: 120,
});