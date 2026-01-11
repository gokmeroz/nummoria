import api from "./api";

// POST /auto/transactions/text
export async function autoCreateFromText({
  accountId,
  text,
  type,
  date,
  reminder,
}) {
  const res = await api.post("/auto/transactions/text", {
    accountId,
    text,
    type,
    date,
    reminder,
  });
  return res.data;
}

// GET /auto/transactions/drafts
export async function getAutoDrafts(status = "draft") {
  const res = await api.get("/auto/transactions/drafts", {
    params: { status },
  });
  return res.data;
}

// PATCH /auto/transactions/drafts/:id
export async function updateAutoDraft(id, payload) {
  const res = await api.patch(`/auto/transactions/drafts/${id}`, payload);
  return res.data;
}

// POST /auto/transactions/drafts/:id/post
export async function postAutoDraft(id) {
  const res = await api.post(`/auto/transactions/drafts/${id}/post`);
  return res.data;
}

// POST /auto/transactions/drafts/:id/reject
export async function rejectAutoDraft(id, reason) {
  const res = await api.post(`/auto/transactions/drafts/${id}/reject`, {
    reason,
  });
  return res.data;
}
