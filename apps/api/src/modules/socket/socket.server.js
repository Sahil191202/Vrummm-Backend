import { Server } from 'socket.io';
import { socketRooms } from '@vrumm/contracts';
import { ROLES } from '../rbac/permissions.js';

const ADMIN_ROLES = new Set([ROLES.SUPER_ADMIN, ROLES.OPERATIONS, ROLES.SUPPORT, ROLES.FINANCE]);

// Build the Socket.IO server and attach it to an HTTP server.
// authService is injected so we can verify the JWT on connection.
export function createSocketServer(httpServer, { authService, corsOrigins, logger }) {
  const io = new Server(httpServer, {
    cors: {
      origin: [...corsOrigins],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // No anonymous connections.
    // Clients send the JWT as a query param: ?token=<accessToken>
    // or in the auth object: { auth: { token } }
  });

  // ── Auth middleware ───────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = authService.verifyAccessToken(token);
      socket.user = payload; // { sub, role, sessionId }
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { sub: userId, role } = socket.user;

    // Every user joins their own private room automatically.
    socket.join(socketRooms.user(userId));
    logger.info({ userId, role, socketId: socket.id }, 'socket connected');

    // Admin roles join the ops dashboard room.
    if (ADMIN_ROLES.has(role)) {
      socket.join(socketRooms.ops());
    }

    // Clients request to join a ride room after they have been assigned.
    // The server validates that the user is actually part of that ride
    // before joining — clients cannot join arbitrary rooms.
    socket.on('ride:join', async ({ rideId }) => {
      if (!rideId || typeof rideId !== 'string') return;
      try {
        const { Ride } = await import('../rides/schemas/ride.schema.js');
        const ride = await Ride.findById(rideId).select('customerUserId captainUserId');
        if (!ride) return;
        const allowed =
          String(ride.customerUserId) === userId ||
          String(ride.captainUserId) === userId ||
          ADMIN_ROLES.has(role);
        if (allowed) {
          socket.join(socketRooms.ride(rideId));
          socket.emit('ride:joined', { rideId });
        }
      } catch {
        // Silently ignore — client will retry.
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'socket disconnected');
    });

    // Clients must never trust events they receive as proof of state.
    // All state must be confirmed via REST before acting on it.
  });

  return io;
}
