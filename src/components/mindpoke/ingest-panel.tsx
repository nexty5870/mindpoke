"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, RefreshCw, Sparkles, X, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface IngestedBookmark {
  id: string;
  tweetId: string;
  title: string;
  text: string;
  url: string;
  author: string;
  authorHandle: string;
  keywords: string[];
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  createdAt: string;
}

interface SuggestedInterest {
  keyword: string;
  count: number;
}

interface IngestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddInterest: (interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">) => void;
  existingInterests: Interest[];
}

export function IngestPanel({ isOpen, onClose, onAddInterest, existingInterests }: IngestPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<IngestedBookmark[]>([]);
  const [suggestedInterests, setSuggestedInterests] = useState<SuggestedInterest[]>([]);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ total: number; new: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/ingest/bookmarks?count=50");
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch bookmarks");
      }
      
      setBookmarks(data.data.bookmarks);
      setSuggestedInterests(data.data.suggestedInterests);
      setStats(data.data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuggestedInterest = (keyword: string) => {
    // Check if interest already exists
    const exists = existingInterests.some(
      (i) => i.name.toLowerCase() === keyword.toLowerCase() ||
             i.keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())
    );
    
    if (exists) return;
    
    onAddInterest({
      name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      keywords: [keyword],
      priority: 3,
    });
    
    setAddedKeywords((prev) => new Set([...prev, keyword]));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-4xl max-h-[80vh] bg-[#111113] border border-[#2a2a30] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#2a2a30] flex items-center justify-between">
            <div>
              <div className="font-terminal text-[10px] text-[#555555] mb-1">
                $ MODULE_LOAD :: BOOKMARK_INGEST
              </div>
              <h2 className="font-serif text-xl text-white">
                Import X Bookmarks
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="border border-[#2a2a30] hover:border-[#888888] hover:bg-transparent"
            >
              <X className="w-4 h-4 text-[#888888]" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Main content */}
            <div className="flex-1 p-6 overflow-auto">
              {/* Action button */}
              {!bookmarks.length && !isLoading && (
                <div className="text-center py-12">
                  <Bookmark className="w-12 h-12 mx-auto mb-4 text-[#2a2a30]" />
                  <h3 className="font-serif text-lg text-white mb-2">
                    Bootstrap from your bookmarks
                  </h3>
                  <p className="font-terminal text-xs text-[#888888] mb-6 max-w-md mx-auto">
                    DESCRIPTION :: Analyze your X bookmarks to discover interests and seed the discovery engine with your preferences.
                  </p>
                  <Button
                    onClick={handleIngest}
                    className="bg-[#00d4aa] text-[#0a0a0f] hover:bg-[#00d4aa]/90 font-terminal text-xs"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    $ FETCH_BOOKMARKS
                  </Button>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="text-center py-12">
                  <div className="font-terminal text-sm text-[#00d4aa] mb-2">
                    <span className="braille-loader mr-2" />
                    PROCESSING_STREAM...
                  </div>
                  <p className="font-terminal text-xs text-[#555555]">
                    Fetching bookmarks from X_NETWORK
                  </p>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="text-center py-12">
                  <div className="font-terminal text-sm text-[#ff4444] mb-4">
                    ERROR :: {error}
                  </div>
                  <Button
                    onClick={handleIngest}
                    className="border border-[#2a2a30] bg-transparent hover:border-[#00d4aa] font-terminal text-xs text-[#888888]"
                  >
                    $ RETRY
                  </Button>
                </div>
              )}

              {/* Results */}
              {bookmarks.length > 0 && (
                <div>
                  {/* Stats */}
                  {stats && (
                    <div className="mb-6 p-4 border border-[#2a2a30] bg-[#0a0a0f]">
                      <div className="font-terminal text-[10px] text-[#555555] mb-2">
                        $ INGEST_STATS
                      </div>
                      <div className="grid grid-cols-3 gap-4 font-terminal text-xs">
                        <div>
                          <span className="text-[#888888]">TOTAL_FETCHED:</span>
                          <span className="text-[#00d4aa] ml-2">{stats.total}</span>
                        </div>
                        <div>
                          <span className="text-[#888888]">NEW_ITEMS:</span>
                          <span className="text-[#ffb000] ml-2">{stats.new}</span>
                        </div>
                        <div>
                          <span className="text-[#888888]">SKIPPED:</span>
                          <span className="text-[#555555] ml-2">{stats.skipped}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bookmark list */}
                  <div className="font-terminal text-[10px] text-[#555555] mb-3">
                    $ INGESTED_ITEMS [{bookmarks.length}]
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {bookmarks.map((bookmark, index) => (
                        <motion.div
                          key={bookmark.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="p-3 border border-[#2a2a30] bg-[#0a0a0f] hover:border-[#3a3a40]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-serif text-sm text-white truncate">
                                {bookmark.title}
                              </h4>
                              <div className="font-terminal text-[10px] text-[#555555] mt-1">
                                @{bookmark.authorHandle} | ♥{bookmark.engagement.likes} | ↻{bookmark.engagement.retweets}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-wrap justify-end">
                              {bookmark.keywords.slice(0, 3).map((kw) => (
                                <span
                                  key={kw}
                                  className="px-1.5 py-0.5 border border-[#2a2a30] font-terminal text-[9px] text-[#888888]"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Suggested Interests Sidebar */}
            {suggestedInterests.length > 0 && (
              <div className="w-72 border-l border-[#2a2a30] p-4 bg-[#0a0a0f]">
                <div className="font-terminal text-[10px] text-[#555555] mb-3">
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  $ SUGGESTED_INTERESTS
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {suggestedInterests.map((suggestion) => {
                      const isAdded = addedKeywords.has(suggestion.keyword);
                      const exists = existingInterests.some(
                        (i) => i.name.toLowerCase() === suggestion.keyword.toLowerCase()
                      );
                      
                      return (
                        <button
                          key={suggestion.keyword}
                          onClick={() => handleAddSuggestedInterest(suggestion.keyword)}
                          disabled={isAdded || exists}
                          className={cn(
                            "w-full flex items-center justify-between p-2 border transition-none",
                            isAdded || exists
                              ? "border-[#2a2a30] bg-[#1a1a1f] opacity-50"
                              : "border-[#2a2a30] hover:border-[#00d4aa] hover:bg-[#111113]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isAdded ? (
                              <Check className="w-3 h-3 text-[#00d4aa]" />
                            ) : exists ? (
                              <span className="font-terminal text-[9px] text-[#555555]">EXISTS</span>
                            ) : (
                              <Plus className="w-3 h-3 text-[#888888]" />
                            )}
                            <span className="font-terminal text-xs text-[#e6e6e6]">
                              {suggestion.keyword}
                            </span>
                          </div>
                          <span className="font-terminal text-[10px] text-[#555555]">
                            ×{suggestion.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#2a2a30] flex items-center justify-between">
            <div className="font-terminal text-[10px] text-[#555555]">
              {bookmarks.length > 0 
                ? `READY :: ${addedKeywords.size} interests added`
                : "AWAITING_INPUT"}
            </div>
            <Button
              onClick={onClose}
              className="bg-transparent border border-[#2a2a30] hover:border-[#888888] font-terminal text-xs text-[#888888]"
            >
              $ CLOSE
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
