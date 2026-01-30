import { NextResponse } from "next/server";
import { getDiscoveryEmbedding, findSimilarByEmbedding } from "@/lib/embeddings";

/**
 * GET /api/discoveries/similar?id=<discovery_id>
 * 
 * Find discoveries similar to a given discovery using embedding cosine similarity.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const discoveryId = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!discoveryId) {
      return NextResponse.json(
        { success: false, error: "Missing discovery id" },
        { status: 400 }
      );
    }

    // Get embedding for the source discovery
    const embedding = await getDiscoveryEmbedding(discoveryId);

    if (!embedding) {
      return NextResponse.json(
        { success: false, error: "Discovery not found or has no embedding" },
        { status: 404 }
      );
    }

    // Find similar discoveries (excluding the source)
    const similar = await findSimilarByEmbedding(embedding, discoveryId, limit);

    // Format results
    const formatted = similar.map((r) => ({
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
      interest: r.interestId
        ? {
            id: r.interestId,
            name: r.interestName,
            color: r.interestColor,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      meta: {
        sourceId: discoveryId,
        count: formatted.length,
      },
    });
  } catch (error) {
    console.error("[similar] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to find similar" },
      { status: 500 }
    );
  }
}
