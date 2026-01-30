import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Discovery not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
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
