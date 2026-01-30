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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Discovery, Interest, DiscoverySource } from "@/types";

interface DiscoveryFeedProps {
  discoveries: Discovery[];
  interests: Interest[];
  onUpdateStatus?: (id: string, status: Discovery["status"]) => Promise<unknown>;
}

const sourceLabels: Record<DiscoverySource, string> = {
  x: "X_NETWORK",
  reddit: "REDDIT",
  hackernews: "HN_FEED",
  rss: "RSS_STREAM",
  arxiv: "ARXIV_DB",
};

const sourceColors: Record<DiscoverySource, string> = {
  x: "border-[#888888] text-[#888888]",
  reddit: "border-[#ff4500] text-[#ff4500]",
  hackernews: "border-[#ff6600] text-[#ff6600]",
  rss: "border-[#00d4aa] text-[#00d4aa]",
  arxiv: "border-[#b31b1b] text-[#b31b1b]",
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

  const timestamp = new Date(discovery.publishedAt).toISOString();

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
            {/* Source badge */}
            <span className={cn(
              "font-terminal text-[10px] px-2 py-0.5 border",
              sourceColors[discovery.source]
            )}>
              {sourceLabels[discovery.source]}
            </span>
            
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
      </div>
    </motion.div>
  );
}

export function DiscoveryFeed({ discoveries, interests, onUpdateStatus }: DiscoveryFeedProps) {
  // Filter out dismissed items and sort by status then relevance
  const sortedDiscoveries = [...discoveries]
    .filter((d) => d.status !== "dismissed")
    .sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1;
      if (a.status !== "new" && b.status === "new") return 1;
      return b.relevanceScore - a.relevanceScore;
    });

  const newCount = discoveries.filter((d) => d.status === "new").length;

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
            PROCESSING_COMPLETE :: {newCount} NEW_ITEMS | {discoveries.length} TOTAL_ITEMS
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {sortedDiscoveries.map((discovery, index) => (
            <DiscoveryCard
              key={discovery.id}
              discovery={discovery}
              interests={interests}
              index={index}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#2a2a30] font-terminal text-[10px] text-[#555555] text-center">
          ─── END_OF_STREAM ───
        </div>
      </div>
    </ScrollArea>
  );
}
