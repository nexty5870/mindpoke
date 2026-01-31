"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { Interest, Discovery } from "@/types";

interface DiscoveryStat {
  interestId: string;
  count: number;
}

interface InterestGraphProps {
  interests: Interest[];
  discoveries: Discovery[];
  selectedInterest: string | null;
  onSelectInterest: (id: string | null) => void;
  newDiscoveries?: DiscoveryStat[] | null;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  interest: Interest;
  discoveryCount: number;
  recentActivity: number; // 0-1 based on recent discoveries
  heatLevel: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  strength: number;
  sharedCount: number; // discoveries matching both interests
}

// Calculate connections based on shared discoveries
function calculateConnections(
  interests: Interest[],
  discoveries: Discovery[]
): GraphLink[] {
  const links: GraphLink[] = [];
  
  for (let i = 0; i < interests.length; i++) {
    for (let j = i + 1; j < interests.length; j++) {
      const a = interests[i];
      const b = interests[j];
      
      // Count discoveries that match both interests (via keywords or direct match)
      const aKeywords = new Set(a.keywords.map(k => k.toLowerCase()));
      const bKeywords = new Set(b.keywords.map(k => k.toLowerCase()));
      
      // Check for keyword overlap
      let overlap = 0;
      aKeywords.forEach(kw => {
        if (bKeywords.has(kw)) overlap += 2;
        bKeywords.forEach(bkw => {
          if (kw.includes(bkw) || bkw.includes(kw)) overlap += 0.5;
        });
      });
      
      // Count shared discoveries
      const sharedDiscoveries = discoveries.filter(d => {
        const content = (d.title + ' ' + d.content).toLowerCase();
        const matchesA = a.keywords.some(k => content.includes(k.toLowerCase()));
        const matchesB = b.keywords.some(k => content.includes(k.toLowerCase()));
        return matchesA && matchesB;
      }).length;
      
      const strength = overlap + sharedDiscoveries * 0.5;
      
      if (strength > 0.5) {
        links.push({
          id: `${a.id}-${b.id}`,
          source: a.id as any,
          target: b.id as any,
          strength: Math.min(strength, 10),
          sharedCount: sharedDiscoveries,
        });
      }
    }
  }
  
  return links;
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
  newDiscoveries,
}: InterestGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pulsingNodes, setPulsingNodes] = useState<Set<string>>(new Set());
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const dragRef = useRef<{ nodeId: string } | null>(null);
  const positionSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Trigger pulse animations when new discoveries arrive
  useEffect(() => {
    if (newDiscoveries && newDiscoveries.length > 0) {
      const newPulsing = new Set(newDiscoveries.filter(d => d.count > 0).map(d => d.interestId));
      setPulsingNodes(newPulsing);
      const timeout = setTimeout(() => setPulsingNodes(new Set()), 3000);
      return () => clearTimeout(timeout);
    }
  }, [newDiscoveries]);

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
    // Calculate recent activity (discoveries in last 24h)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const graphNodes: GraphNode[] = interests.map((interest, index) => {
      const matchedDiscoveries = discoveries.filter(
        d => d.matchedInterests.includes(interest.id)
      );
      const newCount = matchedDiscoveries.filter(d => d.status === "new").length;
      const recentCount = matchedDiscoveries.filter(
        d => new Date(d.publishedAt).getTime() > dayAgo
      ).length;
      
      const heatLevel = Math.min(5, Math.round(interest.heat / 20));
      const recentActivity = Math.min(1, recentCount / 10);
      
      const hasPosition = interest.positionX != null && interest.positionY != null;
      const angle = (index / Math.max(interests.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.25;
      
      return {
        id: interest.id,
        interest,
        discoveryCount: newCount,
        recentActivity,
        heatLevel,
        x: hasPosition ? interest.positionX! : dimensions.width / 2 + Math.cos(angle) * radius,
        y: hasPosition ? interest.positionY! : dimensions.height / 2 + Math.sin(angle) * radius,
        fx: hasPosition ? interest.positionX! : undefined,
        fy: hasPosition ? interest.positionY! : undefined,
      };
    });

    const graphLinks = calculateConnections(interests, discoveries);
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
        .distance(d => Math.max(120, 200 - d.strength * 10))
        .strength(d => Math.min(0.7, 0.1 + d.strength * 0.05))
      )
      .force("charge", forceManyBody<GraphNode>().strength(-400).distanceMax(400))
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
      .force("collision", forceCollide<GraphNode>().radius(90))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulation.on("tick", () => {
      setNodes(simulation.nodes().map(n => ({ ...n })));
      setLinks(graphData.links.map(l => ({ ...l })));
    });

    simulationRef.current = simulation;
    return () => { simulation.stop(); };
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
      if (positionSaveTimeout.current) clearTimeout(positionSaveTimeout.current);
      positionSaveTimeout.current = setTimeout(() => {
        saveNodePosition(nodeId, node.fx!, node.fy!);
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

  // Reset all nodes to auto-layout
  const handleResetLayout = useCallback(() => {
    if (!simulationRef.current) return;
    
    // Clear all fixed positions
    simulationRef.current.nodes().forEach(node => {
      node.fx = null;
      node.fy = null;
      // Save cleared position to API
      saveNodePosition(node.id, null, null);
    });
    
    // Restart simulation with high energy
    simulationRef.current.alpha(1).restart();
  }, []);

  // Get node position by ID for link rendering
  const getNodePos = (nodeOrId: GraphNode | string) => {
    if (typeof nodeOrId === 'string') {
      const node = nodes.find(n => n.id === nodeOrId);
      return node ? { x: node.x || 0, y: node.y || 0 } : { x: 0, y: 0 };
    }
    return { x: nodeOrId.x || 0, y: nodeOrId.y || 0 };
  };

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
        <div>$ INTEREST_NETWORK :: LIVE</div>
        <div className="text-[#00d4aa]">
          NODES: {nodes.length} | EDGES: {links.length} | ACTIVITY: {discoveries.filter(d => d.status === 'new').length}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleResetLayout}
          className="px-3 py-1.5 border border-[#2a2a30] bg-[#111113] hover:border-[#00d4aa] hover:bg-[#00d4aa]/10 font-terminal text-[10px] text-[#888888] hover:text-[#00d4aa] transition-colors flex items-center gap-2"
          title="Auto-organize all nodes"
        >
          <Icon icon="carbon:reset" className="w-3 h-3" />
          RESET_LAYOUT
        </button>
      </div>

      {/* SVG Layer - Grid + Connections */}
      <svg 
        className="absolute inset-0" 
        style={{ zIndex: 1 }}
        width={dimensions.width} 
        height={dimensions.height}
      >
        {/* Definitions for gradients and filters */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(42, 42, 48, 0.3)" strokeWidth="1"/>
          </pattern>
          
          {/* Glow filter for active connections */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Animated dash pattern */}
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.1"/>
            <stop offset="50%" stopColor="#00d4aa" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.1"/>
          </linearGradient>
        </defs>
        
        {/* Grid background */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Connection lines */}
        <g className="connections">
          {links.map(link => {
            const source = getNodePos(link.source as any);
            const target = getNodePos(link.target as any);
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
            const isHighlighted = hoveredNode === sourceId || hoveredNode === targetId || 
                                  selectedInterest === sourceId || selectedInterest === targetId;
            const isHovered = hoveredLink === link.id;
            const opacity = isHighlighted ? 0.8 : isHovered ? 0.6 : 0.2 + link.strength * 0.03;
            const strokeWidth = isHighlighted ? 2 + link.strength * 0.3 : 1 + link.strength * 0.2;
            
            return (
              <g key={link.id}>
                {/* Base line */}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isHighlighted ? "#00d4aa" : "#3a3a40"}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                  filter={isHighlighted ? "url(#glow)" : undefined}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: 'pointer' }}
                />
                
                {/* Animated particles on active connections */}
                {isHighlighted && link.sharedCount > 0 && (
                  <>
                    <circle r="3" fill="#00d4aa" opacity="0.8">
                      <animateMotion
                        dur={`${3 - Math.min(link.strength, 2)}s`}
                        repeatCount="indefinite"
                        path={`M${source.x},${source.y} L${target.x},${target.y}`}
                      />
                    </circle>
                    <circle r="2" fill="#ffb000" opacity="0.6">
                      <animateMotion
                        dur={`${4 - Math.min(link.strength, 2)}s`}
                        repeatCount="indefinite"
                        path={`M${target.x},${target.y} L${source.x},${source.y}`}
                      />
                    </circle>
                  </>
                )}
                
                {/* Shared count label on hover */}
                {isHovered && link.sharedCount > 0 && (
                  <g transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`}>
                    <rect x="-20" y="-10" width="40" height="20" fill="#111113" stroke="#2a2a30" rx="2"/>
                    <text 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      className="font-terminal text-[9px] fill-[#00d4aa]"
                    >
                      {link.sharedCount} shared
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Nodes Layer */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        <AnimatePresence>
          {nodes.map((node) => {
            const isSelected = node.id === selectedInterest;
            const isHovered = node.id === hoveredNode;
            const isPulsing = pulsingNodes.has(node.id);
            const isActive = isSelected || isHovered;
            const isFixed = node.fx != null;
            
            // Size based on activity
            const baseSize = 140;
            const sizeBoost = node.recentActivity * 20;
            const nodeSize = baseSize + sizeBoost;

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isPulsing ? [1, 1.1, 1] : 1,
                  opacity: 1,
                  x: (node.x || 0) - nodeSize / 2,
                  y: (node.y || 0) - 45,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ 
                  type: "spring", 
                  damping: 30, 
                  stiffness: 400,
                  scale: isPulsing ? { repeat: 2, duration: 0.5 } : undefined
                }}
                className={cn(
                  "absolute cursor-grab active:cursor-grabbing",
                  isDragging && dragRef.current?.nodeId === node.id && "z-20"
                )}
                style={{ width: nodeSize }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => !isDragging && onSelectInterest(node.id === selectedInterest ? null : node.id)}
                onDoubleClick={() => handleDoubleClick(node.id)}
              >
                {/* Pulsing ring effect */}
                {isPulsing && (
                  <motion.div
                    className="absolute inset-0 border-2 border-[#00d4aa] rounded-none"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                )}
                
                {/* Activity ring */}
                {node.recentActivity > 0.3 && (
                  <div 
                    className="absolute -inset-1 border border-[#00d4aa] opacity-30"
                    style={{
                      boxShadow: `0 0 ${10 + node.recentActivity * 15}px rgba(0,212,170,${node.recentActivity * 0.4})`
                    }}
                  />
                )}

                <div className={cn(
                  "relative border transition-all duration-200",
                  isSelected
                    ? "border-[#00d4aa] bg-[#0a0a0f] shadow-[0_0_30px_rgba(0,212,170,0.5)]"
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
                    {/* Heat visualization - animated bars */}
                    <div className="flex gap-[2px] mb-2 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <motion.div 
                          key={i} 
                          className={cn(
                            "w-[3px] transition-all",
                            i < node.heatLevel
                              ? "bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                              : "bg-[#2a2a30]"
                          )}
                          initial={{ height: 8 }}
                          animate={{ 
                            height: i < node.heatLevel ? 12 + (isPulsing ? 4 : 0) : 8 
                          }}
                          transition={{ 
                            repeat: isPulsing ? Infinity : 0, 
                            repeatType: "reverse",
                            duration: 0.3,
                            delay: i * 0.05
                          }}
                        />
                      ))}
                    </div>

                    <h3 className={cn(
                      "font-serif text-sm text-center font-semibold whitespace-nowrap",
                      isSelected ? "text-white" : "text-[#e6e6e6]"
                    )}>{node.interest.name}</h3>

                    {/* Stats row */}
                    <div className="font-terminal text-[9px] text-[#555555] text-center mt-1 flex justify-center gap-2">
                      <span>H:{Math.round(node.interest.heat)}</span>
                      <span>•</span>
                      <span>E:{node.interest.engagementCount}</span>
                    </div>

                    {/* New discoveries badge */}
                    {node.discoveryCount > 0 && (
                      <motion.div 
                        className="flex items-center justify-center gap-1 mt-1.5 font-terminal text-[9px]"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <span className="w-1.5 h-1.5 bg-[#ffb000]" />
                        <span className="text-[#ffb000]">{node.discoveryCount} NEW</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Priority badge */}
                  <div className={cn(
                    "absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center font-terminal text-[9px] border bg-[#0a0a0f]",
                    node.interest.priority >= 5 ? "border-[#ff4444] text-[#ff4444]"
                      : node.interest.priority >= 4 ? "border-[#ffb000] text-[#ffb000]"
                      : "border-[#2a2a30] text-[#888888]"
                  )}>{node.interest.priority}</div>

                  {/* Pinned indicator */}
                  {isFixed && (
                    <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center border border-[#00d4aa] bg-[#0a0a0f]">
                      <Icon icon="icon-park-twotone:pin" className="w-3 h-3 text-[#00d4aa]" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 font-terminal text-[9px] text-[#555555] bg-[#111113]/80 border border-[#2a2a30] p-3">
        <div className="text-[#888888] mb-2">LEGEND</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-[2px] bg-[#3a3a40]" />
          <span>weak link</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-[2px] bg-[#00d4aa]" />
          <span>strong link</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
          <span>active flow</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 font-terminal text-[10px] text-[#555555]">
        DRAG: PLACE | DBL-CLICK: UNPIN | HOVER: CONNECTIONS
      </div>
    </div>
  );
}
