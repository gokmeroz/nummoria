// frontend/src/admin/lib/adminApi.js
import api from "../../lib/api";

// Admin endpoints MUST be called via /admin/* to keep boundaries clean
export async function adminSearchUsers({
  q = "",
  page = 1,
  limit = 20,
  includeInactive = false,
} = {}) {
  const { data } = await api.get("/admin/users", {
    params: { q, page, limit, includeInactive },
    withCredentials: true,
  });
  return data;
}

export async function adminGetUserById(userId) {
  const { data } = await api.get(`/admin/users/${userId}`, {
    withCredentials: true,
  });
  return data;
}

// AdminRoute should call the same endpoint your backend actually provides.
// If your backend is /me, keep this. If it's /auth/me, change the path here.
export async function getMe() {
  const { data } = await api.get("/me", { withCredentials: true });
  return data;
}

// (Keep but don’t call until backend exists)
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
  const { data } = await api.patch(
    `/admin/users/${userId}/deactivate`,
    {},
    { withCredentials: true }
  );
  return data;
}

export async function adminReactivateUser(userId) {
  const { data } = await api.patch(
    `/admin/users/${userId}/reactivate`,
    {},
    { withCredentials: true }
  );
  return data;
}

export async function adminHardDeleteUser(userId) {
  const { data } = await api.delete(`/admin/users/${userId}/hard`, {
    withCredentials: true,
  });
  return data;
}
// Phase 1 admin actions
export async function adminResendVerification(userId) {
  const { data } = await api.post(`/admin/users/${userId}/resend-verification`);
  return data;
}

export async function adminForceLogout(userId) {
  const { data } = await api.post(`/admin/users/${userId}/force-logout`);
  return data;
}

export async function adminSendPasswordReset(userId) {
  const { data } = await api.post(`/admin/users/${userId}/send-password-reset`);
  return data;
}
