import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, interests } from "@/lib/db/schema";
import { desc, ilike, eq, or, and, sql } from "drizzle-orm";

/**
 * GET /api/search
 * 
 * Search discoveries with filters:
 * - Plain text: searches title and content
 * - #interest: filters by interest name
 * - @handle: filters by author handle
 * - x: or twitter: filters by X/Twitter source
 * - reddit: filters by Reddit source
 * - hn: or hackernews: filters by HackerNews source
 * 
 * Example: "agent #Claude @levelsio x:"
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Parse query for filters
    let textQuery = query;
    let interestFilter: string | null = null;
    let authorFilter: string | null = null;
    let sourceFilter: string | null = null;

    // Extract #interest
    const interestMatch = query.match(/#(\w+)/);
    if (interestMatch) {
      interestFilter = interestMatch[1].toLowerCase();
      textQuery = textQuery.replace(/#\w+/, "").trim();
    }

    // Extract @author
    const authorMatch = query.match(/@(\w+)/);
    if (authorMatch) {
      authorFilter = authorMatch[1].toLowerCase();
      textQuery = textQuery.replace(/@\w+/, "").trim();
    }

    // Extract source filter
    const sourceMatch = query.match(/\b(x|twitter|reddit|hn|hackernews):/i);
    if (sourceMatch) {
      const s = sourceMatch[1].toLowerCase();
      sourceFilter = s === "x" || s === "twitter" ? "twitter" 
                   : s === "hn" || s === "hackernews" ? "hackernews"
                   : s;
      textQuery = textQuery.replace(/\b(x|twitter|reddit|hn|hackernews):/i, "").trim();
    }

    // Build query conditions
    const conditions: any[] = [];

    // Text search (title or content)
    if (textQuery) {
      conditions.push(
        or(
          ilike(discoveries.title, `%${textQuery}%`),
          ilike(discoveries.content, `%${textQuery}%`)
        )
      );
    }

    // Author filter
    if (authorFilter) {
      conditions.push(ilike(discoveries.authorHandle, `%${authorFilter}%`));
    }

    // Source filter
    if (sourceFilter) {
      conditions.push(eq(discoveries.sourceType, sourceFilter));
    }

    // Get all matching discoveries with interest data
    let results = await db.query.discoveries.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(discoveries.relevanceScore), desc(discoveries.discoveredAt)],
      limit: limit * 2, // Fetch more to filter by interest
      with: {
        interest: true,
      },
    });

    // Filter by interest name (need to do this in memory since it's a relation)
    if (interestFilter) {
      results = results.filter(
        (d) => d.interest?.name.toLowerCase().includes(interestFilter!)
      );
    }

    // Limit final results
    results = results.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        query,
        filters: {
          text: textQuery || null,
          interest: interestFilter,
          author: authorFilter,
          source: sourceFilter,
        },
        count: results.length,
      },
    });
  } catch (error) {
    console.error("[search] Error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}
