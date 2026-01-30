import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

// GET /api/discoveries - List discoveries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const interestId = searchParams.get("interestId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = db.query.discoveries.findMany({
      orderBy: [desc(discoveries.discoveredAt)],
      limit,
      with: {
        interest: true,
      },
    });

    const allDiscoveries = await query;
    
    // Filter in memory for now (Drizzle query builder limitations)
    let filtered = allDiscoveries;
    if (status) {
      filtered = filtered.filter(d => d.status === status);
    }
    if (interestId) {
      filtered = filtered.filter(d => d.interestId === interestId);
    }

    return NextResponse.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error("Failed to fetch discoveries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch discoveries" },
      { status: 500 }
    );
  }
}

// POST /api/discoveries - Create discovery (usually from discover API)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];

    const created = await db.insert(discoveries).values(
      items.map(item => ({
        sourceType: item.sourceType || item.source,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl || item.url,
        title: item.title,
        content: item.content || item.summary,
        author: item.author,
        authorHandle: item.authorHandle,
        authorAvatar: item.authorAvatar,
        metadata: item.metadata || item.engagementMetrics || {},
        relevanceScore: item.relevanceScore || 0,
        engagementScore: item.engagementScore || 0,
        interestId: item.interestId,
        matchedKeywords: item.matchedKeywords || [],
        status: item.status || "unseen",
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      }))
    ).returning();

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (error) {
    console.error("Failed to create discoveries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create discoveries" },
      { status: 500 }
    );
  }
}
