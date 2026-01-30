import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, interests } from "@/lib/db/schema";
import { desc, ilike, eq, or, and, sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/embeddings";

/**
 * GET /api/search
 * 
 * Hybrid search combining keyword + semantic results.
 * 
 * Query params:
 * - q: Search query (text)
 * - mode: "hybrid" (default) | "keyword" | "semantic"
 * - limit: Max results (default 20)
 * 
 * Filters in query:
 * - #interest: filters by interest name
 * - @handle: filters by author handle
 * - x: or twitter: filters by X/Twitter source
 * - reddit: filters by Reddit source
 * - hn: or hackernews: filters by HackerNews source
 * 
 * Example: "agent #Claude @levelsio x:"
 * 
 * Hybrid scoring: keyword_score * 0.4 + semantic_similarity * 0.6
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const mode = searchParams.get("mode") || "hybrid";
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

    // If no text query left after extracting filters, just do filtered fetch
    if (!textQuery && mode !== "semantic") {
      return await doKeywordSearch(null, { interestFilter, authorFilter, sourceFilter }, limit);
    }

    // Hybrid mode: combine keyword + semantic
    if (mode === "hybrid" && textQuery) {
      const [keywordResults, semanticResults] = await Promise.all([
        doKeywordSearchRaw(textQuery, { interestFilter, authorFilter, sourceFilter }, limit * 2),
        doSemanticSearchRaw(textQuery, { interestFilter, authorFilter, sourceFilter }, limit * 2),
      ]);

      // Build score map: id -> { keyword_score, semantic_score }
      const scoreMap = new Map<string, { 
        keywordScore: number; 
        semanticScore: number;
        data: any;
      }>();

      // Normalize keyword scores (0-100 based on position)
      keywordResults.forEach((r: any, i: number) => {
        const positionScore = ((keywordResults.length - i) / keywordResults.length) * 100;
        scoreMap.set(r.id, {
          keywordScore: positionScore,
          semanticScore: 0,
          data: r,
        });
      });

      // Add semantic scores
      semanticResults.forEach((r: any) => {
        const existing = scoreMap.get(r.id);
        const semanticScore = r.similarity * 100; // Already 0-1
        if (existing) {
          existing.semanticScore = semanticScore;
        } else {
          scoreMap.set(r.id, {
            keywordScore: 0,
            semanticScore,
            data: r,
          });
        }
      });

      // Calculate hybrid scores: keyword * 0.4 + semantic * 0.6
      const hybridResults = Array.from(scoreMap.entries())
        .map(([id, scores]) => ({
          ...scores.data,
          keywordScore: Math.round(scores.keywordScore),
          semanticScore: Math.round(scores.semanticScore),
          hybridScore: Math.round(scores.keywordScore * 0.4 + scores.semanticScore * 0.6),
        }))
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: hybridResults,
        meta: {
          query,
          mode: "hybrid",
          filters: {
            text: textQuery || null,
            interest: interestFilter,
            author: authorFilter,
            source: sourceFilter,
          },
          count: hybridResults.length,
        },
      });
    }

    // Semantic-only mode
    if (mode === "semantic" && textQuery) {
      const results = await doSemanticSearchRaw(textQuery, { interestFilter, authorFilter, sourceFilter }, limit);
      const formatted = results.map((r: any) => ({
        ...r,
        similarity: Math.round(r.similarity * 100),
      }));
      return NextResponse.json({
        success: true,
        data: formatted,
        meta: {
          query,
          mode: "semantic",
          filters: {
            text: textQuery || null,
            interest: interestFilter,
            author: authorFilter,
            source: sourceFilter,
          },
          count: formatted.length,
        },
      });
    }

    // Keyword-only mode (default fallback)
    return await doKeywordSearch(textQuery, { interestFilter, authorFilter, sourceFilter }, limit);

  } catch (error) {
    console.error("[search] Error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}

interface Filters {
  interestFilter: string | null;
  authorFilter: string | null;
  sourceFilter: string | null;
}

async function doKeywordSearch(textQuery: string | null, filters: Filters, limit: number) {
  const results = await doKeywordSearchRaw(textQuery, filters, limit);
  return NextResponse.json({
    success: true,
    data: results,
    meta: {
      query: textQuery,
      mode: "keyword",
      filters,
      count: results.length,
    },
  });
}

async function doKeywordSearchRaw(textQuery: string | null, filters: Filters, limit: number) {
  const { interestFilter, authorFilter, sourceFilter } = filters;
  
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

  return results.slice(0, limit);
}

async function doSemanticSearchRaw(query: string, filters: Filters, limit: number) {
  const { interestFilter, authorFilter, sourceFilter } = filters;
  
  // Generate embedding for query
  const embedding = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  // Build filter conditions for SQL
  const filterConditions: string[] = ["d.embedding IS NOT NULL"];
  
  if (authorFilter) {
    filterConditions.push(`LOWER(d.author_handle) LIKE '%${authorFilter.toLowerCase()}%'`);
  }
  if (sourceFilter) {
    filterConditions.push(`d.source_type = '${sourceFilter}'`);
  }

  const whereClause = filterConditions.join(" AND ");

  const results = await db.execute(sql.raw(`
    SELECT 
      d.id,
      d.title,
      d.content,
      d.source_type as "sourceType",
      d.source_url as "sourceUrl",
      d.author,
      d.author_handle as "authorHandle",
      d.relevance_score as "relevanceScore",
      d.discovered_at as "discoveredAt",
      1 - (d.embedding <=> '${vectorStr}'::vector) as similarity,
      i.id as "interestId",
      i.name as "interestName",
      i.color as "interestColor"
    FROM discoveries d
    LEFT JOIN interests i ON d.interest_id = i.id
    WHERE ${whereClause}
    ORDER BY d.embedding <=> '${vectorStr}'::vector
    LIMIT ${limit * 2}
  `));

  const rows = Array.isArray(results) ? results : (results as any).rows || [];
  
  // Map and filter by interest in memory
  let mapped = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    sourceType: r.sourceType,
    sourceUrl: r.sourceUrl,
    author: r.author,
    authorHandle: r.authorHandle,
    relevanceScore: r.relevanceScore,
    discoveredAt: r.discoveredAt,
    similarity: parseFloat(r.similarity),
    interest: r.interestId ? {
      id: r.interestId,
      name: r.interestName,
      color: r.interestColor,
    } : null,
  }));

  if (interestFilter) {
    mapped = mapped.filter(
      (d: any) => d.interest?.name?.toLowerCase().includes(interestFilter!)
    );
  }

  return mapped.slice(0, limit);
}
