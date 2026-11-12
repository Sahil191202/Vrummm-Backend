import crypto from 'node:crypto';
import { Incident } from './schemas/incident.schema.js';
import { TripShareToken } from './schemas/tripShareToken.schema.js';
import { SupportTicket } from './schemas/supportTicket.schema.js';
import { Ride } from '../rides/schemas/ride.schema.js';
import { RideLocationSample } from '../rides/schemas/rideLocationSample.schema.js';
import { Vehicle } from '../vehicles/schemas/vehicle.schema.js';
import { errors } from '../../shared/AppError.js';
import { emit } from '../socket/socket.service.js';
import { SOCKET_EVENTS } from '@vrumm/contracts';

export function createSafetyService({ io = null } = {}) {
  // ── SOS Alert (Simulated) ──────────────────────────────────────────────────
  async function triggerSos({ rideId, userId, userRole, coordinates, description }) {
    const ride = await Ride.findById(rideId);
    if (!ride) throw errors.notFound('Ride not found');

    const isCustomer = String(ride.customerUserId) === String(userId);
    const isCaptain = String(ride.captainUserId) === String(userId);
    if (!isCustomer && !isCaptain) {
      throw errors.forbidden('You can only trigger SOS for an active ride you are part of');
    }

    const incident = await Incident.create({
      rideId,
      reporterUserId: userId,
      reporterRole: userRole,
      type: 'SOS_SIMULATED',
      severity: 'CRITICAL',
      status: 'REPORTED',
      isSimulated: true,
      description: description || 'Emergency SOS button triggered (Simulation mode)',
      location: coordinates ? { type: 'Point', coordinates } : undefined,
      statusHistory: [
        {
          status: 'REPORTED',
          changedBy: userId,
          note: 'SOS triggered in simulation mode',
          changedAt: new Date(),
        },
      ],
    });

    // Alert the ride room and operations room via Socket.IO
    await emit.toRide(io, String(rideId), SOCKET_EVENTS.SAFETY_INCIDENT, {
      incidentId: incident._id,
      rideId,
      type: 'SOS_SIMULATED',
      severity: 'CRITICAL',
      isSimulated: true,
    });

    await emit.toOps(io, SOCKET_EVENTS.SAFETY_INCIDENT, {
      incidentId: incident._id,
      rideId,
      type: 'SOS_SIMULATED',
      severity: 'CRITICAL',
      isSimulated: true,
      reporterRole: userRole,
    });

    return {
      incident,
      message:
        'SOS alert received and escalated to operations (Simulation mode — emergency services are not contacted).',
    };
  }

  // ── Incidents Management ───────────────────────────────────────────────────
  async function createIncident(data, actorUserId, userRole) {
    if (data.rideId) {
      const ride = await Ride.findById(data.rideId);
      if (!ride) throw errors.notFound('Ride not found');
    }

    const incident = await Incident.create({
      ...data,
      reporterUserId: actorUserId,
      reporterRole: userRole,
      statusHistory: [
        {
          status: 'REPORTED',
          changedBy: actorUserId,
          note: 'Incident reported',
          changedAt: new Date(),
        },
      ],
    });

    if (data.rideId) {
      await emit.toRide(io, String(data.rideId), SOCKET_EVENTS.SAFETY_INCIDENT, {
        incidentId: incident._id,
        rideId: data.rideId,
        type: incident.type,
        severity: incident.severity,
      });
    }

    return incident;
  }

  async function updateIncidentStatus(incidentId, { status, resolutionNotes }, actorUserId) {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw errors.notFound('Incident not found');

    incident.status = status;
    if (resolutionNotes) incident.resolutionNotes = resolutionNotes;
    if (status === 'RESOLVED' || status === 'DISMISSED') {
      incident.resolvedBy = actorUserId;
      incident.resolvedAt = new Date();
    }

    incident.statusHistory.push({
      status,
      changedBy: actorUserId,
      note: resolutionNotes || `Status updated to ${status}`,
      changedAt: new Date(),
    });

    await incident.save();
    return incident;
  }

  async function listIncidents(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.severity) query.severity = filter.severity;
    if (filter.type) query.type = filter.type;
    if (filter.rideId) query.rideId = filter.rideId;

    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      Incident.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Incident.countDocuments(query),
    ]);

    return {
      incidents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getIncidentById(incidentId) {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw errors.notFound('Incident not found');
    return incident;
  }

  // ── Trip Sharing with Expiring Tokens ──────────────────────────────────────
  async function generateTripShareToken({ rideId, userId, ttlHours = 24 }) {
    const ride = await Ride.findById(rideId);
    if (!ride) throw errors.notFound('Ride not found');

    if (String(ride.customerUserId) !== String(userId)) {
      throw errors.forbidden('You can only share your own active rides');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + ttlHours * 3600000);

    const shareDoc = await TripShareToken.create({
      rideId,
      userId,
      token,
      expiresAt,
    });

    return {
      token: shareDoc.token,
      expiresAt: shareDoc.expiresAt,
      shareUrl: `/shared/trip/${shareDoc.token}`,
    };
  }

  async function getSharedTripDetails(token) {
    const shareDoc = await TripShareToken.findOne({ token, isActive: true });
    if (!shareDoc) throw errors.notFound('Shared trip link not found or has been revoked');

    if (new Date() > shareDoc.expiresAt) {
      throw errors.businessRule('This trip share link has expired');
    }

    const ride = await Ride.findById(shareDoc.rideId);
    if (!ride) throw errors.notFound('Trip details unavailable');

    // Fetch latest location sample
    const latestSample = await RideLocationSample.findOne({ rideId: ride._id }).sort({
      recordedAt: -1,
    });

    // Fetch vehicle info
    const vehicle = await Vehicle.findOne({ captainId: ride.captainId });

    return {
      rideId: ride._id,
      status: ride.status,
      vehicleType: ride.vehicleType,
      pickup: ride.pickup,
      drop: ride.drop,
      currentLocation: latestSample ? latestSample.coordinates : null,
      lastUpdated: latestSample ? latestSample.recordedAt : ride.updatedAt,
      vehicle: vehicle
        ? {
            model: vehicle.model,
            plateNumber: vehicle.plateNumber,
            color: vehicle.color,
          }
        : null,
      linkExpiresAt: shareDoc.expiresAt,
    };
  }

  // ── Support Tickets ────────────────────────────────────────────────────────
  async function createSupportTicket(data, actorUserId, userRole) {
    const ticketNumber = `TCK-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const ticket = await SupportTicket.create({
      ticketNumber,
      userId: actorUserId,
      userRole,
      rideId: data.rideId,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      messages: [
        {
          senderUserId: actorUserId,
          senderRole: userRole,
          message: data.message,
          sentAt: new Date(),
        },
      ],
    });

    return ticket;
  }

  async function addSupportMessage(ticketId, { message }, actorUserId, userRole) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw errors.notFound('Support ticket not found');

    ticket.messages.push({
      senderUserId: actorUserId,
      senderRole: userRole,
      message,
      sentAt: new Date(),
    });

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      ticket.status = 'IN_PROGRESS';
    }

    await ticket.save();
    return ticket;
  }

  async function updateSupportTicketStatus(ticketId, { status }, actorUserId) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw errors.notFound('Support ticket not found');

    ticket.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      ticket.resolvedAt = new Date();
    }
    ticket.assignedToUserId = actorUserId;

    await ticket.save();
    return ticket;
  }

  async function listSupportTickets(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.category) query.category = filter.category;
    if (filter.priority) query.priority = filter.priority;
    if (filter.userId) query.userId = filter.userId;

    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SupportTicket.countDocuments(query),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getSupportTicketById(ticketId, requestingUserId, requestingRole) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw errors.notFound('Support ticket not found');

    // Customer or Captain can only view their own tickets
    if (
      (requestingRole === 'CUSTOMER' || requestingRole === 'CAPTAIN') &&
      String(ticket.userId) !== String(requestingUserId)
    ) {
      throw errors.forbidden('You can only view your own support tickets');
    }

    return ticket;
  }

  return {
    triggerSos,
    createIncident,
    updateIncidentStatus,
    listIncidents,
    getIncidentById,
    generateTripShareToken,
    getSharedTripDetails,
    createSupportTicket,
    addSupportMessage,
    updateSupportTicketStatus,
    listSupportTickets,
    getSupportTicketById,
  };
}
