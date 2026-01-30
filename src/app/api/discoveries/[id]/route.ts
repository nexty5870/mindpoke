import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, interests } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// Heat adjustment values for feedback loop
const HEAT_SAVE_DELTA = 5;  // saved → +5
const HEAT_DISMISS_DELTA = -2;  // dismissed → -2

// GET /api/discoveries/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const discovery = await db.query.discoveries.findFirst({
      where: eq(discoveries.id, id),
      with: { interest: true },
    });

    if (!discovery) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: discovery,
    });
  } catch (error) {
    console.error("Failed to fetch discovery:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch discovery" },
      { status: 500 }
    );
  }
}

// PATCH /api/discoveries/[id] - Update status, etc.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // First, get the current discovery to check for status change and get interestId
    const existing = await db.query.discoveries.findFirst({
      where: eq(discoveries.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    // Handle status changes with timestamps
    const updates: Record<string, unknown> = { ...body };
    if (body.status === "seen" && !body.seenAt) {
      updates.seenAt = new Date();
    }

    const [updated] = await db
      .update(discoveries)
      .set(updates)
      .where(eq(discoveries.id, id))
      .returning();

    // Update interest heat if status changed to saved or dismissed
    let updatedInterest = null;
    if (body.status && existing.interestId && body.status !== existing.status) {
      const heatDelta = body.status === "saved" 
        ? HEAT_SAVE_DELTA 
        : body.status === "dismissed" 
        ? HEAT_DISMISS_DELTA 
        : 0;

      if (heatDelta !== 0) {
        // Update heat with floor(0) and cap(100)
        const [interest] = await db
          .update(interests)
          .set({
            heat: sql`GREATEST(0, LEAST(100, ${interests.heat} + ${heatDelta}))`,
            updatedAt: new Date(),
          })
          .where(eq(interests.id, existing.interestId))
          .returning();
        
        updatedInterest = interest;
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
      interest: updatedInterest,
    });
  } catch (error) {
    console.error("Failed to update discovery:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update discovery" },
      { status: 500 }
    );
  }
}

// DELETE /api/discoveries/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(discoveries)
      .where(eq(discoveries.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    console.error("Failed to delete discovery:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete discovery" },
      { status: 500 }
    );
  }
}
