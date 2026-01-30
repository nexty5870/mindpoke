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
  savedX?: number | null;
  savedY?: number | null;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
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
  
  // 3. Semantic relationships (hardcoded common pairs in AI/tech)
  const semanticPairs: [string[], string[], number][] = [
    [["llm", "llama", "ollama", "mistral", "local llm"], ["ai", "artificial intelligence", "machine learning"], 1.5],
    [["claude", "anthropic", "claude code"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["gpt", "openai", "chatgpt"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["agent", "agents", "ai agents", "autonomous"], ["ai", "artificial intelligence", "llm"], 1.5],
    [["claude", "anthropic"], ["agent", "agents", "ai agents"], 1],
    [["langchain", "autogpt", "crewai"], ["agent", "agents", "ai agents"], 1.5],
    [["rag", "retrieval"], ["llm", "embedding", "vector"], 1],
    [["embedding", "embeddings"], ["vector", "ai", "llm"], 1],
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
      if (!reasons.includes(matchedTerms.join("↔"))) {
        reasons.push(matchedTerms.join("↔"));
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
async function saveNodePosition(interestId: string, x: number, y: number) {
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
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number } | null>(null);
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

  // Build graph data
  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = interests.map((interest, index) => {
      const discoveryCount = discoveries.filter(
        (d) => d.matchedInterests.includes(interest.id) && d.status === "new"
      ).length;
      const heatLevel = Math.round(
        (interest.engagementCount / (interest.engagementCount + interest.dismissCount + 1)) * 5
      );

      // Use saved position or calculate default
      const hasPosition = interest.positionX != null && interest.positionY != null;
      const defaultAngle = (index / interests.length) * 2 * Math.PI - Math.PI / 2;
      const defaultRadius = 150;
      
      return {
        id: interest.id,
        interest,
        discoveryCount,
        heatLevel,
        savedX: interest.positionX,
        savedY: interest.positionY,
        x: hasPosition ? interest.positionX! : dimensions.width / 2 + Math.cos(defaultAngle) * defaultRadius,
        y: hasPosition ? interest.positionY! : dimensions.height / 2 + Math.sin(defaultAngle) * defaultRadius,
        // Fix position if saved
        fx: hasPosition ? interest.positionX! : undefined,
        fy: hasPosition ? interest.positionY! : undefined,
      };
    });

    // Build links based on connections
    const graphLinks: GraphLink[] = [];
    
    for (let i = 0; i < interests.length; i++) {
      for (let j = i + 1; j < interests.length; j++) {
        const connection = calculateConnections(interests[i], interests[j]);
        if (connection) {
          graphLinks.push({
            id: `${interests[i].id}-${interests[j].id}`,
            source: interests[i].id,
            target: interests[j].id,
            strength: connection.strength,
            reason: connection.reason,
          });
        }
      }
    }

    console.log("[graph] Built", graphNodes.length, "nodes and", graphLinks.length, "links");
    graphLinks.forEach(l => console.log("[graph] Link:", l.reason, "strength:", l.strength));

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
        .distance(d => Math.max(120, 200 - (d as GraphLink).strength * 20))
        .strength(d => Math.min(1, 0.2 + (d as GraphLink).strength * 0.15))
      )
      .force("charge", forceManyBody<GraphNode>()
        .strength(-300)
        .distanceMax(400)
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
      .force("collision", forceCollide<GraphNode>().radius(90))
      .force("x", forceX(dimensions.width / 2).strength(0.03))
      .force("y", forceY(dimensions.height / 2).strength(0.03))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulation.on("tick", () => {
      setNodes([...simulation.nodes()]);
      setLinks([...graphData.links] as GraphLink[]);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
    
    if (simulationRef.current) {
      const node = simulationRef.current.nodes().find(n => n.id === nodeId);
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
      }
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  // Handle drag move
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

  // Handle drag end - save position
  const handleMouseUp = useCallback(() => {
    if (!dragRef.current || !simulationRef.current) return;
    
    const nodeId = dragRef.current.nodeId;
    const node = simulationRef.current.nodes().find(n => n.id === nodeId);
    
    if (node && node.fx != null && node.fy != null) {
      // Keep position fixed (user placed it there)
      const x = node.fx;
      const y = node.fy;
      
      // Debounce save
      if (positionSaveTimeout.current) {
        clearTimeout(positionSaveTimeout.current);
      }
      positionSaveTimeout.current = setTimeout(() => {
        saveNodePosition(nodeId, x, y);
        console.log("[graph] Saved position for", nodeId, "at", x, y);
      }, 500);
    }
    
    simulationRef.current.alphaTarget(0);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // Reset node position (double-click)
  const handleDoubleClick = useCallback((nodeId: string) => {
    if (!simulationRef.current) return;
    
    const node = simulationRef.current.nodes().find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
      simulationRef.current.alpha(0.5).restart();
      
      // Clear saved position
      saveNodePosition(nodeId, null as any, null as any);
      console.log("[graph] Reset position for", nodeId);
    }
  }, []);

  // Get link path
  const getLinkPath = useCallback((link: GraphLink) => {
    const source = typeof link.source === "object" ? link.source : nodes.find(n => n.id === link.source);
    const target = typeof link.target === "object" ? link.target : nodes.find(n => n.id === link.target);
    
    if (!source?.x || !source?.y || !target?.x || !target?.y) return "";
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }, [nodes]);

  // Check if link is highlighted
  const isLinkHighlighted = useCallback((link: GraphLink) => {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    const activeId = hoveredNode || selectedInterest;
    return activeId && (sourceId === activeId || targetId === activeId);
  }, [hoveredNode, selectedInterest]);

  // Get connections for a node
  const getNodeConnections = useCallback((nodeId: string) => {
    return links.filter(l => {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      return sId === nodeId || tId === nodeId;
    });
  }, [links]);

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
          NODES: {nodes.length} | EDGES: {links.length}
        </div>
      </div>

      {/* Connection info on hover */}
      {hoveredNode && getNodeConnections(hoveredNode).length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-[#111113] border border-[#2a2a30] p-3 max-w-xs">
          <div className="font-terminal text-[10px] text-[#555555] mb-2">$ CONNECTIONS</div>
          {getNodeConnections(hoveredNode).map(l => {
            const otherId = (typeof l.source === "object" ? l.source.id : l.source) === hoveredNode
              ? (typeof l.target === "object" ? l.target.id : l.target)
              : (typeof l.source === "object" ? l.source.id : l.source);
            const otherNode = nodes.find(n => n.id === otherId);
            return (
              <div key={l.id} className="font-terminal text-xs text-[#888888] mb-1">
                <span className="text-[#00d4aa]">→</span> {otherNode?.interest.name}
                <span className="text-[#555555] ml-2">({l.reason})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* SVG Layer for links */}
      <svg className="absolute inset-0 pointer-events-none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
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
            const opacity = highlighted ? 0.8 : 0.15 + link.strength * 0.1;
            const width = Math.min(5, 1.5 + link.strength * 0.5);
            
            return (
              <g key={link.id}>
                {/* Glow effect for highlighted */}
                {highlighted && (
                  <path
                    d={getLinkPath(link)}
                    fill="none"
                    stroke="#00d4aa"
                    strokeWidth={width + 4}
                    opacity={0.3}
                    filter="url(#glow)"
                  />
                )}
                <path
                  d={getLinkPath(link)}
                  fill="none"
                  stroke={highlighted ? "#00d4aa" : "#00d4aa"}
                  strokeWidth={width}
                  opacity={opacity}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Nodes */}
      <AnimatePresence>
        {nodes.map((node) => {
          const isSelected = node.id === selectedInterest;
          const isHovered = node.id === hoveredNode;
          const connections = getNodeConnections(node.id);
          const isConnectedToActive = connections.some(l => {
            const sId = typeof l.source === "object" ? l.source.id : l.source;
            const tId = typeof l.target === "object" ? l.target.id : l.target;
            const activeId = hoveredNode || selectedInterest;
            return activeId && (sId === activeId || tId === activeId);
          });
          const isActive = isSelected || isHovered || isConnectedToActive;
          const isFixed = node.fx != null && node.fy != null;

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
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 400,
                x: { type: "spring", damping: 30, stiffness: 500 },
                y: { type: "spring", damping: 30, stiffness: 500 },
              }}
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
              <div
                className={cn(
                  "relative border transition-all duration-200 min-w-[140px]",
                  isSelected
                    ? "border-[#00d4aa] bg-[#0a0a0f] shadow-[0_0_25px_rgba(0,212,170,0.4)]"
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

                <div className="px-4 py-3">
                  {/* Heat bars */}
                  <div className="flex gap-[2px] mb-2 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-[3px] transition-all duration-300",
                          i < node.heatLevel
                            ? "h-3 bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                            : "h-2 bg-[#2a2a30]"
                        )}
                      />
                    ))}
                  </div>

                  {/* Name */}
                  <h3 className={cn(
                    "font-serif text-sm text-center font-semibold whitespace-nowrap",
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
                )}>
                  {node.interest.priority}
                </div>

                {/* Connection count badge */}
                {connections.length > 0 && (
                  <div className="absolute -bottom-2 -left-2 w-5 h-5 flex items-center justify-center font-terminal text-[9px] border border-[#00d4aa] bg-[#0a0a0f] text-[#00d4aa]">
                    {connections.length}
                  </div>
                )}

                {/* Pinned indicator */}
                {isFixed && (
                  <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center font-terminal text-[9px] border border-[#888888] bg-[#0a0a0f] text-[#888888]">
                    📌
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 font-terminal text-[10px] text-[#555555]">
        DRAG: PLACE_NODE | DOUBLE-CLICK: RESET | CLICK: SELECT
      </div>

      {/* No connections message */}
      {links.length === 0 && nodes.length > 1 && (
        <div className="absolute bottom-4 right-4 font-terminal text-[10px] text-[#ffb000]">
          NO_CONNECTIONS_DETECTED — Add more interests with overlapping keywords
        </div>
      )}
    </div>
  );
}
