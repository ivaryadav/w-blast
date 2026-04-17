/**
 * WhatsApp Web Service — FREE, no API key needed.
 *
 * Uses whatsapp-web.js to connect to your own WhatsApp account.
 * You scan a QR code once, and the session persists.
 *
 * This replaces the paid Meta Cloud API entirely.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from "qrcode";

let client = null;
let qrDataUrl = null;
let connectionState = "disconnected"; // disconnected | qr_ready | connecting | ready
let clientInfo = null;
let io = null; // Socket.IO reference for real-time updates

// ─── INITIALIZE CLIENT ───
function createClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./data/wa-session" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    },
  });

  // ─── QR CODE EVENT ───
  client.on("qr", async (qr) => {
    console.log("📱 QR Code received — scan with WhatsApp");
    connectionState = "qr_ready";
    try {
      qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
    } catch (e) {
      console.error("QR generation error:", e);
    }
    if (io) io.emit("wa:qr", { qr: qrDataUrl });
  });

  // ─── READY EVENT ───
  client.on("ready", () => {
    console.log("✅ WhatsApp connected!");
    connectionState = "ready";
    qrDataUrl = null;
    clientInfo = {
      pushname: client.info?.pushname || "Unknown",
      phone: client.info?.wid?.user || "Unknown",
      platform: client.info?.platform || "Unknown",
    };
    if (io) io.emit("wa:ready", clientInfo);
  });

  // ─── AUTHENTICATED ───
  client.on("authenticated", () => {
    console.log("🔑 Session authenticated (saved for next time)");
    connectionState = "connecting";
    if (io) io.emit("wa:auth", { status: "authenticated" });
  });

  // ─── DISCONNECTED ───
  client.on("disconnected", (reason) => {
    console.log("❌ WhatsApp disconnected:", reason);
    connectionState = "disconnected";
    clientInfo = null;
    qrDataUrl = null;
    if (io) io.emit("wa:disconnected", { reason });

    // Auto-reconnect after 5 seconds (unless intentional logout)
    if (reason !== "LOGOUT") {
      console.log("🔄 Will attempt reconnection in 5 seconds...");
      setTimeout(async () => {
        try {
          client = null; // Reset client
          createClient();
          connectionState = "connecting";
          if (io) io.emit("wa:status", { state: "connecting", qr: null, info: null });
          await client.initialize();
        } catch (err) {
          console.error("Reconnection failed:", err.message);
          connectionState = "disconnected";
          if (io) io.emit("wa:disconnected", { reason: "Reconnection failed: " + err.message });
        }
      }, 5000);
    }
  });

  // ─── CONNECTION LOST (phone offline, etc.) ───
  client.on("change_state", (state) => {
    console.log("📡 WhatsApp state changed:", state);
    if (state === "CONFLICT" || state === "UNLAUNCHED" || state === "UNPAIRED") {
      connectionState = "disconnected";
      if (io) io.emit("wa:disconnected", { reason: state });
    }
  });

  // ─── INCOMING MESSAGES (for STOP opt-out) ───
  client.on("message", async (msg) => {
    const text = msg.body?.trim().toUpperCase();
    if (["STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "CANCEL"].includes(text)) {
      const phone = msg.from.replace("@c.us", "");
      console.log(`🛑 Opt-out received from ${phone}`);
      if (io) io.emit("wa:optout", { phone });

      // Auto-reply confirmation
      try {
        await msg.reply(
          "✅ You've been unsubscribed. You won't receive marketing messages from us.\n\nReply HI to re-subscribe."
        );
      } catch (e) {
        console.error("Reply failed:", e.message);
      }
    }

    if (["HI", "START", "SUBSCRIBE", "OPT IN", "OPTIN"].includes(text)) {
      const phone = msg.from.replace("@c.us", "");
      console.log(`✅ Re-opt-in from ${phone}`);
      if (io) io.emit("wa:optin", { phone });
    }
  });

  return client;
}

// ─── START / CONNECT ───
async function start(socketIo) {
  io = socketIo;
  if (!client) createClient();
  if (connectionState === "disconnected" || connectionState === "qr_ready") {
    connectionState = "connecting";
    try {
      await client.initialize();
    } catch (err) {
      console.error("WhatsApp init error:", err.message);
      connectionState = "disconnected";
    }
  }
}

// ─── DISCONNECT / LOGOUT ───
async function logout() {
  if (client) {
    try {
      await client.logout();
    } catch (e) {}
    try {
      await client.destroy();
    } catch (e) {}
    client = null;
    connectionState = "disconnected";
    clientInfo = null;
    qrDataUrl = null;
  }
}

// ─── GET STATUS ───
function getStatus() {
  return {
    state: connectionState,
    qr: qrDataUrl,
    info: clientInfo,
  };
}

// ─── SEND TEXT MESSAGE ───
async function sendMessage(phone, text) {
  if (connectionState !== "ready") {
    throw new Error("WhatsApp not connected. Scan QR code first.");
  }

  // Format phone: remove spaces, dashes, leading +
  // WhatsApp expects: countrycode + number @ c.us (e.g. "919876543210@c.us")
  let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
  // If starts with 0, assume local — need country code
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "91" + cleanPhone.slice(1); // Default India — change as needed
  }
  const chatId = cleanPhone + "@c.us";

  // Check if the number is registered on WhatsApp
  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) {
    throw new Error(`${phone} is not on WhatsApp`);
  }

  const result = await client.sendMessage(chatId, text);
  return {
    success: true,
    messageId: result.id?.id || result.id,
    timestamp: result.timestamp,
  };
}

// ─── SEND MESSAGE WITH IMAGE ───
async function sendMessageWithMedia(phone, text, mediaPath, mimetype) {
  if (connectionState !== "ready") {
    throw new Error("WhatsApp not connected. Scan QR code first.");
  }

  let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "91" + cleanPhone.slice(1);
  const chatId = cleanPhone + "@c.us";

  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) throw new Error(`${phone} is not on WhatsApp`);

  const media = MessageMedia.fromFilePath(mediaPath);
  const result = await client.sendMessage(chatId, media, { caption: text });
  return {
    success: true,
    messageId: result.id?.id || result.id,
    timestamp: result.timestamp,
  };
}

// ─── GET ALL CONTACTS FROM WHATSAPP ───
async function getContacts() {
  if (connectionState !== "ready") {
    throw new Error("WhatsApp not connected");
  }

  const contacts = await client.getContacts();

  // Filter to real contacts (not groups, not business accounts, has a name)
  return contacts
    .filter((c) => {
      return (
        c.id?.server === "c.us" && // regular user (not group)
        !c.isMe &&
        !c.isGroup &&
        (c.name || c.pushname) &&
        c.id?.user // has a phone number
      );
    })
    .map((c) => ({
      wa_id: c.id._serialized,
      phone: "+" + c.id.user,
      name: c.name || c.pushname || c.id.user,
      pushname: c.pushname || "",
      isMyContact: c.isMyContact || false,
      profilePicUrl: null, // can fetch if needed
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── GET ALL CHATS ───
async function getChats() {
  if (connectionState !== "ready") throw new Error("WhatsApp not connected");

  const chats = await client.getChats();
  return chats
    .filter((c) => !c.isGroup)
    .slice(0, 100)
    .map((c) => ({
      id: c.id._serialized,
      name: c.name || c.id.user,
      lastMessage: c.lastMessage?.body?.slice(0, 50) || "",
      timestamp: c.timestamp,
      unreadCount: c.unreadCount,
    }));
}

// ─── CHECK IF NUMBER IS ON WHATSAPP ───
async function checkNumber(phone) {
  if (connectionState !== "ready") throw new Error("WhatsApp not connected");
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
  const chatId = cleanPhone + "@c.us";
  const isRegistered = await client.isRegisteredUser(chatId);
  return { phone, registered: isRegistered };
}

export default {
  start,
  logout,
  getStatus,
  sendMessage,
  sendMessageWithMedia,
  getContacts,
  getChats,
  checkNumber,
};
