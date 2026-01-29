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

// Custom node component for interests
function InterestNode({ data, selected }: NodeProps) {
  const interest = data.interest as Interest;
  const heatLevel = data.heatLevel as number;
  const discoveryCount = data.discoveryCount as number;

  const getHeatColor = (level: number) => {
    if (level >= 4) return "from-orange-500 via-red-500 to-pink-500";
    if (level >= 3) return "from-yellow-500 via-orange-500 to-red-500";
    if (level >= 2) return "from-green-500 via-yellow-500 to-orange-500";
    return "from-blue-500 via-cyan-500 to-green-500";
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "relative cursor-pointer",
        selected && "z-10"
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      
      {/* Glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl blur-xl opacity-30 transition-opacity",
          `bg-gradient-to-br ${getHeatColor(heatLevel)}`,
          selected && "opacity-50"
        )}
      />
      
      {/* Main card */}
      <div
        className={cn(
          "relative px-6 py-4 rounded-2xl border transition-all",
          "bg-zinc-900/90 backdrop-blur-sm",
          selected
            ? "border-violet-500 shadow-lg shadow-violet-500/20"
            : "border-zinc-700 hover:border-zinc-600"
        )}
      >
        {/* Heat bars */}
        <div className="flex gap-1 mb-2 justify-center">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: i < heatLevel ? 12 : 8 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "w-1.5 rounded-full",
                i < heatLevel
                  ? `bg-gradient-to-t ${getHeatColor(heatLevel)}`
                  : "bg-zinc-700"
              )}
            />
          ))}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-center text-white mb-1">
          {interest.name}
        </h3>

        {/* Discovery count */}
        {discoveryCount > 0 && (
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            {discoveryCount} new
          </div>
        )}

        {/* Priority badge */}
        <div
          className={cn(
            "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
            interest.priority >= 5
              ? "bg-red-500 text-white"
              : interest.priority >= 4
              ? "bg-orange-500 text-white"
              : interest.priority >= 3
              ? "bg-yellow-500 text-black"
              : "bg-zinc-600 text-white"
          )}
        >
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
    const radius = Math.min(200, 100 + count * 30);

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

    // Calculate connection strength based on shared discoveries
    discoveries.forEach((discovery) => {
      const matched = discovery.matchedInterests;
      for (let i = 0; i < matched.length; i++) {
        for (let j = i + 1; j < matched.length; j++) {
          const key = [matched[i], matched[j]].sort().join("-");
          connectionStrengths.set(key, (connectionStrengths.get(key) || 0) + 1);
        }
      }
    });

    // Create edges
    connectionStrengths.forEach((strength, key) => {
      const [source, target] = key.split("-");
      edges.push({
        id: key,
        source,
        target,
        style: {
          stroke: `rgba(139, 92, 246, ${Math.min(0.8, strength * 0.2)})`,
          strokeWidth: Math.min(4, 1 + strength * 0.5),
        },
        animated: strength > 2,
      });
    });

    return edges;
  }, [discoveries]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectInterest(node.id === selectedInterest ? null : node.id);
    },
    [onSelectInterest, selectedInterest]
  );

  return (
    <div className="w-full h-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-zinc-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.05)"
        />
        <Controls
          className="bg-zinc-800 border-zinc-700 rounded-lg"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
