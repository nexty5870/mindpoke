"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ExternalLink, Hash, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  author: string | null;
  authorHandle: string | null;
  relevanceScore: number;
  discoveredAt: string;
  similarity?: number; // For semantic search
  interest?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// Source icons
const SourceIcon = ({ source }: { source: string }) => {
  if (source === "twitter" || source === "x") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (source === "reddit") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
      <path d="M0 0v24h24V0H0zm12.3 12.8v5.5h-1.4v-5.5L7.3 5.8h1.6l2.7 5.4 2.7-5.4h1.6l-3.6 7z"/>
    </svg>
  );
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, searchMode === "semantic" ? 400 : 200); // Slightly longer debounce for semantic

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const performSearch = async (q: string) => {
    setIsLoading(true);
    try {
      let res;
      if (searchMode === "semantic") {
        res = await fetch("/api/search/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, limit: 10 }),
        });
      } else {
        res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      }
      const data = await res.json();
      if (data.success) {
        setResults(data.data || []);
        setSelectedIndex(0);
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result.sourceUrl) {
        window.open(result.sourceUrl, "_blank");
      }
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [results, selectedIndex, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const selected = resultsRef.current?.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-[15vh]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-[#111113] border border-[#2a2a30] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ASCII corners */}
          <span className="absolute -top-[1px] -left-[1px] font-terminal text-[#2a2a30] text-xs">┌</span>
          <span className="absolute -top-[1px] -right-[1px] font-terminal text-[#2a2a30] text-xs">┐</span>
          <span className="absolute -bottom-[1px] -left-[1px] font-terminal text-[#2a2a30] text-xs">└</span>
          <span className="absolute -bottom-[1px] -right-[1px] font-terminal text-[#2a2a30] text-xs">┘</span>

          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a30]">
            <Search className="w-4 h-4 text-[#555555]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchMode === "semantic" ? "Search by meaning..." : "Search discoveries..."}
              className="flex-1 bg-transparent font-terminal text-sm text-[#e6e6e6] placeholder:text-[#555555] outline-none"
            />
            {isLoading && <Loader2 className="w-4 h-4 text-[#00d4aa] animate-spin" />}
            {/* Mode Toggle */}
            <button
              onClick={() => setSearchMode(m => m === "keyword" ? "semantic" : "keyword")}
              className={cn(
                "px-2 py-1 font-terminal text-[9px] border transition-none",
                searchMode === "semantic"
                  ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10"
                  : "border-[#2a2a30] text-[#555555] hover:border-[#3a3a40]"
              )}
              title="Toggle semantic search (AI-powered)"
            >
              {searchMode === "semantic" ? "🧠 AI" : "⌨️ KW"}
            </button>
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1f] border border-[#2a2a30] font-terminal text-[9px] text-[#555555]">ESC</kbd>
          </div>

          {/* Hints */}
          {!query && (
            <div className="px-4 py-3 border-b border-[#2a2a30] bg-[#0a0a0f]/50">
              <div className="font-terminal text-[10px] text-[#555555] flex flex-wrap gap-3">
                <span><span className="text-[#00d4aa]">#interest</span> filter by interest</span>
                <span><span className="text-[#00d4aa]">@handle</span> filter by author</span>
                <span><span className="text-[#00d4aa]">x:</span> <span className="text-[#00d4aa]">reddit:</span> <span className="text-[#00d4aa]">hn:</span> filter by source</span>
              </div>
            </div>
          )}

          {/* Results */}
          <div ref={resultsRef} className="max-h-80 overflow-y-auto">
            {results.length === 0 && query && !isLoading ? (
              <div className="px-4 py-8 text-center font-terminal text-[10px] text-[#555555]">
                NO_RESULTS_FOUND
              </div>
            ) : (
              results.map((result, index) => (
                <a
                  key={result.id}
                  href={result.sourceUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "block px-4 py-3 border-b border-[#2a2a30] last:border-b-0",
                    index === selectedIndex 
                      ? "bg-[#00d4aa]/10 border-l-2 border-l-[#00d4aa]" 
                      : "hover:bg-[#1a1a1f]"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={onClose}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {/* Source */}
                    <span className="text-[#555555]">
                      <SourceIcon source={result.sourceType} />
                    </span>
                    
                    {/* Interest */}
                    {result.interest && (
                      <span 
                        className="font-terminal text-[9px] px-1.5 py-0.5 border"
                        style={{ 
                          borderColor: result.interest.color,
                          color: result.interest.color 
                        }}
                      >
                        #{result.interest.name.toUpperCase()}
                      </span>
                    )}

                    {/* Author */}
                    {result.authorHandle && (
                      <span className="font-terminal text-[9px] text-[#555555]">
                        @{result.authorHandle}
                      </span>
                    )}

                    {/* Relevance or Similarity */}
                    <span className="ml-auto font-terminal text-[9px] text-[#ffb000]">
                      {result.similarity !== undefined 
                        ? `${result.similarity}% similar`
                        : `${Math.round(result.relevanceScore)}%`
                      }
                    </span>
                  </div>

                  {/* Content */}
                  <div className="font-terminal text-[11px] text-[#e6e6e6] line-clamp-2">
                    {result.title || result.content.slice(0, 150)}
                  </div>
                </a>
              ))
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-[#2a2a30] bg-[#0a0a0f] flex items-center justify-between">
              <div className="font-terminal text-[9px] text-[#555555]">
                {results.length} RESULTS
              </div>
              <div className="flex items-center gap-2 font-terminal text-[9px] text-[#555555]">
                <span>
                  <kbd className="px-1 py-0.5 bg-[#1a1a1f] border border-[#2a2a30]">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-[#1a1a1f] border border-[#2a2a30]">⏎</kbd> open
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook for global keyboard shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
