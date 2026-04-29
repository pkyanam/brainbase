"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { GraphNode } from "@/lib/supabase/graph";

const TYPE_COLORS: Record<string, string> = {
  person: "#c084fc", company: "#22d3ee", project: "#34d399",
  concept: "#fbbf24", idea: "#f472b6", place: "#60a5fa",
  software: "#a78bfa", meeting: "#fb923c",
};
const FALLBACK_COLOR = "#6b7280";

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
  for (let iter = 0; iter < 8; iter++) {
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

// ── Minimal Scene: Points + Lines only, no per-mesh components ──
function Scene({
  nodes, edges, onSelectNode,
}: {
  nodes: GraphNode[]; edges: { source: string; target: string; type: string }[];
  onSelectNode: (s: string) => void;
}) {
  const { gl, raycaster, camera, pointer } = useThree();
  const slugMap = useRef<Map<number, string>>(new Map());

  // Cap
  const capped = useMemo(() => nodes.sort((a, b) => b.linkCount - a.linkCount).slice(0, 150), [nodes]);
  const cappedEdges = useMemo(() => {
    const ids = new Set(capped.map(n => n.id));
    return edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 200);
  }, [edges, capped]);

  const positions = useMemo(() => computeLayout(capped, cappedEdges), [capped, cappedEdges]);

  // Build flat arrays for Points geometry
  const { pointPositions, pointColors } = useMemo(() => {
    const verts: number[] = [], colors: number[] = [];
    slugMap.current = new Map();
    let idx = 0;
    for (const n of capped) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      verts.push(pos.x, pos.y, pos.z);
      const hex = TYPE_COLORS[n.type] || FALLBACK_COLOR;
      const c = new THREE.Color(hex);
      colors.push(c.r, c.g, c.b);
      slugMap.current.set(idx, n.id);
      idx++;
    }
    return { pointPositions: new Float32Array(verts), pointColors: new Float32Array(colors) };
  }, [capped, positions]);

  // Build flat array for LineSegments geometry
  const edgeVerts = useMemo(() => {
    const verts: number[] = [];
    for (const e of cappedEdges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (a && b) { verts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    }
    return new Float32Array(verts);
  }, [cappedEdges, positions]);

  // Geometries
  const pointGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const edgeGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeo.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeVerts, 3));
  }, [pointPositions, pointColors, edgeVerts, pointGeo, edgeGeo]);

  const pointRef = useRef<THREE.Points>(null);
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

  // Attach click handler directly to canvas (no React event system)
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerup", handlePointerUp);
    return () => canvas.removeEventListener("pointerup", handlePointerUp);
  }, [gl, handlePointerUp]);

  // Context loss
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color="#1a1a2e" transparent opacity={0.4} />
      </lineSegments>
      <points ref={pointRef} geometry={pointGeo}>
        <pointsMaterial size={0.18} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>
      <OrbitControls enableDamping dampingFactor={0.06} minDistance={2} maxDistance={18} autoRotate autoRotateSpeed={0.2} />
    </>
  );
}

export default function BrainGalaxy({
  nodes, edges, onSelectNode,
}: {
  nodes: GraphNode[]; edges: { source: string; target: string; type: string }[];
  onSelectNode: (s: string) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 3, 12], fov: 45 }}
      style={{ background: "#000000" }}
      dpr={[1, 1]}
      gl={{ antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }}
      performance={{ min: 0.3 }}
    >
      <Scene nodes={nodes} edges={edges} onSelectNode={onSelectNode} />
    </Canvas>
  );
}
