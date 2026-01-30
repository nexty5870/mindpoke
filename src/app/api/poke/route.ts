import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, pokes, interests, settings } from "@/lib/db/schema";
import { eq, gt, and, notInArray, desc } from "drizzle-orm";

const DEFAULT_MIN_RELEVANCE = 55;
const DEFAULT_MAX_POKES = 3;

// Helper to load app settings
async function loadSettings() {
  const result = await db.query.settings.findFirst({
    where: eq(settings.key, "app_settings"),
  });
  return result?.value as {
    minPokeRelevance?: number;
    maxPokesPerBatch?: number;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  } | null;
}

// Check if current time is within quiet hours
function isQuietHours(start?: string, end?: string): boolean {
  if (!start || !end) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight quiet hours (e.g., 23:00 to 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

interface PokeableDiscovery {
  id: string;
  title: string | null;
  content: string;
  sourceUrl: string | null;
  authorHandle: string | null;
  author: string | null;
  relevanceScore: number;
  interest: {
    id: string;
    name: string;
  } | null;
}

/**
 * Format a single discovery into a poke message line
 */
function formatDiscoveryLine(d: PokeableDiscovery, index: number): string {
  const interestName = d.interest?.name || "General";
  const score = Math.round(d.relevanceScore);
  const author = d.authorHandle ? `@${d.authorHandle}` : d.author || "Unknown";
  
  // Truncate title/content for message
  const title = (d.title || d.content || "").slice(0, 60);
  const ellipsis = (d.title || d.content || "").length > 60 ? "..." : "";
  
  return [
    `**${interestName}** (${score}% match)`,
    `"${title}${ellipsis}"`,
    `by ${author}`,
    d.sourceUrl ? `→ ${d.sourceUrl}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Format a batch of discoveries into a complete poke message
 */
function formatPokeMessage(discoveries: PokeableDiscovery[]): string {
  if (discoveries.length === 0) {
    return "";
  }

  const lines: string[] = ["[MINDPOKE] New discoveries:", ""];
  
  // Format each discovery
  discoveries.forEach((d, i) => {
    lines.push(formatDiscoveryLine(d, i + 1));
    if (i < discoveries.length - 1) {
      lines.push(""); // blank line between discoveries
    }
  });
  
  // Add footer with actions
  lines.push("");
  if (discoveries.length === 1) {
    lines.push("Reply SAVE or DISMISS to respond.");
  } else {
    lines.push("Reply SAVE 1 or DISMISS 1 to respond.");
  }
  
  return lines.join("\n");
}

/**
 * POST /api/poke
 * 
 * Finds high-relevance unseen discoveries and formats them for WhatsApp notification.
 * Records pokes in database to prevent duplicates.
 * 
 * Request body:
 * - minRelevance?: number (default: 80)
 * - maxPokes?: number (default: 3)
 * - dryRun?: boolean (default: false) - if true, don't record pokes
 * 
 * Response:
 * - message: string (formatted WhatsApp message, empty if nothing to poke)
 * - discoveries: array of discovery IDs that were included
 * - count: number of discoveries in message
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Load settings
    const appSettings = await loadSettings();
    
    // Use settings values with fallbacks, allow body to override
    const minRelevance = body.minRelevance ?? appSettings?.minPokeRelevance ?? DEFAULT_MIN_RELEVANCE;
    const maxPokes = body.maxPokes ?? appSettings?.maxPokesPerBatch ?? DEFAULT_MAX_POKES;
    const dryRun = body.dryRun ?? false;
    
    // Check quiet hours (unless explicitly overridden)
    if (!body.ignoreQuietHours && isQuietHours(appSettings?.quietHoursStart, appSettings?.quietHoursEnd)) {
      console.log("[poke] Skipping - quiet hours active");
      return NextResponse.json({
        success: true,
        message: "",
        discoveries: [],
        count: 0,
        reason: "Quiet hours active - no pokes sent",
        quietHours: true,
      });
    }
    
    console.log(`[poke] Using minRelevance=${minRelevance}, maxPokes=${maxPokes}`);

    // Get discovery IDs that have already been poked
    const alreadyPoked = await db.query.pokes.findMany({
      columns: { discoveryId: true },
      where: (pokes, { isNotNull }) => isNotNull(pokes.discoveryId),
    });
    const pokedIds = alreadyPoked
      .map(p => p.discoveryId)
      .filter((id): id is string => id !== null);

    // Find unseen discoveries with high relevance that haven't been poked
    const pokeableQuery = db
      .select({
        id: discoveries.id,
        title: discoveries.title,
        content: discoveries.content,
        sourceUrl: discoveries.sourceUrl,
        authorHandle: discoveries.authorHandle,
        author: discoveries.author,
        relevanceScore: discoveries.relevanceScore,
        interestId: discoveries.interestId,
        interestName: interests.name,
      })
      .from(discoveries)
      .leftJoin(interests, eq(discoveries.interestId, interests.id))
      .where(
        and(
          eq(discoveries.status, "unseen"),
          gt(discoveries.relevanceScore, minRelevance),
          pokedIds.length > 0 ? notInArray(discoveries.id, pokedIds) : undefined
        )
      )
      .orderBy(desc(discoveries.relevanceScore))
      .limit(maxPokes);

    const pokeable = await pokeableQuery;

    if (pokeable.length === 0) {
      return NextResponse.json({
        success: true,
        message: "",
        discoveries: [],
        count: 0,
        reason: "No high-relevance unseen discoveries to poke",
      });
    }

    // Transform to PokeableDiscovery format
    const formattedDiscoveries: PokeableDiscovery[] = pokeable.map(d => ({
      id: d.id,
      title: d.title,
      content: d.content,
      sourceUrl: d.sourceUrl,
      authorHandle: d.authorHandle,
      author: d.author,
      relevanceScore: d.relevanceScore,
      interest: d.interestId ? {
        id: d.interestId,
        name: d.interestName || "Unknown",
      } : null,
    }));

    // Format the message
    const message = formatPokeMessage(formattedDiscoveries);

    // Record pokes in database (unless dry run)
    if (!dryRun && formattedDiscoveries.length > 0) {
      const pokeRecords = formattedDiscoveries.map(d => ({
        discoveryId: d.id,
        interestId: d.interest?.id || null,
        message: formatDiscoveryLine(d, 0), // Individual message for tracking
        channel: "whatsapp" as const,
      }));

      await db.insert(pokes).values(pokeRecords);
    }

    return NextResponse.json({
      success: true,
      message,
      discoveries: formattedDiscoveries.map(d => d.id),
      count: formattedDiscoveries.length,
      dryRun,
    });
  } catch (error) {
    console.error("[poke] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Poke failed",
        message: "",
        discoveries: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/poke
 * 
 * Preview what would be poked without recording anything
 */
export async function GET() {
  // Same logic as POST but always dry run
  const fakeRequest = new Request("http://localhost/api/poke", {
    method: "POST",
    body: JSON.stringify({ dryRun: true }),
  });
  return POST(fakeRequest);
}
