import { db, resetDailyCountersIfNeeded } from "../db.js";
import wa from "./whatsapp.js";

const MAX_MARKETING_PER_DAY = 2;
const OPT_OUT_FOOTER = "\n\n─────────────\nReply STOP to unsubscribe";
const DELAY_BETWEEN_MSGS = 2500;
const MAX_RETRIES = 1;

// Track pausable/cancellable campaigns
const activeCampaigns = new Map();

async function sendCampaign(campaignId, io) {
  resetDailyCountersIfNeeded();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const varValues = JSON.parse(campaign.var_values || "{}");

  // FIX: Use template_body stored directly in campaign row
  const templateBody = campaign.template_body || "";
  if (!templateBody) {
    db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaignId);
    throw new Error("Campaign has no template body");
  }

  const mediaPath = campaign.media_path || null;
  // FIX: Use stored category, not text heuristic
  const isUtility = campaign.template_category === "Utility";

  const messages = db.prepare(
    "SELECT ml.*, c.name, c.phone, c.opted_in, c.msgs_today FROM message_logs ml JOIN contacts c ON ml.contact_id = c.id WHERE ml.campaign_id = ? AND ml.status = 'queued' ORDER BY ml.id"
  ).all(campaignId);

  if (messages.length === 0) {
    db.prepare("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(campaignId);
    return { sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  activeCampaigns.set(campaignId, { paused: false, cancelled: false });
  db.prepare("UPDATE campaigns SET status = 'sending', started_at = datetime('now') WHERE id = ?").run(campaignId);

  let sentCount = 0, failedCount = 0, skippedCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const ctrl = activeCampaigns.get(campaignId);
    if (ctrl?.cancelled) {
      db.prepare("UPDATE message_logs SET status = 'skipped', error_message = 'Cancelled' WHERE campaign_id = ? AND status = 'queued'").run(campaignId);
      skippedCount += messages.length - i;
      break;
    }
    while (ctrl?.paused) {
      db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(campaignId);
      if (io) io.emit("campaign:progress", { campaignId, sent: sentCount, failed: failedCount, skipped: skippedCount, total: messages.length, paused: true });
      await new Promise(r => setTimeout(r, 2000));
      const u = activeCampaigns.get(campaignId);
      if (!u || u.cancelled) break;
      if (!u.paused) { db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(campaignId); break; }
    }

    const msg = messages[i];
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(msg.contact_id);

    if (!contact || !contact.opted_in) {
      db.prepare("UPDATE message_logs SET status = 'skipped', error_message = 'No opt-in' WHERE id = ?").run(msg.id);
      skippedCount++; emitProgress(io, campaignId, sentCount, failedCount, skippedCount, messages.length); continue;
    }
    if (!isUtility && contact.msgs_today >= MAX_MARKETING_PER_DAY) {
      db.prepare("UPDATE message_logs SET status = 'skipped', error_message = 'Frequency cap' WHERE id = ?").run(msg.id);
      skippedCount++; emitProgress(io, campaignId, sentCount, failedCount, skippedCount, messages.length); continue;
    }

    let text = templateBody;
    const allVars = { ...varValues, name: contact.name };
    Object.entries(allVars).forEach(([k, v]) => { text = text.replaceAll(`{{${k}}}`, v || `{{${k}}}`); });
    text += OPT_OUT_FOOTER;

    let success = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        let result;
        if (mediaPath) {
          result = await wa.sendMessageWithMedia(contact.phone, text, mediaPath);
        } else {
          result = await wa.sendMessage(contact.phone, text);
        }
        db.prepare("UPDATE message_logs SET status = 'sent', wa_message_id = ?, sent_at = datetime('now') WHERE id = ?").run(result.messageId || "", msg.id);
        db.prepare("UPDATE contacts SET msgs_today = msgs_today + 1, msgs_total = msgs_total + 1, last_msg_date = datetime('now') WHERE id = ?").run(contact.id);
        sentCount++; success = true;
        console.log(`  ✅ ${i+1}/${messages.length} → ${contact.name}`);
        break;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          db.prepare("UPDATE message_logs SET status = 'failed', error_message = ? WHERE id = ?").run(err.message, msg.id);
          failedCount++;
          console.error(`  ❌ ${i+1}/${messages.length} → ${contact.name}: ${err.message}`);
        } else { await new Promise(r => setTimeout(r, 3000)); }
      }
    }
    emitProgress(io, campaignId, sentCount, failedCount, skippedCount, messages.length);
    if (i < messages.length - 1) await new Promise(r => setTimeout(r, DELAY_BETWEEN_MSGS));
  }

  activeCampaigns.delete(campaignId);
  db.prepare("UPDATE campaigns SET status = 'completed', total_sent = ?, total_failed = ?, total_skipped = ?, completed_at = datetime('now') WHERE id = ?")
    .run(sentCount, failedCount, skippedCount, campaignId);
  emitProgress(io, campaignId, sentCount, failedCount, skippedCount, messages.length, true);
  return { sentCount, failedCount, skippedCount };
}

function emitProgress(io, cid, sent, failed, skipped, total, done = false) {
  if (io) io.emit("campaign:progress", { campaignId: cid, sent, failed, skipped, total, done });
}

function pauseCampaign(id) { const c = activeCampaigns.get(id); if (c) c.paused = true; }
function resumeCampaign(id) { const c = activeCampaigns.get(id); if (c) c.paused = false; }
function cancelCampaign(id) { const c = activeCampaigns.get(id); if (c) { c.cancelled = true; c.paused = false; } }

// FIX: Now stores template_body + template_category directly
function createCampaign({ templateId, templateName, templateBody, templateCategory, mediaPath, varValues, contactIds, scheduleType, scheduledAt }) {
  resetDailyCountersIfNeeded();
  if (!templateBody?.trim()) throw new Error("Template body is empty");

  const campaign = db.prepare(`
    INSERT INTO campaigns (template_id, template_name, template_body, template_category, media_path, var_values, total_contacts, schedule_type, scheduled_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(templateId||null, templateName, templateBody, templateCategory||"Promo", mediaPath||null, JSON.stringify(varValues||{}), contactIds.length, scheduleType||"now", scheduledAt||null, scheduleType==="later"?"scheduled":"pending");

  const campaignId = campaign.lastInsertRowid;
  const ins = db.prepare("INSERT INTO message_logs (campaign_id, contact_id, contact_phone, contact_name, status) VALUES (?, ?, ?, ?, 'queued')");
  const insertMany = db.transaction((ids) => {
    for (const cid of ids) { const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(cid); if (c) ins.run(campaignId, c.id, c.phone, c.name); }
  });
  insertMany(contactIds);
  if (scheduleType === "later" && scheduledAt) db.prepare("INSERT INTO scheduled_jobs (campaign_id, run_at) VALUES (?, ?)").run(campaignId, scheduledAt);
  return campaignId;
}

export { sendCampaign, createCampaign, pauseCampaign, resumeCampaign, cancelCampaign };
