import { NextResponse } from "next/server";
import { searchTweets, calculateRelevance, type Tweet } from "@/lib/sources/bird";
import { db } from "@/lib/db";
import { discoveries, interests as interestsTable } from "@/lib/db/schema";
import type { Discovery, DiscoverySource } from "@/types";
import { franc } from "franc-min";

// Detect if text is English (returns true if English or undetermined for short text)
function isEnglish(text: string): boolean {
  // Skip very short texts - can't reliably detect
  if (text.length < 20) return true;
  
  const lang = franc(text);
  // 'und' means undetermined (too short/ambiguous)
  // Allow English and undetermined
  return lang === "eng" || lang === "und";
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
    const minRelevance: number = body.minRelevance || 40;
    const maxResultsPerInterest: number = body.maxResultsPerInterest || 10;
    
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
    const searchStats: Record<string, { query: string; found: number; relevant: number; new: number }> = {};
    
    // Search for each interest
    for (const interest of allInterests) {
      const keywords = interest.keywords || [];
      if (keywords.length === 0) {
        console.log(`[discover] Skipping ${interest.name} - no keywords`);
        searchStats[interest.id] = { query: "(no keywords)", found: 0, relevant: 0, new: 0 };
        continue;
      }
      
      // Build search query from keywords (use top 3)
      const query = keywords.slice(0, 3).join(" OR ");
      
      console.log(`[discover] Searching: "${query}" for interest: ${interest.name}`);
      
      try {
        const tweets = await searchTweets(query, 30);
        
        // Filter out already-saved tweets and non-English content
        const newTweets = tweets.filter(t => {
          if (existingSourceIds.has(t.id)) return false;
          if (!isEnglish(t.text)) {
            console.log(`[discover] Skipping non-English tweet: ${t.text.slice(0, 50)}...`);
            return false;
          }
          return true;
        });
        
        // Convert to DB format and filter by relevance
        const dbDiscoveries = newTweets
          .map(tweet => tweetToDbDiscovery(tweet, { id: interest.id, keywords }))
          .filter(d => d.relevanceScore >= minRelevance)
          .slice(0, maxResultsPerInterest); // Limit per interest
        
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
