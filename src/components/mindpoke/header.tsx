"use client";

import { Bell, Network, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HeaderProps {
  view: "graph" | "feed";
  onViewChange: (view: "graph" | "feed") => void;
  discoveryCount: number;
}

export function Header({ view, onViewChange, discoveryCount }: HeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as "graph" | "feed")}>
          <TabsList className="bg-zinc-800/50">
            <TabsTrigger value="graph" className="gap-2">
              <Network className="w-4 h-4" />
              Interest Graph
            </TabsTrigger>
            <TabsTrigger value="feed" className="gap-2">
              <List className="w-4 h-4" />
              Discovery Feed
              {discoveryCount > 0 && (
                <Badge className="ml-1 bg-violet-500 text-white text-xs px-1.5">
                  {discoveryCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {discoveryCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-xs flex items-center justify-center">
              {discoveryCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
