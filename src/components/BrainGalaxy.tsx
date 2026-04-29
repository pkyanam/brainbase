"use client";

import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { GraphNode } from "@/lib/supabase/graph";

/*
  Graph colors — harmonized earth-tone palette
  that complements the charcoal + mint-green brand.
*/
const TYPE_COLORS: Record<string, string> = {
  person: "#e8927c",   // warm coral
  company: "#7dd3a8",  // mint (brand accent)
  project: "#e8c97c",  // soft amber
  concept: "#d4a5a5",  // soft rose
  idea: "#b8a9d9",     // lavender
  place: "#8ec5e8",    // sky
  software: "#6ec5b8", // teal
  email: "#f0c674",    // yellow-gold
};
const FALLBACK_COLOR = "#7dd3a8";
const EDGE_COLOR = "#4a7e5c"; // brighter mint-green for visibility

function computeLayout(
  nodes: GraphNode[],
  edges: { source: string; target: string; type: string }[]
) {
  const positions = new Map<string, THREE.Vector3>();
  for (const n of nodes) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r = 4 + Math.random() * 3;
    positions.set(n.id, new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
  }
  for (let iter = 0; iter < 12; iter++) {
    const forces = new Map<string, THREE.Vector3>();
    for (const n of nodes) forces.set(n.id, new THREE.Vector3());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!, b = positions.get(nodes[j].id)!;
        const dir = new THREE.Vector3().subVectors(a, b);
        const d = dir.length() + 0.1;
        dir.normalize().multiplyScalar(0.02 / (d * d));
        forces.get(nodes[i].id)!.add(dir); forces.get(nodes[j].id)!.sub(dir);
      }
    }
    for (const e of edges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      const dir = new THREE.Vector3().subVectors(b, a);
      dir.normalize().multiplyScalar(0.003 * dir.length());
      forces.get(e.source)!.add(dir); forces.get(e.target)!.sub(dir);
    }
    for (const n of nodes) { const p = positions.get(n.id)!; p.add(forces.get(n.id)!.multiplyScalar(0.7)); p.clampLength(2, 12); }
  }
  return positions;
}

