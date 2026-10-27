import { Captain } from './schemas/captain.schema.js';
import { User } from '../rbac/schemas/user.schema.js';
import { Document, REQUIRED_DOCUMENT_TYPES } from '../documents/schemas/document.schema.js';
import { errors } from '../../shared/AppError.js';

export function createCaptainService() {
  async function getOrCreateProfile(userId) {
    let profile = await Captain.findOne({ userId });
    if (!profile) profile = await Captain.create({ userId });
    return profile;
  }

  async function getProfile(captainId) {
    const profile = await Captain.findById(captainId).populate('userId', 'email displayName phone');
    if (!profile) throw errors.notFound('Captain not found');
    return profile;
  }

  async function getProfileByUserId(userId) {
    const profile = await Captain.findOne({ userId }).populate('userId', 'email displayName phone');
    if (!profile) throw errors.notFound('Captain profile not found');
    return profile;
  }

  async function updateProfile(userId, { displayName, phone, vehicleType }) {
    const update = {};
    if (displayName !== undefined) update.displayName = displayName;
    if (phone !== undefined) update.phone = phone;

    if (Object.keys(update).length > 0) {
      await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
    }

    const captainUpdate = {};
    if (vehicleType !== undefined) captainUpdate.vehicleType = vehicleType;

    if (Object.keys(captainUpdate).length > 0) {
      await Captain.findOneAndUpdate({ userId }, { $set: captainUpdate }, { runValidators: true });
    }

    return getProfileByUserId(userId);
  }

  // Toggle online/offline. Only APPROVED captains can go online.
  async function setAvailability(userId, isOnline) {
    const captain = await Captain.findOne({ userId });
    if (!captain) throw errors.notFound('Captain profile not found');

    if (isOnline && captain.approvalStatus !== 'APPROVED') {
      throw errors.businessRule(
        'You cannot go online until your account is approved and all documents are verified',
      );
    }

    if (isOnline) {
      // Check document eligibility at the point of going online.
      await assertDocumentEligibility(captain._id);
    }

    await Captain.updateOne({ _id: captain._id }, { $set: { isOnline } });
    return { isOnline };
  }

  // Admin: approve or reject a captain.
  async function setApprovalStatus(captainId, { status, reason, adminUserId }) {
    const captain = await Captain.findById(captainId);
    if (!captain) throw errors.notFound('Captain not found');

    const update = { approvalStatus: status };
    if (status === 'APPROVED') {
      update.approvedAt = new Date();
      update.approvedBy = adminUserId;
    }
    if (status === 'REJECTED' || status === 'SUSPENDED') {
      if (!reason) throw errors.badRequest('A reason is required when rejecting or suspending');
      update.rejectionReason = reason;
      update.isOnline = false;
    }

    await Captain.updateOne({ _id: captainId }, { $set: update });
    return Captain.findById(captainId);
  }

  // Checks whether all required documents are present and not expired.
  async function assertDocumentEligibility(captainId) {
    const docs = await Document.find({ captainId, status: 'APPROVED' });
    const approvedTypes = new Set(docs.map((d) => d.type));
    const now = new Date();

    const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !approvedTypes.has(t));
    if (missing.length > 0) {
      throw errors.businessRule('Missing required documents', { missing });
    }

    const expired = docs.filter((d) => d.expiresAt && d.expiresAt < now).map((d) => d.type);
    if (expired.length > 0) {
      throw errors.businessRule('One or more documents have expired', { expired });
    }
  }

  async function checkEligibility(captainId) {
    try {
      await assertDocumentEligibility(captainId);
      return { eligible: true };
    } catch (err) {
      return { eligible: false, reason: err.message, details: err.details };
    }
  }

  // List captains for admin with pagination.
  async function listCaptains({ page = 1, limit = 20, approvalStatus, search } = {}) {
    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    let captainIds;
    if (search) {
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ],
        role: 'CAPTAIN',
      }).select('_id');
      captainIds = users.map((u) => u._id);
      filter.userId = { $in: captainIds };
    }

    const total = await Captain.countDocuments(filter);
    const captains = await Captain.find(filter)
      .populate('userId', 'email displayName phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { captains, total, page, limit, pages: Math.ceil(total / limit) };
  }

  return {
    getOrCreateProfile,
    getProfile,
    getProfileByUserId,
    updateProfile,
    setAvailability,
    setApprovalStatus,
    checkEligibility,
    listCaptains,
  };
}