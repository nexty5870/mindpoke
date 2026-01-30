"use client";

import { useState, useEffect } from "react";
import { Lightbulb, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface KeywordSuggestion {
  keyword: string;
  score: number;
}

interface SuggestionsData {
  interestId: string;
  interestName: string;
  existingKeywords: string[];
  savedCount: number;
  suggestedKeywords: KeywordSuggestion[];
  message?: string;
}

interface KeywordSuggestionsProps {
  interestId: string;
  interestName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddKeywords: (keywords: string[]) => Promise<void>;
}

export function KeywordSuggestions({
  interestId,
  interestName,
  open,
  onOpenChange,
  onAddKeywords,
}: KeywordSuggestionsProps) {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/interests/${interestId}/suggestions`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setSelectedKeywords(new Set());
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && interestId) {
      fetchSuggestions();
    }
  }, [open, interestId]);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedKeywords.size === 0) return;
    setIsAdding(true);
    try {
      await onAddKeywords(Array.from(selectedKeywords));
      // Refresh to update the list
      await fetchSuggestions();
    } catch (error) {
      console.error("Failed to add keywords:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const ratio = score / maxScore;
    if (ratio > 0.7) return "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10";
    if (ratio > 0.4) return "border-[#ffb000] text-[#ffb000] bg-[#ffb000]/10";
    return "border-[#888888] text-[#888888] bg-[#888888]/10";
  };

  const maxScore = data?.suggestedKeywords[0]?.score || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111113] border-[#2a2a30] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-terminal text-[#00d4aa] flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            KEYWORD_SUGGESTIONS
          </DialogTitle>
          <DialogDescription className="font-terminal text-xs text-[#888888]">
            Based on saved discoveries for {interestName.toUpperCase().replace(/\s+/g, "_")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-[#00d4aa] animate-spin" />
              <span className="ml-2 font-terminal text-xs text-[#888888]">
                ANALYZING_CONTENT...
              </span>
            </div>
          ) : data?.message ? (
            <div className="text-center py-8">
              <Lightbulb className="w-12 h-12 text-[#ffb000] mx-auto mb-4 opacity-50" />
              <p className="font-terminal text-xs text-[#888888]">{data.message}</p>
            </div>
          ) : data ? (
            <>
              {/* Stats */}
              <div className="flex gap-4 font-terminal text-[10px] text-[#888888] border-b border-[#2a2a30] pb-3">
                <span>SAVED_ITEMS: {data.savedCount}</span>
                <span>EXISTING_KEYWORDS: {data.existingKeywords?.length || 0}</span>
              </div>

              {/* Existing keywords */}
              {data.existingKeywords && data.existingKeywords.length > 0 && (
                <div>
                  <div className="font-terminal text-[10px] text-[#555555] mb-2">
                    CURRENT_KEYWORDS:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.existingKeywords.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="border-[#2a2a30] text-[#888888] font-terminal text-xs"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {data.suggestedKeywords.length > 0 ? (
                <div>
                  <div className="font-terminal text-[10px] text-[#555555] mb-2">
                    SUGGESTED_KEYWORDS (click to select):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.suggestedKeywords.map((suggestion) => (
                      <button
                        key={suggestion.keyword}
                        onClick={() => toggleKeyword(suggestion.keyword)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 border rounded font-terminal text-xs transition-all",
                          selectedKeywords.has(suggestion.keyword)
                            ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/20"
                            : getScoreColor(suggestion.score, maxScore)
                        )}
                      >
                        <span>{suggestion.keyword}</span>
                        <span className="text-[10px] opacity-60">({suggestion.score})</span>
                        {selectedKeywords.has(suggestion.keyword) && (
                          <Plus className="w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="font-terminal text-xs text-[#888888]">
                    No additional keywords found. Try saving more discoveries!
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-[#2a2a30]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSuggestions}
                  disabled={isLoading}
                  className="font-terminal text-xs border-[#2a2a30] text-[#888888] hover:border-[#00d4aa] hover:text-[#00d4aa] hover:bg-transparent"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                  REFRESH
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSelected}
                  disabled={selectedKeywords.size === 0 || isAdding}
                  className="flex-1 font-terminal text-xs bg-[#00d4aa] text-[#0a0a0f] hover:bg-[#00d4aa]/80 disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ADDING...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      ADD_SELECTED ({selectedKeywords.size})
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
