import mongoose from 'mongoose';
import { INCIDENT_TYPES, INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@vrumm/contracts';

const { Schema } = mongoose;

const incidentStatusHistorySchema = new Schema(
  {
    status: { type: String, enum: INCIDENT_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, maxlength: 500 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const incidentSchema = new Schema(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      index: true,
    },
    reporterUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterRole: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: INCIDENT_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: INCIDENT_SEVERITIES,
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: 'REPORTED',
      index: true,
    },
    // SOS is simulated in demo/learning mode — never calls real emergency services
    isSimulated: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    resolutionNotes: {
      type: String,
      maxlength: 1000,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    statusHistory: [incidentStatusHistorySchema],
  },
  { timestamps: true },
);

incidentSchema.index({ status: 1, severity: 1 });
incidentSchema.index({ createdAt: -1 });

export const Incident = mongoose.model('Incident', incidentSchema);
