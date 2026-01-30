import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/embeddings
 * 
 * Generate embeddings for discoveries that don't have them yet.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */
export async function POST(request: Request) {
  try {
    const { limit = 50 } = await request.json().catch(() => ({}));

    // Find discoveries without embeddings
    const pending = await db
      .select({
        id: discoveries.id,
        content: discoveries.content,
        title: discoveries.title,
      })
      .from(discoveries)
      .where(isNull(discoveries.embedding))
      .limit(limit);

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All discoveries have embeddings",
        processed: 0,
      });
    }

    console.log(`[embeddings] Processing ${pending.length} discoveries...`);

    // Generate embeddings in batches
    const texts = pending.map((d) => 
      `${d.title || ""} ${d.content}`.slice(0, 8000) // Limit text length
    );

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    // Update each discovery with its embedding
    let updated = 0;
    for (let i = 0; i < pending.length; i++) {
      const embedding = response.data[i].embedding;
      const vectorStr = `[${embedding.join(",")}]`;
      
      await db.execute(sql`
        UPDATE discoveries 
        SET embedding = ${vectorStr}::vector 
        WHERE id = ${pending[i].id}
      `);
      updated++;
    }

    console.log(`[embeddings] Updated ${updated} discoveries`);

    return NextResponse.json({
      success: true,
      processed: updated,
      remaining: await db
        .select({ count: sql<number>`count(*)` })
        .from(discoveries)
        .where(isNull(discoveries.embedding))
        .then((r) => Number(r[0]?.count || 0)),
    });
  } catch (error) {
    console.error("[embeddings] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate embeddings" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/embeddings
 * 
 * Get embedding stats.
 */
export async function GET() {
  try {
    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(discoveries)
      .then((r) => Number(r[0]?.count || 0));

    const withEmbeddings = await db
      .select({ count: sql<number>`count(*)` })
      .from(discoveries)
      .where(sql`embedding IS NOT NULL`)
      .then((r) => Number(r[0]?.count || 0));

    return NextResponse.json({
      success: true,
      data: {
        total,
        withEmbeddings,
        withoutEmbeddings: total - withEmbeddings,
        coverage: total > 0 ? Math.round((withEmbeddings / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[embeddings] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
