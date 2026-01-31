"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Eye,
  X,
  MessageCircle,
  Heart,
  Repeat2,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  Link2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { Discovery, Interest, DiscoverySource } from "@/types";

interface PokeAroundResult {
  source: "twitter" | "reddit" | "hackernews";
  id: string;
  title?: string;
  content: string;
  url: string;
  author?: string;
  authorHandle?: string;
  score?: number;
  createdAt?: string;
}

// Format date for poke around results - "30 Jan" or "30 Jan 2024" if not current year
function formatPokeDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// localStorage key for dismissed poke around items
const POKE_DISMISSED_KEY = "mindpoke:poke-around:dismissed";

function getDismissedPokeIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(POKE_DISMISSED_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function dismissPokeId(source: string, id: string): void {
  const key = `${source}:${id}`;
  const dismissed = getDismissedPokeIds();
  dismissed.add(key);
  localStorage.setItem(POKE_DISMISSED_KEY, JSON.stringify([...dismissed]));
}

// Format timestamp - "30 Jan, 22:21"
function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { 
    day: "numeric", 
    month: "short",
  }) + ", " + d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Source Icons as SVG components
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);

const HNIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
    <path d="M0 0v24h24V0H0zm12.3 12.8v5.5h-1.4v-5.5L7.3 5.8h1.6l2.7 5.4 2.7-5.4h1.6l-3.6 7z"/>
  </svg>
);

const SourceIcons: Record<DiscoverySource, React.FC> = {
  x: XIcon,
  reddit: RedditIcon,
  hackernews: HNIcon,
  rss: () => <Link2 className="w-3 h-3" />,
  arxiv: () => <Link2 className="w-3 h-3" />,
};

interface DiscoveryFeedProps {
  discoveries: Discovery[];
  interests: Interest[];
  onUpdateStatus?: (id: string, status: Discovery["status"]) => Promise<unknown>;
}

const sourceLabels: Record<DiscoverySource, string> = {
  x: "X",
  reddit: "Reddit",
  hackernews: "HN",
  rss: "RSS",
  arxiv: "arXiv",
};

const sourceColors: Record<DiscoverySource, string> = {
  x: "border-[#1DA1F2] text-[#1DA1F2] bg-[#1DA1F2]/10",
  reddit: "border-[#FF4500] text-[#FF4500] bg-[#FF4500]/10",
  hackernews: "border-[#FF6600] text-[#FF6600] bg-[#FF6600]/10",
  rss: "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10",
  arxiv: "border-[#b31b1b] text-[#b31b1b] bg-[#b31b1b]/10",
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (match) => entities[match] || match);
}

// Format large numbers
function formatNumber(num: number | undefined): string {
  if (num === undefined) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Thread tweet type from API
interface ThreadTweet {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
  };
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
}

interface ThreadData {
  mainTweet: ThreadTweet;
  thread: ThreadTweet[];
  isThread: boolean;
}

