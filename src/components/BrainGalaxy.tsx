"use client";

import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import { useTheme } from "@/components/ThemeProvider";
import * as THREE from "three";
import type { GraphNode } from "@/lib/supabase/graph";

/* ── Theme-aware color palettes ── */
// Dark theme: vibrant, high-chroma colors pop against dark bg
const DARK_COLORS: Record<string, string> = {
  person:    "#ff8a80", // coral pink
  company:   "#69f0ae", // bright mint
  project:   "#ffd740", // amber gold
  concept:   "#ea80fc", // magenta
  idea:      "#b388ff", // violet
  place:     "#40c4ff", // cyan
  software:  "#64ffda", // teal
  email:     "#ffe57f", // yellow
};
const DARK_BG = "#0d1117";
const DARK_EDGE = "#3ecf8e";
const DARK_LABEL = "#e6edf3";
const DARK_LABEL_OUTLINE = "#0d1117";
const DARK_NODE_DIM = 0.22;
const DARK_NODE_HOVER = 1.6;

// Light theme: saturated, deeper tones against light bg
const LIGHT_COLORS: Record<string, string> = {
  person:    "#d32f2f", // deep red
  company:   "#00796b", // dark teal
  project:   "#f57c00", // deep orange
  concept:   "#7b1fa2", // purple
  idea:      "#512da8", // deep violet
  place:     "#0277bd", // deep blue
  software:  "#00897b", // dark mint
  email:     "#f9a825", // amber
};
const LIGHT_BG = "#f6f8fa";
const LIGHT_EDGE = "#57606a";
const LIGHT_LABEL = "#1f2328";
const LIGHT_LABEL_OUTLINE = "#f6f8fa";
const LIGHT_NODE_DIM = 0.28;
const LIGHT_NODE_HOVER = 1.3;

type ThemeColors = {
  bg: string;
  edge: string;
  label: string;
  labelOutline: string;
  nodeDim: number;
  nodeHover: number;
  typeColors: Record<string, string>;
  fallback: string;
};

function getThemeColors(dark: boolean): ThemeColors {
  return dark ? {
    bg: DARK_BG,
    edge: DARK_EDGE,
    label: DARK_LABEL,
    labelOutline: DARK_LABEL_OUTLINE,
    nodeDim: DARK_NODE_DIM,
    nodeHover: DARK_NODE_HOVER,
    typeColors: DARK_COLORS,
    fallback: "#69f0ae",
  } : {
    bg: LIGHT_BG,
    edge: LIGHT_EDGE,
    label: LIGHT_LABEL,
    labelOutline: LIGHT_LABEL_OUTLINE,
    nodeDim: LIGHT_NODE_DIM,
    nodeHover: LIGHT_NODE_HOVER,
    typeColors: LIGHT_COLORS,
    fallback: "#00796b",
  };
}

/* ── Barnes-Hut force-directed layout ── */
interface BHNode {
  cx: number; cy: number; cz: number; mass: number;
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  children: BHNode[]; pointIndex: number | null;
}

function buildBarnesHut(points: Float32Array, masses: Float32Array): BHNode {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const n = points.length / 3;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const pad = 0.1;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad; minZ -= pad; maxZ += pad;

  const root: BHNode = {
    cx: 0, cy: 0, cz: 0, mass: 0,
    minX, maxX, minY, maxY, minZ, maxZ,
    children: [], pointIndex: null,
  };

  for (let i = 0; i < n; i++) {
    insertBH(root, i, points, masses);
  }
  computeCenters(root);
  return root;
}

function insertBH(node: BHNode, idx: number, points: Float32Array, _masses: Float32Array) {
  const x = points[idx * 3], y = points[idx * 3 + 1], z = points[idx * 3 + 2];
  if (node.children.length === 0 && node.pointIndex === null) {
    node.pointIndex = idx;
    return;
  }
  if (node.children.length === 0 && node.pointIndex !== null) {
    const oldIdx = node.pointIndex;
    node.pointIndex = null;
    const ox = points[oldIdx * 3], oy = points[oldIdx * 3 + 1], oz = points[oldIdx * 3 + 2];
    const child = getChild(node, ox, oy, oz);
    insertBH(child, oldIdx, points, _masses);
  }
  const child = getChild(node, x, y, z);
  insertBH(child, idx, points, _masses);
}

