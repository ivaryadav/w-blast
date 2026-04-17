import { Router } from "express";
import { db } from "../db.js";
import { createCampaign, sendCampaign, pauseCampaign, resumeCampaign, cancelCampaign } from "../services/campaign.js";

const router = Router();

router.get("/", (req, res) => {
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 50").all();
  res.json(campaigns);
});

router.get("/:id", (req, res) => {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Not found" });
  const logs = db.prepare("SELECT * FROM message_logs WHERE campaign_id = ? ORDER BY id").all(req.params.id);
  res.json({ ...campaign, messages: logs });
});

// SEND — now requires templateBody + templateCategory from frontend
router.post("/send", async (req, res) => {
  try {
    const { templateId, templateName, templateBody, templateCategory, mediaPath, varValues, contactIds, scheduleType, scheduledAt } = req.body;
    if (!contactIds?.length) return res.status(400).json({ error: "No contacts selected" });
    if (!templateBody?.trim()) return res.status(400).json({ error: "Template body is empty" });

    const campaignId = createCampaign({
      templateId, templateName, templateBody, templateCategory, mediaPath,
      varValues: varValues || {}, contactIds, scheduleType, scheduledAt,
    });

    if (scheduleType === "later") return res.json({ success: true, campaignId, status: "scheduled" });

    const io = req.app.get("io");
    sendCampaign(campaignId, io).catch((err) => {
      console.error("Campaign error:", err);
      db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaignId);
    });

    res.json({ success: true, campaignId, status: "sending" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PAUSE / RESUME / CANCEL
router.post("/:id/pause", (req, res) => { pauseCampaign(Number(req.params.id)); res.json({ success: true }); });
router.post("/:id/resume", (req, res) => { resumeCampaign(Number(req.params.id)); res.json({ success: true }); });
router.post("/:id/cancel", (req, res) => { cancelCampaign(Number(req.params.id)); res.json({ success: true }); });

router.get("/:id/progress", (req, res) => {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Not found" });
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) as queued
    FROM message_logs WHERE campaign_id = ?
  `).get(req.params.id);
  res.json({ campaignStatus: campaign.status, ...stats });
});

export default router;