interface SimilarDiscovery {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  author: string | null;
  authorHandle: string | null;
  similarity: number;
  interest: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface DiscoveryCardProps {
  discovery: Discovery;
  interests: Interest[];
  index: number;
  onUpdateStatus?: (id: string, status: Discovery["status"]) => Promise<unknown>;
}

function DiscoveryCard({ discovery, interests, index, onUpdateStatus }: DiscoveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarDiscoveries, setSimilarDiscoveries] = useState<SimilarDiscovery[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [showPokeAround, setShowPokeAround] = useState(false);
  const [pokeAroundResults, setPokeAroundResults] = useState<PokeAroundResult[]>([]);
  const [isLoadingPokeAround, setIsLoadingPokeAround] = useState(false);
  const [pokeAroundTerms, setPokeAroundTerms] = useState<string[]>([]);
  const [dismissedPokeIds, setDismissedPokeIds] = useState<Set<string>>(() => getDismissedPokeIds());
  const [savingPokeIds, setSavingPokeIds] = useState<Set<string>>(new Set());
  const [savedPokeIds, setSavedPokeIds] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      await onUpdateStatus(discovery.id, discovery.status === "saved" ? "read" : "saved");
    }
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      await onUpdateStatus(discovery.id, "dismissed");
    }
  };

  const handleMoreLikeThis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (showSimilar) {
      setShowSimilar(false);
      return;
    }
    
    setIsLoadingSimilar(true);
    setShowSimilar(true);
    
    try {
      const res = await fetch(`/api/discoveries/similar?id=${discovery.id}&limit=5`);
      const data = await res.json();
      if (data.success) {
        setSimilarDiscoveries(data.data);
      }
    } catch (err) {
      console.error("Failed to load similar:", err);
    } finally {
      setIsLoadingSimilar(false);
    }
  };

  const handlePokeAround = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (showPokeAround) {
      setShowPokeAround(false);
      return;
    }
    
    setIsLoadingPokeAround(true);
    setShowPokeAround(true);
    setShowSimilar(false); // Close similar panel
    
    try {
      const res = await fetch("/api/discoveries/poke-around", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveryId: discovery.id, limit: 5 }),
      });
      const data = await res.json();
      if (data.success) {
        setPokeAroundResults(data.data);
        setPokeAroundTerms(data.meta?.searchTerms || []);
      }
    } catch (err) {
      console.error("Failed to poke around:", err);
    } finally {
      setIsLoadingPokeAround(false);
    }
  };

  const handleDismissPoke = (result: PokeAroundResult) => {
    const key = `${result.source}:${result.id}`;
    dismissPokeId(result.source, result.id);
    setDismissedPokeIds(prev => new Set([...prev, key]));
  };

  const handleSavePoke = async (result: PokeAroundResult) => {
    const key = `${result.source}:${result.id}`;
    setSavingPokeIds(prev => new Set([...prev, key]));
    
    try {
      const sourceTypeMap: Record<string, string> = {
        twitter: "x",
        reddit: "reddit",
        hackernews: "hackernews",
      };
      
      const res = await fetch("/api/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: sourceTypeMap[result.source] || result.source,
          sourceId: result.id,
          sourceUrl: result.url,
          title: result.title || result.content.slice(0, 100),
          content: result.content,
          author: result.author,
          authorHandle: result.authorHandle,
          relevanceScore: 50, // Default score for saved external items
          status: "saved",
          metadata: { score: result.score, savedFrom: "poke-around" },
        }),
      });
      
      if (res.ok) {
        setSavedPokeIds(prev => new Set([...prev, key]));
      }
    } catch (err) {
      console.error("Failed to save poke result:", err);
    } finally {
      setSavingPokeIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (showSummary && summary) {
      // Toggle off if already showing
      setShowSummary(false);
      return;
    }
    
    if (summary) {
      // Already have summary, just show it
      setShowSummary(true);
      return;
    }
    
    setIsLoadingSummary(true);
    setShowSummary(true);
    setShowSimilar(false);
    setShowPokeAround(false);
    
    try {
      const res = await fetch(`/api/discoveries/${discovery.id}/summarize`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data.summary);
      } else {
        setSummary(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Failed to summarize:", err);
      setSummary("Failed to generate summary");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleCardClick = async () => {
    if (!isExpanded && discovery.source === "x" && !threadData) {
      // Fetch thread data when expanding for X/Twitter posts
      setIsLoadingThread(true);
      setThreadError(null);
      try {
        const res = await fetch(`/api/discoveries/thread?id=${discovery.sourceId}`);
        const data = await res.json();
        if (data.success) {
          setThreadData(data.data);
        } else {
          setThreadError(data.error || "Failed to load thread");
        }
      } catch (err) {
        setThreadError("Network error loading thread");
      } finally {
        setIsLoadingThread(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const matchedInterestNames = discovery.matchedInterests
    .map((id) => interests.find((i) => i.id === id)?.name?.toUpperCase().replace(/\s+/g, '_'))
    .filter(Boolean);

  const timestamp = formatDateTime(discovery.publishedAt);

  // Build direct X link
  const xUrl = discovery.source === "x" && discovery.authorHandle
    ? `https://x.com/${discovery.authorHandle}/status/${discovery.sourceId}`
    : discovery.url;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className={cn(
        "border bg-[#111113] transition-none group cursor-pointer",
        discovery.status === "new" 
          ? "border-[#2a2a30] hover:border-[#00d4aa]" 
          : "border-[#1a1a1f] opacity-70",
        isExpanded && "border-[#00d4aa]"
      )}
      onClick={handleCardClick}
      >
        {/* Card Header - Terminal Style */}
        <div className="px-4 py-2 border-b border-[#2a2a30] flex items-center justify-between bg-[#0a0a0f]">
          <div className="flex items-center gap-3">
            {/* Source badge with icon */}
            {(() => {
              const Icon = SourceIcons[discovery.source];
              return (
                <span className={cn(
                  "font-terminal text-[10px] px-2 py-0.5 border flex items-center gap-1.5",
                  sourceColors[discovery.source]
                )}>
                  {Icon && <Icon />}
                  {sourceLabels[discovery.source]}
                </span>
              );
            })()}
            
            {/* Matched interests */}
            {matchedInterestNames.map((name) => (
              <span 
                key={name} 
                className="font-terminal text-[10px] text-[#00d4aa]"
              >
                #{name}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Timestamp */}
            <span className="font-terminal text-[10px] text-[#555555]">
              {timestamp}
            </span>
            {/* Expand indicator */}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[#00d4aa]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#555555]" />
            )}
          </div>
        </div>

        <div className="p-4 flex gap-4">
          {/* Relevance Score - Cyber Style */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-16 h-16 border flex flex-col items-center justify-center",
              discovery.relevanceScore >= 90
                ? "border-[#00d4aa] text-[#00d4aa]"
                : discovery.relevanceScore >= 75
                ? "border-[#ffb000] text-[#ffb000]"
                : "border-[#888888] text-[#888888]"
            )}>
              <span className="font-terminal text-2xl font-bold">
                {discovery.relevanceScore}
              </span>
              <span className="font-terminal text-[8px] tracking-wider">
                MATCH_%
              </span>
            </div>
            
            {/* Status indicator */}
            <div className="mt-2 font-terminal text-[8px] text-[#555555]">
              {discovery.status === "new" ? "● NEW" : discovery.status === "saved" ? "◉ SAVED" : "○ READ"}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title - Serif */}
            <h3 className="font-serif text-lg text-white mb-2 group-hover:text-[#00d4aa] transition-none">
              {decodeHtmlEntities(discovery.title)}
            </h3>

            {/* Summary - Terminal (truncated when collapsed) */}
            <p className={cn(
              "font-terminal text-xs text-[#888888] mb-3",
              !isExpanded && "line-clamp-2"
            )}>
              {decodeHtmlEntities(discovery.summary)}
            </p>

            {/* Metadata row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 font-terminal text-[10px] text-[#555555]">
                {discovery.authorHandle && (
                  <span>@{discovery.authorHandle}</span>
                )}
                {discovery.engagementMetrics.likes !== undefined && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {discovery.engagementMetrics.likes.toLocaleString()}
                  </span>
                )}
                {discovery.engagementMetrics.retweets !== undefined && (
                  <span className="flex items-center gap-1">
                    <Repeat2 className="w-3 h-3" />
                    {discovery.engagementMetrics.retweets.toLocaleString()}
                  </span>
                )}
                {discovery.engagementMetrics.upvotes !== undefined && (
                  <span className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    {discovery.engagementMetrics.upvotes.toLocaleString()}
                  </span>
                )}
                {discovery.engagementMetrics.comments !== undefined && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {discovery.engagementMetrics.comments.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Actions - ASCII Style */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-none"
                onClick={(e) => e.stopPropagation()}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8 border border-transparent hover:border-[#00d4aa] hover:bg-transparent",
                    showSimilar && "border-[#00d4aa] bg-[#00d4aa]/10"
                  )}
                  onClick={handleMoreLikeThis}
                  title="More like this"
                >
                  <Sparkles className={cn(
                    "w-4 h-4",
                    showSimilar ? "text-[#00d4aa]" : "text-[#888888]"
                  )} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8 border border-transparent hover:border-[#ffb000] hover:bg-transparent",
                    showPokeAround && "border-[#ffb000] bg-[#ffb000]/10"
                  )}
                  onClick={handlePokeAround}
                  title="Poke Around - find similar on X, Reddit, HN"
                >
                  <Icon 
                    icon="ph:compass-bold" 
                    className={cn(
                      "w-4 h-4",
                      showPokeAround ? "text-[#ffb000]" : "text-[#888888]"
                    )} 
                  />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8 border border-transparent hover:border-[#a855f7] hover:bg-transparent",
                    showSummary && "border-[#a855f7] bg-[#a855f7]/10"
                  )}
                  onClick={handleSummarize}
                  title="AI Summary"
                >
                  <Icon 
                    icon="ph:brain-bold" 
                    className={cn(
                      "w-4 h-4",
                      showSummary ? "text-[#a855f7]" : "text-[#888888]"
                    )} 
                  />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 border border-transparent hover:border-[#00d4aa] hover:bg-transparent"
                  onClick={handleSave}
                  title={discovery.status === "saved" ? "Unsave" : "Save"}
                >
                  {discovery.status === "saved" ? (
                    <BookmarkCheck className="w-4 h-4 text-[#00d4aa]" />
                  ) : (
                    <Bookmark className="w-4 h-4 text-[#888888]" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 border border-transparent hover:border-[#00d4aa] hover:bg-transparent"
                  title="Mark as read"
                >
                  <Eye className="w-4 h-4 text-[#888888]" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 border border-transparent hover:border-[#ff4444] hover:bg-transparent"
                  onClick={handleDismiss}
                  title="Dismiss"
                  disabled={discovery.status === "dismissed"}
                >
                  <X className="w-4 h-4 text-[#888888]" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 border border-transparent hover:border-[#ffb000] hover:bg-transparent" 
                  asChild
                >
                  <a href={discovery.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 text-[#888888]" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-[#2a2a30] bg-[#0a0a0f]">
                {/* Engagement Metrics Bar */}
                <div className="px-4 py-3 border-b border-[#2a2a30] flex items-center gap-6">
                  <span className="font-terminal text-[10px] text-[#555555]">ENGAGEMENT::</span>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-[#ff4444]" />
                      <span className="font-terminal text-sm text-white">
                        {formatNumber(discovery.engagementMetrics.likes)}
                      </span>
                      <span className="font-terminal text-[10px] text-[#555555]">LIKES</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Repeat2 className="w-4 h-4 text-[#00d4aa]" />
                      <span className="font-terminal text-sm text-white">
                        {formatNumber(discovery.engagementMetrics.retweets)}
                      </span>
                      <span className="font-terminal text-[10px] text-[#555555]">RETWEETS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-[#ffb000]" />
                      <span className="font-terminal text-sm text-white">
                        {formatNumber(discovery.engagementMetrics.comments)}
                      </span>
                      <span className="font-terminal text-[10px] text-[#555555]">REPLIES</span>
                    </div>
                  </div>
                </div>

                {/* Thread Content or Loading */}
                <div className="p-4">
                  {isLoadingThread ? (
                    <div className="flex items-center gap-3 py-4">
                      <Loader2 className="w-4 h-4 text-[#00d4aa] animate-spin" />
                      <span className="font-terminal text-xs text-[#888888]">
                        LOADING_THREAD_DATA...
                      </span>
                    </div>
                  ) : threadError ? (
                    <div className="py-2">
                      <span className="font-terminal text-xs text-[#ff4444]">
                        ERR:: {threadError}
                      </span>
                    </div>
                  ) : threadData?.isThread && threadData.thread.length > 0 ? (
                    <div className="space-y-4">
                      <div className="font-terminal text-[10px] text-[#00d4aa] mb-2">
                        ── THREAD ({threadData.thread.length} POSTS) ──
                      </div>
                      {threadData.thread.map((tweet, i) => (
                        <div key={tweet.id} className="relative pl-4">
                          {/* Thread connector line */}
                          {i < threadData.thread.length - 1 && (
                            <div className="absolute left-1 top-6 bottom-0 w-px bg-[#2a2a30]" />
                          )}
                          <div className="absolute left-0 top-2 w-2 h-2 border border-[#00d4aa] bg-[#0a0a0f]" />
                          
                          <div className="pb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-terminal text-[10px] text-[#00d4aa]">
                                @{tweet.author.username}
                              </span>
                              <span className="font-terminal text-[10px] text-[#555555]">
                                {new Date(tweet.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="font-terminal text-xs text-[#cccccc] whitespace-pre-wrap">
                              {decodeHtmlEntities(tweet.text)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="font-terminal text-xs text-[#888888]">
                      {discovery.source === "x" 
                        ? "SINGLE_POST :: No thread detected"
                        : "FULL_CONTENT_ABOVE"
                      }
                    </div>
                  )}
                </div>

                {/* Direct Link Footer */}
                <div className="px-4 py-3 border-t border-[#2a2a30] flex items-center justify-between">
                  <a 
                    href={xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#ffb000] hover:text-[#ffc033] transition-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link2 className="w-4 h-4" />
                    <span className="font-terminal text-xs">
                      OPEN_IN_{discovery.source.toUpperCase()}
                    </span>
                  </a>
                  <span className="font-terminal text-[10px] text-[#555555]">
                    ID: {discovery.sourceId}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Similar Discoveries Panel */}
        <AnimatePresence>
          {showSimilar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-[#00d4aa]/30"
            >
              <div className="bg-[#00d4aa]/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-terminal text-[10px] text-[#00d4aa]">
                    ── SIMILAR DISCOVERIES ──
                  </span>
                </div>

                {isLoadingSimilar ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-4 h-4 text-[#00d4aa] animate-spin" />
                    <span className="font-terminal text-xs text-[#888888]">
                      FINDING_SIMILAR...
                    </span>
                  </div>
                ) : similarDiscoveries.length === 0 ? (
                  <div className="py-2">
                    <span className="font-terminal text-xs text-[#555555]">
                      NO_SIMILAR_ITEMS_FOUND
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {similarDiscoveries.map((similar) => (
                      <a
                        key={similar.id}
                        href={similar.sourceUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-[#111113] border border-[#2a2a30] hover:border-[#00d4aa] transition-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {/* Similarity badge */}
                          <span className="font-terminal text-[9px] px-1.5 py-0.5 border border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10">
                            {similar.similarity}% MATCH
                          </span>
                          
                          {/* Interest */}
                          {similar.interest && (
                            <span 
                              className="font-terminal text-[9px] px-1.5 py-0.5 border"
                              style={{ 
                                borderColor: similar.interest.color,
                                color: similar.interest.color 
                              }}
                            >
                              #{similar.interest.name.toUpperCase()}
                            </span>
                          )}
                          
                          {/* Author */}
                          {similar.authorHandle && (
                            <span className="font-terminal text-[9px] text-[#555555]">
                              @{similar.authorHandle}
                            </span>
                          )}
                        </div>
                        
                        <div className="font-terminal text-[11px] text-[#e6e6e6] line-clamp-2">
                          {similar.title || similar.content.slice(0, 150)}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Summary Panel */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-[#a855f7]/30"
            >
              <div className="bg-[#a855f7]/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="ph:brain-bold" className="w-4 h-4 text-[#a855f7]" />
                  <span className="font-terminal text-[10px] text-[#a855f7]">
                    ── AI SUMMARY ──
                  </span>
                </div>

                {isLoadingSummary ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-4 h-4 text-[#a855f7] animate-spin" />
                    <span className="font-terminal text-xs text-[#888888]">
                      GENERATING_SUMMARY...
                    </span>
                  </div>
                ) : summary ? (
                  <div className="font-terminal text-xs text-[#e6e6e6] leading-relaxed">
                    {summary}
                  </div>
                ) : (
                  <div className="py-2">
                    <span className="font-terminal text-xs text-[#555555]">
                      NO_SUMMARY_AVAILABLE
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Poke Around Panel */}
        <AnimatePresence>
          {showPokeAround && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-[#ffb000]/30"
            >
              <div className="bg-[#ffb000]/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon="ph:compass-bold" className="w-4 h-4 text-[#ffb000]" />
                  <span className="font-terminal text-[10px] text-[#ffb000]">
                    ── POKE AROUND ──
                  </span>
                </div>
                
                {/* Search terms used */}
                {pokeAroundTerms.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="font-terminal text-[9px] text-[#555555]">TERMS:</span>
                    {pokeAroundTerms.map((term, i) => (
                      <span key={i} className="font-terminal text-[9px] px-1.5 py-0.5 bg-[#1a1a1f] border border-[#2a2a30] text-[#888888]">
                        {term}
                      </span>
                    ))}
                  </div>
                )}

                {isLoadingPokeAround ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-4 h-4 text-[#ffb000] animate-spin" />
                    <span className="font-terminal text-xs text-[#888888]">
                      SEARCHING_WEB...
                    </span>
                  </div>
                ) : pokeAroundResults.filter(r => !dismissedPokeIds.has(`${r.source}:${r.id}`)).length === 0 ? (
                  <div className="py-2">
                    <span className="font-terminal text-xs text-[#555555]">
                      {pokeAroundResults.length > 0 ? "ALL_ITEMS_DISMISSED" : "NO_RESULTS_FOUND"}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pokeAroundResults
                      .filter(r => !dismissedPokeIds.has(`${r.source}:${r.id}`))
                      .map((result) => {
                        const pokeKey = `${result.source}:${result.id}`;
                        const isSaving = savingPokeIds.has(pokeKey);
                        const isSaved = savedPokeIds.has(pokeKey);
                        
                        return (
                          <div
                            key={pokeKey}
                            className="p-3 bg-[#111113] border border-[#2a2a30] hover:border-[#ffb000] transition-none group/poke"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* Source badge */}
                                <span className={cn(
                                  "font-terminal text-[9px] px-1.5 py-0.5 border flex items-center gap-1 shrink-0",
                                  result.source === "twitter" && "border-[#1DA1F2] text-[#1DA1F2]",
                                  result.source === "reddit" && "border-[#FF4500] text-[#FF4500]",
                                  result.source === "hackernews" && "border-[#FF6600] text-[#FF6600]"
                                )}>
                                  {result.source === "twitter" && <XIcon />}
                                  {result.source === "reddit" && <RedditIcon />}
                                  {result.source === "hackernews" && <HNIcon />}
                                  {result.source.toUpperCase()}
                                </span>
                                
                                {/* Score */}
                                {result.score !== undefined && result.score > 0 && (
                                  <span className="font-terminal text-[9px] text-[#555555]">
                                    ↑{result.score}
                                  </span>
                                )}
                                
                                {/* Author */}
                                {result.authorHandle && (
                                  <span className="font-terminal text-[9px] text-[#555555] truncate">
                                    @{result.authorHandle}
                                  </span>
                                )}
                                
                                {/* Date */}
                                {result.createdAt && (
                                  <span className="font-terminal text-[9px] text-[#444444]">
                                    {formatPokeDate(result.createdAt)}
                                  </span>
                                )}
                              </div>
                              
                              {/* Action buttons */}
                              <div className="flex items-center gap-1 opacity-0 group-hover/poke:opacity-100 transition-opacity shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border border-transparent hover:border-[#00d4aa] hover:bg-transparent"
                                  onClick={() => handleSavePoke(result)}
                                  disabled={isSaving || isSaved}
                                  title={isSaved ? "Saved" : "Save to discoveries"}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3 h-3 text-[#888888] animate-spin" />
                                  ) : isSaved ? (
                                    <BookmarkCheck className="w-3 h-3 text-[#00d4aa]" />
                                  ) : (
                                    <Bookmark className="w-3 h-3 text-[#888888]" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border border-transparent hover:border-[#ff4444] hover:bg-transparent"
                                  onClick={() => handleDismissPoke(result)}
                                  title="Dismiss"
                                >
                                  <X className="w-3 h-3 text-[#888888]" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border border-transparent hover:border-[#ffb000] hover:bg-transparent"
                                  asChild
                                >
                                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-3 h-3 text-[#888888]" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                            
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <div className="font-terminal text-[11px] text-[#e6e6e6] line-clamp-2 hover:text-[#ffb000]">
                                {result.title || result.content.slice(0, 150)}
                              </div>
                            </a>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

type FilterType = "new" | "saved" | "all";

export function DiscoveryFeed({ discoveries, interests, onUpdateStatus }: DiscoveryFeedProps) {
  const [filter, setFilter] = useState<FilterType>("new");

  // Count by status
  const newCount = discoveries.filter((d) => d.status === "new").length;
  const savedCount = discoveries.filter((d) => d.status === "saved").length;

  // Filter and sort discoveries based on selected filter
  const sortedDiscoveries = [...discoveries]
    .filter((d) => {
      if (d.status === "dismissed") return false;
      if (filter === "new") return d.status === "new";
      if (filter === "saved") return d.status === "saved";
      return true; // "all"
    })
    .sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1;
      if (a.status !== "new" && b.status === "new") return 1;
      return b.relevanceScore - a.relevanceScore;
    });

  return (
    <ScrollArea className="h-full bg-[#0a0a0f]">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header - Terminal style */}
        <div className="mb-6 border-b border-[#2a2a30] pb-4">
          <div className="font-terminal text-[10px] text-[#555555] mb-2">
            $ LOG_STREAM :: DISCOVERY_FEED
          </div>
          <h2 className="font-serif text-2xl text-white mb-1">
            Today&apos;s Discoveries
          </h2>
          <div className="font-terminal text-xs text-[#888888]">
            PROCESSING_COMPLETE :: {newCount} NEW_ITEMS | {savedCount} SAVED_ITEMS | {discoveries.length} TOTAL
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {(["new", "saved", "all"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 font-terminal text-xs border transition-none",
                  filter === f
                    ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10"
                    : "border-[#2a2a30] text-[#888888] hover:border-[#3a3a40] hover:text-[#e6e6e6]"
                )}
              >
                {f === "new" && `● NEW (${newCount})`}
                {f === "saved" && `◉ SAVED (${savedCount})`}
                {f === "all" && `○ ALL (${discoveries.filter(d => d.status !== "dismissed").length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {sortedDiscoveries.length === 0 ? (
            <div className="text-center py-12">
              <div className="font-terminal text-[#555555] text-sm mb-2">
                {filter === "new" && "$ NO_NEW_DISCOVERIES"}
                {filter === "saved" && "$ NO_SAVED_ITEMS"}
                {filter === "all" && "$ FEED_EMPTY"}
              </div>
              <div className="font-terminal text-[10px] text-[#3a3a40]">
                {filter === "new" && "Run DISCOVER to fetch new content"}
                {filter === "saved" && "Save discoveries to build your collection"}
                {filter === "all" && "Run DISCOVER to populate the feed"}
              </div>
            </div>
          ) : (
            sortedDiscoveries.map((discovery, index) => (
              <DiscoveryCard
                key={discovery.id}
                discovery={discovery}
                interests={interests}
                index={index}
                onUpdateStatus={onUpdateStatus}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#2a2a30] font-terminal text-[10px] text-[#555555] text-center">
          ─── END_OF_STREAM :: {sortedDiscoveries.length} ITEMS ───
        </div>
      </div>
    </ScrollArea>
  );
}