function getChild(node: BHNode, x: number, y: number, z: number): BHNode {
  const midX = (node.minX + node.maxX) / 2;
  const midY = (node.minY + node.maxY) / 2;
  const midZ = (node.minZ + node.maxZ) / 2;
  const ix = x > midX ? 1 : 0, iy = y > midY ? 1 : 0, iz = z > midZ ? 1 : 0;
  const idx = ix * 4 + iy * 2 + iz;
  if (!node.children[idx]) {
    node.children[idx] = {
      cx: 0, cy: 0, cz: 0, mass: 0,
      minX: ix === 0 ? node.minX : midX, maxX: ix === 0 ? midX : node.maxX,
      minY: iy === 0 ? node.minY : midY, maxY: iy === 0 ? midY : node.maxY,
      minZ: iz === 0 ? node.minZ : midZ, maxZ: iz === 0 ? midZ : node.maxZ,
      children: [], pointIndex: null,
    };
  }
  return node.children[idx];
}

function computeCenters(node: BHNode) {
  if (node.children.length === 0 && node.pointIndex !== null) { node.mass = 1; return; }
  node.mass = 0; node.cx = 0; node.cy = 0; node.cz = 0;
  for (const child of node.children) {
    if (!child) continue;
    computeCenters(child);
    node.mass += child.mass;
    node.cx += child.cx * child.mass;
    node.cy += child.cy * child.mass;
    node.cz += child.cz * child.mass;
  }
  if (node.mass > 0) { node.cx /= node.mass; node.cy /= node.mass; node.cz /= node.mass; }
}

function barnesHutForce(points: Float32Array, velocities: Float32Array, root: BHNode, theta: number, repulsion: number) {
  const n = points.length / 3;
  for (let i = 0; i < n; i++) applyBH(points, velocities, i, root, theta, repulsion);
}

function applyBH(points: Float32Array, velocities: Float32Array, idx: number, node: BHNode, theta: number, repulsion: number) {
  if (node.mass === 0) return;
  const px = points[idx * 3], py = points[idx * 3 + 1], pz = points[idx * 3 + 2];
  const dx = node.cx - px, dy = node.cy - py, dz = node.cz - pz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
  const width = node.maxX - node.minX;
  if (node.children.length === 0 || width / dist < theta) {
    const f = (repulsion * node.mass) / (dist * dist);
    velocities[idx * 3] -= (dx / dist) * f;
    velocities[idx * 3 + 1] -= (dy / dist) * f;
    velocities[idx * 3 + 2] -= (dz / dist) * f;
  } else {
    for (const child of node.children) {
      if (child) applyBH(points, velocities, idx, child, theta, repulsion);
    }
  }
}

