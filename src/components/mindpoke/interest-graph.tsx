"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Interest, Discovery } from "@/types";

interface InterestGraphProps {
  interests: Interest[];
  discoveries: Discovery[];
  selectedInterest: string | null;
  onSelectInterest: (id: string | null) => void;
}

// Custom Cyber-Serif node component
function InterestNode({ data, selected }: NodeProps) {
  const interest = data.interest as Interest;
  const heatLevel = data.heatLevel as number;
  const discoveryCount = data.discoveryCount as number;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("relative cursor-pointer", selected && "z-10")}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      
      {/* ASCII Corner Frame */}
      <div className={cn(
        "relative border transition-none",
        selected 
          ? "border-[#00d4aa] bg-[#0a0a0f]" 
          : "border-[#2a2a30] bg-[#111113] hover:border-[#3a3a40]"
      )}>
        {/* Top corners */}
        <span className={cn(
          "absolute -top-[1px] -left-[1px] font-terminal text-[10px]",
          selected ? "text-[#00d4aa]" : "text-[#2a2a30]"
        )}>┌</span>
        <span className={cn(
          "absolute -top-[1px] -right-[1px] font-terminal text-[10px]",
          selected ? "text-[#00d4aa]" : "text-[#2a2a30]"
        )}>┐</span>
        {/* Bottom corners */}
        <span className={cn(
          "absolute -bottom-[1px] -left-[1px] font-terminal text-[10px]",
          selected ? "text-[#00d4aa]" : "text-[#2a2a30]"
        )}>└</span>
        <span className={cn(
          "absolute -bottom-[1px] -right-[1px] font-terminal text-[10px]",
          selected ? "text-[#00d4aa]" : "text-[#2a2a30]"
        )}>┘</span>

        <div className="px-6 py-4">
          {/* Heat bars */}
          <div className="flex gap-[2px] mb-3 justify-center">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: i < heatLevel ? 16 : 8 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "w-[4px]",
                  i < heatLevel
                    ? "bg-gradient-to-t from-[#ffb000] to-[#00d4aa]"
                    : "bg-[#2a2a30]"
                )}
              />
            ))}
          </div>

          {/* Name - Serif font */}
          <h3 className={cn(
            "font-serif text-lg text-center font-semibold mb-1",
            selected ? "text-white" : "text-[#e6e6e6]"
          )}>
            {interest.name}
          </h3>

          {/* Metadata - Terminal font */}
          <div className="font-terminal text-[10px] text-[#555555] text-center">
            PRI:{interest.priority} | ENG:{interest.engagementCount}
          </div>

          {/* Discovery count badge */}
          {discoveryCount > 0 && (
            <div className="flex items-center justify-center gap-1 mt-2 font-terminal text-[10px]">
              <span className="w-2 h-2 bg-[#ffb000]" />
              <span className="text-[#ffb000]">{discoveryCount} NEW</span>
            </div>
          )}
        </div>

        {/* Priority badge - top right */}
        <div className={cn(
          "absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center font-terminal text-[10px] border bg-[#0a0a0f]",
          interest.priority >= 5
            ? "border-[#ff4444] text-[#ff4444]"
            : interest.priority >= 4
            ? "border-[#ffb000] text-[#ffb000]"
            : interest.priority >= 3
            ? "border-[#00d4aa] text-[#00d4aa]"
            : "border-[#2a2a30] text-[#888888]"
        )}>
          {interest.priority}
        </div>
      </div>
    </motion.div>
  );
}

const nodeTypes = {
  interest: InterestNode,
};

export function InterestGraph({
  interests,
  discoveries,
  selectedInterest,
  onSelectInterest,
}: InterestGraphProps) {
  // Calculate positions in a circle
  const generatePositions = useCallback((count: number) => {
    const positions: { x: number; y: number }[] = [];
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(220, 120 + count * 25);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return positions;
  }, []);

  // Build nodes
  const initialNodes = useMemo(() => {
    const positions = generatePositions(interests.length);
    
    return interests.map((interest, index) => {
      const heatLevel = Math.round(
        (interest.engagementCount /
          (interest.engagementCount + interest.dismissCount + 1)) *
          5
      );
      const discoveryCount = discoveries.filter(
        (d) => d.matchedInterests.includes(interest.id) && d.status === "new"
      ).length;

      return {
        id: interest.id,
        type: "interest",
        position: positions[index],
        data: {
          interest,
          heatLevel,
          discoveryCount,
        },
        selected: interest.id === selectedInterest,
      };
    });
  }, [interests, discoveries, selectedInterest, generatePositions]);

  // Build edges based on shared discoveries
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];
    const connectionStrengths = new Map<string, number>();

    discoveries.forEach((discovery) => {
      const matched = discovery.matchedInterests;
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const key = [matched[i], matched[j]].sort().join("-");
          connectionStrengths.set(key, (connectionStrengths.get(key) || 0) + 1);
        }
      }
    });

    connectionStrengths.forEach((strength, key) => {
      const [source, target] = key.split("-");
      edges.push({
        id: key,
        source,
        target,
        style: {
          stroke: `rgba(0, 212, 170, ${Math.min(0.6, strength * 0.15)})`,
          strokeWidth: Math.min(3, 1 + strength * 0.3),
          strokeDasharray: strength > 2 ? undefined : "4 4",
        },
      });
    });

    return edges;
  }, [discoveries]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectInterest(node.id === selectedInterest ? null : node.id);
    },
    [onSelectInterest, selectedInterest]
  );

  return (
    <div className="w-full h-full bg-[#0a0a0f] relative">
      {/* Terminal header overlay */}
      <div className="absolute top-4 left-4 z-10 font-terminal text-[10px] text-[#555555]">
        <div>$ GRAPH_RENDER :: INTEREST_MAP</div>
        <div className="text-[#00d4aa]">NODES: {interests.length} | EDGES: {edges.length}</div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0f]"
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={40}
          size={1}
          color="rgba(42, 42, 48, 0.5)"
        />
        <Controls
          className="bg-[#111113] border border-[#2a2a30] [&>button]:bg-[#111113] [&>button]:border-[#2a2a30] [&>button]:text-[#888888] [&>button:hover]:bg-[#1a1a1f] [&>button:hover]:text-[#00d4aa]"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
