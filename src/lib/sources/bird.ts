/**
 * Bird CLI wrapper for X/Twitter operations
 * Uses @steipete/bird for Twitter GraphQL API access
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Path to bird CLI (installed in project)
const BIRD_CMD = "npx bird";

export interface Tweet {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
  };
  authorId: string;
  createdAt: string;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  conversationId: string;
  quotedTweet?: Tweet;
  article?: {
    title: string;
    previewText: string;
  };
}

export interface BookmarkResult {
  tweets: Tweet[];
  cursor?: string;
  hasMore: boolean;
}

export interface SearchResult {
  tweets: Tweet[];
  cursor?: string;
}

/**
 * Execute bird CLI command and parse JSON output
 */
async function runBird<T>(args: string): Promise<T> {
  try {
    const { stdout, stderr } = await execAsync(`${BIRD_CMD} ${args} --json`, {
      cwd: process.cwd(),
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large results
    });

    if (stderr && !stderr.includes("warn")) {
      console.error("[bird] stderr:", stderr);
    }

    return JSON.parse(stdout) as T;
  } catch (error: unknown) {
    const err = error as Error & { stdout?: string; stderr?: string };
    console.error("[bird] Error:", err.message);
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout) as T;
      } catch {
        // ignore parse error
      }
    }
    throw new Error(`Bird CLI failed: ${err.message}`);
  }
}

/**
 * Get bookmarked tweets
 */
export async function getBookmarks(count: number = 50): Promise<Tweet[]> {
  const result = await runBird<Tweet[]>(`bookmarks -n ${count}`);
  return Array.isArray(result) ? result : [];
}

/**
 * Search tweets by query
 */
export async function searchTweets(query: string, count: number = 20): Promise<Tweet[]> {
  // Escape quotes in query
  const escapedQuery = query.replace(/"/g, '\\"');
  const result = await runBird<Tweet[]>(`search "${escapedQuery}" -n ${count}`);
  return Array.isArray(result) ? result : [];
}

/**
 * Get tweets from a specific user
 */
export async function getUserTweets(username: string, count: number = 20): Promise<Tweet[]> {
  const result = await runBird<Tweet[]>(`user-tweets @${username.replace("@", "")} -n ${count}`);
  return Array.isArray(result) ? result : [];
}

/**
 * Read a specific tweet by ID or URL
 */
export async function readTweet(idOrUrl: string): Promise<Tweet> {
  return runBird<Tweet>(`read ${idOrUrl}`);
}

/**
 * Get full thread for a tweet
 */
export async function getThread(idOrUrl: string): Promise<Tweet[]> {
  const result = await runBird<Tweet[]>(`thread ${idOrUrl}`);
  return Array.isArray(result) ? result : [];
}

/**
 * Check if bird CLI is authenticated
 */
export async function checkAuth(): Promise<{ authenticated: boolean; username?: string }> {
  try {
    const result = await runBird<{ username: string; name: string }>("whoami");
    return { authenticated: true, username: result.username };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Extract key topics/keywords from tweet text using simple heuristics
 */
export function extractKeywords(text: string): string[] {
  // Remove URLs
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  
  // Extract hashtags
  const hashtags = (withoutUrls.match(/#\w+/g) || []).map((h) => h.slice(1).toLowerCase());
  
  // Extract mentions (as potential topic indicators)
  const mentions = (withoutUrls.match(/@\w+/g) || []).map((m) => m.slice(1).toLowerCase());
  
  // Common AI/tech keywords to look for
  const techKeywords = [
    "ai", "llm", "gpt", "claude", "agent", "agents", "rag", "embeddings",
    "vector", "langchain", "openai", "anthropic", "local", "ollama",
    "typescript", "react", "nextjs", "python", "rust", "golang",
    "startup", "saas", "indie", "hacker", "builder", "ship",
    "memory", "autonomous", "automation", "workflow", "api",
  ];
  
  const words = withoutUrls.toLowerCase().split(/\s+/);
  const foundKeywords = words.filter((w) => techKeywords.includes(w.replace(/[^a-z]/g, "")));
  
  // Combine and deduplicate
  const all = [...new Set([...hashtags, ...foundKeywords])];
  return all.slice(0, 10); // Limit to top 10
}

/**
 * Calculate relevance score between tweet and interest keywords
 */
export function calculateRelevance(tweet: Tweet, interestKeywords: string[]): number {
  const text = (tweet.text + " " + (tweet.article?.title || "")).toLowerCase();
  const tweetKeywords = extractKeywords(text);
  
  let matches = 0;
  let partialMatches = 0;
  
  for (const keyword of interestKeywords) {
    const kw = keyword.toLowerCase();
    // Direct match in text
    if (text.includes(kw)) {
      matches += 2;
    }
    // Match in extracted keywords
    if (tweetKeywords.some((tk) => tk.includes(kw) || kw.includes(tk))) {
      matches += 1;
    }
    // Partial match (word contains keyword)
    if (text.split(/\s+/).some((w) => w.includes(kw))) {
      partialMatches += 0.5;
    }
  }
  
  // Engagement boost (logarithmic)
  const engagementScore = Math.log10(
    (tweet.likeCount || 0) + (tweet.retweetCount || 0) * 2 + (tweet.replyCount || 0) + 1
  );
  
  // Calculate final score (0-100)
  const keywordScore = Math.min(60, (matches + partialMatches) * 10);
  const engagementBonus = Math.min(20, engagementScore * 5);
  const hasArticle = tweet.article ? 10 : 0;
  const isThread = tweet.replyCount > 10 ? 10 : 0;
  
  return Math.min(100, Math.round(keywordScore + engagementBonus + hasArticle + isThread));
}
