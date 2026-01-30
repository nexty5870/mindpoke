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
import { Icon } from "@iconify/react";
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
  strength: number;
  reason: string;
}

// Calculate connections between interests
function calculateConnections(a: Interest, b: Interest): { strength: number; reason: string } | null {
  const aKeywords = a.keywords.map(k => k.toLowerCase());
  const bKeywords = b.keywords.map(k => k.toLowerCase());
  const aName = a.name.toLowerCase();
  const bName = b.name.toLowerCase();
  
  const reasons: string[] = [];
  let strength = 0;
  
  // 1. Direct keyword overlap
  aKeywords.forEach(aKw => {
    bKeywords.forEach(bKw => {
      if (aKw === bKw) {
        reasons.push(aKw);
        strength += 2;
      } else if (aKw.includes(bKw) || bKw.includes(aKw)) {
        reasons.push(`${aKw}~${bKw}`);
        strength += 1;
      }
    });
  });
  
  // 2. Name in keywords
  if (aKeywords.some(k => k.includes(bName) || bName.includes(k))) {
    reasons.push(`name:${bName}`);
    strength += 1.5;
  }
  if (bKeywords.some(k => k.includes(aName) || aName.includes(k))) {
    reasons.push(`name:${aName}`);
    strength += 1.5;
  }
  
  // 3. Semantic relationships
  const semanticPairs: [string[], string[], number][] = [
    [["llm", "llama", "ollama", "mistral", "local llm"], ["ai", "artificial intelligence", "machine learning"], 1.5],
    [["claude", "anthropic", "claude code"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["gpt", "openai", "chatgpt"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["agent", "agents", "ai agents", "autonomous"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["claude", "anthropic"], ["agent", "agents", "ai agents"], 1],
    [["langchain", "autogpt", "crewai"], ["agent", "agents", "ai agents"], 1.5],
  ];
  
  const allATerms = [...aKeywords, aName];
  const allBTerms = [...bKeywords, bName];
  
  semanticPairs.forEach(([group1, group2, weight]) => {
    const aHasGroup1 = allATerms.some(t => group1.some(g => t.includes(g) || g.includes(t)));
    const aHasGroup2 = allATerms.some(t => group2.some(g => t.includes(g) || g.includes(t)));
    const bHasGroup1 = allBTerms.some(t => group1.some(g => t.includes(g) || g.includes(t)));
    const bHasGroup2 = allBTerms.some(t => group2.some(g => t.includes(g) || g.includes(t)));
    
    if ((aHasGroup1 && bHasGroup2) || (aHasGroup2 && bHasGroup1)) {
      const matchedTerms = [
        ...group1.filter(g => allATerms.some(t => t.includes(g)) || allBTerms.some(t => t.includes(g))),
        ...group2.filter(g => allATerms.some(t => t.includes(g)) || allBTerms.some(t => t.includes(g))),
      ].slice(0, 2);
      const key = matchedTerms.join("↔");
      if (!reasons.includes(key)) {
        reasons.push(key);
        strength += weight;
      }
    }
  });
  
  if (strength > 0) {
    return { strength, reason: reasons.slice(0, 3).join(", ") };
  }
  return null;
}

// Save position to API
async function saveNodePosition(interestId: string, x: number | null, y: number | null) {
  try {
    await fetch(`/api/interests/${interestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionX: x, positionY: y }),
    });
  } catch (e) {
    console.error("Failed to save position:", e);
  }
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
  const dragRef = useRef<{ nodeId: string } | null>(null);
  const positionSaveTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Build initial graph data
  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = interests.map((interest, index) => {
      const discoveryCount = discoveries.filter(
        (d) => d.matchedInterests.includes(interest.id) && d.status === "new"
      ).length;
      const heatLevel = Math.round(
        (interest.engagementCount / (interest.engagementCount + interest.dismissCount + 1)) * 5
      );
      
      const hasPosition = interest.positionX != null && interest.positionY != null;
      const angle = (index / Math.max(interests.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = 150;
      
      return {
        id: interest.id,
        interest,
        discoveryCount,
        heatLevel,
        x: hasPosition ? interest.positionX! : dimensions.width / 2 + Math.cos(angle) * radius,
        y: hasPosition ? interest.positionY! : dimensions.height / 2 + Math.sin(angle) * radius,
        fx: hasPosition ? interest.positionX! : undefined,
        fy: hasPosition ? interest.positionY! : undefined,
      };
    });

    const graphLinks: GraphLink[] = [];
    for (let i = 0; i < interests.length; i++) {
      for (let j = i + 1; j < interests.length; j++) {
        const connection = calculateConnections(interests[i], interests[j]);
        if (connection) {
          graphLinks.push({
            id: `${interests[i].id}-${interests[j].id}`,
            source: interests[i].id as any,
            target: interests[j].id as any,
            strength: connection.strength,
            reason: connection.reason,
          });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [interests, discoveries, dimensions]);

  // Initialize simulation
  useEffect(() => {
    if (graphData.nodes.length === 0) return;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = forceSimulation<GraphNode>(graphData.nodes)
      .force("link", forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(d => Math.max(100, 180 - d.strength * 15))
        .strength(d => Math.min(0.8, 0.15 + d.strength * 0.1))
      )
      .force("charge", forceManyBody<GraphNode>().strength(-250).distanceMax(350))
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.03))
      .force("collision", forceCollide<GraphNode>().radius(85))
      .force("x", forceX(dimensions.width / 2).strength(0.02))
      .force("y", forceY(dimensions.height / 2).strength(0.02))
      .alphaDecay(0.015)
      .velocityDecay(0.35);

    simulation.on("tick", () => {
      // Update state with current positions - spread to trigger re-render
      setNodes(simulation.nodes().map(n => ({ ...n })));
      // Links now have resolved source/target objects from d3
      setLinks(graphData.links.map(l => ({ ...l })));
    });

    simulationRef.current = simulation;

    return () => simulation.stop();
  }, [graphData, dimensions]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { nodeId };
    
    if (simulationRef.current) {
      const node = simulationRef.current.nodes().find(n => n.id === nodeId);
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
      }
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || !simulationRef.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const node = simulationRef.current.nodes().find(n => n.id === dragRef.current!.nodeId);
    if (node) {
      node.fx = e.clientX - rect.left;
      node.fy = e.clientY - rect.top;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current || !simulationRef.current) return;
    
    const nodeId = dragRef.current.nodeId;
    const node = simulationRef.current.nodes().find(n => n.id === nodeId);
    
    if (node && node.fx != null && node.fy != null) {
      const x = node.fx;
      const y = node.fy;
      
      if (positionSaveTimeout.current) clearTimeout(positionSaveTimeout.current);
      positionSaveTimeout.current = setTimeout(() => {
        saveNodePosition(nodeId, x, y);
      }, 500);
    }
    
    simulationRef.current.alphaTarget(0);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback((nodeId: string) => {
    if (!simulationRef.current) return;
    
    const node = simulationRef.current.nodes().find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
      simulationRef.current.alpha(0.5).restart();
      saveNodePosition(nodeId, null, null);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#0a0a0f] relative overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 font-terminal text-[10px] text-[#555555]">
        <div>$ GRAPH_RENDER :: FORCE_DIRECTED</div>
        <div className="text-[#00d4aa]">NODES: {nodes.length} | PHYSICS: ACTIVE</div>
      </div>

      {/* SVG for grid background */}
      <svg 
        className="absolute inset-0 pointer-events-none" 
        style={{ zIndex: 1 }}
        width={dimensions.width} 
        height={dimensions.height}
      >
        {/* Grid */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(42, 42, 48, 0.3)" strokeWidth="1"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Nodes */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        <AnimatePresence>
          {nodes.map((node) => {
            const isSelected = node.id === selectedInterest;
            const isHovered = node.id === hoveredNode;
            const isActive = isSelected || isHovered;
            const isFixed = node.fx != null;

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x: (node.x || 0) - 70,
                  y: (node.y || 0) - 45,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                className={cn(
                  "absolute cursor-grab active:cursor-grabbing",
                  isDragging && dragRef.current?.nodeId === node.id && "z-20"
                )}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => !isDragging && onSelectInterest(node.id === selectedInterest ? null : node.id)}
                onDoubleClick={() => handleDoubleClick(node.id)}
              >
                <div className={cn(
                  "relative border transition-all duration-200 min-w-[140px]",
                  isSelected
                    ? "border-[#00d4aa] bg-[#0a0a0f] shadow-[0_0_25px_rgba(0,212,170,0.4)]"
                    : isActive
                    ? "border-[#3a3a40] bg-[#111113]"
                    : "border-[#2a2a30] bg-[#111113] hover:border-[#3a3a40]"
                )}>
                  {/* ASCII corners */}
                  {["┌", "┐", "└", "┘"].map((char, i) => (
                    <span key={i} className={cn(
                      "absolute font-terminal text-[10px]",
                      isSelected ? "text-[#00d4aa]" : "text-[#2a2a30]",
                      i === 0 && "-top-[1px] -left-[1px]",
                      i === 1 && "-top-[1px] -right-[1px]",
                      i === 2 && "-bottom-[1px] -left-[1px]",
                      i === 3 && "-bottom-[1px] -right-[1px]",
                    )}>{char}</span>
                  ))}

                  <div className="px-4 py-3">
                    {/* Heat bars */}
                    <div className="flex gap-[2px] mb-2 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={cn(
                          "w-[3px] transition-all",
                          i < node.heatLevel
                            ? "h-3 bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                            : "h-2 bg-[#2a2a30]"
                        )}/>
                      ))}
                    </div>

                    <h3 className={cn(
                      "font-serif text-sm text-center font-semibold whitespace-nowrap",
                      isSelected ? "text-white" : "text-[#e6e6e6]"
                    )}>{node.interest.name}</h3>

                    <div className="font-terminal text-[9px] text-[#555555] text-center mt-1">
                      PRI:{node.interest.priority} | ENG:{node.interest.engagementCount}
                    </div>

                    {node.discoveryCount > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1.5 font-terminal text-[9px]">
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
                  )}>{node.interest.priority}</div>

                  {/* Pinned/Locked indicator */}
                  {isFixed && (
                    <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center border border-[#00d4aa] bg-[#0a0a0f]">
                      <Icon icon="ph:crosshair-simple-bold" className="w-3 h-3 text-[#00d4aa]" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 font-terminal text-[10px] text-[#555555]">
        DRAG: PLACE_NODE | DOUBLE-CLICK: RESET | CLICK: SELECT
      </div>
    </div>
  );
}