function computeLayoutBHV2(
  nodes: GraphNode[],
  edges: { source: string; target: string; type: string }[],
): Float32Array {
  const n = nodes.length;
  const points = new Float32Array(n * 3);
  const velocities = new Float32Array(n * 3);
  const masses = new Float32Array(n).fill(1);
  const idToIdx = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r = 3 + Math.random() * 5;
    points[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    points[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    points[i * 3 + 2] = r * Math.cos(phi);
    idToIdx.set(nodes[i].id, i);
  }

  const edgePairs: [number, number][] = [];
  for (const e of edges) {
    const si = idToIdx.get(e.source), ti = idToIdx.get(e.target);
    if (si !== undefined && ti !== undefined) edgePairs.push([si, ti]);
  }

  const repulsion = 8, attraction = 0.005, damping = 0.7, theta = 0.8;
  for (let iter = 0; iter < 20; iter++) {
    const bh = buildBarnesHut(points, masses);
    barnesHutForce(points, velocities, bh, theta, repulsion);
    for (const [si, ti] of edgePairs) {
      const dx = points[ti * 3] - points[si * 3];
      const dy = points[ti * 3 + 1] - points[si * 3 + 1];
      const dz = points[ti * 3 + 2] - points[si * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const f = attraction * dist;
      velocities[si * 3] += (dx / dist) * f; velocities[si * 3 + 1] += (dy / dist) * f; velocities[si * 3 + 2] += (dz / dist) * f;
      velocities[ti * 3] -= (dx / dist) * f; velocities[ti * 3 + 1] -= (dy / dist) * f; velocities[ti * 3 + 2] -= (dz / dist) * f;
    }
    for (let i = 0; i < n; i++) {
      velocities[i * 3] *= damping; velocities[i * 3 + 1] *= damping; velocities[i * 3 + 2] *= damping;
      points[i * 3] += velocities[i * 3]; points[i * 3 + 1] += velocities[i * 3 + 1]; points[i * 3 + 2] += velocities[i * 3 + 2];
      const l = Math.sqrt(points[i * 3] ** 2 + points[i * 3 + 1] ** 2 + points[i * 3 + 2] ** 2);
      if (l > 25) { const s = 25 / l; points[i * 3] *= s; points[i * 3 + 1] *= s; points[i * 3 + 2] *= s; }
    }
  }
  return points;
}

/* ── WASD keyboard controls ── */
function KeyboardControls() {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame((_, delta) => {
    const speed = 8 * delta;
    const k = keys.current;
    // WASD pan in XZ plane relative to camera facing
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (k.has("w") || k.has("arrowup"))    camera.position.addScaledVector(forward, speed);
    if (k.has("s") || k.has("arrowdown"))   camera.position.addScaledVector(forward, -speed);
    if (k.has("a") || k.has("arrowleft"))   camera.position.addScaledVector(right, -speed);
    if (k.has("d") || k.has("arrowright"))  camera.position.addScaledVector(right, speed);
    if (k.has("q")) camera.position.y += speed;  // up
    if (k.has("e")) camera.position.y -= speed;  // down
    // R/F: zoom in/out
    if (k.has("r")) camera.position.addScaledVector(forward, speed * 3);
    if (k.has("f")) camera.position.addScaledVector(forward, -speed * 3);
  });

  return null;
}

/* ── Instanced node cloud ── */
function NodeCloud({
  nodes, positions, onSelectNode, selectedId, hoveredId, setHoveredId, colors,
}: {
  nodes: GraphNode[];
  positions: Float32Array;
  onSelectNode: (s: string) => void;
  selectedId: string | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  colors: ThemeColors;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { raycaster, camera, pointer } = useThree();
  const n = nodes.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < n; i++) {
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const linkCount = nodes[i].linkCount || 0;
      const scale = 0.02 + Math.min(linkCount / 20, 0.10);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const hex = colors.typeColors[nodes[i].type] || colors.fallback;
      const isHovered = nodes[i].id === hoveredId;
      const isSelected = nodes[i].id === selectedId;
      const dimmed = selectedId && !isSelected && !isHovered;
      color.set(hex);
      if (dimmed) color.multiplyScalar(colors.nodeDim);
      else if (isHovered) color.multiplyScalar(colors.nodeHover);
      else color.multiplyScalar(0.85);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [positions, nodes, hoveredId, selectedId, dummy, color, n, colors]);

  useFrame(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const idx = intersects[0].instanceId;
      if (idx !== undefined && idx < n) { setHoveredId(nodes[idx].id); return; }
    }
    setHoveredId(null);
  });

  const handleClick = useCallback(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const idx = intersects[0].instanceId;
      if (idx < n) onSelectNode(nodes[idx].id);
    }
  }, [raycaster, pointer, camera, n, nodes, onSelectNode]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, n]} onClick={handleClick}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

