/**
 * AI utilities for Mindpoke
 * Uses OpenAI for keyword expansion and smart suggestions
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface KeywordSuggestion {
  keyword: string;
  reason: string;
}

interface AIKeywordResponse {
  suggestions: KeywordSuggestion[];
  relatedTopics: string[];
}

/**
 * Generate AI-powered keyword suggestions for an interest
 */
export async function suggestKeywords(
  interestName: string,
  existingKeywords: string[],
  context?: {
    savedTitles?: string[];
    recentDiscoveries?: string[];
  }
): Promise<AIKeywordResponse> {
  if (!OPENAI_API_KEY) {
    console.warn("[ai] No OpenAI API key, falling back to empty suggestions");
    return { suggestions: [], relatedTopics: [] };
  }

  const contextText = context?.savedTitles?.length
    ? `\n\nRecent saved content titles:\n${context.savedTitles.slice(0, 5).map(t => `- ${t}`).join("\n")}`
    : "";

  const prompt = `You are a keyword research assistant for a content discovery tool.

Interest topic: "${interestName}"
Current keywords: [${existingKeywords.join(", ")}]${contextText}

Generate 8-10 additional search keywords that would help find relevant content on X/Twitter about this topic. Focus on:
1. Synonyms and related terms
2. Key people/accounts in this space
3. Hashtags without the # symbol
4. Related technologies or concepts
5. Common phrases used when discussing this topic

Return JSON only:
{
  "suggestions": [
    {"keyword": "term", "reason": "brief reason why this is relevant"}
  ],
  "relatedTopics": ["topic1", "topic2"]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that outputs only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("[ai] OpenAI error:", response.status, await response.text());
      return { suggestions: [], relatedTopics: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON response
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    
    return {
      suggestions: parsed.suggestions || [],
      relatedTopics: parsed.relatedTopics || [],
    };
  } catch (error) {
    console.error("[ai] Keyword suggestion failed:", error);
    return { suggestions: [], relatedTopics: [] };
  }
}

/**
 * Analyze content to extract key themes
 */
export async function analyzeContentThemes(
  texts: string[]
): Promise<string[]> {
  if (!OPENAI_API_KEY || texts.length === 0) {
    return [];
  }

  const sampleTexts = texts.slice(0, 10).join("\n---\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Extract 5-8 key themes/topics from the content. Return as JSON array of strings only." },
          { role: "user", content: sampleTexts },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return [];
  }
}
