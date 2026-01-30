"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Interest, Discovery } from "@/types";

interface InterestGraphProps {
  interests: Interest[];
  discoveries: Discovery[];
  selectedInterest: string | null;
  onSelectInterest: (id: string | null) => void;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  interest: Interest;
  discoveryCount: number;
  heatLevel: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
  sharedKeywords: string[];
}

// Calculate keyword overlap between two interests
function calculateKeywordOverlap(a: Interest, b: Interest): { strength: number; shared: string[] } {
  const aKeywords = new Set(a.keywords.map(k => k.toLowerCase()));
  const bKeywords = new Set(b.keywords.map(k => k.toLowerCase()));
  
  const shared: string[] = [];
  
  // Direct keyword matches
  aKeywords.forEach(kw => {
    if (bKeywords.has(kw)) shared.push(kw);
  });
  
  // Partial matches (one keyword contains another)
  a.keywords.forEach(aKw => {
    b.keywords.forEach(bKw => {
      const aLower = aKw.toLowerCase();
      const bLower = bKw.toLowerCase();
      if (aLower !== bLower && (aLower.includes(bLower) || bLower.includes(aLower))) {
        const match = aLower.length > bLower.length ? bLower : aLower;
        if (!shared.includes(match)) shared.push(match);
      }
    });
  });
  
  // Semantic similarity hints (common AI/tech term relationships)
  const semanticPairs: [string, string][] = [
    ["llm", "ai"], ["llm", "claude"], ["llm", "gpt"], 
    ["agent", "autonomous"], ["agent", "ai"],
    ["claude", "anthropic"], ["claude", "ai"],
    ["embedding", "vector"], ["rag", "memory"],
  ];
  
  semanticPairs.forEach(([term1, term2]) => {
    const has1 = a.keywords.some(k => k.toLowerCase().includes(term1)) || 
                 b.keywords.some(k => k.toLowerCase().includes(term1));
    const has2 = a.keywords.some(k => k.toLowerCase().includes(term2)) || 
                 b.keywords.some(k => k.toLowerCase().includes(term2));
    if (has1 && has2 && !shared.includes(`${term1}↔${term2}`)) {
      shared.push(`${term1}↔${term2}`);
    }
  });
  
  return {
    strength: shared.length,
    shared,
  };
}

