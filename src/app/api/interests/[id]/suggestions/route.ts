import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discoveries, interests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { suggestKeywords } from "@/lib/ai";

// Common English stop words to filter out
const STOP_WORDS = new Set([
  // Articles
  "a", "an", "the",
  // Pronouns
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
  "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she",
  "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
  "theirs", "themselves", "what", "which", "who", "whom", "this", "that",
  "these", "those",
  // Verbs
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "having", "do", "does", "did", "doing", "would", "should", "could",
  "ought", "might", "must", "shall", "will", "can", "may",
  // Prepositions
  "about", "above", "across", "after", "against", "along", "among", "around",
  "at", "before", "behind", "below", "beneath", "beside", "between", "beyond",
  "by", "down", "during", "except", "for", "from", "in", "inside", "into",
  "like", "near", "of", "off", "on", "onto", "out", "outside", "over",
  "past", "since", "through", "throughout", "till", "to", "toward", "under",
  "underneath", "until", "up", "upon", "with", "within", "without",
  // Conjunctions
  "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
  "not", "only", "whether", "while", "although", "because", "if", "when",
  "where", "how", "why", "than", "then", "once",
  // Other common words
  "all", "any", "each", "every", "few", "more", "most", "other", "some",
  "such", "no", "not", "own", "same", "too", "very", "just", "also",
  "now", "here", "there", "always", "never", "often", "still", "already",
  "even", "much", "many", "well", "back", "way", "new", "first", "last",
  "long", "great", "little", "old", "right", "big", "high", "different",
  "small", "large", "next", "early", "young", "important", "public", "bad",
  "same", "able", "get", "got", "make", "made", "take", "took", "see", "saw",
  "know", "knew", "think", "thought", "come", "came", "want", "use", "find",
  "found", "give", "gave", "tell", "told", "work", "seem", "feel", "try",
  "leave", "left", "call", "keep", "let", "begin", "seem", "help", "show",
  "hear", "heard", "play", "run", "ran", "move", "live", "believe", "hold",
  "bring", "happen", "write", "wrote", "provide", "sit", "stand", "lose",
  "pay", "meet", "include", "continue", "set", "learn", "change", "lead",
  "understand", "watch", "follow", "stop", "create", "speak", "read", "allow",
  "add", "spend", "grow", "open", "walk", "win", "offer", "remember", "love",
  "consider", "appear", "buy", "wait", "serve", "die", "send", "expect",
  "build", "stay", "fall", "cut", "reach", "kill", "remain", "suggest",
  "raise", "pass", "sell", "require", "report", "decide", "pull",
  // Web/social specific
  "http", "https", "www", "com", "org", "net", "via", "amp", "html", "url",
  "link", "click", "post", "thread", "reply", "retweet", "like", "share",
  "tweet", "follow", "comment", "read", "check", "see", "look", "today",
  "yesterday", "tomorrow", "week", "month", "year", "day", "time", "thing",
  "things", "people", "person", "man", "woman", "child", "world", "life",
  "hand", "part", "place", "case", "fact", "point", "government", "company",
  "number", "group", "problem", "yeah", "yes", "okay", "sure", "really",
  "actually", "basically", "literally", "probably", "maybe", "perhaps",
  "though", "however", "therefore", "thus", "hence", "anyway", "instead",
]);

interface WordFrequency {
  keyword: string;
  score: number;
}

function extractKeywords(
  texts: string[],
  existingKeywords: string[],
  limit: number = 10
): WordFrequency[] {
  const wordCounts = new Map<string, number>();
  const existingSet = new Set(existingKeywords.map(k => k.toLowerCase()));

  for (const text of texts) {
    if (!text) continue;

    // Extract words - keep alphanumeric and hyphens for compound terms
    const words = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter(word => {
        // Skip if too short
        if (word.length < 3) return false;
        // Skip if it's a stop word
        if (STOP_WORDS.has(word)) return false;
        // Skip if it's already a keyword
        if (existingSet.has(word)) return false;
        // Skip if it's just numbers
        if (/^\d+$/.test(word)) return false;
        return true;
      });

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Sort by frequency and return top N
  const sorted = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, score]) => ({ keyword, score }));

  return sorted;
}

// GET /api/interests/[id]/suggestions - Get keyword suggestions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const useAI = searchParams.get("ai") !== "false"; // Default to using AI

    // Get the interest with its keywords
    const interest = await db.query.interests.findFirst({
      where: eq(interests.id, id),
    });

    if (!interest) {
      return NextResponse.json(
        { success: false, error: "Interest not found" },
        { status: 404 }
      );
    }

    // Get all saved discoveries for this interest
    const savedDiscoveries = await db.query.discoveries.findMany({
      where: and(
        eq(discoveries.interestId, id),
        eq(discoveries.status, "saved")
      ),
    });

    // Extract text content from discoveries
    const texts = savedDiscoveries.flatMap(d => [
      d.title || "",
      d.content || "",
    ]).filter(Boolean);

    // Get frequency-based suggestions from saved content
    const frequencyKeywords = savedDiscoveries.length > 0
      ? extractKeywords(texts, interest.keywords || [], limit)
      : [];

    // Get AI-powered suggestions
    let aiSuggestions: { keyword: string; reason: string }[] = [];
    let relatedTopics: string[] = [];
    
    if (useAI) {
      try {
        const aiResult = await suggestKeywords(
          interest.name,
          interest.keywords || [],
          {
            savedTitles: savedDiscoveries.slice(0, 5).map(d => d.title || d.content || "").filter(Boolean),
          }
        );
        aiSuggestions = aiResult.suggestions;
        relatedTopics = aiResult.relatedTopics;
      } catch (e) {
        console.error("AI suggestions failed:", e);
      }
    }

    // Merge and dedupe suggestions
    const existingSet = new Set((interest.keywords || []).map(k => k.toLowerCase()));
    const seenKeywords = new Set<string>();
    
    const mergedSuggestions = [
      ...aiSuggestions.map(s => ({
        keyword: s.keyword,
        score: 100, // AI suggestions get high score
        reason: s.reason,
        source: "ai" as const,
      })),
      ...frequencyKeywords.map(s => ({
        keyword: s.keyword,
        score: s.score,
        reason: `Appears ${s.score}x in saved content`,
        source: "frequency" as const,
      })),
    ].filter(s => {
      const lower = s.keyword.toLowerCase();
      if (existingSet.has(lower) || seenKeywords.has(lower)) return false;
      seenKeywords.add(lower);
      return true;
    }).slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        interestId: id,
        interestName: interest.name,
        existingKeywords: interest.keywords,
        savedCount: savedDiscoveries.length,
        suggestedKeywords: mergedSuggestions,
        relatedTopics,
        sources: {
          ai: aiSuggestions.length > 0,
          frequency: frequencyKeywords.length > 0,
        },
      },
    });
  } catch (error) {
    console.error("Failed to generate keyword suggestions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
