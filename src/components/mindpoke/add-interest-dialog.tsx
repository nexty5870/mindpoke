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
import { X, Plus, Terminal } from "lucide-react";
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
      <DialogContent className="bg-[#111113] border border-[#2a2a30] max-w-lg">
        {/* ASCII corners */}
        <span className="absolute top-0 left-0 font-terminal text-[#2a2a30] text-xs">┌</span>
        <span className="absolute top-0 right-0 font-terminal text-[#2a2a30] text-xs">┐</span>
        <span className="absolute bottom-0 left-0 font-terminal text-[#2a2a30] text-xs">└</span>
        <span className="absolute bottom-0 right-0 font-terminal text-[#2a2a30] text-xs">┘</span>

        <DialogHeader className="border-b border-[#2a2a30] pb-4">
          <div className="font-terminal text-[10px] text-[#555555] mb-2">
            <Terminal className="w-3 h-3 inline mr-1" />
            $ MODULE_INIT :: ADD_INTEREST
          </div>
          <DialogTitle className="font-serif text-xl text-white">
            Initialize New Interest
          </DialogTitle>
          <DialogDescription className="font-terminal text-xs text-[#888888]">
            CONFIGURE_PARAMETERS :: Define topic scope for discovery engine
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
              $ INTEREST_NAME
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AI Agents"
              className="bg-[#0a0a0f] border-[#2a2a30] font-terminal text-sm text-[#e6e6e6] placeholder:text-[#555555] focus:border-[#00d4aa]"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
              $ DESCRIPTION <span className="text-[#555555]">[OPTIONAL]</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Autonomous AI systems and agent architectures"
              className="bg-[#0a0a0f] border-[#2a2a30] font-terminal text-sm text-[#e6e6e6] placeholder:text-[#555555] focus:border-[#00d4aa]"
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
              $ SEARCH_KEYWORDS
            </label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="> add keyword..."
                className="bg-[#0a0a0f] border-[#2a2a30] font-terminal text-sm text-[#e6e6e6] placeholder:text-[#555555] focus:border-[#00d4aa]"
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                className="bg-transparent border border-[#2a2a30] hover:border-[#00d4aa] hover:bg-transparent text-[#00d4aa] px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-[#2a2a30] font-terminal text-[10px] text-[#888888] cursor-pointer hover:border-[#ff4444] hover:text-[#ff4444] transition-none"
                  >
                    {keyword}
                    <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
              $ PRIORITY_LEVEL
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "w-12 h-12 font-terminal text-lg border transition-none",
                    priority === p
                      ? p >= 5
                        ? "border-[#ff4444] text-[#ff4444] bg-[#ff4444]/10"
                        : p >= 4
                        ? "border-[#ffb000] text-[#ffb000] bg-[#ffb000]/10"
                        : p >= 3
                        ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/10"
                        : "border-[#888888] text-[#888888] bg-[#888888]/10"
                      : "border-[#2a2a30] text-[#555555] hover:border-[#3a3a40]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="font-terminal text-[10px] text-[#555555]">
              {priority >= 5
                ? "▲ CRITICAL :: Notify immediately for any match"
                : priority >= 4
                ? "▲ HIGH :: Notify for good matches (75%+)"
                : priority >= 3
                ? "● MEDIUM :: Notify for strong matches (85%+)"
                : priority >= 2
                ? "▼ LOW :: Only notify for excellent matches (95%+)"
                : "▽ MINIMAL :: Rarely notify"}
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#2a2a30]">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-transparent border border-[#2a2a30] hover:border-[#888888] hover:bg-transparent font-terminal text-xs text-[#888888]"
            >
              $ CANCEL
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className={cn(
                "font-terminal text-xs border",
                name.trim()
                  ? "bg-[#00d4aa] text-[#0a0a0f] border-[#00d4aa] hover:bg-[#00d4aa]/90"
                  : "bg-transparent border-[#2a2a30] text-[#555555]"
              )}
            >
              ┌ INITIALIZE ┐
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
