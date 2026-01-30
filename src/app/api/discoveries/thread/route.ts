import { NextResponse } from "next/server";
import { getThread, readTweet, type Tweet } from "@/lib/sources/bird";

export interface ThreadResponse {
  success: boolean;
  data?: {
    mainTweet: Tweet;
    thread: Tweet[];
    isThread: boolean;
  };
  error?: string;
}

/**
 * GET /api/discoveries/thread?id=<tweetId>
 * Fetches full thread data for a tweet
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tweetId = searchParams.get("id");

    if (!tweetId) {
      return NextResponse.json(
        { success: false, error: "Missing tweet id parameter" },
        { status: 400 }
      );
    }

    console.log(`[thread] Fetching thread for tweet: ${tweetId}`);

    // First get the main tweet
    const mainTweet = await readTweet(tweetId);
    
    // Check if this is part of a thread (has conversation id different from tweet id)
    const isThread = mainTweet.conversationId && mainTweet.conversationId !== mainTweet.id;
    
    let thread: Tweet[] = [];
    if (isThread) {
      try {
        // Fetch full thread using conversation ID
        thread = await getThread(mainTweet.conversationId);
        console.log(`[thread] Found ${thread.length} tweets in thread`);
      } catch (threadError) {
        console.error("[thread] Failed to fetch thread:", threadError);
        // Continue with just the main tweet
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mainTweet,
        thread,
        isThread: thread.length > 1,
      },
    });
  } catch (error) {
    console.error("[thread] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch thread",
      },
      { status: 500 }
    );
  }
}
