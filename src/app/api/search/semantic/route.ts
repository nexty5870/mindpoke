import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/search/semantic
 * 
 * Semantic search using embeddings.
 * Finds discoveries similar in meaning to the query.
 */
export async function POST(request: Request) {
  try {
    const { query, limit = 10 } = await request.json();

    if (!query?.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    console.log(`[semantic-search] Query: "${query}"`);

    // Generate embedding for the search query
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = response.data[0].embedding;
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    // Find similar discoveries using cosine similarity
    const results = await db.execute(sql`
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
        1 - (d.embedding <=> ${vectorStr}::vector) as similarity,
        i.id as "interestId",
        i.name as "interestName",
        i.color as "interestColor"
      FROM discoveries d
      LEFT JOIN interests i ON d.interest_id = i.id
      WHERE d.embedding IS NOT NULL
      ORDER BY d.embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    // Format results (Drizzle returns array directly, not .rows)
    const rows = Array.isArray(results) ? results : (results as any).rows || [];
    const formatted = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      sourceType: r.sourceType,
      sourceUrl: r.sourceUrl,
      author: r.author,
      authorHandle: r.authorHandle,
      relevanceScore: r.relevanceScore,
      discoveredAt: r.discoveredAt,
      similarity: Math.round(r.similarity * 100),
      interest: r.interestId ? {
        id: r.interestId,
        name: r.interestName,
        color: r.interestColor,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      meta: {
        query,
        type: "semantic",
        count: formatted.length,
      },
    });
  } catch (error) {
    console.error("[semantic-search] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
