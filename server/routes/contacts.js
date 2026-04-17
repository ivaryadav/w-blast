import { Router } from "express";
import { db, resetDailyCountersIfNeeded } from "../db.js";
import wa from "../services/whatsapp.js";

const router = Router();

// LIST — with search + group filter
router.get("/", (req, res) => {
  resetDailyCountersIfNeeded();
  const { search, group_id } = req.query;
  let sql = "SELECT c.* FROM contacts c";
  const params = [];

  if (group_id) {
    sql += " JOIN contact_group_members gm ON c.id = gm.contact_id WHERE gm.group_id = ?";
    params.push(group_id);
    if (search) { sql += " AND (c.name LIKE ? OR c.phone LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  } else if (search) {
    sql += " WHERE (c.name LIKE ? OR c.phone LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY c.name ASC";
  const contacts = db.prepare(sql).all(...params);
  res.json(contacts.map(c => ({ ...c, opted_in: !!c.opted_in })));
});

// ADD
router.post("/", (req, res) => {
  const { name, phone, opted_in } = req.body;
  if (!name?.trim() || !phone?.trim()) return res.status(400).json({ error: "Name and phone required" });
  try {
    const r = db.prepare("INSERT INTO contacts (name, phone, opted_in, opt_in_date) VALUES (?, ?, ?, ?)").run(name.trim(), phone.trim(), opted_in !== false ? 1 : 0, new Date().toISOString().slice(0, 10));
    res.json({ id: r.lastInsertRowid, success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Phone already exists" });
    throw err;
  }
});

// BULK IMPORT (JSON array or CSV text)
router.post("/bulk", (req, res) => {
  const { contacts: list, csv } = req.body;
  let parsed = [];

  if (csv) {
    // Parse CSV text: Name,Phone per line (with or without header)
    const lines = csv.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/[,\t]+/).map(s => s.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        // Skip header row
        if (parts[0].toLowerCase() === "name" && parts[1].toLowerCase() === "phone") continue;
        parsed.push({ name: parts[0], phone: parts[1] });
      }
    }
  } else if (Array.isArray(list)) {
    parsed = list.filter(c => c.name?.trim() && c.phone?.trim());
  }

  const insert = db.prepare("INSERT OR IGNORE INTO contacts (name, phone, opted_in, opt_in_date) VALUES (?, ?, 1, ?)");
  const importMany = db.transaction((items) => {
    let imported = 0;
    for (const c of items) {
      const r = insert.run(c.name.trim(), c.phone.trim(), new Date().toISOString().slice(0, 10));
      if (r.changes > 0) imported++;
    }
    return imported;
  });
  const imported = importMany(parsed);
  res.json({ imported, total: parsed.length });
});

// SYNC FROM WHATSAPP
router.post("/sync-whatsapp", async (req, res) => {
  try {
    const waContacts = await wa.getContacts();
    const insert = db.prepare("INSERT OR IGNORE INTO contacts (name, phone, wa_id, opted_in, opt_in_date, synced_from_wa) VALUES (?, ?, ?, 1, ?, 1)");
    const syncMany = db.transaction((contacts) => {
      let synced = 0;
      for (const c of contacts) { const r = insert.run(c.name, c.phone, c.wa_id, new Date().toISOString().slice(0, 10)); if (r.changes > 0) synced++; }
      return synced;
    });
    const synced = syncMany(waContacts);
    res.json({ synced, total: waContacts.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// TOGGLE OPT-IN
router.patch("/:id/opt", (req, res) => {
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Not found" });
  const ns = contact.opted_in ? 0 : 1;
  db.prepare("UPDATE contacts SET opted_in=?, opt_in_date=?, opt_out_date=?, updated_at=datetime('now') WHERE id=?")
    .run(ns, ns ? new Date().toISOString().slice(0,10) : contact.opt_in_date, ns ? null : new Date().toISOString().slice(0,10), req.params.id);
  res.json({ success: true, opted_in: !!ns });
});

// DELETE
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── GROUPS ───
router.get("/groups", (req, res) => {
  const groups = db.prepare("SELECT g.*, COUNT(gm.contact_id) as member_count FROM contact_groups g LEFT JOIN contact_group_members gm ON g.id = gm.group_id GROUP BY g.id ORDER BY g.name").all();
  res.json(groups);
});

router.post("/groups", (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });
  try {
    const r = db.prepare("INSERT INTO contact_groups (name, color) VALUES (?, ?)").run(name.trim(), color || "#48bfe3");
    res.json({ id: r.lastInsertRowid, success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Group already exists" });
    throw err;
  }
});

router.delete("/groups/:id", (req, res) => {
  db.prepare("DELETE FROM contact_groups WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Add contacts to group
router.post("/groups/:id/members", (req, res) => {
  const { contactIds } = req.body;
  if (!Array.isArray(contactIds)) return res.status(400).json({ error: "contactIds array required" });
  const ins = db.prepare("INSERT OR IGNORE INTO contact_group_members (contact_id, group_id) VALUES (?, ?)");
  const addMany = db.transaction((ids) => { let added = 0; for (const cid of ids) { const r = ins.run(cid, req.params.id); if (r.changes > 0) added++; } return added; });
  const added = addMany(contactIds);
  res.json({ added });
});

// Remove contact from group
router.delete("/groups/:gid/members/:cid", (req, res) => {
  db.prepare("DELETE FROM contact_group_members WHERE group_id = ? AND contact_id = ?").run(req.params.gid, req.params.cid);
  res.json({ success: true });
});

export default router;
