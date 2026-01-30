import { NextResponse } from "next/server";

/**
 * POST /api/notify
 * 
 * Queue a notification to be sent via WhatsApp.
 * Note: Actual WhatsApp sending happens via Moltbot cron.
 * This endpoint just records the intent and returns the message.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // For now, just return success - the poke is already recorded in DB
    // Actual WhatsApp delivery happens via Moltbot cron or manual trigger
    return NextResponse.json({
      success: true,
      message: "Notification queued",
      preview: message.slice(0, 100) + "...",
      note: "WhatsApp delivery via Moltbot cron",
    });
  } catch (error) {
    console.error("Failed to queue notification:", error);
    return NextResponse.json(
      { success: false, error: "Failed to queue notification" },
      { status: 500 }
    );
  }
}
