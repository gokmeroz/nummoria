import { AdminAuditLog } from "../models/adminAuditLog.js";

export function audit({
  action,
  entityType,
  entityIdFromReq,
  metadataFromReq,
}) {
  return async (req, _res, next) => {
    try {
      // Only log if actor is authenticated (admin routes will be)
      if (req.user?._id) {
        const entityId = entityIdFromReq?.(req);
        const metadata = metadataFromReq?.(req);

        await AdminAuditLog.create({
          actorUserId: req.user._id,
          action,
          entityType,
          entityId,
          metadata: metadata ?? {},
          ip: req.ip,
          userAgent: req.get("user-agent") || "",
        });
      }
    } catch (e) {
      // Never block the request because auditing failed (but log server-side)
      console.error("AUDIT_LOG_FAILED:", e);
    }
    next();
  };
}
