"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Settings {
  discoverIntervalHours: number;
  minPokeRelevance: number;
  maxPokesPerBatch: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  enabledSources: {
    twitter: boolean;
    reddit: boolean;
    hackernews: boolean;
  };
}

const DEFAULT_SETTINGS: Settings = {
  discoverIntervalHours: 4,
  minPokeRelevance: 55,
  maxPokesPerBatch: 3,
  quietHoursStart: "23:00",
  quietHoursEnd: "08:00",
  enabledSources: {
    twitter: true,
    reddit: true,
    hackernews: true,
  },
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success && data.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.data });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const intervalOptions = [
    { value: 1, label: "1 HOUR" },
    { value: 2, label: "2 HOURS" },
    { value: 4, label: "4 HOURS" },
    { value: 6, label: "6 HOURS" },
    { value: 12, label: "12 HOURS" },
    { value: 24, label: "24 HOURS" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111113] border border-[#2a2a30] max-w-lg">
        {/* ASCII corners */}
        <span className="absolute top-0 left-0 font-terminal text-[#2a2a30] text-xs">┌</span>
        <span className="absolute top-0 right-0 font-terminal text-[#2a2a30] text-xs">┐</span>
        <span className="absolute bottom-0 left-0 font-terminal text-[#2a2a30] text-xs">└</span>
        <span className="absolute bottom-0 right-0 font-terminal text-[#2a2a30] text-xs">┘</span>

        <DialogHeader className="border-b border-[#2a2a30] pb-4">
          <div className="font-terminal text-[10px] text-[#555555] mb-2">
            <Terminal className="w-3 h-3 inline mr-1" />
            $ SYSTEM_CONFIG
          </div>
          <DialogTitle className="font-serif text-xl text-white">
            Settings
          </DialogTitle>
          <DialogDescription className="font-terminal text-xs text-[#888888]">
            CONFIGURE_PARAMETERS :: Discovery and notification preferences
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-[#00d4aa] animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Auto-Discover Interval */}
            <div className="space-y-2">
              <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
                $ AUTO_DISCOVER_INTERVAL
              </label>
              <div className="grid grid-cols-3 gap-2">
                {intervalOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSettings({ ...settings, discoverIntervalHours: opt.value })}
                    className={cn(
                      "px-3 py-2 font-terminal text-[10px] border transition-none",
                      settings.discoverIntervalHours === opt.value
                        ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10"
                        : "border-[#2a2a30] text-[#888888] hover:border-[#3a3a40]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="font-terminal text-[10px] text-[#555555]">
                How often to scan for new content
              </p>
            </div>

            {/* Min Poke Relevance */}
            <div className="space-y-2">
              <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
                $ MIN_POKE_RELEVANCE :: {settings.minPokeRelevance}%
              </label>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={settings.minPokeRelevance}
                onChange={(e) => setSettings({ ...settings, minPokeRelevance: parseInt(e.target.value) })}
                className="w-full accent-[#00d4aa] bg-[#2a2a30]"
              />
              <div className="flex justify-between font-terminal text-[10px] text-[#555555]">
                <span>30% (more pokes)</span>
                <span>90% (fewer pokes)</span>
              </div>
            </div>

            {/* Enabled Sources */}
            <div className="space-y-2">
              <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
                $ ENABLED_SOURCES
              </label>
              <div className="flex gap-2">
                {(["twitter", "reddit", "hackernews"] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      enabledSources: {
                        ...settings.enabledSources,
                        [source]: !settings.enabledSources[source],
                      },
                    })}
                    className={cn(
                      "px-4 py-2 font-terminal text-xs border transition-none",
                      settings.enabledSources[source]
                        ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10"
                        : "border-[#2a2a30] text-[#555555]"
                    )}
                  >
                    {source === "twitter" ? "X" : source === "hackernews" ? "HN" : "REDDIT"}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-2">
              <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
                $ QUIET_HOURS <span className="text-[#555555]">[NO_POKES]</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
                  className="bg-[#0a0a0f] border-[#2a2a30] font-terminal text-sm text-[#e6e6e6] w-32"
                />
                <span className="font-terminal text-[10px] text-[#555555]">TO</span>
                <Input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
                  className="bg-[#0a0a0f] border-[#2a2a30] font-terminal text-sm text-[#e6e6e6] w-32"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#2a2a30]">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-transparent border border-[#2a2a30] hover:border-[#888888] hover:bg-transparent font-terminal text-xs text-[#888888]"
              >
                $ CANCEL
              </Button>
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="font-terminal text-xs border bg-[#00d4aa] text-[#0a0a0f] border-[#00d4aa] hover:bg-[#00d4aa]/90"
              >
                {isSaving ? "SAVING..." : "┌ SAVE ┐"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
