"use client";

import { useState, useEffect, useCallback } from "react";
import type { Interest, Discovery } from "@/types";

// Map DB schema to frontend types
function mapInterest(db: Record<string, unknown>): Interest {
  return {
    id: db.id as string,
    name: db.name as string,
    description: (db.keywords as string[])?.join(", ") || "",
    keywords: (db.keywords as string[]) || [],
    priority: db.priority === "high" ? 5 : db.priority === "medium" ? 3 : 1,
    createdAt: new Date(db.createdAt as string),
    updatedAt: new Date(db.updatedAt as string),
    engagementCount: 0, // TODO: calculate from discoveries
    dismissCount: 0,
    positionX: db.positionX as number | null | undefined,
    positionY: db.positionY as number | null | undefined,
  };
}

function mapDiscovery(db: Record<string, unknown>): Discovery {
  const metadata = (db.metadata || {}) as Record<string, unknown>;
  const sourceType = db.sourceType as string;
  return {
    id: db.id as string,
    title: (db.title as string) || "",
    summary: (db.content as string) || "",
    url: (db.sourceUrl as string) || "",
    source: (sourceType === "twitter" ? "x" : sourceType) as Discovery["source"],
    sourceId: db.sourceId as string,
    author: db.author as string,
    authorHandle: db.authorHandle as string,
    relevanceScore: (db.relevanceScore as number) || 0,
    matchedInterests: db.interestId ? [db.interestId as string] : [],
    engagementMetrics: {
      likes: metadata.likes as number,
      retweets: metadata.retweets as number,
      comments: metadata.comments as number,
      upvotes: metadata.upvotes as number,
    },
    status: mapStatus(db.status as string),
    publishedAt: db.publishedAt ? new Date(db.publishedAt as string) : new Date(),
    discoveredAt: new Date(db.discoveredAt as string),
  };
}

function mapStatus(status: string): Discovery["status"] {
  switch (status) {
    case "saved": return "saved";
    case "seen": return "read";
    case "dismissed": return "dismissed";
    default: return "new";
  }
}

export function useMindpokeData() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [interestsRes, discoveriesRes] = await Promise.all([
          fetch("/api/interests"),
          fetch("/api/discoveries?limit=100"),
        ]);

        const interestsData = await interestsRes.json();
        const discoveriesData = await discoveriesRes.json();

        if (interestsData.success) {
          setInterests(interestsData.data.map(mapInterest));
        }
        if (discoveriesData.success) {
          setDiscoveries(discoveriesData.data.map(mapDiscovery));
        }
      } catch (err) {
        setError("Failed to load data");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Add interest
  const addInterest = useCallback(async (
    interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">
  ) => {
    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: interest.name,
          keywords: interest.keywords,
          priority: interest.priority >= 4 ? "high" : interest.priority >= 2 ? "medium" : "low",
        }),
      });

      const data = await response.json();
      if (data.success) {
        setInterests(prev => [...prev, mapInterest(data.data)]);
        return data.data;
      }
    } catch (err) {
      console.error("Failed to add interest:", err);
    }
    return null;
  }, []);

  // Update interest
  const updateInterest = useCallback(async (id: string, updates: Partial<Interest>) => {
    try {
      const response = await fetch(`/api/interests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          keywords: updates.keywords,
          priority: updates.priority 
            ? (updates.priority >= 4 ? "high" : updates.priority >= 2 ? "medium" : "low")
            : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setInterests(prev => prev.map(i => i.id === id ? mapInterest(data.data) : i));
        return data.data;
      }
    } catch (err) {
      console.error("Failed to update interest:", err);
    }
    return null;
  }, []);

  // Delete interest
  const deleteInterest = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/interests/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setInterests(prev => prev.filter(i => i.id !== id));
        return true;
      }
    } catch (err) {
      console.error("Failed to delete interest:", err);
    }
    return false;
  }, []);

  // Update discovery status
  const updateDiscoveryStatus = useCallback(async (
    id: string, 
    status: Discovery["status"]
  ) => {
    try {
      const dbStatus = status === "read" ? "seen" : status === "new" ? "unseen" : status;
      const response = await fetch(`/api/discoveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: dbStatus }),
      });

      const data = await response.json();
      if (data.success) {
        setDiscoveries(prev => prev.map(d => d.id === id ? mapDiscovery(data.data) : d));
        return data.data;
      }
    } catch (err) {
      console.error("Failed to update discovery:", err);
    }
    return null;
  }, []);

  // Add discoveries (from discover API)
  const addDiscoveries = useCallback((newDiscoveries: Discovery[]) => {
    setDiscoveries(prev => {
      const existingIds = new Set(prev.map(d => d.sourceId));
      const unique = newDiscoveries.filter(d => !existingIds.has(d.sourceId));
      return [...unique, ...prev];
    });
  }, []);

  return {
    interests,
    discoveries,
    isLoading,
    error,
    addInterest,
    updateInterest,
    deleteInterest,
    updateDiscoveryStatus,
    addDiscoveries,
  };
}
