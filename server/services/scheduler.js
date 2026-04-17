import { db } from "../db.js";
import { sendCampaign } from "./campaign.js";

function startScheduler(io) {
  console.log("⏰ Scheduler started (checks every 60s)");
  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const jobs = db.prepare("SELECT * FROM scheduled_jobs WHERE status = 'pending' AND run_at <= ?").all(now);
      for (const job of jobs) {
        console.log(`🚀 Running scheduled campaign #${job.campaign_id}`);
        db.prepare("UPDATE scheduled_jobs SET status = 'running' WHERE id = ?").run(job.id);
        try {
          await sendCampaign(job.campaign_id, io);
          db.prepare("UPDATE scheduled_jobs SET status = 'completed' WHERE id = ?").run(job.id);
        } catch (err) {
          console.error(`❌ Scheduled campaign failed:`, err.message);
          db.prepare("UPDATE scheduled_jobs SET status = 'failed' WHERE id = ?").run(job.id);
        }
      }
    } catch (err) { console.error("Scheduler error:", err); }
  }, 60_000);
}

export { startScheduler };
