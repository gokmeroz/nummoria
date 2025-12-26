import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true }, // e.g. "USER_NOTE_CREATE"
    entityType: { type: String, required: true }, // "User", "Account", "Transaction"
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    metadata: { type: Object, default: {} }, // before/after, reason, etc.
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const AdminAuditLog = mongoose.model(
  "AdminAuditLog",
  adminAuditLogSchema
);
