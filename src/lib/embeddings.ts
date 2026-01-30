import OpenAI from "openai";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // Limit text length
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map(t => t.slice(0, 8000)),
  });
  
  return response.data.map(d => d.embedding);
}

/**
 * Save embedding for a discovery
 */
export async function saveEmbedding(discoveryId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await db.execute(sql`
    UPDATE discoveries 
    SET embedding = ${vectorStr}::vector 
    WHERE id = ${discoveryId}
  `);
}

/**
 * Find duplicates by embedding similarity
 * Returns discoveries with similarity > threshold
 */
export async function findDuplicatesByEmbedding(
  embedding: number[],
  threshold: number = 0.95
): Promise<Array<{ id: string; title: string | null; similarity: number }>> {
  const vectorStr = `[${embedding.join(",")}]`;
  
  const results = await db.execute(sql`
    SELECT 
      id,
      title,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM discoveries
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT 5
  `);
  
  const rows = Array.isArray(results) ? results : (results as any).rows || [];
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    similarity: parseFloat(r.similarity),
  }));
}

/**
 * Find similar discoveries by embedding
 */
export async function findSimilarByEmbedding(
  embedding: number[],
  excludeId: string | null = null,
  limit: number = 10
): Promise<Array<{
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  author: string | null;
  authorHandle: string | null;
  relevanceScore: number;
  discoveredAt: Date;
  similarity: number;
  interestId: string | null;
  interestName: string | null;
  interestColor: string | null;
}>> {
  const vectorStr = `[${embedding.join(",")}]`;
  
  const excludeClause = excludeId 
    ? sql`AND d.id != ${excludeId}` 
    : sql``;
  
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
      ${excludeClause}
    ORDER BY d.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);
  
  const rows = Array.isArray(results) ? results : (results as any).rows || [];
  return rows.map((r: any) => ({
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
    interestId: r.interestId,
    interestName: r.interestName,
    interestColor: r.interestColor,
  }));
}

/**
 * Get embedding for an existing discovery
 */
export async function getDiscoveryEmbedding(discoveryId: string): Promise<number[] | null> {
  const results = await db.execute(sql`
    SELECT embedding::text as embedding_text
    FROM discoveries
    WHERE id = ${discoveryId}
      AND embedding IS NOT NULL
  `);
  
  const rows = Array.isArray(results) ? results : (results as any).rows || [];
  if (rows.length === 0) return null;
  
  // Parse the vector string [1,2,3,...] back to array
  const embeddingText = rows[0].embedding_text;
  if (!embeddingText) return null;
  
  try {
    return JSON.parse(embeddingText);
  } catch {
    return null;
  }
}
