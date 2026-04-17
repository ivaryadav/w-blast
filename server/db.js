import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "blast.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    wa_id         TEXT,
    opted_in      INTEGER NOT NULL DEFAULT 1,
    opt_in_date   TEXT,
    opt_out_date  TEXT,
    msgs_today    INTEGER NOT NULL DEFAULT 0,
    msgs_total    INTEGER NOT NULL DEFAULT 0,
    last_msg_date TEXT,
    is_on_whatsapp INTEGER DEFAULT 1,
    synced_from_wa INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'Promo',
    body          TEXT NOT NULL,
    vars          TEXT NOT NULL DEFAULT '[]',
    status        TEXT NOT NULL DEFAULT 'ready',
    emoji         TEXT DEFAULT '📝',
    gradient      TEXT DEFAULT 'linear-gradient(135deg, #667eea, #764ba2)',
    tip           TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER,
    template_name   TEXT NOT NULL,
    template_body   TEXT NOT NULL DEFAULT '',
    template_category TEXT NOT NULL DEFAULT 'Promo',
    media_path      TEXT,
    var_values      TEXT NOT NULL DEFAULT '{}',
    total_contacts  INTEGER NOT NULL DEFAULT 0,
    total_sent      INTEGER NOT NULL DEFAULT 0,
    total_failed    INTEGER NOT NULL DEFAULT 0,
    total_skipped   INTEGER NOT NULL DEFAULT 0,
    schedule_type   TEXT NOT NULL DEFAULT 'now',
    scheduled_at    TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Contact groups for segmentation
  CREATE TABLE IF NOT EXISTS contact_groups (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#48bfe3',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Many-to-many: contacts ↔ groups
  CREATE TABLE IF NOT EXISTS contact_group_members (
    contact_id INTEGER NOT NULL,
    group_id   INTEGER NOT NULL,
    PRIMARY KEY (contact_id, group_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id   INTEGER,
    contact_id    INTEGER NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_name  TEXT,
    wa_message_id TEXT,
    status        TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    sent_at       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id   INTEGER NOT NULL,
    run_at        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS daily_reset (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    last_reset    TEXT NOT NULL DEFAULT (date('now'))
  );
  INSERT OR IGNORE INTO daily_reset (id, last_reset) VALUES (1, date('now'));
`);

function resetDailyCountersIfNeeded() {
  const row = db.prepare("SELECT last_reset FROM daily_reset WHERE id = 1").get();
  const today = new Date().toISOString().slice(0, 10);
  if (row && row.last_reset !== today) {
    db.prepare("UPDATE contacts SET msgs_today = 0").run();
    db.prepare("UPDATE daily_reset SET last_reset = ? WHERE id = 1").run(today);
    console.log("✅ Daily message counters reset");
  }
}

export { db, resetDailyCountersIfNeeded };
