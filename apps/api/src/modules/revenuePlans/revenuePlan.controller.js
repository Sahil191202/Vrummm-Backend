import { sendSuccess } from '../../shared/respond.js';
import { errors } from '../../shared/AppError.js';
import { Captain } from '../captains/schemas/captain.schema.js';

export function createRevenuePlanController({ revenuePlanService }) {
  return {
    async createPlan(req, res) {
      const plan = await revenuePlanService.createPlan(req.validated.body, req.user.sub);
      return sendSuccess(req, res, plan, { status: 201 });
    },

    async listPlans(req, res) {
      const plans = await revenuePlanService.listPlans(req.query);
      return sendSuccess(req, res, plans);
    },

    async getPlan(req, res) {
      const plan = await revenuePlanService.getPlanById(req.validated.params.planId);
      return sendSuccess(req, res, plan);
    },

    async updatePlan(req, res) {
      const plan = await revenuePlanService.updatePlan(
        req.validated.params.planId,
        req.validated.body,
        req.user.sub,
      );
      return sendSuccess(req, res, plan);
    },

    async selectCaptainPlan(req, res) {
      const captain = await Captain.findOne({ userId: req.user.sub });
      if (!captain) throw errors.notFound('Captain profile not found');

      const { planId, effectiveFrom } = req.validated.body;
      const assignment = await revenuePlanService.selectCaptainPlan(captain._id, planId, {
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
      });

      return sendSuccess(req, res, assignment, { status: 201 });
    },

    async getMyPlan(req, res) {
      const captain = await Captain.findOne({ userId: req.user.sub });
      if (!captain) throw errors.notFound('Captain profile not found');

      const currentPlan = await revenuePlanService.getActiveCaptainPlan(captain._id);
      const history = await revenuePlanService.getCaptainPlanHistory(captain._id);

      return sendSuccess(req, res, { currentPlan, history });
    },
  };
}
