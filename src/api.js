const B = "/api";
const j = (p, o = {}) =>
  fetch(`${B}${p}`, { headers: { "Content-Type": "application/json", ...o.headers }, ...o })
    .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || `Error ${r.status}`); return d; });

export const contacts = {
  list: (search, groupId) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (groupId) params.set("group_id", groupId);
    const qs = params.toString();
    return j(`/contacts${qs ? "?" + qs : ""}`);
  },
  add: (name, phone) => j("/contacts", { method: "POST", body: JSON.stringify({ name, phone }) }),
  bulkImport: (list) => j("/contacts/bulk", { method: "POST", body: JSON.stringify({ contacts: list }) }),
  bulkImportCSV: (csv) => j("/contacts/bulk", { method: "POST", body: JSON.stringify({ csv }) }),
  syncWhatsApp: () => j("/contacts/sync-whatsapp", { method: "POST" }),
  toggleOpt: (id) => j(`/contacts/${id}/opt`, { method: "PATCH" }),
  remove: (id) => j(`/contacts/${id}`, { method: "DELETE" }),
  // Groups
  groups: () => j("/contacts/groups"),
  createGroup: (name, color) => j("/contacts/groups", { method: "POST", body: JSON.stringify({ name, color }) }),
  deleteGroup: (id) => j(`/contacts/groups/${id}`, { method: "DELETE" }),
  addToGroup: (groupId, contactIds) => j(`/contacts/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ contactIds }) }),
  removeFromGroup: (groupId, contactId) => j(`/contacts/groups/${groupId}/members/${contactId}`, { method: "DELETE" }),
};

export const templates = {
  list: () => j("/templates"),
  create: (data) => j("/templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => j(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => j(`/templates/${id}`, { method: "DELETE" }),
};

export const campaigns = {
  list: () => j("/campaigns"),
  get: (id) => j(`/campaigns/${id}`),
  send: (data) => j("/campaigns/send", { method: "POST", body: JSON.stringify(data) }),
  progress: (id) => j(`/campaigns/${id}/progress`),
  pause: (id) => j(`/campaigns/${id}/pause`, { method: "POST" }),
  resume: (id) => j(`/campaigns/${id}/resume`, { method: "POST" }),
  cancel: (id) => j(`/campaigns/${id}/cancel`, { method: "POST" }),
};

export const wa = {
  status: () => j("/wa/status"),
  connect: () => j("/wa/connect", { method: "POST" }),
  logout: () => j("/wa/logout", { method: "POST" }),
  testSend: (phone, text) => j("/wa/test-send", { method: "POST", body: JSON.stringify({ phone, text }) }),
};

export const media = {
  upload: async (file) => {
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
    return j("/media/upload", { method: "POST", body: JSON.stringify({ data: base64, filename: file.name, mimetype: file.type }) });
  },
};

export const health = () => fetch("/health").then((r) => r.json());
