"use client";

import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
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

interface DiscoveryCardProps {
  discovery: Discovery;
  interests: Interest[];
  index: number;
  onUpdateStatus?: (id: string, status: Discovery["status"]) => Promise<unknown>;
}

function DiscoveryCard({ discovery, interests, index, onUpdateStatus }: DiscoveryCardProps) {
  const handleSave = async () => {
    if (onUpdateStatus) {
      await onUpdateStatus(discovery.id, discovery.status === "saved" ? "read" : "saved");
    }
  };

  const handleDismiss = async () => {
    if (onUpdateStatus) {
      await onUpdateStatus(discovery.id, "dismissed");
    }
  };

  const matchedInterestNames = discovery.matchedInterests
    .map((id) => interests.find((i) => i.id === id)?.name?.toUpperCase().replace(/\s+/g, '_'))
    .filter(Boolean);

  const timestamp = new Date(discovery.publishedAt).toISOString();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className={cn(
        "border bg-[#111113] transition-none group",
        discovery.status === "new" 
          ? "border-[#2a2a30] hover:border-[#00d4aa]" 
          : "border-[#1a1a1f] opacity-70"
      )}>
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

          {/* Timestamp */}
          <span className="font-terminal text-[10px] text-[#555555]">
            {timestamp}
          </span>
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
              {discovery.title}
            </h3>

            {/* Summary - Terminal */}
            <p className="font-terminal text-xs text-[#888888] mb-3 line-clamp-2">
              {discovery.summary}
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
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-none">
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
