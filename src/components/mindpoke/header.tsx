"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Network, List, Terminal, Send, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Poke {
  id: string;
  message: string;
  sentAt: string;
  discoveryId?: string;
  channel: string;
}

interface HeaderProps {
  view: "graph" | "feed";
  onViewChange: (view: "graph" | "feed") => void;
  discoveryCount: number;
}

export function Header({ view, onViewChange, discoveryCount }: HeaderProps) {
  const timestamp = new Date().toISOString();
  const [showNotifications, setShowNotifications] = useState(false);
  const [pokes, setPokes] = useState<Poke[]>([]);
  const [isLoadingPokes, setIsLoadingPokes] = useState(false);
  const [isSendingPoke, setIsSendingPoke] = useState(false);
  const [pokePreview, setPokePreview] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch recent pokes when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      fetchPokes();
      fetchPokePreview();
    }
  }, [showNotifications]);

  const fetchPokes = async () => {
    setIsLoadingPokes(true);
    try {
      const res = await fetch("/api/pokes?limit=5");
      const data = await res.json();
      if (data.success) {
        setPokes(data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch pokes:", e);
    } finally {
      setIsLoadingPokes(false);
    }
  };

  const fetchPokePreview = async () => {
    try {
      const res = await fetch("/api/poke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minRelevance: 55, maxPokes: 3, dryRun: true }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setPokePreview(data.message);
      } else {
        setPokePreview(null);
      }
    } catch (e) {
      setPokePreview(null);
    }
  };

  const sendPoke = async () => {
    setIsSendingPoke(true);
    try {
      const res = await fetch("/api/poke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minRelevance: 55, maxPokes: 3 }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        // Send to WhatsApp via our API
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: data.message }),
        });
        fetchPokes(); // Refresh list
        setPokePreview(null);
      }
    } catch (e) {
      console.error("Failed to send poke:", e);
    } finally {
      setIsSendingPoke(false);
    }
  };

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
        <div className="relative" ref={dropdownRef}>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "relative border hover:bg-transparent",
              showNotifications 
                ? "border-[#00d4aa] bg-[#00d4aa]/10" 
                : "border-[#2a2a30] hover:border-[#00d4aa]"
            )}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className={cn("w-4 h-4", showNotifications ? "text-[#00d4aa]" : "text-[#888888]")} />
            {discoveryCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-[#ffb000] text-[#0a0a0f] text-[10px] font-terminal font-bold flex items-center justify-center">
                {discoveryCount > 99 ? "99+" : discoveryCount}
              </span>
            )}
          </Button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-[#111113] border border-[#2a2a30] z-50 shadow-xl">
              {/* ASCII corners */}
              <span className="absolute -top-[1px] -left-[1px] font-terminal text-[#2a2a30] text-xs">┌</span>
              <span className="absolute -top-[1px] -right-[1px] font-terminal text-[#2a2a30] text-xs">┐</span>
              <span className="absolute -bottom-[1px] -left-[1px] font-terminal text-[#2a2a30] text-xs">└</span>
              <span className="absolute -bottom-[1px] -right-[1px] font-terminal text-[#2a2a30] text-xs">┘</span>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a30]">
                <div>
                  <div className="font-terminal text-[10px] text-[#555555]">$ NOTIFICATION_CENTER</div>
                  <div className="font-serif text-sm text-white">Poke History</div>
                </div>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-[#555555] hover:text-[#888888]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Send Poke Section */}
              {pokePreview && (
                <div className="px-4 py-3 border-b border-[#2a2a30] bg-[#0a0a0f]">
                  <div className="font-terminal text-[10px] text-[#ffb000] mb-2">
                    ● READY_TO_POKE
                  </div>
                  <div className="font-terminal text-[10px] text-[#888888] mb-3 line-clamp-3">
                    {pokePreview.split('\n').slice(0, 3).join(' ')}...
                  </div>
                  <button
                    onClick={sendPoke}
                    disabled={isSendingPoke}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#00d4aa] text-[#00d4aa] font-terminal text-xs hover:bg-[#00d4aa]/10 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {isSendingPoke ? "SENDING..." : "SEND_TO_WHATSAPP"}
                  </button>
                </div>
              )}

              {/* Recent Pokes */}
              <div className="max-h-64 overflow-y-auto">
                {isLoadingPokes ? (
                  <div className="px-4 py-6 text-center font-terminal text-[10px] text-[#555555]">
                    LOADING...
                  </div>
                ) : pokes.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="font-terminal text-[10px] text-[#555555]">NO_POKES_SENT</div>
                    <div className="font-terminal text-[10px] text-[#3a3a40] mt-1">
                      Run discover to find content
                    </div>
                  </div>
                ) : (
                  pokes.map((poke) => (
                    <div 
                      key={poke.id}
                      className="px-4 py-3 border-b border-[#2a2a30] last:border-b-0 hover:bg-[#1a1a1f]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-terminal text-[10px] text-[#00d4aa]">
                          via {poke.channel.toUpperCase()}
                        </span>
                        <span className="font-terminal text-[10px] text-[#555555]">
                          {new Date(poke.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="font-terminal text-[10px] text-[#888888] line-clamp-2">
                        {poke.message.slice(0, 100)}...
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[#2a2a30] font-terminal text-[10px] text-[#555555] text-center">
                {discoveryCount} NEW_DISCOVERIES_PENDING
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
