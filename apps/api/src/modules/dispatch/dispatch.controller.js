import { sendSuccess } from '../../shared/respond.js';

export function createDispatchController({ dispatchService }) {
  return {
    // Captain: list pending offers (pickup only — no drop revealed)
    async listMyOffers(req, res) {
      const offers = await dispatchService.listMyOffers(req.user.sub);
      return sendSuccess(req, res, offers);
    },

    // Captain: accept an offer
    async acceptOffer(req, res) {
      const { offer, booking } = await dispatchService.captainAcceptOffer(
        req.validated.params.offerId,
        req.user.sub,
      );
      return sendSuccess(req, res, { offer, booking });
    },

    // Captain: reject an offer
    async rejectOffer(req, res) {
      const offer = await dispatchService.captainRejectOffer(
        req.validated.params.offerId,
        req.user.sub,
      );
      return sendSuccess(req, res, offer);
    },

    // Customer: get dispatch status for their booking
    async getDispatchStatus(req, res) {
      const status = await dispatchService.getDispatchStatus(
        req.validated.params.bookingId,
        req.user.sub,
      );
      return sendSuccess(req, res, status);
    },
  };
}