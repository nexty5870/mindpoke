# 🧠 Mindpoke

> A proactive learning agent that pokes you with interesting content

**Stop scrolling. Start getting poked.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Mindpoke?

Most content consumption is reactive: you open Twitter, Reddit, or HN and scroll until something catches your eye. This is inefficient and addictive.

**Mindpoke flips the model.** You define what you care about. Mindpoke watches the internet and *pokes* you when something genuinely interesting appears — not through another feed to doom-scroll, but through a direct notification with context on why it matters to you.

```
┌─────────────────────────────────────────────────────────┐
│  "I told Mindpoke I care about AI agents, local LLMs,  │
│   and TypeScript tooling. Now, instead of spending     │
│   2 hours on Twitter, I get 3-5 pokes per day with     │
│   genuinely relevant content."                          │
└─────────────────────────────────────────────────────────┘
```

## ✨ Features

- **🕸️ Interest Graph** — Visual node graph of your interests with heat levels and connections
- **🔍 Multi-Source Discovery** — Search X/Twitter, Reddit, HackerNews (more coming)
- **📊 Relevance Scoring** — 0-100 scoring based on keywords, engagement, and quality signals
- **🔥 Heat & Decay** — Active interests get priority, stale ones fade
- **📱 Proactive Pokes** — WhatsApp/Telegram notifications for high-relevance content
- **🔖 Bookmark Bootstrap** — Import your X bookmarks to seed interests

## 🖼️ Design

Cyber-Serif aesthetic — terminal brutalism meets editorial sophistication:

- Charcoal (#0a0a0f) + Cyan (#00d4aa) + Amber (#ffb000)
- Sharp corners, ASCII decorations, no rounded anything
- Terminal-style labels: `SYSTEM_STATUS`, `MODULE_LOAD`, `PROCESSING_STREAM`

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+
- [Bird CLI](https://github.com/steipete/bird) for X/Twitter access

### Installation

```bash
# Clone the repo
git clone https://github.com/nexty5870/mindpoke.git
cd mindpoke

# Install dependencies
bun install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL
```

### Database Setup

```bash
# Create database (if using existing Postgres)
psql -U postgres -c "CREATE DATABASE mindpoke;"

# Push schema
bun drizzle-kit push
```

### Run

```bash
bun dev --port 3003
```

Open [http://localhost:3003](http://localhost:3003)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Visualization | React Flow (@xyflow/react) |
| Animations | Framer Motion |
| Database | PostgreSQL + Drizzle ORM |
| X/Twitter | Bird CLI (@steipete/bird) |
| Package Manager | Bun |

## 📁 Project Structure

```
mindpoke/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── interests/     # Interest CRUD
│   │   │   ├── discoveries/   # Discovery CRUD
│   │   │   ├── discover/      # Run discovery search
│   │   │   └── ingest/        # Bookmark ingestion
│   │   └── page.tsx           # Main UI
│   ├── components/
│   │   └── mindpoke/          # Core components
│   ├── hooks/
│   │   └── use-mindpoke-data.ts
│   └── lib/
│       ├── db/                # Drizzle schema + connection
│       └── sources/           # Bird CLI wrapper
├── drizzle.config.ts
├── PRD.md                     # Full product spec
└── README.md
```

## 🗄️ Database Schema

```
interests          — Your topics (nodes in the graph)
discoveries        — Found content from sources
pokes              — Notification history
interest_connections — Graph edges between interests
settings           — App configuration
```

See [PRD.md](./PRD.md) for full schema details.

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/interests` | GET/POST | List or create interests |
| `/api/interests/[id]` | GET/PATCH/DELETE | Single interest ops |
| `/api/discoveries` | GET/POST | List or create discoveries |
| `/api/discoveries/[id]` | GET/PATCH/DELETE | Single discovery ops |
| `/api/discover` | POST | Run discovery search |
| `/api/ingest/bookmarks` | GET | Fetch & analyze X bookmarks |

## 📋 Roadmap

- [x] Interest graph visualization
- [x] X/Twitter discovery via Bird CLI
- [x] Bookmark ingestion for onboarding
- [x] Database persistence (Postgres + Drizzle)
- [ ] WhatsApp/Telegram notification pokes
- [ ] Reddit integration
- [ ] HackerNews integration
- [ ] Heat decay cron jobs
- [ ] Engagement tracking (save/dismiss affects scores)

## 🤝 Contributing

Contributions welcome! Please read the [PRD](./PRD.md) first to understand the vision.

## 📄 License

MIT © [Quentin](https://github.com/nexty5870)

---

<p align="center">
  <i>"Stop scrolling. Start getting poked."</i>
</p>
