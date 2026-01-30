import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/interests/[id] - Get single interest
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interest = await db.query.interests.findFirst({
      where: eq(interests.id, id),
    });

    if (!interest) {
      return NextResponse.json(
        { success: false, error: "Interest not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: interest,
    });
  } catch (error) {
    console.error("Failed to fetch interest:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch interest" },
      { status: 500 }
    );
  }
}

// PATCH /api/interests/[id] - Update interest
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(interests)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(interests.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Interest not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Failed to update interest:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update interest" },
      { status: 500 }
    );
  }
}

// DELETE /api/interests/[id] - Delete interest
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(interests)
      .where(eq(interests.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Interest not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    console.error("Failed to delete interest:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete interest" },
      { status: 500 }
    );
  }
}
