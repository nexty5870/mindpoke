import { NextResponse } from "next/server";
import { searchTweets, calculateRelevance, type Tweet } from "@/lib/sources/bird";
import type { Discovery, DiscoverySource, Interest } from "@/types";

// In-memory store for seen tweet IDs (to prevent duplicates across searches)
const seenTweetIds = new Set<string>();

function tweetToDiscovery(tweet: Tweet, matchedInterests: Interest[]): Discovery {
  const interestIds = matchedInterests.map((i) => i.id);
  const allKeywords = matchedInterests.flatMap((i) => i.keywords);
  
  return {
    id: `disc_${tweet.id}`,
    title: tweet.article?.title || tweet.text.slice(0, 120) + (tweet.text.length > 120 ? "..." : ""),
    summary: tweet.article?.previewText || tweet.text,
    url: `https://x.com/${tweet.author.username}/status/${tweet.id}`,
    source: "x" as DiscoverySource,
    sourceId: tweet.id,
    author: tweet.author.name,
    authorHandle: tweet.author.username,
    relevanceScore: calculateRelevance(tweet, allKeywords),
    matchedInterests: interestIds,
    engagementMetrics: {
      likes: tweet.likeCount || 0,
      retweets: tweet.retweetCount || 0,
      comments: tweet.replyCount || 0,
    },
    status: "new",
    publishedAt: new Date(tweet.createdAt),
    discoveredAt: new Date(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const interests: Interest[] = body.interests || [];
    const minRelevance: number = body.minRelevance || 50;
    const maxResults: number = body.maxResults || 20;
    const includeSeenTweets: boolean = body.includeSeenTweets || false;
    
    if (!interests.length) {
      return NextResponse.json(
        { success: false, error: "No interests provided" },
        { status: 400 }
      );
    }
    
    console.log(`[discover] Searching for ${interests.length} interests...`);
    
    const allDiscoveries: Discovery[] = [];
    const searchStats: Record<string, { query: string; found: number; relevant: number }> = {};
    
    // Search for each interest
    for (const interest of interests) {
      // Build search query from keywords
      const query = interest.keywords.slice(0, 3).join(" OR ");
      
      console.log(`[discover] Searching: "${query}" for interest: ${interest.name}`);
      
      try {
        const tweets = await searchTweets(query, 30);
        
        // Filter out seen tweets unless explicitly included
        const newTweets = includeSeenTweets 
          ? tweets 
          : tweets.filter((t) => !seenTweetIds.has(t.id));
        
        // Convert to discoveries and calculate relevance
        const discoveries = newTweets
          .map((tweet) => tweetToDiscovery(tweet, [interest]))
          .filter((d) => d.relevanceScore >= minRelevance);
        
        // Mark as seen
        newTweets.forEach((t) => seenTweetIds.add(t.id));
        
        allDiscoveries.push(...discoveries);
        
        searchStats[interest.id] = {
          query,
          found: tweets.length,
          relevant: discoveries.length,
        };
        
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(`[discover] Search failed for ${interest.name}:`, error);
        searchStats[interest.id] = { query, found: 0, relevant: 0 };
      }
    }
    
    // Deduplicate by tweet ID (in case same tweet matches multiple interests)
    const uniqueDiscoveries = Array.from(
      new Map(allDiscoveries.map((d) => [d.sourceId, d])).values()
    );
    
    // Merge matched interests for duplicates
    const mergedDiscoveries = uniqueDiscoveries.map((discovery) => {
      const matchingDiscoveries = allDiscoveries.filter(
        (d) => d.sourceId === discovery.sourceId
      );
      const allMatchedInterests = [...new Set(
        matchingDiscoveries.flatMap((d) => d.matchedInterests)
      )];
      
      // Recalculate relevance with all matched interests
      const allKeywords = interests
        .filter((i) => allMatchedInterests.includes(i.id))
        .flatMap((i) => i.keywords);
      
      return {
        ...discovery,
        matchedInterests: allMatchedInterests,
        relevanceScore: Math.max(
          discovery.relevanceScore,
          ...matchingDiscoveries.map((d) => d.relevanceScore)
        ),
      };
    });
    
    // Sort by relevance and limit
    const sortedDiscoveries = mergedDiscoveries
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
    
    return NextResponse.json({
      success: true,
      data: {
        discoveries: sortedDiscoveries,
        stats: {
          totalSearches: interests.length,
          totalFound: allDiscoveries.length,
          uniqueResults: uniqueDiscoveries.length,
          returned: sortedDiscoveries.length,
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
  return NextResponse.json({
    status: "ok",
    seenTweets: seenTweetIds.size,
    timestamp: new Date().toISOString(),
  });
}