/* ── Edge lines ── */
function Edges({
  nodes, edges, positions, colors,
}: {
  nodes: GraphNode[];
  edges: { source: string; target: string; type: string }[];
  positions: Float32Array;
  colors: ThemeColors;
}) {
  const geo = useMemo(() => {
    const idToIdx = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) idToIdx.set(nodes[i].id, i);
    const verts: number[] = [];
    for (const e of edges) {
      const si = idToIdx.get(e.source), ti = idToIdx.get(e.target);
      if (si === undefined || ti === undefined) continue;
      verts.push(
        positions[si * 3], positions[si * 3 + 1], positions[si * 3 + 2],
        positions[ti * 3], positions[ti * 3 + 1], positions[ti * 3 + 2],
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [nodes, edges, positions]);

  if (edges.length === 0) return null;

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={colors.edge} transparent opacity={0.28} linewidth={1} />
    </lineSegments>
  );
}

/* ── Selected highlight ring ── */
function SelectedRing({
  positions, nodeIdx, nodes, colors,
}: {
  positions: Float32Array;
  nodeIdx: number | null;
  nodes: GraphNode[];
  colors: ThemeColors;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const target = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!meshRef.current || nodeIdx === null) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    const px = positions[nodeIdx * 3], py = positions[nodeIdx * 3 + 1], pz = positions[nodeIdx * 3 + 2];
    target.current.set(px, py, pz);
    meshRef.current.position.copy(target.current);
    const linkCount = nodes[nodeIdx]?.linkCount || 0;
    const base = 0.02 + Math.min(linkCount / 20, 0.10);
    const scale = base * 2.5 + Math.sin(Date.now() * 0.003) * base * 0.4;
    meshRef.current.scale.setScalar(scale);
  });

  if (nodeIdx === null) return null;
  return (
    <mesh ref={meshRef}>
      <ringGeometry args={[0.9, 1.05, 32]} />
      <meshBasicMaterial color={colors.fallback} transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ── Node labels ── */
function NodeLabels({
  nodes, positions, selectedId, colors,
}: {
  nodes: GraphNode[];
  positions: Float32Array;
  selectedId: string | null;
  colors: ThemeColors;
}) {
  const visible = useMemo(() => {
    const top = nodes
      .map((n, i) => ({ ...n, idx: i }))
      .filter((n) => n.linkCount >= 2)
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, 60);
    const set = new Set(top.map((n) => n.id));
    if (selectedId) set.add(selectedId);
    return Array.from(set).map((id) => {
      const node = nodes.find((n) => n.id === id);
      return node ? { id: node.id, label: node.label, idx: nodes.indexOf(node) } : null;
    }).filter(Boolean) as { id: string; label: string; idx: number }[];
  }, [nodes, selectedId]);

  return (
    <>
      {visible.map((v) => {
        const label = v.label.length > 32 ? v.label.slice(0, 30) + "…" : v.label;
        return (
          <Billboard key={v.id} position={[positions[v.idx * 3], positions[v.idx * 3 + 1] + 0.28, positions[v.idx * 3 + 2]]}>
            <Text
              fontSize={0.2}
              color={colors.label}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.025}
              outlineColor={colors.labelOutline}
            >
              {label}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

/* ── Scene ── */
function Scene({
  nodes, edges, onSelectNode, selectedId, colors,
}: {
  nodes: GraphNode[];
  edges: { source: string; target: string; type: string }[];
  onSelectNode: (s: string) => void;
  selectedId: string | null;
  colors: ThemeColors;
}) {
  const { camera } = useThree();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cappedEdges = useMemo(() => {
    if (edges.length <= 800) return edges;
    const topIds = new Set(
      nodes.sort((a, b) => b.linkCount - a.linkCount).slice(0, 300).map((n) => n.id),
    );
    return edges.filter((e) => topIds.has(e.source) || topIds.has(e.target)).slice(0, 800);
  }, [nodes, edges]);

  const positions = useMemo(
    () => computeLayoutBHV2(nodes, cappedEdges),
    [nodes, cappedEdges],
  );

  const selectedIdx = selectedId ? nodes.findIndex((n) => n.id === selectedId) : -1;

  return (
    <>
      <Edges nodes={nodes} edges={cappedEdges} positions={positions} colors={colors} />
      <NodeCloud
        nodes={nodes} positions={positions} onSelectNode={onSelectNode}
        selectedId={selectedId} hoveredId={hoveredId} setHoveredId={setHoveredId}
        colors={colors}
      />
      <SelectedRing positions={positions} nodeIdx={selectedIdx >= 0 ? selectedIdx : null} nodes={nodes} colors={colors} />
      <NodeLabels nodes={nodes} positions={positions} selectedId={selectedId} colors={colors} />
      <KeyboardControls />
    </>
  );
}

/* ── Public component ── */
export default function BrainGalaxy({
  nodes, edges, onSelectNode,
}: {
  nodes: GraphNode[];
  edges: { source: string; target: string; type: string }[];
  onSelectNode: (slug: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  const handleSelect = useCallback((slug: string) => {
    setSelectedId(slug);
    onSelectNode(slug);
  }, [onSelectNode]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 14], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: colors.bg }}
      >
        <ambientLight intensity={isDark ? 0.5 : 0.8} />
        <Scene nodes={nodes} edges={edges} onSelectNode={handleSelect} selectedId={selectedId} colors={colors} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={200}
        />
      </Canvas>
      <div className="absolute bottom-4 left-4 text-[10px] tabular-nums bg-bb-bg-primary/80 backdrop-blur-sm rounded px-2 py-1 border border-bb-border/50 pointer-events-none"
        style={{ color: isDark ? "#8b949e" : "#57606a" }}
      >
        {nodes.length} nodes • {edges.length} edges • WASD to pan • scroll to zoom
      </div>
    </div>
  );
}