export function InterestGraph({
  interests,
  discoveries,
  selectedInterest,
  onSelectInterest,
}: InterestGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number } | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Build graph data
  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = interests.map((interest) => {
      const discoveryCount = discoveries.filter(
        (d) => d.matchedInterests.includes(interest.id) && d.status === "new"
      ).length;
      const heatLevel = Math.round(
        (interest.engagementCount / (interest.engagementCount + interest.dismissCount + 1)) * 5
      );

      return {
        id: interest.id,
        interest,
        discoveryCount,
        heatLevel,
        // Initial random position
        x: dimensions.width / 2 + (Math.random() - 0.5) * 200,
        y: dimensions.height / 2 + (Math.random() - 0.5) * 200,
      };
    });

    // Build links based on keyword overlap + shared discoveries
    const graphLinks: GraphLink[] = [];
    const discoveryConnections = new Map<string, number>();

    // Count shared discoveries
    discoveries.forEach((discovery) => {
      const matched = discovery.matchedInterests;
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const key = [matched[i], matched[j]].sort().join("-");
          discoveryConnections.set(key, (discoveryConnections.get(key) || 0) + 1);
        }
      }
    });

    // Create links
    for (let i = 0; i < interests.length; i++) {
      for (let j = i + 1; j < interests.length; j++) {
        const a = interests[i];
        const b = interests[j];
        const { strength: keywordStrength, shared } = calculateKeywordOverlap(a, b);
        const discoveryStrength = discoveryConnections.get([a.id, b.id].sort().join("-")) || 0;
        
        const totalStrength = keywordStrength + discoveryStrength * 0.5;
        
        if (totalStrength > 0) {
          graphLinks.push({
            id: `${a.id}-${b.id}`,
            source: a.id,
            target: b.id,
            strength: totalStrength,
            sharedKeywords: shared,
          });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [interests, discoveries, dimensions]);

  // Initialize and run force simulation
  useEffect(() => {
    if (graphData.nodes.length === 0) return;

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = forceSimulation<GraphNode>(graphData.nodes)
      .force("link", forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(d => 180 - (d as GraphLink).strength * 15)
        .strength(d => Math.min(0.8, 0.1 + (d as GraphLink).strength * 0.1))
      )
      .force("charge", forceManyBody<GraphNode>()
        .strength(-400)
        .distanceMax(350)
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", forceCollide<GraphNode>().radius(80))
      .force("x", forceX(dimensions.width / 2).strength(0.05))
      .force("y", forceY(dimensions.height / 2).strength(0.05))
      .alphaDecay(0.01)
      .velocityDecay(0.3);

    simulation.on("tick", () => {
      setNodes([...simulation.nodes()]);
      setLinks([...graphData.links] as GraphLink[]);
    });

    simulationRef.current = simulation;

    // Gentle continuous movement
    const interval = setInterval(() => {
      if (!isDragging && simulation.alpha() < 0.05) {
        simulation.alpha(0.1).restart();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      simulation.stop();
    };
  }, [graphData, dimensions, isDragging]);

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
    
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || !simulationRef.current) return;
    
    const node = simulationRef.current.nodes().find(n => n.id === dragRef.current!.nodeId);
    if (node) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        node.fx = e.clientX - rect.left;
        node.fy = e.clientY - rect.top;
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current || !simulationRef.current) return;
    
    const node = simulationRef.current.nodes().find(n => n.id === dragRef.current!.nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    
    simulationRef.current.alphaTarget(0);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // Get link positions
  const getLinkPath = useCallback((link: GraphLink) => {
    const source = typeof link.source === "object" ? link.source : nodes.find(n => n.id === link.source);
    const target = typeof link.target === "object" ? link.target : nodes.find(n => n.id === link.target);
    
    if (!source?.x || !source?.y || !target?.x || !target?.y) return "";
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }, [nodes]);

  // Check if link is connected to hovered or selected node
  const isLinkHighlighted = useCallback((link: GraphLink) => {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    const activeId = hoveredNode || selectedInterest;
    return activeId && (sourceId === activeId || targetId === activeId);
  }, [hoveredNode, selectedInterest]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#0a0a0f] relative overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Terminal header */}
      <div className="absolute top-4 left-4 z-10 font-terminal text-[10px] text-[#555555]">
        <div>$ GRAPH_RENDER :: FORCE_DIRECTED</div>
        <div className="text-[#00d4aa]">
          NODES: {nodes.length} | EDGES: {links.length} | PHYSICS: ACTIVE
        </div>
      </div>

      {/* Connection legend */}
      {hoveredNode && (
        <div className="absolute top-4 right-4 z-10 bg-[#111113] border border-[#2a2a30] p-3 max-w-xs">
          <div className="font-terminal text-[10px] text-[#555555] mb-2">$ CONNECTIONS</div>
          {links
            .filter(l => {
              const sId = typeof l.source === "object" ? l.source.id : l.source;
              const tId = typeof l.target === "object" ? l.target.id : l.target;
              return sId === hoveredNode || tId === hoveredNode;
            })
            .map(l => {
              const otherId = (typeof l.source === "object" ? l.source.id : l.source) === hoveredNode
                ? (typeof l.target === "object" ? l.target.id : l.target)
                : (typeof l.source === "object" ? l.source.id : l.source);
              const otherNode = nodes.find(n => n.id === otherId);
              return (
                <div key={l.id} className="font-terminal text-xs text-[#888888]">
                  → {otherNode?.interest.name}: {l.sharedKeywords.slice(0, 3).join(", ")}
                </div>
              );
            })}
        </div>
      )}

      {/* SVG Layer for links */}
      <svg className="absolute inset-0 pointer-events-none">
        <defs>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#00d4aa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Grid background */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(42, 42, 48, 0.3)" strokeWidth="1"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Links */}
        <g>
          {links.map((link) => {
            const highlighted = isLinkHighlighted(link);
            return (
              <path
                key={link.id}
                d={getLinkPath(link)}
                fill="none"
                stroke={highlighted ? "#00d4aa" : "rgba(0, 212, 170, 0.2)"}
                strokeWidth={Math.min(4, 1 + link.strength * 0.5)}
                strokeDasharray={link.strength < 2 ? "4 4" : undefined}
                filter={highlighted ? "url(#glow)" : undefined}
                style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
              />
            );
          })}
        </g>
      </svg>

      {/* Nodes */}
      <AnimatePresence>
        {nodes.map((node) => {
          const isSelected = node.id === selectedInterest;
          const isHovered = node.id === hoveredNode;
          const isConnected = links.some(l => {
            const sId = typeof l.source === "object" ? l.source.id : l.source;
            const tId = typeof l.target === "object" ? l.target.id : l.target;
            const activeId = hoveredNode || selectedInterest;
            return activeId && (sId === node.id || tId === node.id) && (sId === activeId || tId === activeId);
          });
          const isActive = isSelected || isHovered || isConnected;

          return (
            <motion.div
              key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: (node.x || 0) - 75,
                y: (node.y || 0) - 50,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={cn(
                "absolute cursor-grab active:cursor-grabbing",
                isDragging && dragRef.current?.nodeId === node.id && "z-20"
              )}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onSelectInterest(node.id === selectedInterest ? null : node.id)}
            >
              <div
                className={cn(
                  "relative border transition-all duration-200",
                  isSelected
                    ? "border-[#00d4aa] bg-[#0a0a0f] shadow-[0_0_20px_rgba(0,212,170,0.3)]"
                    : isActive
                    ? "border-[#3a3a40] bg-[#111113]"
                    : "border-[#2a2a30] bg-[#111113] hover:border-[#3a3a40]"
                )}
              >
                {/* ASCII corners */}
                <span className={cn(
                  "absolute -top-[1px] -left-[1px] font-terminal text-[10px]",
                  isSelected ? "text-[#00d4aa]" : "text-[#2a2a30]"
                )}>┌</span>
                <span className={cn(
                  "absolute -top-[1px] -right-[1px] font-terminal text-[10px]",
                  isSelected ? "text-[#00d4aa]" : "text-[#2a2a30]"
                )}>┐</span>
                <span className={cn(
                  "absolute -bottom-[1px] -left-[1px] font-terminal text-[10px]",
                  isSelected ? "text-[#00d4aa]" : "text-[#2a2a30]"
                )}>└</span>
                <span className={cn(
                  "absolute -bottom-[1px] -right-[1px] font-terminal text-[10px]",
                  isSelected ? "text-[#00d4aa]" : "text-[#2a2a30]"
                )}>┘</span>

                <div className="px-5 py-3">
                  {/* Heat bars */}
                  <div className="flex gap-[2px] mb-2 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-[3px] transition-all duration-300",
                          i < node.heatLevel
                            ? "h-4 bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                            : "h-2 bg-[#2a2a30]"
                        )}
                      />
                    ))}
                  </div>

                  {/* Name */}
                  <h3 className={cn(
                    "font-serif text-base text-center font-semibold whitespace-nowrap",
                    isSelected ? "text-white" : "text-[#e6e6e6]"
                  )}>
                    {node.interest.name}
                  </h3>

                  {/* Metadata */}
                  <div className="font-terminal text-[9px] text-[#555555] text-center mt-1">
                    PRI:{node.interest.priority} | ENG:{node.interest.engagementCount}
                  </div>

                  {/* Discovery count */}
                  {node.discoveryCount > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-2 font-terminal text-[9px]">
                      <span className="w-1.5 h-1.5 bg-[#ffb000] animate-pulse" />
                      <span className="text-[#ffb000]">{node.discoveryCount} NEW</span>
                    </div>
                  )}
                </div>

                {/* Priority badge */}
                <div className={cn(
                  "absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center font-terminal text-[9px] border bg-[#0a0a0f]",
                  node.interest.priority >= 5 ? "border-[#ff4444] text-[#ff4444]"
                    : node.interest.priority >= 4 ? "border-[#ffb000] text-[#ffb000]"
                    : "border-[#2a2a30] text-[#888888]"
                )}>
                  {node.interest.priority}
                </div>

                {/* Connection count badge */}
                {links.filter(l => {
                  const sId = typeof l.source === "object" ? l.source.id : l.source;
                  const tId = typeof l.target === "object" ? l.target.id : l.target;
                  return sId === node.id || tId === node.id;
                }).length > 0 && (
                  <div className="absolute -bottom-2 -right-2 w-5 h-5 flex items-center justify-center font-terminal text-[9px] border border-[#00d4aa] bg-[#0a0a0f] text-[#00d4aa]">
                    {links.filter(l => {
                      const sId = typeof l.source === "object" ? l.source.id : l.source;
                      const tId = typeof l.target === "object" ? l.target.id : l.target;
                      return sId === node.id || tId === node.id;
                    }).length}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 font-terminal text-[10px] text-[#555555]">
        DRAG: MOVE_NODE | CLICK: SELECT | HOVER: SHOW_CONNECTIONS
      </div>
    </div>
  );
}
