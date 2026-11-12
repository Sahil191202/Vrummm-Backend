import { Ride } from '../rides/schemas/ride.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Payment } from '../payments/schemas/payment.schema.js';
import { LedgerEntry } from '../ledger/schemas/ledgerEntry.schema.js';
import { Incident } from '../safety/schemas/incident.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';

export function createAdminService() {
  async function getOperationsSummary({ from, to } = {}) {
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    const [
      totalBookings,
      searchingBookings,
      totalRides,
      completedRides,
      cancelledRides,
      customerCancelled,
      captainCancelled,
      systemCancelled,
      openIncidents,
      criticalIncidents,
      activeRides,
    ] = await Promise.all([
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ ...dateFilter, status: 'SEARCHING' }),
      Ride.countDocuments(dateFilter),
      Ride.countDocuments({ ...dateFilter, status: 'COMPLETED' }),
      Ride.countDocuments({ ...dateFilter, status: 'CANCELLED' }),
      Ride.countDocuments({ ...dateFilter, status: 'CANCELLED', cancelledBy: 'CUSTOMER' }),
      Ride.countDocuments({ ...dateFilter, status: 'CANCELLED', cancelledBy: 'CAPTAIN' }),
      Ride.countDocuments({ ...dateFilter, status: 'CANCELLED', cancelledBy: 'SYSTEM' }),
      Incident.countDocuments({ status: { $in: ['REPORTED', 'INVESTIGATING'] } }),
      Incident.countDocuments({
        status: { $in: ['REPORTED', 'INVESTIGATING'] },
        severity: 'CRITICAL',
      }),
      Ride.countDocuments({ status: { $in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }),
    ]);

    const completionRate =
      totalRides > 0 ? Math.round((completedRides / totalRides) * 1000) / 10 : 0;

    return {
      period: { from: from ?? null, to: to ?? null },
      bookings: {
        total: totalBookings,
        currentlySearching: searchingBookings,
      },
      rides: {
        total: totalRides,
        active: activeRides,
        completed: completedRides,
        cancelled: cancelledRides,
        completionRatePercentage: completionRate,
        cancellationBreakdown: {
          customer: customerCancelled,
          captain: captainCancelled,
          system: systemCancelled,
        },
      },
      safety: {
        openIncidents,
        criticalIncidents,
      },
    };
  }

  async function getFinancialSummary({ from, to } = {}) {
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    // Aggregate payments & ledger entries
    const [capturedPayments, refundedPayments, ledgerEntries] = await Promise.all([
      Payment.find({ ...dateFilter, status: 'CAPTURED' }),
      Payment.find({ ...dateFilter, status: 'REFUNDED_SIMULATED' }),
      LedgerEntry.find(dateFilter),
    ]);

    let grossBookingValuePaise = 0;
    for (const p of capturedPayments) {
      grossBookingValuePaise += p.amountPaise;
    }

    let simulatedRefundsPaise = 0;
    for (const p of refundedPayments) {
      simulatedRefundsPaise += p.amountPaise;
    }

    let platformCommissionPaise = 0;
    let captainEarningsPaise = 0;
    let simulatedPayoutsPaise = 0;

    for (const e of ledgerEntries) {
      if (e.entryType === 'COMMISSION_EARNED' && e.direction === 'CREDIT') {
        platformCommissionPaise += e.amountPaise;
      } else if (e.entryType === 'CAPTAIN_EARNING' && e.direction === 'CREDIT') {
        captainEarningsPaise += e.amountPaise;
      } else if (e.entryType === 'CAPTAIN_PAYOUT_SIMULATED' && e.direction === 'DEBIT') {
        simulatedPayoutsPaise += e.amountPaise;
      }
    }

    return {
      period: { from: from ?? null, to: to ?? null },
      currency: 'INR',
      grossBookingValue: {
        paise: grossBookingValuePaise,
        rupees: grossBookingValuePaise / 100,
      },
      platformCommission: {
        paise: platformCommissionPaise,
        rupees: platformCommissionPaise / 100,
      },
      captainNetEarnings: {
        paise: captainEarningsPaise,
        rupees: captainEarningsPaise / 100,
      },
      simulatedRefunds: {
        paise: simulatedRefundsPaise,
        rupees: simulatedRefundsPaise / 100,
      },
      simulatedPayouts: {
        paise: simulatedPayoutsPaise,
        rupees: simulatedPayoutsPaise / 100,
      },
    };
  }

  async function getCaptainLeaderboard({ limit = 10 } = {}) {
    const captains = await Captain.find({ approvalStatus: 'APPROVED' })
      .sort({ totalRides: -1, totalEarnedPaise: -1 })
      .limit(limit)
      .populate('userId', 'displayName email phone');

    return captains.map((c, index) => ({
      rank: index + 1,
      captainId: c._id,
      name: c.userId?.displayName || 'Unknown',
      vehicleType: c.vehicleType,
      totalRides: c.totalRides || 0,
      totalEarnedPaise: c.totalEarnedPaise || 0,
      totalEarnedRupees: (c.totalEarnedPaise || 0) / 100,
      rating: c.rating,
      isOnline: c.isOnline,
    }));
  }

  return {
    getOperationsSummary,
    getFinancialSummary,
    getCaptainLeaderboard,
  };
}
