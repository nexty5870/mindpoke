import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/interests - List all interests
export async function GET() {
  try {
    const allInterests = await db.query.interests.findMany({
      orderBy: (interests, { desc }) => [desc(interests.createdAt)],
    });
    
    return NextResponse.json({
      success: true,
      data: allInterests,
    });
  } catch (error) {
    console.error("Failed to fetch interests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}

// POST /api/interests - Create a new interest
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, keywords, priority, color, positionX, positionY } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const [newInterest] = await db.insert(interests).values({
      name,
      keywords: keywords || [],
      priority: priority || "medium",
      color: color || "#00d4aa",
      heat: 10, // Start cold, earn heat through engagement
      positionX,
      positionY,
    }).returning();

    return NextResponse.json({
      success: true,
      data: newInterest,
    });
  } catch (error) {
    console.error("Failed to create interest:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create interest" },
      { status: 500 }
    );
  }
}
