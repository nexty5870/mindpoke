import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pokes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// GET /api/pokes - List recent pokes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const recentPokes = await db.query.pokes.findMany({
      orderBy: [desc(pokes.sentAt)],
      limit,
    });

    return NextResponse.json({
      success: true,
      data: recentPokes,
    });
  } catch (error) {
    console.error("Failed to fetch pokes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pokes" },
      { status: 500 }
    );
  }
}
