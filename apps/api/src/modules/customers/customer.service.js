import { Customer } from './schemas/customer.schema.js';
import { User } from '../rbac/schemas/user.schema.js';
import { errors } from '../../shared/AppError.js';

export function createCustomerService() {
  async function getOrCreateProfile(userId) {
    let profile = await Customer.findOne({ userId });
    if (!profile) profile = await Customer.create({ userId });
    return profile;
  }

  async function getProfile(userId) {
    const profile = await Customer.findOne({ userId }).populate('userId', 'email displayName phone');
    if (!profile) throw errors.notFound('Customer profile not found');
    return profile;
  }

  async function updateProfile(userId, { displayName, phone }) {
    // Update display fields on the User record (single source of truth for identity).
    const update = {};
    if (displayName !== undefined) update.displayName = displayName;
    if (phone !== undefined) update.phone = phone;

    if (Object.keys(update).length > 0) {
      const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
      if (!user) throw errors.notFound('User not found');
    }

    return getProfile(userId);
  }

  async function addSavedPlace(userId, { label, address, coordinates }) {
    const profile = await Customer.findOne({ userId });
    if (!profile) throw errors.notFound('Customer profile not found');
    if (profile.savedPlaces.length >= 5) {
      throw errors.businessRule('You can save at most 5 places');
    }
    profile.savedPlaces.push({
      label,
      address,
      location: { type: 'Point', coordinates },
    });
    await profile.save();
    return profile;
  }

  async function removeSavedPlace(userId, placeId) {
    const profile = await Customer.findOne({ userId });
    if (!profile) throw errors.notFound('Customer profile not found');
    const before = profile.savedPlaces.length;
    profile.savedPlaces = profile.savedPlaces.filter((p) => p._id.toString() !== placeId);
    if (profile.savedPlaces.length === before) throw errors.notFound('Saved place not found');
    await profile.save();
    return profile;
  }

  return { getOrCreateProfile, getProfile, updateProfile, addSavedPlace, removeSavedPlace };
}