// Core Types for Mindpoke

export interface Interest {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  priority: number; // 1-5, affects notification threshold
  createdAt: Date;
  updatedAt: Date;
  // Engagement metrics (for decay)
  lastEngagedAt?: Date;
  engagementCount: number;
  dismissCount: number;
  // Graph position (saved by user)
  positionX?: number | null;
  positionY?: number | null;
}

export interface Discovery {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: DiscoverySource;
  sourceId: string; // tweet id, reddit post id, etc.
  author?: string;
  authorHandle?: string;
  
  // Scoring
  relevanceScore: number; // 0-100
  matchedInterests: string[]; // interest IDs
  
  // Engagement
  engagementMetrics: {
    likes?: number;
    retweets?: number;
    comments?: number;
    upvotes?: number;
  };
  
  // User interaction
  status: 'new' | 'saved' | 'read' | 'dismissed';
  notifiedAt?: Date;
  savedAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;
  
  // Timestamps
  publishedAt: Date;
  discoveredAt: Date;
}

export type DiscoverySource = 'x' | 'reddit' | 'hackernews' | 'rss' | 'arxiv';

export interface SourceConfig {
  id: string;
  type: DiscoverySource;
  enabled: boolean;
  config: Record<string, unknown>;
  lastCrawledAt?: Date;
  crawlIntervalMinutes: number;
}

export interface InterestConnection {
  sourceId: string;
  targetId: string;
  strength: number; // 0-1, based on co-occurrence in saved items
}

export interface NotificationSettings {
  enabled: boolean;
  channel: 'whatsapp' | 'telegram' | 'discord';
  minRelevanceScore: number; // Only notify above this threshold
  quietHours: {
    start: string; // "23:00"
    end: string;   // "08:00"
  };
  maxPerDay: number;
}

// Graph visualization types
export interface InterestNode {
  id: string;
  type: 'interest';
  position: { x: number; y: number };
  data: {
    interest: Interest;
    heatLevel: number; // 0-5, visual intensity
  };
}

export interface InterestEdge {
  id: string;
  source: string;
  target: string;
  data: {
    strength: number;
  };
}
