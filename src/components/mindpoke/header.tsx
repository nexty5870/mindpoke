"use client";

import { Bell, Network, List, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  view: "graph" | "feed";
  onViewChange: (view: "graph" | "feed") => void;
  discoveryCount: number;
}

export function Header({ view, onViewChange, discoveryCount }: HeaderProps) {
  const timestamp = new Date().toISOString();

  return (
    <header className="h-14 border-b border-[#2a2a30] bg-[#111113] flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {/* View Toggle - Terminal Style */}
        <div className="flex border border-[#2a2a30]">
          <button
            onClick={() => onViewChange("graph")}
            className={`
              px-4 py-2 flex items-center gap-2 font-terminal text-xs transition-none
              ${view === "graph" 
                ? "bg-[#00d4aa] text-[#0a0a0f]" 
                : "text-[#888888] hover:text-[#e6e6e6] hover:bg-[#1a1a1f]"
              }
            `}
          >
            <Network className="w-4 h-4" />
            <span>GRAPH_VIEW</span>
          </button>
          <button
            onClick={() => onViewChange("feed")}
            className={`
              px-4 py-2 flex items-center gap-2 font-terminal text-xs transition-none border-l border-[#2a2a30]
              ${view === "feed" 
                ? "bg-[#00d4aa] text-[#0a0a0f]" 
                : "text-[#888888] hover:text-[#e6e6e6] hover:bg-[#1a1a1f]"
              }
            `}
          >
            <List className="w-4 h-4" />
            <span>FEED_VIEW</span>
            {discoveryCount > 0 && (
              <span className={`
                px-1.5 py-0.5 text-[10px] font-terminal
                ${view === "feed" 
                  ? "bg-[#0a0a0f] text-[#00d4aa]" 
                  : "bg-[#ffb000] text-[#0a0a0f]"
                }
              `}>
                {discoveryCount}
              </span>
            )}
          </button>
        </div>

        {/* Module Status */}
        <div className="ml-4 font-terminal text-[10px] text-[#555555]">
          <Terminal className="w-3 h-3 inline mr-1" />
          MODULE_ACTIVE :: {view.toUpperCase()}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Timestamp */}
        <div className="font-terminal text-[10px] text-[#555555]">
          {timestamp}
        </div>

        {/* Notifications */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative border border-[#2a2a30] hover:border-[#00d4aa] hover:bg-transparent"
        >
          <Bell className="w-4 h-4 text-[#888888]" />
          {discoveryCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-[#ffb000] text-[#0a0a0f] text-[10px] font-terminal font-bold flex items-center justify-center">
              {discoveryCount > 99 ? "99+" : discoveryCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
