# AGENTS.md - Mindpoke Codebase Guide

## Project Overview

Mindpoke is a proactive learning agent/content discovery platform built with:
- **Framework**: Next.js 16 + TypeScript 5 (App Router)
- **React**: v19 with functional components and hooks
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Database**: PostgreSQL + Drizzle ORM 0.45
- **Package Manager**: Bun (preferred) or npm
- **Visualization**: React Flow (@xyflow/react) for interest graph

## Build/Lint/Test Commands

```bash
# Development
bun dev                    # Start dev server (or npm run dev)
bun build                  # Production build
bun start                  # Start production server

# Linting
bun lint                   # Run ESLint

# Database
bun drizzle-kit push       # Push schema changes to PostgreSQL
bun drizzle-kit generate   # Generate migrations

# No test framework configured yet
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # REST API routes
│   │   ├── interests/     # Interest CRUD (/api/interests)
│   │   ├── discoveries/   # Discovery CRUD (/api/discoveries)
│   │   ├── discover/      # Run discovery search
│   │   └── ingest/        # Bookmark ingestion
│   ├── page.tsx           # Main page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles + design tokens
├── components/
│   ├── mindpoke/          # App-specific components
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks (use-*.ts)
├── lib/
│   ├── db/                # Drizzle schema + connection
│   ├── sources/           # External data sources
│   └── utils.ts           # Utility functions (cn, etc.)
└── types/                 # TypeScript type definitions
```

## Code Style Guidelines

### Import Order

Organize imports in this order, with blank lines between groups:

```typescript
// 1. Framework/external packages
import { NextResponse } from "next/server";
import { useState, useCallback } from "react";

// 2. Internal libraries and utilities
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

// 3. Schema, types, components
import { interests } from "@/lib/db/schema";
import type { Interest } from "@/types";
```

### Path Aliases

Always use the `@/*` alias for imports from `src/`:
```typescript
import { db } from "@/lib/db";           // Good
import { db } from "../../../lib/db";    // Bad
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `use-mindpoke-data.ts`, `interest-graph.tsx` |
| Components | PascalCase | `InterestGraph`, `DiscoveryFeed` |
| Functions | camelCase | `handleAddInterest`, `mapDiscovery` |
| Types/Interfaces | PascalCase | `Interest`, `Discovery` |
| Database columns | snake_case | `created_at`, `interest_id` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `API_TIMEOUT` |

### TypeScript Guidelines

- Strict mode is enabled - respect it
- Use `type` imports for type-only imports: `import type { Interest } from "@/types"`
- Define interfaces for component props at top of file
- Leverage Drizzle's type inference: `typeof interests.$inferSelect`
- Let TypeScript infer return types when obvious

### Component Patterns

```typescript
"use client";  // Required for client components

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface ComponentProps {
  items: Interest[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function MyComponent({ items, selectedId, onSelect }: ComponentProps) {
  // Use cn() for conditional classes
  return (
    <div className={cn(
      "base-classes",
      selectedId && "selected-classes"
    )}>
      {/* content */}
    </div>
  );
}
```

### API Route Patterns

Use consistent response format across all API routes:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const data = await db.query.tableName.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.requiredField) {
      return NextResponse.json(
        { success: false, error: "Required field missing" },
        { status: 400 }
      );
    }
    
    const [result] = await db.insert(table).values({ ... }).returning();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to create:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create" },
      { status: 500 }
    );
  }
}
```

### Custom Hooks

- Place in `src/hooks/` with `use-` prefix
- Add `"use client"` directive at top
- Return object with state and callbacks

### Error Handling

- Wrap async operations in try-catch
- Log errors with `console.error()` and descriptive prefix
- Return user-friendly error messages in API responses
- Use HTTP status codes: 200 (success), 400 (bad request), 500 (server error)

## Design System: "Cyber-Serif"

The UI follows a terminal brutalism + editorial aesthetic:

### CSS Custom Properties (defined in globals.css)

```css
--cyber-bg: #0a0a0f;        /* Background */
--cyber-surface: #111113;    /* Card/panel surfaces */
--cyber-cyan: #00d4aa;       /* Primary accent */
--cyber-amber: #ffb000;      /* Secondary accent */
--cyber-text: #e6e6e6;       /* Primary text */
--cyber-muted: #888888;      /* Muted text */
```

### Typography Classes

- `font-serif` - Crimson Pro for headings
- `font-terminal` - JetBrains Mono for terminal/code text

### Style Rules

- Sharp corners only (`border-radius: 0`)
- ASCII box drawing characters for decorations (`┌┐└┘`)
- Terminal-style labels in uppercase (`SYSTEM_STATUS`)

## Database Schema

Tables: `interests`, `discoveries`, `interest_connections`, `pokes`, `settings`

Type inference from schema:
```typescript
import type { Interest, Discovery } from "@/lib/db/schema";
// or
type Interest = typeof interests.$inferSelect;
```

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/mindpoke
```

## Key Dependencies

- `@xyflow/react` - Graph visualization
- `framer-motion` - Animations
- `lucide-react` - Icons
- `sonner` - Toast notifications
- `drizzle-orm` - Database ORM
- `date-fns` - Date formatting
