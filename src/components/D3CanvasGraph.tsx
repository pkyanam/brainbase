"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as d3 from "d3";

// ─── Types ──────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  linkCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}
export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Colors ──────────────────────────────────────────────────────
/*
  Harmonized earth-tone palette matching the brand:
  charcoal + silver-white base, mint-green accent.
*/
const NODE_COLORS: Record<string, string> = {
  person: "#e8927c",   // warm coral
  company: "#7dd3a8",  // mint (brand accent)
  project: "#e8c97c",  // soft amber
  concept: "#d4a5a5",  // soft rose
  idea: "#b8a9d9",     // lavender
  source: "#7dd3a8",   // mint
  meeting: "#e8b89c",  // peach
};
const FALLBACK_COLOR = "#7dd3a8";
const BG_COLOR = "rgba(10, 10, 10, 0)";
const EDGE_STROKE = "rgba(125, 211, 168, 0.10)";
const LABEL_COLOR = "#b8b8b8";

// ─── Component ──────────────────────────────────────────────────────
interface D3CanvasGraphProps {
  data: GraphData;
  selectedId: string | null;
  onSelectNode: (slug: string) => void;
  height?: number;
}

export default function D3CanvasGraph({
  data,
  selectedId,
  onSelectNode,
  height = 600,
}: D3CanvasGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });

  // ── Resize observer ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        setDimensions({ width, height: h || 500 });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── D3 force simulation + Canvas render ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height: h } = dimensions;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: GraphEdge[] = data.edges
      .filter((e) => {
        const s = typeof e.source === "string" ? e.source : e.source.id;
        const t = typeof e.target === "string" ? e.target : e.target.id;
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map((e) => ({ ...e }));

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        ctx.save();
        ctx.clearRect(0, 0, width, h);
        ctx.translate(event.transform.x, event.transform.y);
        ctx.scale(event.transform.k, event.transform.k);
        draw(ctx, nodes, [], null, null);
        ctx.restore();
      });

    d3.select(canvas).call(zoom);

    let tickCount = 0;

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(60)
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, h / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 3))
      .alphaDecay(0.04)
      .velocityDecay(0.3)
      .on("tick", () => {
        if (sim.alpha() > 0.05 && tickCount % 3 !== 0) {
          tickCount++;
          return;
        }
        tickCount++;
        ctx.save();
        ctx.clearRect(0, 0, width, h);
        const transform = d3.zoomTransform(canvas);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);
        draw(ctx, nodes, [], null, null);
        ctx.restore();
      })
      .on("end", () => {
        ctx.save();
        ctx.clearRect(0, 0, width, h);
        const transform = d3.zoomTransform(canvas);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);
        draw(ctx, nodes, edges, null, null);
        ctx.restore();

        const bounds = getBounds(nodes);
        if (bounds) {
          const dx = bounds.x1 - bounds.x0;
          const dy = bounds.y1 - bounds.y0;
          const scale = 0.85 / Math.max(dx / width, dy / h, 0.01);
          const cx = (bounds.x0 + bounds.x1) / 2;
          const cy = (bounds.y0 + bounds.y1) / 2;
          d3.select(canvas)
            .transition()
            .duration(400)
            .call(
              zoom.transform,
              d3.zoomIdentity
                .translate(width / 2, h / 2)
                .scale(Math.min(scale, 1.8))
                .translate(-cx, -cy)
            );
        }

        sim.stop();
      });

    simulationRef.current = sim;

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const transform = d3.zoomTransform(canvas);
      const mx = (event.clientX - rect.left - transform.x) / transform.k;
      const my = (event.clientY - rect.top - transform.y) / transform.k;

      let closest: GraphNode | null = null;
      let minDist = 30;
      for (const n of nodes) {
        const dx = (n.x || 0) - mx;
        const dy = (n.y || 0) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = n;
        }
      }
      if (closest) {
        onSelectNode(closest.id);
      }
    };

    const handleMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const transform = d3.zoomTransform(canvas);
      const mx = (event.clientX - rect.left - transform.x) / transform.k;
      const my = (event.clientY - rect.top - transform.y) / transform.k;

      let closest: GraphNode | null = null;
      let minDist = 30;
      for (const n of nodes) {
        const dx = (n.x || 0) - mx;
        const dy = (n.y || 0) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = n;
        }
      }
      if (closest) {
        setTooltip({
          x: event.clientX - (containerRef.current?.getBoundingClientRect().left || 0),
          y: event.clientY - (containerRef.current?.getBoundingClientRect().top || 0),
          label: closest.label,
        });
      } else {
        setTooltip(null);
      }
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMove);
    canvas.style.cursor = "grab";

    return () => {
      sim.stop();
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMove);
    };
  }, [data, dimensions, onSelectNode]);

  // ── Re-highlight selected node without re-running sim ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || data.nodes.length === 0) return;

    const { width, height: h } = dimensions;
    const sim = simulationRef.current;
    const nodes = sim?.nodes() || [];

    ctx.save();
    ctx.clearRect(0, 0, width, h);
    const transform = d3.zoomTransform(canvas);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    ctx.globalAlpha = selectedId ? 0.3 : 1;
    draw(ctx, nodes as GraphNode[], data.edges, null, null);

    if (selectedId) {
      ctx.globalAlpha = 1;
      const selected = (nodes as GraphNode[]).filter((n) => n.id !== selectedId);
      const highlight = (nodes as GraphNode[]).filter((n) => n.id === selectedId);
      const highlightEdges: GraphEdge[] = [];

      draw(ctx, highlight, highlightEdges, null, null);
    }

    ctx.restore();
  }, [selectedId, data, dimensions]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={dimensions.width}
        height={dimensions.height}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded-lg bg-bb-bg-secondary/90 border border-bb-border text-xs text-bb-text-primary backdrop-blur-sm z-10 transition-opacity"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 28,
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

// ─── Drawing helpers ────────────────────────────────────────────────────────────────────────────────
function nodeRadius(d: GraphNode): number {
  return Math.max(5, Math.min(18, 5 + Math.sqrt(d.linkCount) * 3));
}

function colorForType(type: string): string {
  return NODE_COLORS[type] || FALLBACK_COLOR;
}

function getBounds(nodes: GraphNode[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const n of nodes) {
    if (n.x === undefined || n.y === undefined) return null;
    if (n.x < x0) x0 = n.x;
    if (n.y < y0) y0 = n.y;
    if (n.x > x1) x1 = n.x;
    if (n.y > y1) y1 = n.y;
  }
  return { x0: x0 - 20, y0: y0 - 20, x1: x1 + 20, y1: y1 + 20 };
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  _hoveredId: string | null,
  _selectedId: string | null
) {
  // ── Edges ─────────────────────────────────────────────────────────────────────────────────
  for (const e of edges) {
    const source = e.source as GraphNode;
    const target = e.target as GraphNode;
    if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = EDGE_STROKE;
    ctx.lineWidth = Math.max(0.5, Math.min(2, Math.sqrt(
      ((source.linkCount || 0) + (target.linkCount || 0)) / 2
    ) * 0.5));
    ctx.stroke();
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────────────────────
  for (const n of nodes) {
    if (n.x === undefined || n.y === undefined) continue;

    const r = nodeRadius(n);
    const color = colorForType(n.type);

    // Glow
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = color + "12";
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + "25";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    if (r > 7 || n.linkCount > 2) {
      const label = n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label;
      ctx.font = `${Math.max(8, r * 0.9)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = LABEL_COLOR;
      ctx.textAlign = "center";
      ctx.fillText(label, n.x, n.y + r + 14);
    }
  }
}
