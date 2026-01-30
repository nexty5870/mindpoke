import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/**
 * GET /api/cron/status
 *
 * Returns the last cron run status and stats for UI display.
 */
export async function GET() {
  try {
    // Get last 5 runs
    const runs = await db
      .select()
      .from(cronRuns)
      .orderBy(desc(cronRuns.startedAt))
      .limit(5);

    const lastRun = runs[0] || null;

    // Calculate aggregates
    const last24h = runs.filter((r) => {
      const runTime = new Date(r.startedAt).getTime();
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return runTime > dayAgo;
    });

    const totalFound24h = last24h.reduce(
      (sum, r) => sum + (r.discoveriesSaved || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        lastRun: lastRun
          ? {
              id: lastRun.id,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              status: lastRun.status,
              durationMs: lastRun.durationMs,
              discoveriesFound: lastRun.discoveriesFound,
              discoveriesSaved: lastRun.discoveriesSaved,
              interestsScanned: lastRun.interestsScanned,
              pokesQueued: lastRun.pokesQueued,
              pokesSent: lastRun.pokesSent,
              notificationSkipped: lastRun.notificationSkipped,
              error: lastRun.error,
            }
          : null,
        recentRuns: runs.map((r) => ({
          id: r.id,
          startedAt: r.startedAt,
          status: r.status,
          discoveriesSaved: r.discoveriesSaved,
          notificationSkipped: r.notificationSkipped,
        })),
        stats: {
          totalFound24h,
          runsLast24h: last24h.length,
        },
      },
    });
  } catch (error) {
    console.error("[cron/status] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
