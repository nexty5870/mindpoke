/**
 * HackerNews source for Mindpoke
 * Uses the official Firebase API
 */

export interface HNStory {
  id: number;
  title: string;
  url?: string;
  by: string;
  score: number;
  descendants: number; // comment count
  time: number;
  type: "story" | "job" | "poll";
  text?: string; // for Ask HN / text posts
}

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

/**
 * Fetch top story IDs
 */
export async function fetchTopStoryIds(limit: number = 100): Promise<number[]> {
  try {
    const response = await fetch(`${HN_API_BASE}/topstories.json`);
    if (!response.ok) {
      console.error(`[hackernews] Failed to fetch top stories: ${response.status}`);
      return [];
    }
    const ids: number[] = await response.json();
    return ids.slice(0, limit);
  } catch (error) {
    console.error("[hackernews] Error fetching top stories:", error);
    return [];
  }
}

/**
 * Fetch a single story by ID
 */
export async function fetchStory(id: number): Promise<HNStory | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
    if (!response.ok) {
      return null;
    }
    const item = await response.json();
    if (!item || item.dead || item.deleted) {
      return null;
    }
    return item as HNStory;
  } catch (error) {
    console.error(`[hackernews] Error fetching story ${id}:`, error);
    return null;
  }
}

/**
 * Fetch multiple stories in parallel (with batching to avoid rate limits)
 */
export async function fetchStories(ids: number[], batchSize: number = 20): Promise<HNStory[]> {
  const stories: HNStory[] = [];
  
  // Process in batches
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(id => fetchStory(id)));
    stories.push(...results.filter((s): s is HNStory => s !== null && s.type === "story"));
    
    // Small delay between batches
    if (i + batchSize < ids.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return stories;
}

/**
 * Search HN top stories by keywords
 */
export async function searchHackerNews(keywords: string[], limit: number = 30): Promise<HNStory[]> {
  // Fetch more than needed since we'll filter
  const storyIds = await fetchTopStoryIds(100);
  const stories = await fetchStories(storyIds, 25);
  
  // Filter by keywords
  const keywordRegexes = keywords.map(kw => 
    new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  );
  
  const filtered = stories.filter(story => {
    const text = `${story.title} ${story.text || ""}`;
    return keywordRegexes.some(regex => regex.test(text));
  });
  
  // Sort by score and return limited results
  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Calculate relevance score for a HN story
 */
export function calculateHNRelevance(story: HNStory, keywords: string[]): number {
  const text = `${story.title} ${story.text || ""}`.toLowerCase();
  
  let matches = 0;
  let partialMatches = 0;
  
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    // Direct match in text
    if (text.includes(kw)) {
      matches += 2;
    }
    // Match in title (higher weight)
    if (story.title.toLowerCase().includes(kw)) {
      matches += 1;
    }
  }
  
  // Engagement boost (logarithmic)
  const engagementScore = Math.log10(story.score + story.descendants + 1);
  
  // Calculate final score (0-100)
  const keywordScore = Math.min(60, (matches + partialMatches) * 10);
  const engagementBonus = Math.min(25, engagementScore * 5);
  const hasUrl = story.url ? 5 : 0;
  const isPopular = story.score > 200 ? 10 : story.score > 100 ? 5 : 0;
  
  return Math.min(100, Math.round(keywordScore + engagementBonus + hasUrl + isPopular));
}
