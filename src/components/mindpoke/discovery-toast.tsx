"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Toast {
  id: string;
  count: number;
  x: number;
  y: number;
}

interface DiscoveryToastProps {
  count: number | null; // null = no toast, number = show toast with count
  onComplete?: () => void;
}

export function DiscoveryToast({ count, onComplete }: DiscoveryToastProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (count !== null && count > 0) {
      // Random position in the center-ish area of the screen
      const x = 40 + Math.random() * 20; // 40-60% from left
      const y = 30 + Math.random() * 20; // 30-50% from top
      
      const newToast: Toast = {
        id: `toast-${Date.now()}`,
        count,
        x,
        y,
      };
      
      setToasts(prev => [...prev, newToast]);
      
      // Remove toast after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
        onComplete?.();
      }, 2000);
    }
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ 
              opacity: 0, 
              y: 0,
              scale: 0.5,
            }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: -150,
              scale: [0.5, 1.2, 1, 0.8],
            }}
            transition={{ 
              duration: 2,
              ease: "easeOut",
              times: [0, 0.1, 0.7, 1],
            }}
            style={{
              position: "absolute",
              left: `${toast.x}%`,
              top: `${toast.y}%`,
            }}
            className="flex flex-col items-center"
          >
            {/* Main count */}
            <div className="font-terminal text-4xl font-bold text-[#00d4aa] drop-shadow-[0_0_20px_rgba(0,212,170,0.8)]">
              +{toast.count}
            </div>
            
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-terminal text-sm text-[#ffb000] tracking-widest drop-shadow-[0_0_10px_rgba(255,176,0,0.6)]"
            >
              {toast.count === 1 ? "DISCOVERY" : "DISCOVERIES"}
            </motion.div>

            {/* Pixel sparkles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="absolute -top-2 -right-4 text-[#ffb000] text-xl"
            >
              ✦
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute -top-1 -left-3 text-[#00d4aa] text-sm"
            >
              ✦
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Multi-toast variant for showing discoveries per interest
export function DiscoveryToastStack({ 
  discoveries 
}: { 
  discoveries: { interestName: string; count: number }[] | null 
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string; count: number; delay: number }>>([]);

  useEffect(() => {
    if (discoveries && discoveries.length > 0) {
      const newItems = discoveries
        .filter(d => d.count > 0)
        .map((d, i) => ({
          id: `${Date.now()}-${i}`,
          name: d.interestName,
          count: d.count,
          delay: i * 0.15,
        }));
      
      setItems(newItems);
      
      // Clear after animations complete
      setTimeout(() => {
        setItems([]);
      }, 2500 + discoveries.length * 150);
    }
  }, [discoveries]);

  return (
    <div className="fixed top-20 right-6 pointer-events-none z-50 space-y-2">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ 
              duration: 0.4,
              delay: item.delay,
            }}
            className="flex items-center gap-3 bg-[#111113]/90 border border-[#2a2a30] px-4 py-2 backdrop-blur-sm"
          >
            <span className="font-terminal text-2xl font-bold text-[#00d4aa]">
              +{item.count}
            </span>
            <div className="flex flex-col">
              <span className="font-terminal text-[10px] text-[#555555]">NEW</span>
              <span className="font-terminal text-xs text-[#e6e6e6]">
                {item.name.toUpperCase()}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
