/**
 * Reddit source for Mindpoke
 * Uses Reddit's .json endpoint trick (no API key needed)
 */

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
  domain: string;
  thumbnail: string;
}

interface RedditListingChild {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    url: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
    is_self: boolean;
    domain: string;
    thumbnail: string;
    over_18: boolean;
    stickied: boolean;
  };
}

interface RedditListing {
  kind: string;
  data: {
    children: RedditListingChild[];
    after: string | null;
  };
}

// Subreddit mappings per interest keyword category
export const SUBREDDIT_MAPPINGS: Record<string, string[]> = {
  // AI/ML
  ai: ["MachineLearning", "LocalLLaMA", "artificial", "mlops"],
  llm: ["LocalLLaMA", "LanguageTechnology", "MachineLearning"],
  "machine learning": ["MachineLearning", "learnmachinelearning", "mlops"],
  agents: ["autonomous_agents", "LocalLLaMA", "MachineLearning"],
  claude: ["ClaudeAI", "LocalLLaMA", "ChatGPT"],
  chatgpt: ["ChatGPT", "OpenAI", "LocalLLaMA"],
  openai: ["OpenAI", "ChatGPT", "MachineLearning"],
  anthropic: ["ClaudeAI", "MachineLearning"],
  
  // Programming
  typescript: ["typescript", "programming", "webdev"],
  javascript: ["javascript", "webdev", "node"],
  react: ["reactjs", "nextjs", "webdev"],
  nextjs: ["nextjs", "reactjs", "webdev"],
  python: ["Python", "learnpython", "programming"],
  rust: ["rust", "programming"],
  golang: ["golang", "programming"],
  
  // Tech/Startup
  startup: ["startups", "Entrepreneur", "SideProject"],
  saas: ["SaaS", "startups", "Entrepreneur"],
  indie: ["SideProject", "indiehackers", "startups"],
  programming: ["programming", "learnprogramming", "coding"],
  
  // Default fallback
  default: ["technology", "programming"],
};

/**
 * Get relevant subreddits for a set of keywords
 */
export function getSubredditsForKeywords(keywords: string[]): string[] {
  const subreddits = new Set<string>();
  
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    const mapped = SUBREDDIT_MAPPINGS[kw];
    if (mapped) {
      mapped.forEach(s => subreddits.add(s));
    }
  }
  
  // If no matches, use defaults
  if (subreddits.size === 0) {
    SUBREDDIT_MAPPINGS.default.forEach(s => subreddits.add(s));
  }
  
  return Array.from(subreddits).slice(0, 5); // Max 5 subreddits
}

// Browser-like headers to avoid Reddit's bot detection
const REDDIT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url: string, retries: number = 2): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers: REDDIT_HEADERS });
      
      if (response.ok) {
        return response;
      }
      
      // If rate limited (429), wait and retry
      if (response.status === 429 && attempt < retries) {
        const waitTime = (attempt + 1) * 2000;
        console.log(`[reddit] Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      // Other errors - log and return null
      console.error(`[reddit] Fetch failed: ${response.status} for ${url}`);
      return null;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw error;
    }
  }
  return null;
}

/**
 * Fetch hot posts from a subreddit
 */
export async function fetchSubreddit(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  
  try {
    const response = await fetchWithRetry(url);
    
    if (!response) {
      console.error(`[reddit] Failed to fetch r/${subreddit}`);
      return [];
    }
    
    const data: RedditListing = await response.json();
    
    const posts = data.data.children
      .filter(child => !child.data.stickied && !child.data.over_18)
      .map(child => ({
        id: child.data.id,
        title: child.data.title,
        selftext: child.data.selftext,
        author: child.data.author,
        subreddit: child.data.subreddit,
        url: child.data.url,
        permalink: `https://reddit.com${child.data.permalink}`,
        score: child.data.score,
        num_comments: child.data.num_comments,
        created_utc: child.data.created_utc,
        is_self: child.data.is_self,
        domain: child.data.domain,
        thumbnail: child.data.thumbnail,
      }));
    
    console.log(`[reddit] Fetched ${posts.length} posts from r/${subreddit}`);
    return posts;
  } catch (error) {
    console.error(`[reddit] Error fetching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Search Reddit posts by keywords
 */
export async function searchReddit(keywords: string[], limit: number = 30): Promise<RedditPost[]> {
  const subreddits = getSubredditsForKeywords(keywords);
  const allPosts: RedditPost[] = [];
  const postsPerSub = Math.ceil(limit / subreddits.length);
  
  console.log(`[reddit] Searching ${subreddits.length} subreddits: ${subreddits.join(", ")}`);
  
  // Fetch sequentially with delays to avoid rate limiting
  for (const sub of subreddits) {
    const posts = await fetchSubreddit(sub, postsPerSub);
    allPosts.push(...posts);
    
    // Small delay between requests to be polite
    if (subreddits.indexOf(sub) < subreddits.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // Filter by keywords
  const keywordRegexes = keywords.map(kw => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  
  const filtered = allPosts.filter(post => {
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    return keywordRegexes.some(regex => regex.test(text));
  });
  
  // Sort by score and deduplicate
  const seen = new Set<string>();
  return filtered
    .sort((a, b) => b.score - a.score)
    .filter(post => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    })
    .slice(0, limit);
}

/**
 * Calculate relevance score for a Reddit post
 */
export function calculateRedditRelevance(post: RedditPost, keywords: string[]): number {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  
  let matches = 0;
  let partialMatches = 0;
  
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    // Direct match in text
    if (text.includes(kw)) {
      matches += 2;
    }
    // Partial match in title (more weight)
    if (post.title.toLowerCase().includes(kw)) {
      matches += 1;
    }
  }
  
  // Engagement boost (logarithmic)
  const engagementScore = Math.log10(post.score + post.num_comments + 1);
  
  // Calculate final score (0-100)
  const keywordScore = Math.min(60, (matches + partialMatches) * 10);
  const engagementBonus = Math.min(20, engagementScore * 4);
  const hasContent = post.selftext.length > 100 ? 10 : 0;
  const isPopular = post.score > 100 ? 10 : post.score > 50 ? 5 : 0;
  
  return Math.min(100, Math.round(keywordScore + engagementBonus + hasContent + isPopular));
}
