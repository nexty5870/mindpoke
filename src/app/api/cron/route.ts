import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronRuns, settings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Check if current time is within quiet hours
 */
async function isQuietHours(): Promise<boolean> {
  try {
    const settingsRow = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "mindpoke"))
      .then((rows) => rows[0]);

    if (!settingsRow?.value) return false;

    const value = settingsRow.value as {
      quietHoursStart?: string;
      quietHoursEnd?: string;
    };

    const start = value.quietHoursStart || "23:00";
    const end = value.quietHoursEnd || "08:00";

    // Parse times (Warsaw timezone)
    const now = new Date();
    const warsawTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Warsaw" })
    );
    const currentMinutes =
      warsawTime.getHours() * 60 + warsawTime.getMinutes();

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 23:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (e) {
    console.error("[cron] Failed to check quiet hours:", e);
    return false;
  }
}

/**
 * GET /api/cron
 *
 * Main cron endpoint for Mindpoke. Runs discovery ALWAYS, but respects
 * quiet hours for notifications only.
 *
 * Flow:
 * 1. Create a cron_run record
 * 2. Run discover to find new content (always runs)
 * 3. Check quiet hours - if quiet, skip notifications
 * 4. Run poke to format a notification message
 * 5. Update run record with stats
 * 6. Return the message for Moltbot to send via WhatsApp
 */
export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;
  const startTime = Date.now();

  // Create run record
  const [run] = await db
    .insert(cronRuns)
    .values({
      status: "running",
    })
    .returning();

  try {
    // Step 1: Run discovery (ALWAYS - even during quiet hours)
    console.log("[cron] Running discovery...");
    const discoverRes = await fetch(`${baseUrl}/api/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minRelevance: 40,
        maxResultsPerInterest: 10,
      }),
    });

    const discoverData = await discoverRes.json();

    if (!discoverData.success) {
      console.error("[cron] Discovery failed:", discoverData.error);

      // Update run record with failure
      await db
        .update(cronRuns)
        .set({
          status: "failed",
          error: `Discovery failed: ${discoverData.error}`,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        })
        .where(eq(cronRuns.id, run.id));

      return NextResponse.json(
        {
          success: false,
          error: `Discovery failed: ${discoverData.error}`,
          runId: run.id,
          discover: null,
          poke: null,
          shouldNotify: false,
        },
        { status: 500 }
      );
    }

    const discoverStats = discoverData.data?.stats || {};
    // Map API field names to our DB field names
    const statsFound = discoverStats.totalFound || 0;
    const statsSaved = discoverStats.persisted || 0;
    const statsInterests = discoverStats.totalInterests || 0;
    console.log(
      `[cron] Discovery found ${statsSaved} new items (${statsFound} total, ${statsInterests} interests)`
    );

    // Step 2: Check quiet hours
    const quietHours = await isQuietHours();
    console.log(`[cron] Quiet hours: ${quietHours}`);

    if (quietHours) {
      // During quiet hours: discovery ran, but skip notifications
      await db
        .update(cronRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          discoveriesFound: statsFound,
          discoveriesSaved: statsSaved,
          interestsScanned: statsInterests,
          notificationSkipped: true,
          pokesQueued: 0,
          pokesSent: 0,
        })
        .where(eq(cronRuns.id, run.id));

      return NextResponse.json({
        success: true,
        runId: run.id,
        discover: discoverStats,
        poke: null,
        shouldNotify: false,
        quietHours: true,
        message: "Discovery completed. Notifications skipped (quiet hours).",
      });
    }

    // Step 3: Check for high-relevance items to poke
    console.log("[cron] Checking for pokeable items...");
    const pokeRes = await fetch(`${baseUrl}/api/poke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minRelevance: 55,
        maxPokes: 3,
        dryRun: false,
      }),
    });

    const pokeData = await pokeRes.json();

    if (!pokeData.success) {
      console.error("[cron] Poke failed:", pokeData.error);

      // Update run - discovery succeeded but poke failed
      await db
        .update(cronRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          discoveriesFound: statsFound,
          discoveriesSaved: statsSaved,
          interestsScanned: statsInterests,
          notificationSkipped: false,
          pokesQueued: 0,
          pokesSent: 0,
          error: `Poke failed: ${pokeData.error}`,
        })
        .where(eq(cronRuns.id, run.id));

      return NextResponse.json({
        success: true,
        runId: run.id,
        discover: discoverStats,
        poke: null,
        pokeError: pokeData.error,
        shouldNotify: false,
      });
    }

    const shouldNotify = pokeData.count > 0 && !!pokeData.message;

    // Update run record with success
    await db
      .update(cronRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        discoveriesFound: statsFound,
        discoveriesSaved: statsSaved,
        interestsScanned: statsInterests,
        notificationSkipped: false,
        pokesQueued: pokeData.count || 0,
        pokesSent: shouldNotify ? pokeData.count : 0,
      })
      .where(eq(cronRuns.id, run.id));

    console.log(
      `[cron] Poke result: ${pokeData.count} items, shouldNotify=${shouldNotify}`
    );

    return NextResponse.json({
      success: true,
      runId: run.id,
      discover: discoverStats,
      poke: {
        message: pokeData.message,
        count: pokeData.count,
        discoveries: pokeData.discoveries,
      },
      shouldNotify,
    });
  } catch (error) {
    console.error("[cron] Error:", error);

    // Update run record with failure
    await db
      .update(cronRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Cron failed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      })
      .where(eq(cronRuns.id, run.id));

    return NextResponse.json(
      {
        success: false,
        runId: run.id,
        error: error instanceof Error ? error.message : "Cron failed",
        discover: null,
        poke: null,
        shouldNotify: false,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron
 * Same as GET but allows passing options
 */
export async function POST(request: Request) {
  return GET(request);
}
