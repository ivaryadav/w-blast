# 💬 WhatsApp Retail Blast — FREE Edition

Send WhatsApp promotional blasts, loyalty rewards, cart reminders, and order updates — **using your own WhatsApp account, with zero cost and zero API keys.**

## How It Works

Instead of paying for Meta's Business API, this app connects directly to **WhatsApp Web** through your browser. You scan a QR code once, and you're connected. It uses the same mechanism as WhatsApp Desktop.

```
Your Phone ←→ WhatsApp Web Session ←→ This App ←→ Your Customers
```

---

## 🚀 Setup (2 minutes)

### Prerequisites
- **Node.js 18+** — [download here](https://nodejs.org/)
- **A WhatsApp account** (personal or business — both work)

### Install & Run

```bash
# 1. Install dependencies (first time only, takes ~60s)
npm install

# 2. Start the app
npm run dev
```

### 3. Open & Connect
1. Open **http://localhost:3000** in your browser
2. Click **"Connect WhatsApp"**
3. Scan the **QR code** with your phone (WhatsApp → Linked Devices → Link a Device)
4. Done! You're connected.

The session is saved — you won't need to scan again unless you log out.

---

## ✅ What's Included

| Feature | Details |
|---------|---------|
| **QR Code Login** | Scan once, session persists across restarts |
| **Contact Sync** | Import contacts directly from your WhatsApp |
| **Contact Search** | Filter by name or phone across 1000+ contacts |
| **Contact Groups** | Create segments like "VIP", "Diwali List", filter by group |
| **CSV Upload** | Import customer spreadsheet with one click |
| **8 Built-in Templates** | Flash sale, loyalty, restock, cart reminder, etc. |
| **Custom Templates** | Create, edit, delete your own with {{variables}} |
| **Image Attachments** | Attach product photos to promotional messages |
| **Individual Selection** | Checkbox to pick exactly who gets the message |
| **Save as Group** | Save your selection as a reusable contact group |
| **Bulk Import** | Paste Name, Phone pairs to add many contacts |
| **Test Send** | Send a test to yourself before blasting 300 people |
| **Confirmation Dialog** | "Are you sure?" popup before live sends |
| **Opt-in / Opt-out** | STOP replies auto-unsubscribe contacts |
| **Frequency Cap** | Max 2 marketing messages per contact per day |
| **Pause / Resume / Cancel** | Control campaigns mid-send |
| **Scheduling** | Schedule campaigns for a specific date/time |
| **Retry Logic** | Failed messages auto-retry once |
| **Analytics Dashboard** | Delivery rates, success rates, visual bar charts |
| **Campaign History** | Full log with per-campaign progress bars |
| **Real-time Progress** | Live send counter via WebSocket |
| **Rate Limiting** | 2.5s between messages to avoid bans |
| **Auto-Reconnect** | WhatsApp + server disconnect recovery |
| **Graceful Shutdown** | Ctrl+C properly saves session |
| **SQLite Database** | All data persists locally |

---

## 📁 Project Structure

```
wa-blast/
├── package.json
├── vite.config.js
├── index.html
├── src/                    ← Frontend (React)
│   ├── main.jsx
│   ├── App.jsx             ← Full UI
│   └── api.js              ← API client
├── server/                 ← Backend (Express)
│   ├── index.js            ← Server + Socket.IO
│   ├── db.js               ← SQLite database
│   ├── routes/
│   │   ├── contacts.js     ← CRUD + WhatsApp sync
│   │   ├── templates.js    ← CRUD
│   │   └── campaigns.js    ← Send + progress
│   └── services/
│       ├── whatsapp.js     ← WhatsApp Web connection
│       ├── campaign.js     ← Message sender
│       └── scheduler.js    ← Scheduled campaigns
└── data/                   ← Auto-created (database + session)
```

---

## ⚠️ Important Notes

### Rate Limits
WhatsApp has unofficial limits for personal accounts. To stay safe:
- The app waits **2.5 seconds** between each message
- Don't send more than **200-300 messages per day** on a personal number
- A WhatsApp Business account has slightly higher limits
- If your number gets flagged, reduce volume and wait 24-48 hours

### Best Practices
- Always get **consent** before messaging customers
- Include **opt-out** (STOP) in every message (the app does this automatically)
- Don't spam — focus on value (offers, updates, rewards)
- Space out campaigns — don't blast the same people every day
- Start with small batches (20-50 contacts) and scale up gradually

### Session Persistence
The WhatsApp session is saved in `./data/wa-session/`. To start fresh:
```bash
rm -rf data/wa-session
```
Then restart the app and scan QR again.

---

## 🔧 Troubleshooting

**"Scan QR code" — nothing happens after clicking Connect**
→ First run downloads Chromium (~170MB). Wait 1-2 minutes.

**QR code expired**
→ It auto-refreshes. If not, click Connect again.

**Messages not sending**
→ Check your phone has internet and WhatsApp Web is still linked.

**"Phone number not on WhatsApp"**
→ The number must be registered on WhatsApp. Verify the country code.

**Too many messages — account flagged**
→ Reduce volume, wait 24-48 hours, then resume slowly.
