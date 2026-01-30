"use client";

import { Bookmark, Plus, Settings, Zap, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface SidebarProps {
  interests: Interest[];
  selectedInterest: string | null;
  onSelectInterest: (id: string | null) => void;
  onAddInterest: () => void;
  onIngestBookmarks: () => void;
  onDiscover: () => void;
  isDiscovering: boolean;
}

export function Sidebar({
  interests,
  selectedInterest,
  onSelectInterest,
  onAddInterest,
  onIngestBookmarks,
  onDiscover,
  isDiscovering,
}: SidebarProps) {
  const getHeatLevel = (interest: Interest) => {
    const ratio = interest.engagementCount / (interest.engagementCount + interest.dismissCount + 1);
    return Math.round(ratio * 5);
  };

  const formatTimestamp = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <aside className="w-72 border-r border-[#2a2a30] bg-[#111113] flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-[#2a2a30]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-[#00d4aa] flex items-center justify-center font-terminal text-[#00d4aa] text-lg">
            ⟁
          </div>
          <div>
            <h1 className="font-serif text-xl text-white tracking-tight">Mindpoke</h1>
            <p className="text-[10px] font-terminal text-[#888888] tracking-wider">
              SYS_VERSION::0.1.0
            </p>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="px-4 py-3 border-b border-[#2a2a30] font-terminal text-[10px]">
        <div className="flex items-center justify-between text-[#888888]">
          <span>$ SYSTEM_STATUS</span>
          <span className="text-[#00d4aa]">● ONLINE</span>
        </div>
        <div className="text-[#555555] mt-1">
          LAST_SYNC: {formatTimestamp()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-b border-[#2a2a30] space-y-2">
        <Button
          onClick={onDiscover}
          disabled={isDiscovering || interests.length === 0}
          className={cn(
            "w-full justify-start font-terminal text-xs border",
            isDiscovering
              ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
              : "bg-transparent border-[#2a2a30] text-[#888888] hover:border-[#00d4aa] hover:text-[#00d4aa] hover:bg-transparent"
          )}
        >
          {isDiscovering ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              SCANNING...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              $ DISCOVER_NOW
            </>
          )}
        </Button>
        
        <Button
          onClick={onIngestBookmarks}
          className="w-full justify-start font-terminal text-xs bg-transparent border border-[#2a2a30] text-[#888888] hover:border-[#ffb000] hover:text-[#ffb000] hover:bg-transparent"
        >
          <Bookmark className="w-4 h-4 mr-2" />
          $ INGEST_BOOKMARKS
        </Button>
      </div>

      {/* Module Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#2a2a30]">
        <div>
          <span className="font-terminal text-[10px] text-[#888888] tracking-wider">
            ┌─ INTEREST_MODULES ─┐
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 border border-[#2a2a30] hover:border-[#00d4aa] hover:bg-transparent"
          onClick={onAddInterest}
        >
          <Plus className="w-4 h-4 text-[#00d4aa]" />
        </Button>
      </div>

      {/* Interests List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All Discoveries */}
          <button
            onClick={() => onSelectInterest(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-left transition-none border",
              selectedInterest === null
                ? "bg-[#1a1a1f] border-[#00d4aa] text-[#00d4aa]"
                : "border-transparent text-[#888888] hover:text-[#e6e6e6] hover:bg-[#1a1a1f]"
            )}
          >
            <Zap className="w-4 h-4" />
            <div className="flex-1">
              <span className="font-terminal text-xs">ALL_DISCOVERIES</span>
            </div>
          </button>

          {/* Individual Interests */}
          {interests.map((interest) => {
            const heatLevel = getHeatLevel(interest);
            return (
              <button
                key={interest.id}
                onClick={() => onSelectInterest(interest.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-none border group",
                  selectedInterest === interest.id
                    ? "bg-[#1a1a1f] border-[#00d4aa]"
                    : "border-transparent hover:bg-[#1a1a1f] hover:border-[#2a2a30]"
                )}
              >
                {/* Heat indicator - vertical bars */}
                <div className="flex gap-[2px]">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-[3px] h-4 transition-none",
                        i < heatLevel
                          ? "bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                          : "bg-[#2a2a30]"
                      )}
                    />
                  ))}
                </div>
                
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-terminal text-xs block truncate",
                    selectedInterest === interest.id ? "text-[#00d4aa]" : "text-[#e6e6e6]"
                  )}>
                    {interest.name.toUpperCase().replace(/\s+/g, '_')}
                  </span>
                  <span className="font-terminal text-[10px] text-[#555555]">
                    PRI:{interest.priority} | ENG:{interest.engagementCount}
                  </span>
                </div>

                {/* Priority indicator */}
                <div className={cn(
                  "w-6 h-6 flex items-center justify-center font-terminal text-[10px] border",
                  interest.priority >= 5
                    ? "border-[#ff4444] text-[#ff4444]"
                    : interest.priority >= 4
                    ? "border-[#ffb000] text-[#ffb000]"
                    : "border-[#2a2a30] text-[#888888]"
                )}>
                  {interest.priority}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-[#2a2a30]">
        <Button
          variant="ghost"
          className="w-full justify-start text-[#888888] hover:text-[#e6e6e6] hover:bg-transparent font-terminal text-xs"
        >
          <Settings className="w-4 h-4 mr-2" />
          $ CONFIG_SETTINGS
        </Button>
      </div>
    </aside>
  );
}
