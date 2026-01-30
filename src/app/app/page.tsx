"use client";

import { useState, useCallback } from "react";
import { InterestGraph } from "@/components/mindpoke/interest-graph";
import { DiscoveryFeed } from "@/components/mindpoke/discovery-feed";
import { Sidebar } from "@/components/mindpoke/sidebar";
import { Header } from "@/components/mindpoke/header";
import { AddInterestDialog } from "@/components/mindpoke/add-interest-dialog";
import { EditInterestDialog } from "@/components/mindpoke/edit-interest-dialog";
import { IngestPanel } from "@/components/mindpoke/ingest-panel";
import { KeywordSuggestions } from "@/components/mindpoke/keyword-suggestions";
import { useMindpokeData } from "@/hooks/use-mindpoke-data";
import type { Interest } from "@/types";

export default function AppPage() {
  const {
    interests,
    discoveries,
    isLoading,
    addInterest,
    updateInterest,
    deleteInterest,
    addDiscoveries,
    updateDiscoveryStatus,
  } = useMindpokeData();

  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInterestId, setEditingInterestId] = useState<string | null>(null);
  const [isIngestPanelOpen, setIsIngestPanelOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [suggestionsInterestId, setSuggestionsInterestId] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "feed">("graph");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStats, setDiscoveryStats] = useState<{ interestId: string; count: number }[] | null>(null);

  const handleAddInterest = useCallback(async (
    interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">
  ) => {
    await addInterest(interest);
    setIsAddDialogOpen(false);
  }, [addInterest]);

  const handleSuggestKeywords = useCallback((interestId: string) => {
    setSuggestionsInterestId(interestId);
    setIsSuggestionsOpen(true);
  }, []);

  const handleEditInterest = useCallback((interestId: string) => {
    setEditingInterestId(interestId);
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveInterest = useCallback(async (id: string, updates: Partial<Interest>) => {
    await updateInterest(id, updates);
  }, [updateInterest]);

  const handleDeleteInterest = useCallback(async (id: string) => {
    await deleteInterest(id);
    if (selectedInterest === id) {
      setSelectedInterest(null);
    }
  }, [deleteInterest, selectedInterest]);

  const handleAddKeywords = useCallback(async (keywords: string[]) => {
    if (!suggestionsInterestId) return;
    const interest = interests.find(i => i.id === suggestionsInterestId);
    if (!interest) return;
    const newKeywords = [...interest.keywords, ...keywords];
    await updateInterest(suggestionsInterestId, { keywords: newKeywords });
  }, [suggestionsInterestId, interests, updateInterest]);

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
        
        // Per-interest breakdown for node animations
        if (data.data.stats?.byInterest) {
          const stats = data.data.stats.byInterest
            .filter((s: { relevant: number }) => s.relevant > 0)
            .map((s: { id: string; relevant: number }) => ({
              interestId: s.id,
              count: s.relevant,
            }));
          setDiscoveryStats(stats);
          
          // Reset after animation
          setTimeout(() => setDiscoveryStats(null), 2500);
        }
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
        onSuggestKeywords={handleSuggestKeywords}
        onEditInterest={handleEditInterest}
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
              newDiscoveries={discoveryStats}
            />
          ) : (
            <DiscoveryFeed
              discoveries={filteredDiscoveries}
              interests={interests}
              onUpdateStatus={updateDiscoveryStatus}
            />
          )}
        </div>
      </main>

      <AddInterestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddInterest}
      />

      <EditInterestDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        interest={interests.find(i => i.id === editingInterestId) || null}
        onSave={handleSaveInterest}
        onDelete={handleDeleteInterest}
        discoveryCount={editingInterestId ? discoveries.filter(d => d.matchedInterests.includes(editingInterestId)).length : 0}
      />

      <IngestPanel
        isOpen={isIngestPanelOpen}
        onClose={() => setIsIngestPanelOpen(false)}
        onAddInterest={handleAddInterest}
        existingInterests={interests}
      />

      {suggestionsInterestId && (
        <KeywordSuggestions
          interestId={suggestionsInterestId}
          interestName={interests.find(i => i.id === suggestionsInterestId)?.name || ""}
          open={isSuggestionsOpen}
          onOpenChange={setIsSuggestionsOpen}
          onAddKeywords={handleAddKeywords}
        />
      )}

    </div>
  );
}
