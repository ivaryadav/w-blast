import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import contactsRouter from "./routes/contacts.js";
import templatesRouter from "./routes/templates.js";
import campaignsRouter from "./routes/campaigns.js";
import wa from "./services/whatsapp.js";
import { startScheduler } from "./services/scheduler.js";
import { resetDailyCountersIfNeeded } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = 3001;

// Socket.IO for real-time updates (QR code, send progress)
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

app.set("io", io);

// Middleware
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/contacts", contactsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/campaigns", campaignsRouter);

// ─── WHATSAPP STATUS ───
app.get("/api/wa/status", (req, res) => {
  res.json(wa.getStatus());
});

// ─── CONNECT WHATSAPP (triggers QR code) ───
app.post("/api/wa/connect", async (req, res) => {
  try {
    await wa.start(io);
    res.json({ success: true, message: "Connecting... scan QR code" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DISCONNECT / LOGOUT ───
app.post("/api/wa/logout", async (req, res) => {
  try {
    await wa.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  const waStatus = wa.getStatus();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    whatsapp: waStatus.state,
    whatsappInfo: waStatus.info,
  });
});

// TEST SEND — send a single message to yourself to verify everything works
app.post("/api/wa/test-send", async (req, res) => {
  try {
    const { phone, text } = req.body;
    if (!phone || !text) return res.status(400).json({ error: "Phone and text required" });
    const result = await wa.sendMessage(phone, text);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MEDIA UPLOAD — save image for use in campaigns
import fsNode from "fs";
import pathNode from "path";
const uploadDir = pathNode.join(__dirname, "..", "data", "uploads");
fsNode.mkdirSync(uploadDir, { recursive: true });

app.post("/api/media/upload", (req, res) => {
  try {
    const { data, filename: origName, mimetype } = req.body;
    if (!data) return res.status(400).json({ error: "No image data" });
    const ext = (mimetype || "image/jpeg").split("/")[1] || "jpg";
    const filename = `media_${Date.now()}.${ext}`;
    const filepath = pathNode.join(uploadDir, filename);
    // data is base64 string
    const buffer = Buffer.from(data, "base64");
    fsNode.writeFileSync(filepath, buffer);
    res.json({ success: true, filename, filepath, url: `/api/media/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded media
app.use("/api/media", express.static(uploadDir));

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "..", "dist")));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dist", "index.html")));
}

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🔌 Client connected");
  // Send current WA status immediately
  socket.emit("wa:status", wa.getStatus());
  socket.on("disconnect", () => console.log("🔌 Client disconnected"));
});

// Start
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  💬 WhatsApp Retail Blast — FREE Edition                 ║
║                                                          ║
║  Frontend:  http://localhost:3000                         ║
║  API:       http://localhost:${PORT}                        ║
║                                                          ║
║  ✅ No API key needed                                    ║
║  ✅ No Meta Business account needed                      ║
║  ✅ Uses your own WhatsApp via QR scan                   ║
║                                                          ║
║  Next: Open the app and click "Connect WhatsApp"         ║
╚══════════════════════════════════════════════════════════╝
  `);

  startScheduler(io);
  resetDailyCountersIfNeeded();

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    try { await wa.logout(); } catch {}
    server.close(() => { console.log("Server closed"); process.exit(0); });
    setTimeout(() => process.exit(1), 5000); // Force exit after 5s
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
});
