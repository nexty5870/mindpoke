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
import { X, Plus, Terminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Interest } from "@/types";

interface EditInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interest: Interest | null;
  onSave: (id: string, updates: Partial<Interest>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function EditInterestDialog({ 
  open, 
  onOpenChange, 
  interest,
  onSave,
  onDelete,
}: EditInterestDialogProps) {
  const [name, setName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [priority, setPriority] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when interest changes
  useEffect(() => {
    if (interest) {
      setName(interest.name);
      setKeywords(interest.keywords || []);
      setPriority(interest.priority);
    }
  }, [interest]);

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest || !name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(interest.id, {
        name: name.trim(),
        keywords: keywords.length > 0 ? keywords : [name.toLowerCase()],
        priority,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!interest || !onDelete) return;
    if (!confirm(`Delete "${interest.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      await onDelete(interest.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  if (!interest) return null;

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
            $ MODULE_CONFIG :: EDIT_INTEREST
          </div>
          <DialogTitle className="font-serif text-xl text-white">
            Configure Interest
          </DialogTitle>
          <DialogDescription className="font-terminal text-xs text-[#888888]">
            MODIFY_PARAMETERS :: Update keywords and notification priority
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
            {keywords.length === 0 && (
              <p className="font-terminal text-[10px] text-[#ff4444]">
                ⚠ At least one keyword required
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="font-terminal text-[10px] text-[#888888] tracking-wider">
              $ NOTIFICATION_PRIORITY
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

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-[#2a2a30]">
            {onDelete && (
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-transparent border border-[#2a2a30] hover:border-[#ff4444] hover:bg-transparent font-terminal text-xs text-[#ff4444]"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {isDeleting ? "DELETING..." : "DELETE"}
              </Button>
            )}
            <div className="flex gap-3 ml-auto">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-transparent border border-[#2a2a30] hover:border-[#888888] hover:bg-transparent font-terminal text-xs text-[#888888]"
              >
                $ CANCEL
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || keywords.length === 0 || isSaving}
                className={cn(
                  "font-terminal text-xs border",
                  name.trim() && keywords.length > 0
                    ? "bg-[#00d4aa] text-[#0a0a0f] border-[#00d4aa] hover:bg-[#00d4aa]/90"
                    : "bg-transparent border-[#2a2a30] text-[#555555]"
                )}
              >
                {isSaving ? "SAVING..." : "┌ SAVE ┐"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
