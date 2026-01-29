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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Discovery, Interest, DiscoverySource } from "@/types";

interface DiscoveryFeedProps {
  discoveries: Discovery[];
  interests: Interest[];
}

const sourceIcons: Record<DiscoverySource, string> = {
  x: "𝕏",
  reddit: "🔴",
  hackernews: "🟠",
  rss: "📰",
  arxiv: "📄",
};

const sourceColors: Record<DiscoverySource, string> = {
  x: "bg-zinc-800",
  reddit: "bg-orange-500/20 text-orange-400",
  hackernews: "bg-orange-600/20 text-orange-300",
  rss: "bg-blue-500/20 text-blue-400",
  arxiv: "bg-red-500/20 text-red-400",
};

function getRelevanceColor(score: number) {
  if (score >= 90) return "text-green-400 bg-green-500/20";
  if (score >= 75) return "text-yellow-400 bg-yellow-500/20";
  if (score >= 60) return "text-orange-400 bg-orange-500/20";
  return "text-zinc-400 bg-zinc-500/20";
}

function getRelevanceIcon(score: number) {
  if (score >= 90) return "🔥";
  if (score >= 75) return "🟡";
  if (score >= 60) return "🟠";
  return "⚪";
}

interface DiscoveryCardProps {
  discovery: Discovery;
  interests: Interest[];
  index: number;
}

function DiscoveryCard({ discovery, interests, index }: DiscoveryCardProps) {
  const matchedInterestNames = discovery.matchedInterests
    .map((id) => interests.find((i) => i.id === id)?.name)
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="p-4 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group">
        <div className="flex gap-4">
          {/* Relevance Score */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold",
                getRelevanceColor(discovery.relevanceScore)
              )}
            >
              <span className="text-lg">{discovery.relevanceScore}</span>
              <span className="text-[10px] opacity-70">%</span>
            </div>
            <span className="text-lg">{getRelevanceIcon(discovery.relevanceScore)}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={cn("text-xs", sourceColors[discovery.source])}>
                  {sourceIcons[discovery.source]} {discovery.source.toUpperCase()}
                </Badge>
                {matchedInterestNames.map((name) => (
                  <Badge key={name} variant="outline" className="text-xs border-violet-500/50 text-violet-400">
                    {name}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                {formatDistanceToNow(discovery.publishedAt, { addSuffix: true })}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-white mb-1 group-hover:text-violet-400 transition-colors">
              {discovery.title}
            </h3>

            {/* Summary */}
            <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
              {discovery.summary}
            </p>

            {/* Author & Metrics */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-zinc-500">
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

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {discovery.status === "saved" ? (
                    <BookmarkCheck className="w-4 h-4 text-violet-400" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={discovery.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function DiscoveryFeed({ discoveries, interests }: DiscoveryFeedProps) {
  const sortedDiscoveries = [...discoveries].sort((a, b) => {
    // New items first, then by relevance score
    if (a.status === "new" && b.status !== "new") return -1;
    if (a.status !== "new" && b.status === "new") return 1;
    return b.relevanceScore - a.relevanceScore;
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">📡 Today&apos;s Discoveries</h2>
          <p className="text-sm text-zinc-500">
            {discoveries.filter((d) => d.status === "new").length} new finds matching your interests
          </p>
        </div>

        <div className="space-y-3">
          {sortedDiscoveries.map((discovery, index) => (
            <DiscoveryCard
              key={discovery.id}
              discovery={discovery}
              interests={interests}
              index={index}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
