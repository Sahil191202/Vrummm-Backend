import { RevenuePlan } from './schemas/revenuePlan.schema.js';
import { CaptainPlanAssignment } from './schemas/captainPlanAssignment.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';

const DEFAULT_COMMISSION_BPS = 300; // 3.00% default fallback if no plan is assigned

export function createRevenuePlanService() {
  async function createPlan(data, actorUserId) {
    const plan = await RevenuePlan.create({
      ...data,
      createdBy: actorUserId,
    });
    return plan;
  }

  async function listPlans(query = {}) {
    const filter = {};
    if (query.type) filter.type = query.type;
    if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
    return RevenuePlan.find(filter).sort({ createdAt: -1 });
  }

  async function getPlanById(planId) {
    const plan = await RevenuePlan.findById(planId);
    if (!plan) throw errors.notFound('Revenue plan not found');
    return plan;
  }

  async function updatePlan(planId, data) {
    const plan = await RevenuePlan.findByIdAndUpdate(
      planId,
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!plan) throw errors.notFound('Revenue plan not found');
    return plan;
  }

  async function selectCaptainPlan(
    captainId,
    planId,
    { effectiveFrom = new Date() } = {},
    session = null,
  ) {
    const query = RevenuePlan.findById(planId);
    if (session) query.session(session);
    const plan = await query;
    if (!plan) throw errors.notFound('Revenue plan not found');
    if (!plan.isActive) throw errors.businessRule('Cannot assign an inactive revenue plan');

    const effectiveDate = new Date(effectiveFrom);

    const snapshot = {
      name: plan.name,
      type: plan.type,
      commissionBps: plan.commissionBps,
      subscriptionPricePaise: plan.subscriptionPricePaise,
      subscriptionBillingPeriod: plan.subscriptionBillingPeriod,
    };

    // Supersede any previously active plan assignments for this captain
    await CaptainPlanAssignment.updateMany(
      {
        captainId,
        status: 'ACTIVE',
      },
      {
        $set: {
          effectiveTo: effectiveDate,
          status: 'SUPERSEDED',
        },
      },
      { session },
    );

    const [assignment] = await CaptainPlanAssignment.create(
      [
        {
          captainId,
          planId,
          planSnapshot: snapshot,
          effectiveFrom: effectiveDate,
          effectiveTo: null,
          status: 'ACTIVE',
        },
      ],
      { session },
    );

    await Captain.updateOne(
      { _id: captainId },
      { $set: { activeRevenuePlanId: planId } },
      { session },
    );

    return assignment;
  }

  async function getActiveCaptainPlan(captainId, atDate = new Date()) {
    const date = new Date(atDate);
    // Find active assignment whose effectiveFrom is <= date and (effectiveTo is null or > date)
    let assignment = await CaptainPlanAssignment.findOne({
      captainId,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: date } }],
      status: 'ACTIVE',
    }).sort({ effectiveFrom: -1 });

    if (!assignment) {
      // Check if captain has any assignment at all
      assignment = await CaptainPlanAssignment.findOne({ captainId }).sort({ effectiveFrom: -1 });
    }

    if (!assignment) {
      // Fallback default snapshot
      return {
        name: 'Standard Commission Plan (Default)',
        type: 'COMMISSION',
        commissionBps: DEFAULT_COMMISSION_BPS,
        subscriptionPricePaise: null,
        subscriptionBillingPeriod: null,
        isDefault: true,
      };
    }

    return {
      ...assignment.planSnapshot,
      assignmentId: assignment._id,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      isDefault: false,
    };
  }

  async function getCaptainPlanHistory(captainId) {
    return CaptainPlanAssignment.find({ captainId }).sort({ createdAt: -1 });
  }

  async function calculateRideCommission({ totalPaise, captainId, rideDate = new Date() }) {
    if (!Number.isInteger(totalPaise) || totalPaise < 0) {
      throw errors.badRequest('totalPaise must be a non-negative integer');
    }

    const planSnapshot = await getActiveCaptainPlan(captainId, rideDate);

    let commissionPaise = 0;
    if (planSnapshot.type === 'COMMISSION') {
      const bps = planSnapshot.commissionBps ?? DEFAULT_COMMISSION_BPS;
      commissionPaise = Math.round((totalPaise * bps) / 10000);
    } else if (planSnapshot.type === 'SUBSCRIPTION') {
      // In subscription plan, per-ride commission is 0 paise
      commissionPaise = 0;
    }

    const captainEarningsPaise = Math.max(0, totalPaise - commissionPaise);

    return {
      commissionPaise,
      captainEarningsPaise,
      planSnapshot,
    };
  }

  return {
    createPlan,
    listPlans,
    getPlanById,
    updatePlan,
    selectCaptainPlan,
    getActiveCaptainPlan,
    getCaptainPlanHistory,
    calculateRideCommission,
  };
}
