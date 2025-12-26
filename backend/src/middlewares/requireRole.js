// backend/src/middlewares/requireRole.js
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // requireAuth must have attached req.user
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = req.user.role;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

export const requireAdmin = requireRole("admin");
