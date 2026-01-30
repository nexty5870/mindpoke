import { pgTable, text, timestamp, integer, real, boolean, jsonb, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// INTERESTS
// ============================================================================

export const interests = pgTable('interests', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  keywords: text('keywords').array().notNull().default([]),
  priority: text('priority').notNull().default('medium'), // low, medium, high
  heat: real('heat').notNull().default(50), // 0-100, decays over time
  color: text('color').notNull().default('#00d4aa'),
  
  // Graph position (for visualization)
  positionX: real('position_x'),
  positionY: real('position_y'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interestsRelations = relations(interests, ({ many }) => ({
  discoveries: many(discoveries),
  connections: many(interestConnections, { relationName: 'source' }),
  connectedBy: many(interestConnections, { relationName: 'target' }),
}));

// Interest connections (graph edges)
export const interestConnections = pgTable('interest_connections', {
  sourceId: uuid('source_id').notNull().references(() => interests.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => interests.id, { onDelete: 'cascade' }),
  strength: real('strength').notNull().default(1), // edge weight
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.sourceId, table.targetId] }),
}));

export const interestConnectionsRelations = relations(interestConnections, ({ one }) => ({
  source: one(interests, {
    fields: [interestConnections.sourceId],
    references: [interests.id],
    relationName: 'source',
  }),
  target: one(interests, {
    fields: [interestConnections.targetId],
    references: [interests.id],
    relationName: 'target',
  }),
}));

// ============================================================================
// DISCOVERIES
// ============================================================================

export const discoveries = pgTable('discoveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Source info
  sourceType: text('source_type').notNull(), // 'twitter', 'reddit', 'hackernews', 'rss'
  sourceId: text('source_id').notNull(), // external ID (tweet ID, reddit post ID, etc.)
  sourceUrl: text('source_url'),
  
  // Content
  title: text('title'),
  content: text('content').notNull(),
  author: text('author'),
  authorHandle: text('author_handle'),
  authorAvatar: text('author_avatar'),
  
  // Metadata
  metadata: jsonb('metadata').default({}), // source-specific data (retweets, upvotes, etc.)
  
  // Scoring
  relevanceScore: real('relevance_score').notNull().default(0),
  engagementScore: real('engagement_score').notNull().default(0),
  
  // Interest link
  interestId: uuid('interest_id').references(() => interests.id, { onDelete: 'set null' }),
  matchedKeywords: text('matched_keywords').array().default([]),
  
  // User engagement
  status: text('status').notNull().default('unseen'), // unseen, seen, saved, dismissed
  seenAt: timestamp('seen_at'),
  
  // Embedding for semantic search (1536 dimensions - text-embedding-3-small)
  embedding: text('embedding'), // Stored as vector in DB, text in Drizzle
  
  // Timestamps
  publishedAt: timestamp('published_at'),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const discoveriesRelations = relations(discoveries, ({ one }) => ({
  interest: one(interests, {
    fields: [discoveries.interestId],
    references: [interests.id],
  }),
}));

// ============================================================================
// POKES (Notifications sent to user)
// ============================================================================

export const pokes = pgTable('pokes', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // What was poked
  discoveryId: uuid('discovery_id').references(() => discoveries.id, { onDelete: 'set null' }),
  interestId: uuid('interest_id').references(() => interests.id, { onDelete: 'set null' }),
  
  // Poke content
  message: text('message').notNull(),
  channel: text('channel').notNull(), // 'whatsapp', 'telegram', 'email'
  
  // Status
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  
  // User response
  response: text('response'), // 'clicked', 'saved', 'dismissed', 'ignored'
  respondedAt: timestamp('responded_at'),
});

export const pokesRelations = relations(pokes, ({ one }) => ({
  discovery: one(discoveries, {
    fields: [pokes.discoveryId],
    references: [discoveries.id],
  }),
  interest: one(interests, {
    fields: [pokes.interestId],
    references: [interests.id],
  }),
}));

// ============================================================================
// CRON RUNS (Discovery run history)
// ============================================================================

export const cronRuns = pgTable('cron_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Run timing
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
  
  // Discovery stats
  discoveriesFound: integer('discoveries_found').notNull().default(0),
  discoveriesSaved: integer('discoveries_saved').notNull().default(0),
  interestsScanned: integer('interests_scanned').notNull().default(0),
  
  // Notification stats
  pokesQueued: integer('pokes_queued').notNull().default(0),
  pokesSent: integer('pokes_sent').notNull().default(0),
  notificationSkipped: boolean('notification_skipped').notNull().default(false), // true if quiet hours
  
  // Status
  status: text('status').notNull().default('running'), // running, completed, failed
  error: text('error'),
});

export type CronRun = typeof cronRuns.$inferSelect;
export type NewCronRun = typeof cronRuns.$inferInsert;

// ============================================================================
// SETTINGS
// ============================================================================

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// TYPES
// ============================================================================

export type Interest = typeof interests.$inferSelect;
export type NewInterest = typeof interests.$inferInsert;

export type Discovery = typeof discoveries.$inferSelect;
export type NewDiscovery = typeof discoveries.$inferInsert;

export type Poke = typeof pokes.$inferSelect;
export type NewPoke = typeof pokes.$inferInsert;

export type InterestConnection = typeof interestConnections.$inferSelect;
export type NewInterestConnection = typeof interestConnections.$inferInsert;
