import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const templates = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
  res.json(templates.map((t) => ({ ...t, vars: JSON.parse(t.vars || "[]") })));
});

router.post("/", (req, res) => {
  const { name, category, body, vars, emoji, gradient, tip } = req.body;
  if (!name?.trim() || !body?.trim()) return res.status(400).json({ error: "Name and body required" });
  const r = db.prepare(
    "INSERT INTO templates (name, category, body, vars, emoji, gradient, tip, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')"
  ).run(name.trim(), category || "Promo", body.trim(), JSON.stringify(vars || []), emoji || "📝", gradient || "linear-gradient(135deg, #667eea, #764ba2)", tip || "");
  res.json({ id: r.lastInsertRowid, success: true });
});

router.put("/:id", (req, res) => {
  const { name, category, body, vars, emoji, gradient, tip } = req.body;
  db.prepare(
    "UPDATE templates SET name=?, category=?, body=?, vars=?, emoji=?, gradient=?, tip=?, updated_at=datetime('now') WHERE id=?"
  ).run(name, category, body, JSON.stringify(vars || []), emoji, gradient, tip, req.params.id);
  res.json({ success: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
