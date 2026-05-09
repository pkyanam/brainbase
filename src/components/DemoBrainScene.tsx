"use client";

import { useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";

interface DemoNode {
  id: string;
  label: string;
  type: string;
  linkCount: number;
}

interface DemoEdge {
  source: string;
  target: string;
  type: string;
}

const DEMO_NODES: DemoNode[] = [
  { id: "pricing-exceptions", label: "Pricing Exceptions", type: "concept", linkCount: 8 },
  { id: "alice-chen", label: "Alice Chen", type: "person", linkCount: 6 },
  { id: "bob-martinez", label: "Bob Martinez", type: "person", linkCount: 5 },
  { id: "legal-review", label: "Legal Review", type: "concept", linkCount: 4 },
  { id: "sales-manager", label: "Sales Manager", type: "concept", linkCount: 4 },
  { id: "deal-value-50k", label: "Deal < $50K", type: "concept", linkCount: 3 },
  { id: "deal-value-100k", label: "Deal ≥ $100K", type: "concept", linkCount: 4 },
  { id: "escalation-process", label: "Escalation Process", type: "concept", linkCount: 3 },
  { id: "refund-policy", label: "Refund Policy", type: "concept", linkCount: 5 },
  { id: "carol-white", label: "Carol White", type: "person", linkCount: 4 },
  { id: "finance-team", label: "Finance Team", type: "concept", linkCount: 3 },
  { id: "enterprise-tier", label: "Enterprise Tier", type: "concept", linkCount: 3 },
  { id: "customer-success", label: "Customer Success", type: "concept", linkCount: 3 },
  { id: "march-2026", label: "March 2026", type: "concept", linkCount: 2 },
  { id: "april-2026", label: "April 2026", type: "concept", linkCount: 3 },
  { id: "slack-decision-1", label: "Slack: Pricing Exception #1", type: "concept", linkCount: 2 },
  { id: "slack-decision-2", label: "Slack: Pricing Exception #2", type: "concept", linkCount: 2 },
  { id: "unwritten-rule", label: "Unwritten Rule", type: "concept", linkCount: 2 },
  { id: "stripe", label: "Stripe", type: "company", linkCount: 2 },
  { id: "invoice-process", label: "Invoice Process", type: "concept", linkCount: 2 },
];

const DEMO_EDGES: DemoEdge[] = [
  { source: "pricing-exceptions", target: "alice-chen", type: "involves" },
  { source: "pricing-exceptions", target: "bob-martinez", type: "involves" },
  { source: "pricing-exceptions", target: "legal-review", type: "requires" },
  { source: "pricing-exceptions", target: "sales-manager", type: "owned_by" },
  { source: "pricing-exceptions", target: "deal-value-50k", type: "condition" },
  { source: "pricing-exceptions", target: "deal-value-100k", type: "condition" },
  { source: "pricing-exceptions", target: "escalation-process", type: "triggers" },
  { source: "deal-value-50k", target: "sales-manager", type: "approved_by" },
  { source: "deal-value-100k", target: "legal-review", type: "approved_by" },
  { source: "deal-value-100k", target: "escalation-process", type: "triggers" },
  { source: "refund-policy", target: "carol-white", type: "involves" },
  { source: "refund-policy", target: "finance-team", type: "owned_by" },
  { source: "refund-policy", target: "customer-success", type: "handled_by" },
  { source: "alice-chen", target: "sales-manager", type: "role" },
  { source: "bob-martinez", target: "legal-review", type: "role" },
  { source: "carol-white", target: "finance-team", type: "role" },
  { source: "enterprise-tier", target: "pricing-exceptions", type: "related_to" },
  { source: "enterprise-tier", target: "sales-manager", type: "owned_by" },
  { source: "slack-decision-1", target: "pricing-exceptions", type: "about" },
  { source: "slack-decision-1", target: "alice-chen", type: "authored_by" },
  { source: "slack-decision-1", target: "march-2026", type: "date" },
  { source: "slack-decision-2", target: "pricing-exceptions", type: "about" },
  { source: "slack-decision-2", target: "bob-martinez", type: "authored_by" },
  { source: "slack-decision-2", target: "april-2026", type: "date" },
  { source: "unwritten-rule", target: "pricing-exceptions", type: "governs" },
  { source: "unwritten-rule", target: "deal-value-100k", type: "applies_to" },
  { source: "stripe", target: "invoice-process", type: "uses" },
  { source: "invoice-process", target: "finance-team", type: "owned_by" },
];

const TYPE_COLORS: Record<string, string> = {
  person: "#e8927c",
  concept: "#7dd3a8",
  company: "#8ec5e8",
};
const EDGE_COLOR = "#4a7e5c";

function computeLayout(nodes: DemoNode[], edges: DemoEdge[]) {
  const positions = new Map<string, THREE.Vector3>();
  for (const n of nodes) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r = 3 + Math.random() * 2;
    positions.set(n.id, new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ));
  }
  for (let iter = 0; iter < 20; iter++) {
    const forces = new Map<string, THREE.Vector3>();
    for (const n of nodes) forces.set(n.id, new THREE.Vector3());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!, b = positions.get(nodes[j].id)!;
        const dir = new THREE.Vector3().subVectors(a, b);
        const d = dir.length() + 0.1;
        dir.normalize().multiplyScalar(0.03 / (d * d));
        forces.get(nodes[i].id)!.add(dir);
        forces.get(nodes[j].id)!.sub(dir);
      }
    }
    for (const e of edges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      const dir = new THREE.Vector3().subVectors(b, a);
      dir.normalize().multiplyScalar(0.004 * dir.length());
      forces.get(e.source)!.add(dir);
      forces.get(e.target)!.sub(dir);
    }
    for (const n of nodes) {
      const p = positions.get(n.id)!;
      p.add(forces.get(n.id)!.multiplyScalar(0.7));
      p.clampLength(2, 8);
    }
  }
  return positions;
}

