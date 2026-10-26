import mongoose from 'mongoose';

const { Schema } = mongoose;

// Append-only. Never update or delete rows.
const adminAuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String },
    targetId: { type: Schema.Types.ObjectId },
    requestId: { type: String },
    reason: { type: String, maxlength: 500 },
    meta: { type: Schema.Types.Mixed },
    ipAddress: { type: String, maxlength: 45 },
  },
  { timestamps: true },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);
