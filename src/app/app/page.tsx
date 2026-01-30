"use client";

import { useState, useCallback } from "react";
import { InterestGraph } from "@/components/mindpoke/interest-graph";
import { DiscoveryFeed } from "@/components/mindpoke/discovery-feed";
import { Sidebar } from "@/components/mindpoke/sidebar";
import { Header } from "@/components/mindpoke/header";
import { AddInterestDialog } from "@/components/mindpoke/add-interest-dialog";
import { IngestPanel } from "@/components/mindpoke/ingest-panel";
import { useMindpokeData } from "@/hooks/use-mindpoke-data";
import type { Interest } from "@/types";

export default function AppPage() {
  const {
    interests,
    discoveries,
    isLoading,
    addInterest,
    addDiscoveries,
  } = useMindpokeData();

  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isIngestPanelOpen, setIsIngestPanelOpen] = useState(false);
  const [view, setView] = useState<"graph" | "feed">("graph");
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleAddInterest = useCallback(async (
    interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">
  ) => {
    await addInterest(interest);
    setIsAddDialogOpen(false);
  }, [addInterest]);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    try {
      // API fetches all interests from database directly
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minRelevance: 35,
          maxResultsPerInterest: 15,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data.discoveries.length > 0) {
        addDiscoveries(data.data.discoveries);
      }
    } catch (error) {
      console.error("Discovery failed:", error);
    } finally {
      setIsDiscovering(false);
    }
  }, [addDiscoveries]);

  const filteredDiscoveries = selectedInterest
    ? discoveries.filter((d) => d.matchedInterests.includes(selectedInterest))
    : discoveries;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-[#00d4aa] font-mono text-sm">
          ┌─ SYSTEM_BOOT ─┐
          <br />
          │ LOADING...   │
          <br />
          └──────────────┘
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        interests={interests}
        selectedInterest={selectedInterest}
        onSelectInterest={setSelectedInterest}
        onAddInterest={() => setIsAddDialogOpen(true)}
        onIngestBookmarks={() => setIsIngestPanelOpen(true)}
        onDiscover={handleDiscover}
        isDiscovering={isDiscovering}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          view={view}
          onViewChange={setView}
          discoveryCount={discoveries.filter((d) => d.status === "new").length}
        />
        
        <div className="flex-1 overflow-hidden">
          {view === "graph" ? (
            <InterestGraph
              interests={interests}
              discoveries={discoveries}
              selectedInterest={selectedInterest}
              onSelectInterest={setSelectedInterest}
            />
          ) : (
            <DiscoveryFeed
              discoveries={filteredDiscoveries}
              interests={interests}
            />
          )}
        </div>
      </main>

      <AddInterestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddInterest}
      />

      <IngestPanel
        isOpen={isIngestPanelOpen}
        onClose={() => setIsIngestPanelOpen(false)}
        onAddInterest={handleAddInterest}
        existingInterests={interests}
      />
    </div>
  );
}