function DemoScene({ activeNodes, activeEdges }: { activeNodes: Set<string>; activeEdges: Set<string> }) {
  const positions = useMemo(() => computeLayout(DEMO_NODES, DEMO_EDGES), []);

  const { pointPositions, pointColors, pointSizes } = useMemo(() => {
    const verts: number[] = [], colors: number[] = [], sizes: number[] = [];
    for (const n of DEMO_NODES) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      verts.push(pos.x, pos.y, pos.z);
      const hex = TYPE_COLORS[n.type] || "#7dd3a8";
      const c = new THREE.Color(hex);
      if (activeNodes.has(n.id)) {
        c.multiplyScalar(1.5);
      } else if (activeNodes.size > 0) {
        c.multiplyScalar(0.3);
      }
      colors.push(c.r, c.g, c.b);
      const size = activeNodes.has(n.id) ? 0.5 : 0.28;
      sizes.push(size);
    }
    return { pointPositions: new Float32Array(verts), pointColors: new Float32Array(colors), pointSizes: new Float32Array(sizes) };
  }, [positions, activeNodes]);

  const edgeVerts = useMemo(() => {
    const verts: number[] = [];
    for (const e of DEMO_EDGES) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      const isActive = activeEdges.has(`${e.source}-${e.target}`) || activeEdges.has(`${e.target}-${e.source}`);
      if (activeEdges.size > 0 && !isActive) continue;
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    return new Float32Array(verts);
  }, [positions, activeEdges]);

  const pointGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const edgeGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeo.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
    pointGeo.setAttribute("size", new THREE.Float32BufferAttribute(pointSizes, 1));
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeVerts, 3));
  }, [pointPositions, pointColors, pointSizes, edgeVerts, pointGeo, edgeGeo]);

  return (
    <>
      <fog attach="fog" args={["#0a0a0a", 6, 16]} />
      <ambientLight intensity={0.6} />
      <Stars radius={40} depth={30} count={600} factor={3} fade speed={0.5} />

      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={activeEdges.size > 0 ? 0.8 : 0.4} />
      </lineSegments>

      <points geometry={pointGeo}>
        <pointsMaterial size={0.35} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>

      {DEMO_NODES.filter(n => n.linkCount >= 3).map(n => {
        const pos = positions.get(n.id);
        if (!pos) return null;
        const label = n.label.length > 20 ? n.label.slice(0, 18) + "\u2026" : n.label;
        const isActive = activeNodes.has(n.id);
        return (
          <Billboard key={n.id} position={[pos.x, pos.y + 0.4, pos.z]}>
            <Text
              fontSize={isActive ? 0.28 : 0.2}
              color={isActive ? "#7dd3a8" : "#888888"}
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

      <OrbitControls enableDamping dampingFactor={0.06} minDistance={3} maxDistance={14} autoRotate autoRotateSpeed={0.2} />
    </>
  );
}

export default function DemoBrainScene({ activeNodes, activeEdges }: { activeNodes: Set<string>; activeEdges: Set<string> }) {
  return (
    <Canvas
      camera={{ position: [0, 2, 8], fov: 55 }}
      style={{ background: "#0a0a0a" }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "low-power" }}
    >
      <DemoScene activeNodes={activeNodes} activeEdges={activeEdges} />
    </Canvas>
  );
}
