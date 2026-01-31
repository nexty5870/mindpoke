import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ExternalResult {
  source: "twitter" | "reddit" | "hackernews";
  id: string;
  title?: string;
  content: string;
  url: string;
  author?: string;
  authorHandle?: string;
  score?: number;
  createdAt?: string; // ISO date string
}

/**
 * Extract key search terms from content
 */
function extractSearchTerms(content: string, title?: string): string[] {
  const text = `${title || ""} ${content}`.toLowerCase();
  
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
    "because", "until", "while", "this", "that", "these", "those", "i", "you",
    "he", "she", "it", "we", "they", "what", "which", "who", "whom", "its",
    "his", "her", "their", "our", "your", "my", "https", "http", "com", "www",
    "amp", "quot", "t", "co", "pic", "twitter"
  ]);

  // Extract words and filter
  const words = text
    .replace(/https?:\/\/\S+/g, "") // Remove URLs
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq: Record<string, number> = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  // Get top terms by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Search X/Twitter using Bird CLI
 */
async function searchTwitter(query: string, limit: number = 10): Promise<ExternalResult[]> {
  try {
    const { stdout } = await execAsync(
      `bird search "${query.replace(/"/g, '\\"')}" --limit ${limit} --json`,
      { timeout: 30000 }
    );
    
    const tweets = JSON.parse(stdout);
    return tweets.map((t: any) => ({
      source: "twitter" as const,
      id: t.id,
      content: t.text,
      url: `https://x.com/${t.author?.username || "i"}/status/${t.id}`,
      author: t.author?.name,
      authorHandle: t.author?.username,
      score: (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0) * 2,
      createdAt: t.created_at || t.createdAt,
    }));
  } catch (e) {
    console.error("[poke-around] Twitter search failed:", e);
    return [];
  }
}

/**
 * Search Reddit
 */
async function searchReddit(query: string, limit: number = 10): Promise<ExternalResult[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`,
      { headers: { "User-Agent": "Mindpoke/1.0" } }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.data?.children || []).map((post: any) => ({
      source: "reddit" as const,
      id: post.data.id,
      title: post.data.title,
      content: post.data.selftext || post.data.title,
      url: `https://reddit.com${post.data.permalink}`,
      author: post.data.author,
      authorHandle: post.data.author,
      score: post.data.score || 0,
      createdAt: post.data.created_utc ? new Date(post.data.created_utc * 1000).toISOString() : undefined,
    }));
  } catch (e) {
    console.error("[poke-around] Reddit search failed:", e);
    return [];
  }
}

/**
 * Search Hacker News
 */
async function searchHackerNews(query: string, limit: number = 10): Promise<ExternalResult[]> {
  try {
    // Use tags=story to filter out comments (which don't have titles)
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.hits || [])
      .filter((hit: any) => hit.title) // Extra safety: ensure title exists
      .map((hit: any) => ({
        source: "hackernews" as const,
        id: hit.objectID,
        title: hit.title,
        content: hit.title + (hit.story_text ? ` ${hit.story_text}` : ""),
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        author: hit.author,
        authorHandle: hit.author,
        score: hit.points || 0,
        createdAt: hit.created_at || (hit.created_at_i ? new Date(hit.created_at_i * 1000).toISOString() : undefined),
      }));
  } catch (e) {
    console.error("[poke-around] HN search failed:", e);
    return [];
  }
}

/**
 * POST /api/discoveries/poke-around
 * 
 * Search external sources for content similar to a given discovery.
 * 
 * Body: { discoveryId: string, sources?: string[], limit?: number }
 */
export async function POST(request: Request) {
  try {
    const { discoveryId, sources = ["twitter", "reddit", "hackernews"], limit = 5 } = await request.json();

    if (!discoveryId) {
      return NextResponse.json(
        { success: false, error: "Missing discoveryId" },
        { status: 400 }
      );
    }

    // Get the source discovery
    const [discovery] = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.id, discoveryId))
      .limit(1);

    if (!discovery) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    // Extract search terms
    const terms = extractSearchTerms(discovery.content, discovery.title || undefined);
    const query = terms.join(" ");
    
    console.log(`[poke-around] Searching for: "${query}" from discovery ${discoveryId}`);

    // Search all sources in parallel
    const results: ExternalResult[] = [];
    const searchPromises: Promise<ExternalResult[]>[] = [];

    if (sources.includes("twitter")) {
      searchPromises.push(searchTwitter(query, limit));
    }
    if (sources.includes("reddit")) {
      searchPromises.push(searchReddit(query, limit));
    }
    if (sources.includes("hackernews")) {
      searchPromises.push(searchHackerNews(query, limit));
    }

    const searchResults = await Promise.all(searchPromises);
    searchResults.forEach(r => results.push(...r));

    // Sort by score and dedupe
    const seen = new Set<string>();
    const deduped = results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .filter(r => {
        const key = `${r.source}:${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit * 2); // Return up to 2x limit across all sources

    return NextResponse.json({
      success: true,
      data: deduped,
      meta: {
        sourceDiscoveryId: discoveryId,
        searchTerms: terms,
        query,
        counts: {
          twitter: deduped.filter(r => r.source === "twitter").length,
          reddit: deduped.filter(r => r.source === "reddit").length,
          hackernews: deduped.filter(r => r.source === "hackernews").length,
        },
      },
    });
  } catch (error) {
    console.error("[poke-around] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
