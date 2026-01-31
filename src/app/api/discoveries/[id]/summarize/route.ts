import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fetch readable content from a URL
 */
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    // Use a reader-mode service or fetch directly
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Mindpoke/1.0; +https://mindpoke.dev)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Basic HTML to text extraction
    // Remove scripts, styles, and HTML tags
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Return first 8000 chars to stay within token limits
    return text.slice(0, 8000);
  } catch (error) {
    console.error("[summarize] Failed to fetch URL content:", error);
    return null;
  }
}

/**
 * POST /api/discoveries/[id]/summarize
 * 
 * Generate an AI summary of a discovery's content.
 * If the discovery has a URL, fetches the full content first.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the discovery
    const [discovery] = await db
      .select()
      .from(discoveries)
      .where(eq(discoveries.id, id))
      .limit(1);

    if (!discovery) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    // Build content to summarize
    let contentToSummarize = "";
    let fetchedUrl = false;

    // Try to fetch URL content if available
    const url = discovery.sourceUrl;
    if (url && !url.includes("x.com") && !url.includes("twitter.com")) {
      // Don't fetch Twitter URLs - we already have the tweet content
      const urlContent = await fetchUrlContent(url);
      if (urlContent && urlContent.length > 200) {
        contentToSummarize = urlContent;
        fetchedUrl = true;
      }
    }

    // Fall back to stored content
    if (!contentToSummarize) {
      contentToSummarize = [
        discovery.title,
        discovery.content,
      ].filter(Boolean).join("\n\n");
    }

    if (!contentToSummarize || contentToSummarize.length < 50) {
      return NextResponse.json(
        { success: false, error: "Not enough content to summarize" },
        { status: 400 }
      );
    }

    // Generate summary with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a concise summarizer. Create a brief, informative summary of the given content.
Focus on:
- Key points and main ideas
- Notable insights or claims
- Why this might be interesting

Keep the summary to 2-3 sentences (max 100 words). Be direct and skip filler phrases.`,
        },
        {
          role: "user",
          content: `Summarize this:\n\n${contentToSummarize.slice(0, 6000)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json(
        { success: false, error: "Failed to generate summary" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        fetchedUrl,
        contentLength: contentToSummarize.length,
        model: "gpt-4o-mini",
      },
    });
  } catch (error) {
    console.error("[summarize] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Summarization failed" 
      },
      { status: 500 }
    );
  }
}
