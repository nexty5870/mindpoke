import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, pokes, interests } from "@/lib/db/schema";
import { eq, gt, and, notInArray, desc } from "drizzle-orm";

const MIN_RELEVANCE = 80;
const MAX_POKES_PER_BATCH = 3;

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
    const minRelevance = body.minRelevance ?? MIN_RELEVANCE;
    const maxPokes = body.maxPokes ?? MAX_POKES_PER_BATCH;
    const dryRun = body.dryRun ?? false;

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
