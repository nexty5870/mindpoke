"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Network, List, Terminal, Send, X, ExternalLink, Clock, Zap, Moon } from "lucide-react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Poke {
  id: string;
  message: string;
  sentAt: string;
  discoveryId?: string;
  channel: string;
}

interface Discovery {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  author: string | null;
  authorHandle: string | null;
  relevanceScore: number;
  status: string;
  discoveredAt: string;
  interest?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface CronStatus {
  lastRun: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    durationMs: number | null;
    discoveriesFound: number;
    discoveriesSaved: number;
    interestsScanned: number;
    pokesQueued: number;
    pokesSent: number;
    notificationSkipped: boolean;
    error: string | null;
  } | null;
  stats: {
    totalFound24h: number;
    runsLast24h: number;
  };
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
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [activeTab, setActiveTab] = useState<"discoveries" | "pokes">("discoveries");
  const [isLoadingPokes, setIsLoadingPokes] = useState(false);
  const [isLoadingDiscoveries, setIsLoadingDiscoveries] = useState(false);
  const [isSendingPoke, setIsSendingPoke] = useState(false);
  const [pokePreview, setPokePreview] = useState<string | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
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

  // Fetch data when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      fetchDiscoveries();
      fetchPokes();
      fetchPokePreview();
      fetchCronStatus();
    }
  }, [showNotifications]);

  const fetchDiscoveries = async () => {
    setIsLoadingDiscoveries(true);
    try {
      const res = await fetch("/api/discoveries?status=unseen&limit=10");
      const data = await res.json();
      if (data.success) {
        setDiscoveries(data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch discoveries:", e);
    } finally {
      setIsLoadingDiscoveries(false);
    }
  };

  const fetchCronStatus = async () => {
    try {
      const res = await fetch("/api/cron/status");
      const data = await res.json();
      if (data.success) {
        setCronStatus(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch cron status:", e);
    }
  };

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

              {/* Last Run Status */}
              {cronStatus?.lastRun && (
                <div className="px-4 py-3 border-b border-[#2a2a30] bg-[#0a0a0f]/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-terminal text-[10px] text-[#555555] flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      LAST_DISCOVERY_RUN
                    </div>
                    {cronStatus.lastRun.notificationSkipped && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#2a2a30] font-terminal text-[9px] text-[#888888]">
                        <Moon className="w-3 h-3" />
                        QUIET_HOURS
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 font-terminal text-[10px]">
                    <div>
                      <span className="text-[#555555]">TIME:</span>
                      <span className="text-[#888888] ml-1">
                        {new Date(cronStatus.lastRun.startedAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#555555]">STATUS:</span>
                      <span className={cn(
                        "ml-1",
                        cronStatus.lastRun.status === "completed" ? "text-[#00d4aa]" :
                        cronStatus.lastRun.status === "running" ? "text-[#ffb000]" : "text-[#ff4444]"
                      )}>
                        {cronStatus.lastRun.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#555555]">FOUND:</span>
                      <span className="text-[#ffb000] ml-1">{cronStatus.lastRun.discoveriesSaved}</span>
                      <span className="text-[#555555] ml-0.5">new</span>
                    </div>
                    <div>
                      <span className="text-[#555555]">SCANNED:</span>
                      <span className="text-[#888888] ml-1">{cronStatus.lastRun.interestsScanned}</span>
                      <span className="text-[#555555] ml-0.5">interests</span>
                    </div>
                  </div>

                  {/* 24h Summary */}
                  <div className="mt-2 pt-2 border-t border-[#2a2a30]/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-terminal text-[10px]">
                      <Zap className="w-3 h-3 text-[#00d4aa]" />
                      <span className="text-[#555555]">24H:</span>
                      <span className="text-[#00d4aa]">{cronStatus.stats.totalFound24h}</span>
                      <span className="text-[#555555]">discovered</span>
                    </div>
                    <div className="font-terminal text-[10px] text-[#555555]">
                      {cronStatus.stats.runsLast24h} runs
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-[#2a2a30]">
                <button
                  onClick={() => setActiveTab("discoveries")}
                  className={cn(
                    "flex-1 px-4 py-2 font-terminal text-[10px] transition-none",
                    activeTab === "discoveries"
                      ? "bg-[#00d4aa]/10 text-[#00d4aa] border-b border-[#00d4aa]"
                      : "text-[#555555] hover:text-[#888888] hover:bg-[#1a1a1f]"
                  )}
                >
                  NEW_FEED [{discoveries.length}]
                </button>
                <button
                  onClick={() => setActiveTab("pokes")}
                  className={cn(
                    "flex-1 px-4 py-2 font-terminal text-[10px] transition-none border-l border-[#2a2a30]",
                    activeTab === "pokes"
                      ? "bg-[#00d4aa]/10 text-[#00d4aa] border-b border-[#00d4aa]"
                      : "text-[#555555] hover:text-[#888888] hover:bg-[#1a1a1f]"
                  )}
                >
                  SENT_POKES [{pokes.length}]
                </button>
              </div>

              {/* Tab Content */}
              <div className="max-h-72 overflow-y-auto">
                {activeTab === "discoveries" ? (
                  /* New Discoveries Tab */
                  isLoadingDiscoveries ? (
                    <div className="px-4 py-6 text-center font-terminal text-[10px] text-[#555555]">
                      LOADING...
                    </div>
                  ) : discoveries.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <div className="font-terminal text-[10px] text-[#555555]">NO_NEW_DISCOVERIES</div>
                      <div className="font-terminal text-[10px] text-[#3a3a40] mt-1">
                        All caught up!
                      </div>
                    </div>
                  ) : (
                    discoveries.map((discovery) => (
                      <a
                        key={discovery.id}
                        href={discovery.sourceUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 border-b border-[#2a2a30] last:border-b-0 hover:bg-[#1a1a1f] group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {discovery.interest && (
                              <span 
                                className="px-1.5 py-0.5 font-terminal text-[9px] border"
                                style={{ 
                                  borderColor: discovery.interest.color,
                                  color: discovery.interest.color 
                                }}
                              >
                                {discovery.interest.name.toUpperCase()}
                              </span>
                            )}
                            <span className="font-terminal text-[9px] text-[#555555]">
                              {discovery.sourceType.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-terminal text-[9px] text-[#ffb000]">
                            {Math.round(discovery.relevanceScore)}%
                          </span>
                        </div>
                        <div className="font-terminal text-[10px] text-[#e6e6e6] line-clamp-2 group-hover:text-[#00d4aa]">
                          {discovery.title || discovery.content.slice(0, 100)}
                        </div>
                        {discovery.authorHandle && (
                          <div className="font-terminal text-[9px] text-[#555555] mt-1">
                            @{discovery.authorHandle}
                          </div>
                        )}
                      </a>
                    ))
                  )
                ) : (
                  /* Sent Pokes Tab */
                  isLoadingPokes ? (
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
                  )
                )}
              </div>

              {/* Send Poke Button (always visible at bottom) */}
              {pokePreview && (
                <div className="px-4 py-3 border-t border-[#2a2a30] bg-[#0a0a0f]">
                  <button
                    onClick={sendPoke}
                    disabled={isSendingPoke}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#00d4aa] text-[#00d4aa] font-terminal text-xs hover:bg-[#00d4aa]/10 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {isSendingPoke ? "SENDING..." : "POKE_NOW"}
                  </button>
                </div>
              )}

              {/* Footer */}
              <button 
                onClick={() => {
                  onViewChange("feed");
                  setShowNotifications(false);
                }}
                className="w-full px-4 py-2 border-t border-[#2a2a30] font-terminal text-[10px] text-[#555555] text-center hover:bg-[#1a1a1f] hover:text-[#00d4aa]"
              >
                VIEW_ALL_FEED →
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
