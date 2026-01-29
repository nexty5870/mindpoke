"use client";

import { Brain, Plus, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface SidebarProps {
  interests: Interest[];
  selectedInterest: string | null;
  onSelectInterest: (id: string | null) => void;
  onAddInterest: () => void;
}

export function Sidebar({
  interests,
  selectedInterest,
  onSelectInterest,
  onAddInterest,
}: SidebarProps) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return "bg-red-500/20 text-red-400";
    if (priority >= 4) return "bg-orange-500/20 text-orange-400";
    if (priority >= 3) return "bg-yellow-500/20 text-yellow-400";
    return "bg-zinc-500/20 text-zinc-400";
  };

  const getHeatLevel = (interest: Interest) => {
    const ratio = interest.engagementCount / (interest.engagementCount + interest.dismissCount + 1);
    return Math.round(ratio * 5);
  };

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Mindpoke</h1>
            <p className="text-xs text-zinc-500">Poke your curiosity</p>
          </div>
        </div>
      </div>

      {/* Interests List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">Interests</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAddInterest}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-4">
            {/* All Discoveries */}
            <button
              onClick={() => onSelectInterest(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                selectedInterest === null
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">All Discoveries</span>
            </button>

            {/* Individual Interests */}
            {interests.map((interest) => (
              <button
                key={interest.id}
                onClick={() => onSelectInterest(interest.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group",
                  selectedInterest === interest.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                )}
              >
                {/* Heat indicator */}
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 h-3 rounded-full transition-colors",
                        i < getHeatLevel(interest)
                          ? "bg-gradient-to-t from-orange-500 to-yellow-400"
                          : "bg-zinc-700"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium flex-1 truncate">
                  {interest.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", getPriorityColor(interest.priority))}
                >
                  {interest.priority}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-zinc-800">
        <Button
          variant="ghost"
          className="w-full justify-start text-zinc-400 hover:text-zinc-200"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </aside>
  );
}
