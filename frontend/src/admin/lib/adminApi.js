// frontend/src/admin/lib/adminApi.js
import api from "../../lib/api";

// Admin endpoints MUST be called via /admin/* to keep boundaries clean
export async function adminSearchUsers({
  q = "",
  page = 1,
  limit = 20,
  includeInactive = false,
}) {
  const { data } = await api.get("/admin/users", {
    params: { q, page, limit, includeInactive },
  });
  return data;
}

export async function adminGetUserById(userId) {
  const { data } = await api.get(`/admin/users/${userId}`);
  return data;
}

// If you already have /auth/me, this is the best way for AdminRoute to check role
export async function getMe() {
  const { data } = await api.get("/me", { withCredentials: true });
  return data;
}
// NEW: Accounts for a user (admin)
export async function adminGetUserAccounts(
  userId,
  { includeInactive = false } = {}
) {
  const { data } = await api.get(`/admin/users/${userId}/accounts`, {
    params: { includeInactive },
  });
  return data;
}
// Admin user lifecycle actions
export async function adminDeactivateUser(userId) {
  const { data } = await api.patch(`/admin/users/${userId}/deactivate`);
  return data;
}

export async function adminReactivateUser(userId) {
  const { data } = await api.patch(`/admin/users/${userId}/reactivate`);
  return data;
}

export async function adminHardDeleteUser(userId) {
  const { data } = await api.delete(`/admin/users/${userId}/hard`);
  return data;
}
