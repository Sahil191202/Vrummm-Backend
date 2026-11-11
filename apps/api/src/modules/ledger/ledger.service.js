import { LedgerEntry } from './schemas/ledgerEntry.schema.js';
import { errors } from '../../shared/AppError.js';

export function createLedgerService() {
  async function recordRideSettlement({
    rideId,
    paymentId,
    customerUserId,
    captainUserId,
    totalFarePaise,
    commissionPaise,
    captainEarningsPaise,
    session = null,
    actorUserId,
  }) {
    if (!Number.isInteger(totalFarePaise) || totalFarePaise <= 0) {
      throw errors.badRequest('totalFarePaise must be a positive integer in paise');
    }
    if (commissionPaise + captainEarningsPaise !== totalFarePaise) {
      throw errors.businessRule(
        `Accounting imbalance: commission (${commissionPaise}) + captain earnings (${captainEarningsPaise}) does not equal total fare (${totalFarePaise})`,
      );
    }

    const baseEntries = [
      // 1. Customer pays total fare
      {
        rideId,
        paymentId,
        accountType: 'CUSTOMER',
        accountUserId: customerUserId,
        entryType: 'FARE_COLLECTED',
        direction: 'DEBIT',
        amountPaise: totalFarePaise,
        idempotencyKey: `settle:${paymentId}:customer_fare`,
        description: `Fare payment for ride ${rideId}`,
        postedByUserId: actorUserId ?? customerUserId,
      },
      // 2. Platform collects total fare into platform clearing
      {
        rideId,
        paymentId,
        accountType: 'PLATFORM',
        accountUserId: actorUserId ?? customerUserId,
        entryType: 'FARE_COLLECTED',
        direction: 'CREDIT',
        amountPaise: totalFarePaise,
        idempotencyKey: `settle:${paymentId}:platform_clearing`,
        description: `Fare clearing for ride ${rideId}`,
        postedByUserId: actorUserId ?? customerUserId,
      },
      // 3. Captain earns net fare
      {
        rideId,
        paymentId,
        accountType: 'CAPTAIN',
        accountUserId: captainUserId,
        entryType: 'CAPTAIN_EARNING',
        direction: 'CREDIT',
        amountPaise: captainEarningsPaise,
        idempotencyKey: `settle:${paymentId}:captain_earning`,
        description: `Net earnings for ride ${rideId}`,
        postedByUserId: actorUserId ?? customerUserId,
      },
    ];

    if (commissionPaise > 0) {
      // 4. Platform recognizes commission earned
      baseEntries.push({
        rideId,
        paymentId,
        accountType: 'PLATFORM',
        accountUserId: actorUserId ?? customerUserId,
        entryType: 'COMMISSION_EARNED',
        direction: 'CREDIT',
        amountPaise: commissionPaise,
        idempotencyKey: `settle:${paymentId}:platform_commission`,
        description: `Platform commission for ride ${rideId}`,
        postedByUserId: actorUserId ?? customerUserId,
      });
    }

    // Insert entries with idempotency: ignore duplicate key error if already settled
    const createdEntries = [];
    for (const entry of baseEntries) {
      try {
        const [doc] = await LedgerEntry.create([entry], { session });
        createdEntries.push(doc);
      } catch (err) {
        if (err.code === 11000) {
          // Idempotent duplicate — already posted
          continue;
        }
        throw err;
      }
    }

    return createdEntries;
  }

  async function createAdjustment({
    accountUserId,
    accountType,
    direction,
    amountPaise,
    reason,
    description,
    actorUserId,
    rideId = null,
    paymentId = null,
    session = null,
  }) {
    if (!reason || reason.trim().length < 5) {
      throw errors.badRequest(
        'A detailed reason (at least 5 characters) is required for adjustments',
      );
    }

    const [entry] = await LedgerEntry.create(
      [
        {
          rideId,
          paymentId,
          accountType,
          accountUserId,
          entryType: 'ADJUSTMENT',
          direction,
          amountPaise,
          auditReason: reason,
          description,
          postedByUserId: actorUserId,
        },
      ],
      { session },
    );

    return entry;
  }

  async function recordSimulatedPayout({
    captainUserId,
    amountPaise,
    actorUserId,
    idempotencyKey = null,
    session = null,
  }) {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw errors.badRequest('amountPaise must be a positive integer in paise');
    }

    // Check available balance
    const currentBalance = await getAccountBalance(captainUserId, 'CAPTAIN');
    if (currentBalance < amountPaise) {
      throw errors.businessRule(
        `Insufficient balance. Available: ${currentBalance} paise, requested: ${amountPaise} paise`,
      );
    }

    const payoutKey = idempotencyKey ?? `payout:${captainUserId}:${Date.now()}`;

    const [captainEntry] = await LedgerEntry.create(
      [
        {
          accountType: 'CAPTAIN',
          accountUserId: captainUserId,
          entryType: 'CAPTAIN_PAYOUT_SIMULATED',
          direction: 'DEBIT',
          amountPaise,
          idempotencyKey: payoutKey,
          description: `Simulated payout of ${amountPaise} paise (learning project only, no real money)`,
          postedByUserId: actorUserId ?? captainUserId,
          metadata: { isSimulated: true },
        },
      ],
      { session },
    );

    return captainEntry;
  }

  async function getAccountBalance(accountUserId, accountType) {
    const entries = await LedgerEntry.find({ accountUserId, accountType });
    let balance = 0;
    for (const e of entries) {
      if (e.direction === 'CREDIT') balance += e.amountPaise;
      else if (e.direction === 'DEBIT') balance -= e.amountPaise;
    }
    return balance;
  }

  async function listEntries(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (filter.accountType) query.accountType = filter.accountType;
    if (filter.accountUserId) query.accountUserId = filter.accountUserId;
    if (filter.rideId) query.rideId = filter.rideId;
    if (filter.paymentId) query.paymentId = filter.paymentId;
    if (filter.entryType) query.entryType = filter.entryType;

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      LedgerEntry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LedgerEntry.countDocuments(query),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  return {
    recordRideSettlement,
    createAdjustment,
    recordSimulatedPayout,
    getAccountBalance,
    listEntries,
  };
}
