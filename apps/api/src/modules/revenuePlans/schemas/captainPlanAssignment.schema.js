import mongoose from 'mongoose';
import { REVENUE_PLAN_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const captainPlanAssignmentSchema = new Schema(
  {
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'RevenuePlan',
      required: true,
      index: true,
    },
    // Immutable snapshot of the plan terms at the time of assignment.
    planSnapshot: {
      name: { type: String, required: true },
      type: { type: String, enum: REVENUE_PLAN_TYPES, required: true },
      commissionBps: { type: Number },
      subscriptionPricePaise: { type: Number },
      subscriptionBillingPeriod: { type: String },
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true },
);

captainPlanAssignmentSchema.index({ captainId: 1, status: 1 });
captainPlanAssignmentSchema.index({ captainId: 1, effectiveFrom: 1 });

export const CaptainPlanAssignment = mongoose.model(
  'CaptainPlanAssignment',
  captainPlanAssignmentSchema,
);
