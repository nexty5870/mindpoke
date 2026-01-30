import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// POST /api/interests/decay
// Decay all interest heat by 5%, floor at 10
export async function POST() {
  try {
    // Decay heat by 5% (multiply by 0.95), but never go below 10
    const result = await db
      .update(interests)
      .set({
        heat: sql`GREATEST(${interests.heat} * 0.95, 10)`,
        updatedAt: new Date(),
      })
      .returning({ id: interests.id, name: interests.name, heat: interests.heat });

    console.log(`[decay] Decayed heat for ${result.length} interests`);

    return NextResponse.json({
      success: true,
      message: `Decayed heat for ${result.length} interests`,
      data: result,
    });
  } catch (error) {
    console.error("Failed to decay interest heat:", error);
    return NextResponse.json(
      { success: false, error: "Failed to decay interest heat" },
      { status: 500 }
    );
  }
}
