import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminService } from '../admin.service.js';

vi.mock('../../rides/schemas/ride.schema.js', () => ({
  Ride: {
    countDocuments: vi.fn(async (filter = {}) => {
      if (filter.status === 'COMPLETED') return 80;
      if (filter.status === 'CANCELLED') {
        if (filter.cancelledBy === 'CUSTOMER') return 15;
        if (filter.cancelledBy === 'CAPTAIN') return 5;
        return 20;
      }
      if (filter.status?.$in) return 10; // active rides
      return 100; // total rides
    }),
  },
}));

vi.mock('../../bookings/schemas/booking.schema.js', () => ({
  Booking: {
    countDocuments: vi.fn(async (filter = {}) => {
      if (filter.status === 'SEARCHING') return 5;
      return 110;
    }),
  },
}));

vi.mock('../../payments/schemas/payment.schema.js', () => ({
  Payment: {
    find: vi.fn(async (filter = {}) => {
      if (filter.status === 'CAPTURED') {
        return [{ amountPaise: 10000 }, { amountPaise: 20000 }];
      }
      if (filter.status === 'REFUNDED_SIMULATED') {
        return [{ amountPaise: 5000 }];
      }
      return [];
    }),
  },
}));

vi.mock('../../ledger/schemas/ledgerEntry.schema.js', () => ({
  LedgerEntry: {
    find: vi.fn(async () => [
      { entryType: 'COMMISSION_EARNED', direction: 'CREDIT', amountPaise: 1050 },
      { entryType: 'CAPTAIN_EARNING', direction: 'CREDIT', amountPaise: 28950 },
      { entryType: 'CAPTAIN_PAYOUT_SIMULATED', direction: 'DEBIT', amountPaise: 15000 },
    ]),
  },
}));

vi.mock('../../safety/schemas/incident.schema.js', () => ({
  Incident: {
    countDocuments: vi.fn(async (filter = {}) => {
      if (filter.severity === 'CRITICAL') return 1;
      return 3;
    }),
  },
}));

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: {
    find: vi.fn(() => ({
      sort: () => ({
        limit: () => ({
          populate: vi.fn(async () => [
            {
              _id: 'c1',
              vehicleType: 'BIKE',
              totalRides: 150,
              totalEarnedPaise: 150000,
              rating: 4.9,
              isOnline: true,
              userId: { displayName: 'Ramesh Pilot' },
            },
          ]),
        }),
      }),
    })),
  },
}));

const service = createAdminService();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getOperationsSummary', () => {
  it('aggregates ride counts, completion rate, and cancellations', async () => {
    const summary = await service.getOperationsSummary();

    expect(summary.rides.total).toBe(100);
    expect(summary.rides.completed).toBe(80);
    expect(summary.rides.cancelled).toBe(20);
    expect(summary.rides.completionRatePercentage).toBe(80);
    expect(summary.rides.cancellationBreakdown.customer).toBe(15);
    expect(summary.rides.cancellationBreakdown.captain).toBe(5);
    expect(summary.bookings.total).toBe(110);
    expect(summary.safety.openIncidents).toBe(3);
    expect(summary.safety.criticalIncidents).toBe(1);
  });
});

describe('getFinancialSummary', () => {
  it('aggregates gross booking value, commissions, net captain earnings, and refunds', async () => {
    const summary = await service.getFinancialSummary();

    expect(summary.currency).toBe('INR');
    expect(summary.grossBookingValue.paise).toBe(30000);
    expect(summary.grossBookingValue.rupees).toBe(300);
    expect(summary.platformCommission.paise).toBe(1050);
    expect(summary.captainNetEarnings.paise).toBe(28950);
    expect(summary.simulatedRefunds.paise).toBe(5000);
    expect(summary.simulatedPayouts.paise).toBe(15000);
  });
});

describe('getCaptainLeaderboard', () => {
  it('ranks captains by completed rides and earnings', async () => {
    const leaderboard = await service.getCaptainLeaderboard({ limit: 10 });

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].name).toBe('Ramesh Pilot');
    expect(leaderboard[0].totalRides).toBe(150);
    expect(leaderboard[0].totalEarnedRupees).toBe(1500);
  });
});
