import { sendSuccess } from '../../shared/respond.js';

export function createBookingController({ bookingService }) {
  return {
    async createBooking(req, res) {
      const { booking, wasIdempotent } = await bookingService.createBooking(
        req.user.sub,
        req.validated.body,
      );
      // 200 for idempotent replay, 201 for new booking
      return sendSuccess(req, res, booking, { status: wasIdempotent ? 200 : 201 });
    },

    async getBooking(req, res) {
      const booking = await bookingService.getBooking(
        req.validated.params.bookingId,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, booking);
    },

    async listMyBookings(req, res) {
      const { page, limit, status } = req.validated.query;
      const result = await bookingService.listBookings(req.user.sub, { page, limit, status });
      return sendSuccess(req, res, result.bookings, {
        meta: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    },

    async cancelBooking(req, res) {
      const booking = await bookingService.cancelBooking(
        req.validated.params.bookingId,
        req.user.sub,
        req.user.role,
        req.validated.body,
      );
      return sendSuccess(req, res, booking);
    },

    // Admin
    async listAllBookings(req, res) {
      const { page, limit, status } = req.validated.query;
      const result = await bookingService.listAllBookings({ page, limit, status });
      return sendSuccess(req, res, result.bookings, {
        meta: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    },
  };
}