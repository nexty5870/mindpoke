import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SETTINGS_KEY = "app_settings";

// GET /api/settings - Get all settings
export async function GET() {
  try {
    const result = await db.query.settings.findFirst({
      where: eq(settings.key, SETTINGS_KEY),
    });

    return NextResponse.json({
      success: true,
      data: result?.value || null,
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST /api/settings - Save settings
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Upsert settings
    const existing = await db.query.settings.findFirst({
      where: eq(settings.key, SETTINGS_KEY),
    });

    if (existing) {
      await db
        .update(settings)
        .set({ value: body, updatedAt: new Date() })
        .where(eq(settings.key, SETTINGS_KEY));
    } else {
      await db.insert(settings).values({
        key: SETTINGS_KEY,
        value: body,
      });
    }

    return NextResponse.json({
      success: true,
      data: body,
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
