import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../rbac/permissions.js';
import { createSafetyController } from './safety.controller.js';
import { createSafetyService } from './safety.service.js';
import {
  triggerSosSchema,
  createTripShareSchema,
  tokenParamSchema,
  createIncidentSchema,
  resolveIncidentSchema,
  incidentIdParamSchema,
  queryIncidentsSchema,
  createSupportTicketSchema,
  addTicketMessageSchema,
  updateTicketStatusSchema,
  ticketIdParamSchema,
  querySupportTicketsSchema,
} from './schemas/safety.schemas.js';

export function createSafetyRouter({ authService, io }) {
  const safetyService = createSafetyService({ io });
  const controller = createSafetyController({ safetyService });
  const router = Router();
  const auth = authenticate(authService);

  // 1. Public route: anyone with share token can view live trip status
  router.get(
    '/trip-share/:token',
    validate({ params: tokenParamSchema }),
    controller.getSharedTrip,
  );

  // 2. Customer & Captain safety actions
  router.post('/sos', auth, validate({ body: triggerSosSchema }), controller.triggerSos);

  router.post(
    '/trip-share',
    auth,
    requireRole(ROLES.CUSTOMER),
    validate({ body: createTripShareSchema }),
    controller.createTripShare,
  );

  router.post(
    '/incidents',
    auth,
    validate({ body: createIncidentSchema }),
    controller.createIncident,
  );

  // 3. Support Tickets
  router.post(
    '/support/tickets',
    auth,
    validate({ body: createSupportTicketSchema }),
    controller.createSupportTicket,
  );

  router.get(
    '/support/tickets',
    auth,
    validate({ query: querySupportTicketsSchema }),
    controller.listSupportTickets,
  );

  router.get(
    '/support/tickets/:ticketId',
    auth,
    validate({ params: ticketIdParamSchema }),
    controller.getSupportTicket,
  );

  router.post(
    '/support/tickets/:ticketId/messages',
    auth,
    validate({ params: ticketIdParamSchema, body: addTicketMessageSchema }),
    controller.addSupportMessage,
  );

  router.patch(
    '/support/tickets/:ticketId/status',
    auth,
    requirePermission(PERMISSIONS.INCIDENTS_RESOLVE),
    validate({ params: ticketIdParamSchema, body: updateTicketStatusSchema }),
    controller.updateSupportTicketStatus,
  );

  // 4. Admin Incident Resolution
  router.get(
    '/incidents',
    auth,
    requirePermission(PERMISSIONS.INCIDENTS_READ),
    validate({ query: queryIncidentsSchema }),
    controller.listIncidents,
  );

  router.get(
    '/incidents/:incidentId',
    auth,
    requirePermission(PERMISSIONS.INCIDENTS_READ),
    validate({ params: incidentIdParamSchema }),
    controller.getIncident,
  );

  router.patch(
    '/incidents/:incidentId/resolve',
    auth,
    requirePermission(PERMISSIONS.INCIDENTS_RESOLVE),
    validate({ params: incidentIdParamSchema, body: resolveIncidentSchema }),
    controller.updateIncidentStatus,
  );

  return router;
}
