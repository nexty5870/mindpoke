import { NextResponse } from "next/server";

/**
 * GET /api/cron
 * 
 * Main cron endpoint for Mindpoke. Runs the discovery and poke flow.
 * Designed to be called by Moltbot's cron system.
 * 
 * Flow:
 * 1. Run discover to find new high-relevance content
 * 2. Run poke to format a notification message
 * 3. Return the message for Moltbot to send via WhatsApp
 * 
 * Response:
 * - success: boolean
 * - discover: { found, saved, ... }
 * - poke: { message, count, discoveries }
 * - shouldNotify: boolean (true if there's a message to send)
 */
export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;
  
  try {
    // Step 1: Run discovery
    console.log("[cron] Running discovery...");
    const discoverRes = await fetch(`${baseUrl}/api/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minRelevance: 40, // Lower bar for discovery
        maxResultsPerInterest: 10,
      }),
    });
    
    const discoverData = await discoverRes.json();
    
    if (!discoverData.success) {
      console.error("[cron] Discovery failed:", discoverData.error);
      return NextResponse.json({
        success: false,
        error: `Discovery failed: ${discoverData.error}`,
        discover: null,
        poke: null,
        shouldNotify: false,
      }, { status: 500 });
    }
    
    console.log(`[cron] Discovery found ${discoverData.data?.stats?.persisted || 0} new items`);
    
    // Step 2: Check for high-relevance items to poke
    console.log("[cron] Checking for pokeable items...");
    const pokeRes = await fetch(`${baseUrl}/api/poke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minRelevance: 80, // High bar for notifications
        maxPokes: 3,
        dryRun: false, // Record the pokes
      }),
    });
    
    const pokeData = await pokeRes.json();
    
    if (!pokeData.success) {
      console.error("[cron] Poke failed:", pokeData.error);
      // Don't fail the whole cron, just report no notification
      return NextResponse.json({
        success: true,
        discover: discoverData.data?.stats || null,
        poke: null,
        pokeError: pokeData.error,
        shouldNotify: false,
      });
    }
    
    const shouldNotify = pokeData.count > 0 && pokeData.message;
    
    console.log(`[cron] Poke result: ${pokeData.count} items, shouldNotify=${shouldNotify}`);
    
    return NextResponse.json({
      success: true,
      discover: discoverData.data?.stats || null,
      poke: {
        message: pokeData.message,
        count: pokeData.count,
        discoveries: pokeData.discoveries,
      },
      shouldNotify,
    });
    
  } catch (error) {
    console.error("[cron] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Cron failed",
      discover: null,
      poke: null,
      shouldNotify: false,
    }, { status: 500 });
  }
}

/**
 * POST /api/cron
 * 
 * Same as GET but allows passing options
 * 
 * Body:
 * - skipDiscover?: boolean (only run poke check)
 * - minRelevance?: number (override poke threshold)
 */
export async function POST(request: Request) {
  // For now, just delegate to GET
  return GET(request);
}
