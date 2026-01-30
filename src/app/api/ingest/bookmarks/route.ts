import { NextResponse } from "next/server";
import { getBookmarks, extractKeywords, type Tweet } from "@/lib/sources/bird";

export interface IngestedBookmark {
  id: string;
  tweetId: string;
  title: string;
  text: string;
  url: string;
  author: string;
  authorHandle: string;
  keywords: string[];
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  createdAt: string;
  ingestedAt: string;
}

// In-memory store for ingested bookmark IDs (to prevent duplicates)
// In production, this would be in a database
const ingestedIds = new Set<string>();

function tweetToBookmark(tweet: Tweet): IngestedBookmark {
  const title = tweet.article?.title || tweet.text.slice(0, 100) + (tweet.text.length > 100 ? "..." : "");
  
  return {
    id: `bm_${tweet.id}`,
    tweetId: tweet.id,
    title,
    text: tweet.text,
    url: `https://x.com/${tweet.author.username}/status/${tweet.id}`,
    author: tweet.author.name,
    authorHandle: tweet.author.username,
    keywords: extractKeywords(tweet.text + " " + (tweet.article?.title || "")),
    engagement: {
      likes: tweet.likeCount || 0,
      retweets: tweet.retweetCount || 0,
      replies: tweet.replyCount || 0,
    },
    createdAt: tweet.createdAt,
    ingestedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get("count") || "50", 10);
  const includeAll = searchParams.get("includeAll") === "true";
  
  try {
    console.log(`[ingest/bookmarks] Fetching ${count} bookmarks...`);
    
    const tweets = await getBookmarks(count);
    
    // Filter out already ingested unless includeAll is true
    const newTweets = includeAll 
      ? tweets 
      : tweets.filter((t) => !ingestedIds.has(t.id));
    
    // Convert to bookmark format
    const bookmarks = newTweets.map(tweetToBookmark);
    
    // Mark as ingested
    newTweets.forEach((t) => ingestedIds.add(t.id));
    
    // Extract aggregate keywords for interest suggestions
    const keywordCounts = new Map<string, number>();
    bookmarks.forEach((bm) => {
      bm.keywords.forEach((kw) => {
        keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
      });
    });
    
    // Sort keywords by frequency
    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));
    
    return NextResponse.json({
      success: true,
      data: {
        bookmarks,
        stats: {
          total: tweets.length,
          new: newTweets.length,
          skipped: tweets.length - newTweets.length,
        },
        suggestedInterests: topKeywords,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ingest/bookmarks] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch bookmarks",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // POST can be used to force re-ingest or clear the ingested IDs cache
  try {
    const body = await request.json();
    
    if (body.action === "clear") {
      const count = ingestedIds.size;
      ingestedIds.clear();
      return NextResponse.json({
        success: true,
        message: `Cleared ${count} ingested bookmark IDs`,
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
