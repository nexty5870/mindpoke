"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

// Discovery node - a floating point that represents content
function DiscoveryNode({ 
  position, 
  color, 
  size = 0.08,
  pulseSpeed = 1 
}: { 
  position: [number, number, number]; 
  color: string;
  size?: number;
  pulseSpeed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialY = position[1];
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating motion
      meshRef.current.position.y = initialY + Math.sin(state.clock.elapsedTime * pulseSpeed + position[0]) * 0.1;
      // Subtle pulse
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2 * pulseSpeed) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

// Connection line between nodes
function ConnectionLine({ 
  start, 
  end, 
  color,
  opacity = 0.3 
}: { 
  start: [number, number, number]; 
  end: [number, number, number];
  color: string;
  opacity?: number;
}) {
  const points = useMemo(() => [start, end], [start, end]);
  
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={opacity}
    />
  );
}

// Pulsing ring effect for "discovery" moments
function PulseRing({ position, color }: { position: [number, number, number]; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      const t = (state.clock.elapsedTime % 3) / 3; // 3 second cycle
      ringRef.current.scale.setScalar(0.1 + t * 1.5);
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.5 * (1 - t);
    }
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.15, 0.18, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Main scene with all elements
function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  
  // Colors matching Mindpoke theme
  const colors = {
    primary: "#00d4aa",   // Cyan - main accent
    secondary: "#ffb000", // Amber - poke around
    tertiary: "#a855f7",  // Purple - AI summary
    dim: "#888888",       // Dimmed nodes
  };

  // Generate node positions in a constellation pattern
  const nodes = useMemo(() => {
    const positions: { pos: [number, number, number]; color: string; size: number }[] = [];
    
    // Central cluster (main interests)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.4;
      positions.push({
        pos: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 0.6,
          Math.sin(angle) * radius - 1
        ],
        color: i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.secondary : colors.tertiary,
        size: 0.06 + Math.random() * 0.04
      });
    }
    
    // Outer discoveries
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1.2;
      positions.push({
        pos: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 1.2,
          Math.sin(angle) * radius - 1.5
        ],
        color: Math.random() > 0.7 ? colors.primary : colors.dim,
        size: 0.03 + Math.random() * 0.03
      });
    }
    
    return positions;
  }, []);

  // Generate connections between nearby nodes
  const connections = useMemo(() => {
    const lines: { start: [number, number, number]; end: [number, number, number]; color: string }[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].pos[0] - nodes[j].pos[0], 2) +
          Math.pow(nodes[i].pos[1] - nodes[j].pos[1], 2) +
          Math.pow(nodes[i].pos[2] - nodes[j].pos[2], 2)
        );
        
        // Connect nodes within certain distance
        if (dist < 1.2 && Math.random() > 0.5) {
          lines.push({
            start: nodes[i].pos,
            end: nodes[j].pos,
            color: nodes[i].color === colors.primary || nodes[j].color === colors.primary 
              ? colors.primary 
              : colors.dim
          });
        }
      }
    }
    
    return lines;
  }, [nodes]);

  // Slow rotation of the entire scene
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Connections first (behind nodes) */}
      {connections.map((conn, i) => (
        <ConnectionLine 
          key={`line-${i}`}
          start={conn.start}
          end={conn.end}
          color={conn.color}
          opacity={conn.color === colors.primary ? 0.4 : 0.15}
        />
      ))}
      
      {/* Discovery nodes */}
      {nodes.map((node, i) => (
        <DiscoveryNode
          key={`node-${i}`}
          position={node.pos}
          color={node.color}
          size={node.size}
          pulseSpeed={0.5 + Math.random() * 0.5}
        />
      ))}
      
      {/* Pulse effects on key nodes */}
      <PulseRing position={nodes[0].pos} color={colors.primary} />
      <PulseRing position={nodes[3].pos} color={colors.secondary} />
    </group>
  );
}

export function HeroWebGL() {
  return (
    <div className="absolute inset-0 -z-10 opacity-60">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
