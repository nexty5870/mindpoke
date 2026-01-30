# Mindpoke - Product Requirements Document

> **A proactive learning agent that pokes you with interesting content**

**Domain:** mindpoke.com  
**Repository:** https://github.com/nexty5870/mindpoke  
**Status:** MVP In Development  
**Last Updated:** 2026-01-30

---

## Vision

Most content consumption is reactive: you open Twitter, Reddit, or HN and scroll until something catches your eye. This is inefficient and addictive.

**Mindpoke flips the model.** You define what you care about. Mindpoke watches the internet and *pokes* you when something genuinely interesting appears — not through another feed to doom-scroll, but through a direct notification with context on why it matters to you.

### The Promise

> "I told Mindpoke I care about AI agents, local LLMs, and TypeScript tooling. Now, instead of spending 2 hours on Twitter, I get 3-5 pokes per day with genuinely relevant content. My learning is curated, not accidental."

---

## Core Concepts

### Interest Graph

Your interests aren't a flat list — they're a **graph** of interconnected topics. "AI Agents" connects to "Memory Systems" which connects to "Vector Databases." Mindpoke visualizes this graph and uses it to:

- Find content that bridges multiple interests (higher relevance)
- Suggest new interests based on what you save
- Show how your curiosity evolves over time

### Heat & Decay

Interests have **heat levels** that decay over time:
- Saving content → increases heat
- Dismissing content → decreases heat  
- No engagement → gradual decay

Cold interests get deprioritized. Hot interests get more discovery attention. This prevents stale topics from cluttering your feed.

### Relevance Scoring

Every piece of content gets a **relevance score (0-100)** based on:
- Keyword matches with your interests
- Engagement metrics (likes, retweets, replies)
- Content quality signals (has article, is thread, author reputation)
- Recency (recent beats old)

Only content above your threshold gets surfaced.

### Proactive Pokes

The killer feature: **WhatsApp/Telegram notifications** when high-relevance content appears. Not a daily digest. Not a feed to check. A direct poke saying:

> "🧠 Found something for **AI Agents** (94% match):  
> 'How to build an agent that never forgets' by @rohit4verse  
> [View] [Save] [Dismiss]"

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MINDPOKE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   SOURCES   │    │   ENGINE    │    │   DELIVERY  │        │
│   ├─────────────┤    ├─────────────┤    ├─────────────┤        │
│   │ X/Twitter   │───▶│ Discovery   │───▶│ WhatsApp    │        │
│   │ Reddit      │    │ Scoring     │    │ Telegram    │        │
│   │ HackerNews  │    │ Dedup       │    │ Web UI      │        │
│   │ RSS         │    │ Ranking     │    │ Email       │        │
│   │ Arxiv       │    └─────────────┘    └─────────────┘        │
│   └─────────────┘           │                                   │
│                             ▼                                   │
│                    ┌─────────────┐                              │
│                    │  POSTGRES   │                              │
│                    ├─────────────┤                              │
│                    │ interests   │                              │
│                    │ discoveries │                              │
│                    │ pokes       │                              │
│                    │ settings    │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Visualization** | React Flow (@xyflow/react) |
| **Animations** | Framer Motion |
| **Database** | PostgreSQL + Drizzle ORM |
| **Package Manager** | Bun |
| **X/Twitter** | Bird CLI (@steipete/bird) |
| **Notifications** | Moltbot (WhatsApp/Telegram) |

### Design System: Cyber-Serif

A distinctive aesthetic combining terminal brutalism with editorial sophistication:

