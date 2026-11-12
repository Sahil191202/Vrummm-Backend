import mongoose from 'mongoose';
import { IncentiveCampaign } from './schemas/incentiveCampaign.schema.js';
import { IncentiveAward } from './schemas/incentiveAward.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';

export function createIncentiveService({ ledgerService }) {
  async function createCampaign(data, actorUserId) {
    const campaign = await IncentiveCampaign.create({
      ...data,
      createdBy: actorUserId,
    });
    return campaign;
  }

  async function listCampaigns(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (filter.targetType) query.targetType = filter.targetType;
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;

    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      IncentiveCampaign.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      IncentiveCampaign.countDocuments(query),
    ]);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getCampaignById(campaignId) {
    const campaign = await IncentiveCampaign.findById(campaignId);
    if (!campaign) throw errors.notFound('Incentive campaign not found');
    return campaign;
  }

  async function checkAndAwardIncentive({
    campaignId,
    captainId,
    captainUserId,
    periodKey,
    progressCount,
    actorUserId,
  }) {
    const campaign = await IncentiveCampaign.findById(campaignId);
    if (!campaign || !campaign.isActive) {
      throw errors.notFound('Active incentive campaign not found');
    }

    const now = new Date();
    if (now > campaign.expiresAt || (campaign.startsAt && now < campaign.startsAt)) {
      throw errors.businessRule('Incentive campaign is not currently active');
    }

    if (progressCount < campaign.targetCount) {
      return {
        awarded: false,
        reason: 'Target count not yet reached',
        progressCount,
        targetCount: campaign.targetCount,
      };
    }

    const idempotencyKey = `incentive:${campaignId}:${captainId}:${periodKey}`;

    // Check if already awarded (idempotency check)
    const existing = await IncentiveAward.findOne({ idempotencyKey });
    if (existing) {
      return {
        awarded: true,
        alreadyAwarded: true,
        award: existing,
      };
    }

    const session = await mongoose.startSession();
    let awardDoc;

    try {
      await session.withTransaction(async () => {
        const [created] = await IncentiveAward.create(
          [
            {
              campaignId,
              captainId,
              captainUserId,
              periodKey,
              rewardAmountPaise: campaign.rewardAmountPaise,
              idempotencyKey,
            },
          ],
          { session },
        );
        awardDoc = created;

        // Credit captain balance
        await Captain.updateOne(
          { _id: captainId },
          { $inc: { totalEarnedPaise: campaign.rewardAmountPaise } },
          { session },
        );

        // Record credit in append-only ledger
        if (ledgerService) {
          await ledgerService.createAdjustment({
            accountUserId: captainUserId,
            accountType: 'CAPTAIN',
            direction: 'CREDIT',
            amountPaise: campaign.rewardAmountPaise,
            reason: `Automated incentive reward: ${campaign.name} for period ${periodKey}`,
            description: `Incentive reward: ${campaign.name}`,
            actorUserId: actorUserId ?? captainUserId,
            session,
          });
        }
      });
    } finally {
      await session.endSession();
    }

    return {
      awarded: true,
      alreadyAwarded: false,
      award: awardDoc,
    };
  }

  async function listCaptainAwards(captainId) {
    return IncentiveAward.find({ captainId }).sort({ awardedAt: -1 });
  }

  return {
    createCampaign,
    listCampaigns,
    getCampaignById,
    checkAndAwardIncentive,
    listCaptainAwards,
  };
}
