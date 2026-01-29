"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface AddInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (interest: Omit<Interest, "id" | "createdAt" | "updatedAt" | "engagementCount" | "dismissCount">) => void;
}

export function AddInterestDialog({ open, onOpenChange, onAdd }: AddInterestDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [priority, setPriority] = useState(3);

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim() || undefined,
      keywords: keywords.length > 0 ? keywords : [name.toLowerCase()],
      priority,
    });

    // Reset form
    setName("");
    setDescription("");
    setKeywords([]);
    setPriority(3);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Add New Interest
          </DialogTitle>
          <DialogDescription>
            Tell Mindpoke what you&apos;re curious about. We&apos;ll find the best content for you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Interest Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AI Agents"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Description <span className="text-zinc-500">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Autonomous AI systems and agent architectures"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Keywords <span className="text-zinc-500">(for better matching)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="Add keyword and press Enter"
                className="bg-zinc-800 border-zinc-700"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleAddKeyword}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="bg-zinc-800 hover:bg-zinc-700 cursor-pointer group"
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    {keyword}
                    <X className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Priority <span className="text-zinc-500">(affects notification threshold)</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "w-10 h-10 rounded-lg font-semibold transition-all",
                    priority === p
                      ? p >= 5
                        ? "bg-red-500 text-white"
                        : p >= 4
                        ? "bg-orange-500 text-white"
                        : p >= 3
                        ? "bg-yellow-500 text-black"
                        : "bg-zinc-500 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {priority >= 5
                ? "🔥 Critical - Notify immediately for any match"
                : priority >= 4
                ? "⚡ High - Notify for good matches (75%+)"
                : priority >= 3
                ? "📌 Medium - Notify for strong matches (85%+)"
                : priority >= 2
                ? "📋 Low - Only notify for excellent matches (95%+)"
                : "💤 Minimal - Rarely notify"}
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Add Interest
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
