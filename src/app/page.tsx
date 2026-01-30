"use client";

import { useState, useCallback } from "react";
import { InterestGraph } from "@/components/mindpoke/interest-graph";
import { DiscoveryFeed } from "@/components/mindpoke/discovery-feed";
import { Sidebar } from "@/components/mindpoke/sidebar";
import { Header } from "@/components/mindpoke/header";
import { AddInterestDialog } from "@/components/mindpoke/add-interest-dialog";
import { IngestPanel } from "@/components/mindpoke/ingest-panel";
import type { Interest, Discovery } from "@/types";

// Mock data for initial development
const mockInterests: Interest[] = [
  {
    id: "1",
    name: "AI Agents",
    description: "Autonomous AI systems and agent architectures",
    keywords: ["ai agents", "autonomous", "langchain", "autogpt", "crew ai"],
    priority: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    engagementCount: 12,
    dismissCount: 2,
  },
  {
    id: "2",
    name: "Local LLMs",
    description: "Running large language models locally",
    keywords: ["local llm", "ollama", "llama.cpp", "vllm", "gguf"],
    priority: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    engagementCount: 8,
    dismissCount: 1,
  },
  {
    id: "3",
    name: "Memory Systems",
    description: "Long-term memory for AI systems",
    keywords: ["memory", "rag", "vector db", "embeddings", "knowledge graph"],
    priority: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    engagementCount: 5,
    dismissCount: 0,
  },
  {
    id: "4",
    name: "TypeScript",
    description: "TypeScript patterns and tools",
    keywords: ["typescript", "ts", "type safety", "zod"],
    priority: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    engagementCount: 3,
    dismissCount: 4,
  },
];

const mockDiscoveries: Discovery[] = [
  {
    id: "1",
    title: "How to build an agent that never forgets",
    summary:
      "Deep dive into building AI agents with persistent memory. Covers file-based memory, knowledge graphs, and maintenance cron jobs.",
    url: "https://x.com/rohit4verse/status/2012925228159295810",
    source: "x",
    sourceId: "2012925228159295810",
    author: "Rohit",
    authorHandle: "rohit4verse",
    relevanceScore: 94,
    matchedInterests: ["1", "3"],
    engagementMetrics: {
      likes: 2055,
      retweets: 206,
      comments: 103,
    },
    status: "new",
    publishedAt: new Date("2026-01-18"),
    discoveredAt: new Date(),
  },
  {
    id: "2",
    title: "Running Llama 3.3 70B on 6x RTX 3090s",
    summary:
      "Tutorial on setting up a multi-GPU inference server for large models using vLLM and tensor parallelism.",
    url: "https://reddit.com/r/LocalLLaMA/comments/xxx",
    source: "reddit",
    sourceId: "xxx",
    author: "localllama_user",
    relevanceScore: 87,
    matchedInterests: ["2"],
    engagementMetrics: {
      upvotes: 342,
      comments: 89,
    },
    status: "new",
    publishedAt: new Date("2026-01-28"),
    discoveredAt: new Date(),
  },
  {
    id: "3",
    title: "CrewAI vs AutoGen vs LangGraph - 2026 comparison",
    summary:
      "Comprehensive comparison of the top agent frameworks with benchmarks and real-world use cases.",
    url: "https://news.ycombinator.com/item?id=xxx",
    source: "hackernews",
    sourceId: "xxx",
    relevanceScore: 78,
    matchedInterests: ["1"],
    engagementMetrics: {
      upvotes: 156,
      comments: 67,
    },
    status: "saved",
    savedAt: new Date(),
    publishedAt: new Date("2026-01-27"),
    discoveredAt: new Date(),
  },
];

export default function Home() {
  const [interests, setInterests] = useState<Interest[]>(mockInterests);
  const [discoveries, setDiscoveries] = useState<Discovery[]>(mockDiscoveries);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isIngestPanelOpen, setIsIngestPanelOpen] = useState(false);
  const [view, setView] = useState<"graph" | "feed">("graph");
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleAddInterest = useCallback((interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">) => {
    const newInterest: Interest = {
      ...interest,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      engagementCount: 0,
      dismissCount: 0,
    };
    setInterests((prev) => [...prev, newInterest]);
    setIsAddDialogOpen(false);
  }, []);

  const handleDiscover = useCallback(async () => {
    if (interests.length === 0) return;
    
    setIsDiscovering(true);
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests,
          minRelevance: 40,
          maxResults: 30,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data.discoveries.length > 0) {
        // Add new discoveries, avoiding duplicates
        setDiscoveries((prev) => {
          const existingIds = new Set(prev.map((d) => d.sourceId));
          const newDiscoveries = data.data.discoveries.filter(
            (d: Discovery) => !existingIds.has(d.sourceId)
          );
          return [...newDiscoveries, ...prev];
        });
      }
    } catch (error) {
      console.error("Discovery failed:", error);
    } finally {
      setIsDiscovering(false);
    }
  }, [interests]);

  const filteredDiscoveries = selectedInterest
    ? discoveries.filter((d) => d.matchedInterests.includes(selectedInterest))
    : discoveries;

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
