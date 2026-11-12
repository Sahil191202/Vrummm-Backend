import { sendSuccess } from '../../shared/respond.js';
import { ROLES } from '../rbac/permissions.js';

export function createSafetyController({ safetyService }) {
  return {
    async triggerSos(req, res) {
      const result = await safetyService.triggerSos({
        ...req.validated.body,
        userId: req.user.sub,
        userRole: req.user.role,
      });
      return sendSuccess(req, res, result, { status: 201 });
    },

    async createTripShare(req, res) {
      const result = await safetyService.generateTripShareToken({
        rideId: req.validated.body.rideId,
        userId: req.user.sub,
        ttlHours: req.validated.body.ttlHours,
      });
      return sendSuccess(req, res, result, { status: 201 });
    },

    async getSharedTrip(req, res) {
      const result = await safetyService.getSharedTripDetails(req.validated.params.token);
      return sendSuccess(req, res, result);
    },

    async createIncident(req, res) {
      const incident = await safetyService.createIncident(
        req.validated.body,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, incident, { status: 201 });
    },

    async updateIncidentStatus(req, res) {
      const incident = await safetyService.updateIncidentStatus(
        req.validated.params.incidentId,
        req.validated.body,
        req.user.sub,
      );
      return sendSuccess(req, res, incident);
    },

    async listIncidents(req, res) {
      const { page, limit, ...filter } = req.validated.query;
      const result = await safetyService.listIncidents(filter, { page, limit });
      return sendSuccess(req, res, result.incidents, { meta: result.pagination });
    },

    async getIncident(req, res) {
      const incident = await safetyService.getIncidentById(req.validated.params.incidentId);
      return sendSuccess(req, res, incident);
    },

    async createSupportTicket(req, res) {
      const ticket = await safetyService.createSupportTicket(
        req.validated.body,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, ticket, { status: 201 });
    },

    async addSupportMessage(req, res) {
      const ticket = await safetyService.addSupportMessage(
        req.validated.params.ticketId,
        req.validated.body,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, ticket);
    },

    async updateSupportTicketStatus(req, res) {
      const ticket = await safetyService.updateSupportTicketStatus(
        req.validated.params.ticketId,
        req.validated.body,
        req.user.sub,
      );
      return sendSuccess(req, res, ticket);
    },

    async listSupportTickets(req, res) {
      const { page, limit, ...filter } = req.validated.query;

      // If customer or captain, constrain query to own tickets
      if (req.user.role === ROLES.CUSTOMER || req.user.role === ROLES.CAPTAIN) {
        filter.userId = req.user.sub;
      }

      const result = await safetyService.listSupportTickets(filter, { page, limit });
      return sendSuccess(req, res, result.tickets, { meta: result.pagination });
    },

    async getSupportTicket(req, res) {
      const ticket = await safetyService.getSupportTicketById(
        req.validated.params.ticketId,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, ticket);
    },
  };
}
