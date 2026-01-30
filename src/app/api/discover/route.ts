import { NextResponse } from "next/server";
import { searchTweets, calculateRelevance, type Tweet } from "@/lib/sources/bird";
import { db } from "@/lib/db";
import { discoveries, interests as interestsTable } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { Discovery, DiscoverySource, Interest } from "@/types";

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

function dbToFrontendDiscovery(db: any): Discovery {
  return {
    id: db.id,
    title: db.title || "",
    summary: db.content || "",
    url: db.sourceUrl || "",
    source: (db.sourceType === "twitter" ? "x" : db.sourceType) as DiscoverySource,
    sourceId: db.sourceId,
    author: db.author,
    authorHandle: db.authorHandle,
    relevanceScore: db.relevanceScore || 0,
    matchedInterests: db.interestId ? [db.interestId] : [],
    engagementMetrics: {
      likes: db.metadata?.likes,
      retweets: db.metadata?.retweets,
      comments: db.metadata?.replies,
    },
    status: db.status === "unseen" ? "new" : db.status === "seen" ? "read" : db.status,
    publishedAt: db.publishedAt ? new Date(db.publishedAt) : new Date(),
    discoveredAt: new Date(db.discoveredAt),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const interests: Interest[] = body.interests || [];
    const minRelevance: number = body.minRelevance || 50;
    const maxResults: number = body.maxResults || 20;
    
    if (!interests.length) {
      return NextResponse.json(
        { success: false, error: "No interests provided" },
        { status: 400 }
      );
    }
    
    console.log(`[discover] Searching for ${interests.length} interests...`);
    
    // Get existing sourceIds to avoid duplicates
    const existingDiscoveries = await db.query.discoveries.findMany({
      columns: { sourceId: true },
    });
    const existingSourceIds = new Set(existingDiscoveries.map(d => d.sourceId));
    
    const allNewDiscoveries: any[] = [];
    const searchStats: Record<string, { query: string; found: number; relevant: number; new: number }> = {};
    
    // Search for each interest
    for (const interest of interests) {
      // Build search query from keywords
      const query = interest.keywords.slice(0, 3).join(" OR ");
      
      console.log(`[discover] Searching: "${query}" for interest: ${interest.name}`);
      
      try {
        const tweets = await searchTweets(query, 30);
        
        // Filter out already-saved tweets
        const newTweets = tweets.filter(t => !existingSourceIds.has(t.id));
        
        // Convert to DB format and filter by relevance
        const dbDiscoveries = newTweets
          .map(tweet => tweetToDbDiscovery(tweet, { id: interest.id, keywords: interest.keywords }))
          .filter(d => d.relevanceScore >= minRelevance);
        
        // Mark as seen for this session
        newTweets.forEach(t => existingSourceIds.add(t.id));
        
        allNewDiscoveries.push(...dbDiscoveries);
        
        searchStats[interest.id] = {
          query,
          found: tweets.length,
          relevant: dbDiscoveries.length,
          new: newTweets.length,
        };
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        console.error(`[discover] Search failed for ${interest.name}:`, error);
        searchStats[interest.id] = { query, found: 0, relevant: 0, new: 0 };
      }
    }
    
    // Deduplicate by sourceId (in case same tweet matches multiple interests)
    const uniqueDiscoveries = Array.from(
      new Map(allNewDiscoveries.map(d => [d.sourceId, d])).values()
    );
    
    // Sort by relevance and limit
    const sortedDiscoveries = uniqueDiscoveries
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
    
    // PERSIST TO DATABASE
    let savedDiscoveries: any[] = [];
    if (sortedDiscoveries.length > 0) {
      console.log(`[discover] Persisting ${sortedDiscoveries.length} discoveries to database...`);
      try {
        savedDiscoveries = await db.insert(discoveries).values(sortedDiscoveries).returning();
        console.log(`[discover] Saved ${savedDiscoveries.length} discoveries`);
      } catch (dbError) {
        console.error("[discover] Database save failed:", dbError);
        // Continue anyway - return the discoveries even if save failed
      }
    }
    
    // Convert to frontend format for response
    const frontendDiscoveries = (savedDiscoveries.length ? savedDiscoveries : sortedDiscoveries)
      .map(dbToFrontendDiscovery);
    
    return NextResponse.json({
      success: true,
      data: {
        discoveries: frontendDiscoveries,
        stats: {
          totalSearches: interests.length,
          totalFound: allNewDiscoveries.length,
          uniqueResults: uniqueDiscoveries.length,
          persisted: savedDiscoveries.length,
          returned: frontendDiscoveries.length,
          byInterest: searchStats,
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
  const count = await db.query.discoveries.findMany({ columns: { id: true } });
  return NextResponse.json({
    status: "ok",
    totalDiscoveries: count.length,
    timestamp: new Date().toISOString(),
  });
}