function NodeLabels({
  nodes,
  positions,
}: {
  nodes: GraphNode[];
  positions: Map<string, THREE.Vector3>;
}) {
  // Only label the top 25 most connected nodes to keep perf sane
  const labeled = useMemo(() => {
    return nodes
      .filter((n) => n.linkCount >= 3)
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, 25);
  }, [nodes]);

  return (
    <>
      {labeled.map((n) => {
        const pos = positions.get(n.id);
        if (!pos) return null;
        const label = n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label;
        return (
          <Billboard key={n.id} position={[pos.x, pos.y + 0.45, pos.z]}>
            <Text
              fontSize={0.22}
              color="#c8c8c8"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.02}
              outlineColor="#0a0a0a"
            >
              {label}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

function HighlightRing({
  positions,
  selectedId,
  hoveredId,
}: {
  positions: Map<string, THREE.Vector3>;
  selectedId: string | null;
  hoveredId: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const target = useMemo(() => {
    const id = hoveredId || selectedId;
    if (!id) return null;
    return positions.get(id);
  }, [hoveredId, selectedId, positions]);

  useFrame(() => {
    if (!meshRef.current || !target) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    meshRef.current.position.copy(target);
    const scale = 1 + Math.sin(Date.now() * 0.003) * 0.15;
    meshRef.current.scale.setScalar(scale);
  });

  if (!target) return null;

  return (
    <mesh ref={meshRef} position={[target.x, target.y, target.z]}>
      <ringGeometry args={[0.35, 0.45, 32]} />
      <meshBasicMaterial color="#7dd3a8" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene({
  nodes, edges, onSelectNode, selectedId,
}: {
  nodes: GraphNode[]; edges: { source: string; target: string; type: string }[];
  onSelectNode: (s: string) => void;
  selectedId: string | null;
}) {
  const { gl, raycaster, camera, pointer } = useThree();
  const slugMap = useRef<Map<number, string>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const capped = useMemo(() => nodes.sort((a, b) => b.linkCount - a.linkCount).slice(0, 150), [nodes]);
  const cappedEdges = useMemo(() => {
    const ids = new Set(capped.map(n => n.id));
    return edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 200);
  }, [edges, capped]);

  const positions = useMemo(() => computeLayout(capped, cappedEdges), [capped, cappedEdges]);

  const { pointPositions, pointColors, pointSizes } = useMemo(() => {
    const verts: number[] = [], colors: number[] = [], sizes: number[] = [];
    slugMap.current = new Map();
    let idx = 0;
    for (const n of capped) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      verts.push(pos.x, pos.y, pos.z);
      const hex = TYPE_COLORS[n.type] || FALLBACK_COLOR;
      const c = new THREE.Color(hex);
      colors.push(c.r, c.g, c.b);
      // Size based on link count — bigger = more connected
      const size = Math.max(0.25, Math.min(0.55, 0.25 + Math.sqrt(n.linkCount) * 0.06));
      sizes.push(size);
      slugMap.current.set(idx, n.id);
      idx++;
    }
    return { pointPositions: new Float32Array(verts), pointColors: new Float32Array(colors), pointSizes: new Float32Array(sizes) };
  }, [capped, positions]);

  const edgeVerts = useMemo(() => {
    const verts: number[] = [];
    for (const e of cappedEdges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (a && b) { verts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    }
    return new Float32Array(verts);
  }, [cappedEdges, positions]);

  const pointGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const edgeGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeo.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
    pointGeo.setAttribute("size", new THREE.Float32BufferAttribute(pointSizes, 1));
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeVerts, 3));
  }, [pointPositions, pointColors, pointSizes, edgeVerts, pointGeo, edgeGeo]);

  const pointRef = useRef<THREE.Points>(null);

  const handlePointerMove = useCallback(() => {
    if (!pointRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(pointRef.current);
    if (intersects.length > 0) {
      const idx = intersects[0].index;
      if (idx !== undefined) {
        const slug = slugMap.current.get(idx);
        if (slug) {
          setHoveredId(slug);
          gl.domElement.style.cursor = "pointer";
          return;
        }
      }
    }
    setHoveredId(null);
    gl.domElement.style.cursor = "grab";
  }, [gl, raycaster, camera, pointer]);

  const handlePointerUp = useCallback(() => {
    if (!pointRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(pointRef.current);
    if (intersects.length > 0) {
      const idx = intersects[0].index;
      if (idx !== undefined) {
        const slug = slugMap.current.get(idx);
        if (slug) onSelectNode(slug);
      }
    }
  }, [gl, raycaster, camera, pointer, onSelectNode]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointermove", handlePointerMove);
    return () => {
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointermove", handlePointerMove);
    };
  }, [gl, handlePointerUp, handlePointerMove]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl]);

  return (
    <>
      <fog attach="fog" args={["#0a0a0a", 8, 22]} />
      <ambientLight intensity={0.5} />
      <Stars radius={50} depth={40} count={800} factor={3} fade speed={0.5} />

      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.5} />
      </lineSegments>

      <points ref={pointRef} geometry={pointGeo}>
        <pointsMaterial
          size={0.35}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.95}
        />
      </points>

      <NodeLabels nodes={capped} positions={positions} />
      <HighlightRing positions={positions} selectedId={selectedId} hoveredId={hoveredId} />

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={3}
        maxDistance={16}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

export default function BrainGalaxy({
  nodes, edges, onSelectNode,
}: {
  nodes: GraphNode[]; edges: { source: string; target: string; type: string }[];
  onSelectNode: (s: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((slug: string) => {
    setSelectedId(slug);
    onSelectNode(slug);
  }, [onSelectNode]);

  return (
    <Canvas
      camera={{ position: [0, 2, 9], fov: 50 }}
      style={{ background: "#0a0a0a" }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }}
      performance={{ min: 0.3 }}
    >
      <Scene nodes={nodes} edges={edges} onSelectNode={handleSelect} selectedId={selectedId} />
    </Canvas>
  );
}
