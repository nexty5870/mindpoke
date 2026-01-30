import { NextResponse } from "next/server";
import { searchTweets, calculateRelevance, type Tweet } from "@/lib/sources/bird";
import { searchReddit, calculateRedditRelevance, type RedditPost } from "@/lib/sources/reddit";
import { searchHackerNews, calculateHNRelevance, type HNStory } from "@/lib/sources/hackernews";
import { db } from "@/lib/db";
import { discoveries, interests as interestsTable, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Helper to load app settings
async function loadSettings() {
  const result = await db.query.settings.findFirst({
    where: eq(settings.key, "app_settings"),
  });
  return result?.value as {
    discoverIntervalHours?: number;
    minPokeRelevance?: number;
    enabledSources?: { twitter?: boolean; reddit?: boolean; hackernews?: boolean };
  } | null;
}
import type { Discovery, DiscoverySource } from "@/types";

// Non-Latin script ranges to block
const NON_LATIN_REGEX = new RegExp([
  '[\u0600-\u06FF]',      // Arabic
  '[\u0750-\u077F]',      // Arabic Supplement
  '[\u08A0-\u08FF]',      // Arabic Extended-A
  '[\u4E00-\u9FFF]',      // CJK Unified
  '[\u3400-\u4DBF]',      // CJK Extension A
  '[\u3040-\u309F]',      // Hiragana
  '[\u30A0-\u30FF]',      // Katakana
  '[\uAC00-\uD7AF]',      // Korean Hangul
  '[\u0400-\u04FF]',      // Cyrillic
  '[\u0500-\u052F]',      // Cyrillic Supplement
  '[\u0590-\u05FF]',      // Hebrew
  '[\u0E00-\u0E7F]',      // Thai
  '[\u0900-\u097F]',      // Devanagari (Hindi)
  '[\u0980-\u09FF]',      // Bengali
  '[\u0A80-\u0AFF]',      // Gujarati
  '[\u0B00-\u0B7F]',      // Oriya
  '[\u0B80-\u0BFF]',      // Tamil
  '[\u0C00-\u0C7F]',      // Telugu
  '[\u0C80-\u0CFF]',      // Kannada
  '[\u0D00-\u0D7F]',      // Malayalam
].join('|'));

// Check if text is English (Latin script only)
function isEnglish(text: string): boolean {
  // Remove URLs, mentions, hashtags, emojis for cleaner check
  const cleanText = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // emojis
    .trim();
  
  // If mostly stripped, allow through
  if (cleanText.length < 10) return true;
  
  // Block if ANY non-Latin characters found
  if (NON_LATIN_REGEX.test(cleanText)) {
    return false;
  }
  
  return true;
}

function tweetToDbDiscovery(tweet: Tweet, interest: { id: string; keywords: string[] }) {
  return {
    sourceType: "twitter" as const,
    sourceId: tweet.id,
    sourceUrl: `https://x.com/${tweet.author.username}/status/${tweet.id}`,
    title: tweet.article?.title || tweet.text.slice(0, 120) + (tweet.text.length > 120 ? "..." : ""),
    content: tweet.article?.previewText || tweet.text,
    author: tweet.author.name,
    authorHandle: tweet.author.username,
    metadata: {
      likes: tweet.likeCount || 0,
      retweets: tweet.retweetCount || 0,
      replies: tweet.replyCount || 0,
      quotedTweet: tweet.quotedTweet?.id,
      conversationId: tweet.conversationId,
    },
    relevanceScore: calculateRelevance(tweet, interest.keywords),
    interestId: interest.id,
    matchedKeywords: interest.keywords.filter(kw => 
      tweet.text.toLowerCase().includes(kw.toLowerCase())
    ),
    status: "unseen" as const,
    publishedAt: new Date(tweet.createdAt),
  };
}

function redditPostToDbDiscovery(post: RedditPost, interest: { id: string; keywords: string[] }) {
  return {
    sourceType: "reddit" as const,
    sourceId: `reddit_${post.id}`,
    sourceUrl: post.permalink,
    title: post.title,
    content: post.selftext || post.title,
    author: post.author,
    authorHandle: post.author,
    metadata: {
      upvotes: post.score,
      comments: post.num_comments,
      subreddit: post.subreddit,
      domain: post.domain,
      externalUrl: post.is_self ? null : post.url,
    },
    relevanceScore: calculateRedditRelevance(post, interest.keywords),
    interestId: interest.id,
    matchedKeywords: interest.keywords.filter(kw => 
      `${post.title} ${post.selftext}`.toLowerCase().includes(kw.toLowerCase())
    ),
    status: "unseen" as const,
    publishedAt: new Date(post.created_utc * 1000),
  };
}

function hnStoryToDbDiscovery(story: HNStory, interest: { id: string; keywords: string[] }) {
  return {
    sourceType: "hackernews" as const,
    sourceId: `hn_${story.id}`,
    sourceUrl: `https://news.ycombinator.com/item?id=${story.id}`,
    title: story.title,
    content: story.text || story.title,
    author: story.by,
    authorHandle: story.by,
    metadata: {
      upvotes: story.score,
      comments: story.descendants,
      externalUrl: story.url,
    },
    relevanceScore: calculateHNRelevance(story, interest.keywords),
    interestId: interest.id,
    matchedKeywords: interest.keywords.filter(kw => 
      `${story.title} ${story.text || ""}`.toLowerCase().includes(kw.toLowerCase())
    ),
    status: "unseen" as const,
    publishedAt: new Date(story.time * 1000),
  };
}

function dbToFrontendDiscovery(db: any): Discovery {
  // Map sourceType to frontend source
  const sourceMap: Record<string, DiscoverySource> = {
    twitter: "x",
    reddit: "reddit",
    hackernews: "hackernews",
    rss: "rss",
  };
  
  return {
    id: db.id,
    title: db.title || "",
    summary: db.content || "",
    url: db.sourceUrl || "",
    source: sourceMap[db.sourceType] || "x",
    sourceId: db.sourceId,
    author: db.author,
    authorHandle: db.authorHandle,
    relevanceScore: db.relevanceScore || 0,
    matchedInterests: db.interestId ? [db.interestId] : [],
    engagementMetrics: {
      likes: db.metadata?.likes,
      retweets: db.metadata?.retweets,
      comments: db.metadata?.replies || db.metadata?.comments,
      upvotes: db.metadata?.upvotes,
    },
    status: db.status === "unseen" ? "new" : db.status === "seen" ? "read" : db.status,
    publishedAt: db.publishedAt ? new Date(db.publishedAt) : new Date(),
    discoveredAt: new Date(db.discoveredAt),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const minRelevance: number = body.minRelevance || 25;
    const maxResultsPerInterest: number = body.maxResultsPerInterest || 10;
    
    // Load settings to check enabled sources
    const appSettings = await loadSettings();
    const enabledSources = appSettings?.enabledSources || { twitter: true, reddit: true, hackernews: true };
    
    console.log(`[discover] Enabled sources: X=${enabledSources.twitter}, Reddit=${enabledSources.reddit}, HN=${enabledSources.hackernews}`);
    
    // ALWAYS fetch interests from database to get current keywords
    const allInterests = await db.query.interests.findMany();
    
    if (!allInterests.length) {
      return NextResponse.json(
        { success: false, error: "No interests found in database" },
        { status: 400 }
      );
    }
    
    console.log(`[discover] Searching for ${allInterests.length} interests from database...`);
    
    // Get existing sourceIds to avoid duplicates
    const existingDiscoveries = await db.query.discoveries.findMany({
      columns: { sourceId: true },
    });
    const existingSourceIds = new Set(existingDiscoveries.map(d => d.sourceId));
    
    const allNewDiscoveries: any[] = [];
    const searchStats: Record<string, { query: string; found: number; relevant: number; new: number; sources: Record<string, number> }> = {};
    
    // Search for each interest - all sources in parallel
    for (const interest of allInterests) {
      const keywords = interest.keywords || [];
      if (keywords.length === 0) {
        console.log(`[discover] Skipping ${interest.name} - no keywords`);
        searchStats[interest.id] = { query: "(no keywords)", found: 0, relevant: 0, new: 0, sources: {} };
        continue;
      }
      
      // Build search query from keywords (use top 3)
      const query = keywords.slice(0, 3).join(" OR ");
      
      console.log(`[discover] Searching: "${query}" for interest: ${interest.name}`);
      
      const sourceStats: Record<string, number> = {};
      
      try {
        // Run enabled sources in parallel
        const [tweets, redditPosts, hnStories] = await Promise.all([
          enabledSources.twitter !== false
            ? searchTweets(query, 30).catch(err => {
                console.error(`[discover] Twitter search failed:`, err);
                return [];
              })
            : Promise.resolve([]),
          enabledSources.reddit !== false
            ? searchReddit(keywords, 20).catch(err => {
                console.error(`[discover] Reddit search failed:`, err);
                return [];
              })
            : Promise.resolve([]),
          enabledSources.hackernews !== false
            ? searchHackerNews(keywords, 20).catch(err => {
                console.error(`[discover] HackerNews search failed:`, err);
                return [];
              })
            : Promise.resolve([]),
        ]);
        
        // Process Twitter results
        const twitterDiscoveries = tweets
          .filter(t => {
            if (existingSourceIds.has(t.id)) return false;
            if (!isEnglish(t.text)) {
              console.log(`[discover] Skipping non-English tweet: ${t.text.slice(0, 50)}...`);
              return false;
            }
            return true;
          })
          .map(tweet => tweetToDbDiscovery(tweet, { id: interest.id, keywords }))
          .filter(d => d.relevanceScore >= minRelevance);
        
        sourceStats.twitter = twitterDiscoveries.length;
        tweets.forEach(t => existingSourceIds.add(t.id));
        
        // Process Reddit results
        const redditDiscoveries = redditPosts
          .filter(p => {
            const sourceId = `reddit_${p.id}`;
            if (existingSourceIds.has(sourceId)) return false;
            if (!isEnglish(`${p.title} ${p.selftext}`)) return false;
            return true;
          })
          .map(post => redditPostToDbDiscovery(post, { id: interest.id, keywords }))
          .filter(d => d.relevanceScore >= minRelevance);
        
        sourceStats.reddit = redditDiscoveries.length;
        redditPosts.forEach(p => existingSourceIds.add(`reddit_${p.id}`));
        
        // Process HackerNews results
        const hnDiscoveries = hnStories
          .filter(s => {
            const sourceId = `hn_${s.id}`;
            if (existingSourceIds.has(sourceId)) return false;
            if (!isEnglish(`${s.title} ${s.text || ""}`)) return false;
            return true;
          })
          .map(story => hnStoryToDbDiscovery(story, { id: interest.id, keywords }))
          .filter(d => d.relevanceScore >= minRelevance);
        
        sourceStats.hackernews = hnDiscoveries.length;
        hnStories.forEach(s => existingSourceIds.add(`hn_${s.id}`));
        
        // Combine all and limit per interest
        const allSourceDiscoveries = [
          ...twitterDiscoveries,
          ...redditDiscoveries,
          ...hnDiscoveries,
        ].sort((a, b) => b.relevanceScore - a.relevanceScore)
         .slice(0, maxResultsPerInterest);
        
        allNewDiscoveries.push(...allSourceDiscoveries);
        
        const totalFound = tweets.length + redditPosts.length + hnStories.length;
        const totalRelevant = allSourceDiscoveries.length;
        
        searchStats[interest.id] = {
          query,
          found: totalFound,
          relevant: totalRelevant,
          new: totalRelevant,
          sources: sourceStats,
        };
        
        // Small delay between interests
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.error(`[discover] Search failed for ${interest.name}:`, error);
        searchStats[interest.id] = { query, found: 0, relevant: 0, new: 0, sources: {} };
      }
    }
    
    // Deduplicate by sourceId (in case same item matches multiple interests)
    const uniqueDiscoveries = Array.from(
      new Map(allNewDiscoveries.map(d => [d.sourceId, d])).values()
    );
    
    // Sort by relevance
    const sortedDiscoveries = uniqueDiscoveries
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // PERSIST TO DATABASE
    let savedDiscoveries: any[] = [];
    if (sortedDiscoveries.length > 0) {
      console.log(`[discover] Persisting ${sortedDiscoveries.length} discoveries to database...`);
      try {
        savedDiscoveries = await db.insert(discoveries).values(sortedDiscoveries).returning();
        console.log(`[discover] Saved ${savedDiscoveries.length} discoveries`);
      } catch (dbError) {
        console.error("[discover] Database save failed:", dbError);
      }
    }
    
    // Convert to frontend format for response
    const frontendDiscoveries = (savedDiscoveries.length ? savedDiscoveries : sortedDiscoveries)
      .map(dbToFrontendDiscovery);
    
    // Build per-interest stats for response
    const interestStats = allInterests.map(i => ({
      id: i.id,
      name: i.name,
      ...searchStats[i.id],
    }));
    
    // Count by source
    const bySource = {
      twitter: sortedDiscoveries.filter(d => d.sourceType === "twitter").length,
      reddit: sortedDiscoveries.filter(d => d.sourceType === "reddit").length,
      hackernews: sortedDiscoveries.filter(d => d.sourceType === "hackernews").length,
    };
    
    return NextResponse.json({
      success: true,
      data: {
        discoveries: frontendDiscoveries,
        stats: {
          totalInterests: allInterests.length,
          totalFound: allNewDiscoveries.length,
          uniqueResults: uniqueDiscoveries.length,
          persisted: savedDiscoveries.length,
          returned: frontendDiscoveries.length,
          bySource,
          byInterest: interestStats,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[discover] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Discovery failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint for quick status check
export async function GET() {
  const [discCount, intCount] = await Promise.all([
    db.query.discoveries.findMany({ columns: { id: true } }),
    db.query.interests.findMany({ columns: { id: true } }),
  ]);
  return NextResponse.json({
    status: "ok",
    totalDiscoveries: discCount.length,
    totalInterests: intCount.length,
    timestamp: new Date().toISOString(),
  });
}