- **Typography:** Crimson Pro (serif headers) + JetBrains Mono (terminal text)
- **Colors:** Charcoal (#0a0a0f), Cyan (#00d4aa), Amber (#ffb000)
- **Style:** Sharp corners, ASCII decorations (┌┐└┘), no rounded elements
- **Labels:** Terminal-style (SYSTEM_STATUS, MODULE_LOAD, PROCESSING_STREAM)

---

## Features

### ✅ Built (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| **Interest Graph** | Visual node graph with heat levels, drag-and-drop positioning | ✅ Working |
| **Discovery Feed** | Card-based feed with relevance scores and engagement metrics | ✅ Working |
| **Bookmark Ingestion** | Import X bookmarks, extract keywords, suggest interests | ✅ Working |
| **Discovery Search** | Search X via Bird CLI based on interest keywords | ✅ Working |
| **Relevance Scoring** | 0-100 scoring based on keywords + engagement + quality | ✅ Working |
| **Database Persistence** | Postgres + Drizzle for interests, discoveries, pokes | ✅ Working |
| **Cyber-Serif UI** | Distinctive terminal-meets-editorial design | ✅ Working |

### 🚧 In Progress

| Feature | Description | Priority |
|---------|-------------|----------|
| **WhatsApp Pokes** | Push notifications via Moltbot cron | High |
| **Engagement Tracking** | Save/dismiss affects relevance scoring | High |
| **Interest Connections** | Graph edges based on co-occurring discoveries | Medium |

### 📋 Planned

| Feature | Description | Priority |
|---------|-------------|----------|
| **Reddit Integration** | Discover from r/LocalLLaMA, r/MachineLearning, etc. | High |
| **HackerNews Integration** | Front page + Show HN + relevant comments | High |
| **RSS Feeds** | Custom blog/newsletter sources | Medium |
| **Arxiv Papers** | Academic paper discovery | Medium |
| **Heat Decay Cron** | Nightly job to decay inactive interests | Medium |
| **Embedding Search** | Semantic similarity via pgvector | Low |
| **Multi-user Support** | Auth + separate interest graphs | Low |

---

## Database Schema

```sql
-- Core interests (nodes in the graph)
interests (
  id UUID PRIMARY KEY,
  name TEXT,
  keywords TEXT[],
  priority TEXT,        -- low, medium, high
  heat REAL,            -- 0-100, decays over time
  color TEXT,
  position_x REAL,
  position_y REAL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Discovered content
discoveries (
  id UUID PRIMARY KEY,
  source_type TEXT,     -- twitter, reddit, hackernews, rss
  source_id TEXT,       -- external ID
  source_url TEXT,
  title TEXT,
  content TEXT,
  author TEXT,
  author_handle TEXT,
  metadata JSONB,       -- engagement stats, etc.
  relevance_score REAL,
  interest_id UUID,     -- linked interest
  matched_keywords TEXT[],
  status TEXT,          -- unseen, seen, saved, dismissed
  published_at TIMESTAMP,
  discovered_at TIMESTAMP
)

-- Notification history
pokes (
  id UUID PRIMARY KEY,
  discovery_id UUID,
  interest_id UUID,
  message TEXT,
  channel TEXT,         -- whatsapp, telegram, email
  sent_at TIMESTAMP,
  response TEXT         -- clicked, saved, dismissed, ignored
)

-- Graph edges
interest_connections (
  source_id UUID,
  target_id UUID,
  strength REAL,
  PRIMARY KEY (source_id, target_id)
)
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/interests` | GET | List all interests |
| `/api/interests` | POST | Create interest |
| `/api/interests/[id]` | GET/PATCH/DELETE | Single interest CRUD |
| `/api/discoveries` | GET | List discoveries (with filters) |
| `/api/discoveries` | POST | Create discoveries |
| `/api/discoveries/[id]` | GET/PATCH/DELETE | Single discovery CRUD |
| `/api/discover` | POST | Run discovery search across sources |
| `/api/ingest/bookmarks` | GET | Fetch and analyze X bookmarks |

---

## User Flows

### 1. Onboarding (Bootstrap from Bookmarks)

```
User clicks "INGEST_BOOKMARKS"
  → Fetch last 50 X bookmarks via Bird CLI
  → Extract keywords from each bookmark
  → Aggregate into suggested interests
  → User clicks "+" to add interests as graph nodes
  → Interests saved to database
```

### 2. Discovery

```
User clicks "DISCOVER_NOW" (or cron triggers)
  → For each interest with heat > threshold:
    → Search X for interest keywords
    → Score results for relevance
    → Deduplicate against existing discoveries
    → Save new discoveries to database
  → Update feed view with new content
```

### 3. Poke (Notification)

```
Cron runs every 30 minutes:
  → Check for unseen discoveries with score > 80
  → For each:
    → Format poke message with context
    → Send via WhatsApp/Telegram
    → Log poke in database
  → User responds (save/dismiss)
  → Update discovery status + interest heat
```

### 4. Engagement Loop

```
User saves discovery:
  → Mark discovery as "saved"
  → Increase heat on linked interest (+5)
  → Strengthen keyword weights

User dismisses discovery:
  → Mark discovery as "dismissed"  
  → Decrease heat on linked interest (-2)
  → Weaken keyword weights

No interaction after 24h:
  → Mark as "ignored"
  → Slight heat decrease (-1)
```

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Poke Open Rate** | >60% | Are we surfacing genuinely interesting content? |
| **Save Rate** | >20% | Is the relevance scoring accurate? |
| **Dismiss Rate** | <30% | Are we being too noisy? |
| **Daily Active Interests** | 5-15 | Is the user engaged with the graph? |
| **Time to First Poke** | <5 min | Can users get value immediately? |

---

## Competitive Landscape

| Product | Approach | Mindpoke Difference |
|---------|----------|---------------------|
| **Twitter Lists** | Manual curation | Mindpoke auto-discovers, scores relevance |
| **Feedly** | RSS aggregation | Mindpoke is push-first, not feed-based |
| **Pocket** | Save for later | Mindpoke is proactive, not reactive |
| **Readwise** | Highlight management | Mindpoke focuses on discovery, not retention |
| **Perplexity** | Search-based | Mindpoke is interest-based, continuous |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **API Rate Limits** | Can't discover enough | Batch requests, cache results, prioritize hot interests |
| **Notification Fatigue** | User ignores pokes | Strict relevance threshold, quiet hours, daily caps |
| **Stale Interests** | Irrelevant content | Heat decay, periodic review prompts |
| **Bird CLI Auth** | X access breaks | Fallback to public search, add Reddit/HN as primary |

---

## Roadmap

### Phase 1: Core Loop (Current)
- [x] Interest graph visualization
- [x] X/Twitter discovery via Bird CLI
- [x] Bookmark ingestion for onboarding
- [x] Database persistence
- [ ] WhatsApp notification pokes
- [ ] Basic engagement tracking

### Phase 2: Multi-Source
- [ ] Reddit integration
- [ ] HackerNews integration
- [ ] RSS feed support
- [ ] Interest connection edges

### Phase 3: Intelligence
- [ ] Embedding-based semantic search
- [ ] Auto-suggest new interests
- [ ] Heat decay + maintenance crons
- [ ] Learning from engagement patterns

### Phase 4: Scale
- [ ] Multi-user support
- [ ] Public launch
- [ ] Mobile app (React Native)
- [ ] Team/shared interest graphs

---

## Getting Started

```bash
# Clone
git clone https://github.com/nexty5870/mindpoke.git
cd mindpoke

# Install
bun install

# Database (uses existing Postgres on localhost:5432)
# Create database: CREATE DATABASE mindpoke;
bun drizzle-kit push

# Environment
cp .env.example .env.local
# Set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mindpoke

# Run
bun dev --port 3003
```

---

## Team

Built by **Quentin** with **Leo** (AI pair programmer)

---

*"Stop scrolling. Start getting poked."*
