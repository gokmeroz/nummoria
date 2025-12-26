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
