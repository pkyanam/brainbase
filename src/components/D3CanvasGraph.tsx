"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as d3 from "d3";

// ─── Types ────────────────────────────────────────────
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

// ─── Colors ───────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  person: "#d8b4fe",
  company: "#67e8f9",
  project: "#86efac",
  concept: "#fde68a",
  idea: "#fb7185",
  source: "#c084fc",
  meeting: "#f472b6",
};
const FALLBACK_COLOR = "#a855f7";
const BG_COLOR = "rgba(7, 7, 16, 0)";

// ─── Component ────────────────────────────────────────
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

  // ── Resize observer ─────────────────────────────────
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

  // ── D3 force simulation + Canvas render ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height: h } = dimensions;
    // Cap HiDPI — full devicePixelRatio on mobile wastes GPU on canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Deep clone data for D3 mutation, filter orphan edges
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: GraphEdge[] = data.edges
      .filter((e) => {
        const s = typeof e.source === "string" ? e.source : e.source.id;
        const t = typeof e.target === "string" ? e.target : e.target.id;
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map((e) => ({ ...e }));

    // ── Zoom behavior ─────────────────────────────────
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        ctx.save();
        ctx.clearRect(0, 0, width, h);
        ctx.translate(event.transform.x, event.transform.y);
        ctx.scale(event.transform.k, event.transform.k);
        draw(ctx, nodes, [], null, null);  // Nodes only during zoom
        ctx.restore();
      });

    d3.select(canvas).call(zoom);

    let tickCount = 0;

    // ── Force simulation (mobile-optimized) ───────────
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
      .alphaDecay(0.04)        // Faster settle (~115 ticks → alpha < 0.01)
      .velocityDecay(0.3)      // Extra damping for mobile
      .on("tick", () => {
        // Throttle: only redraw every 3 ticks (mobile-friendly)
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
        draw(ctx, nodes, [], null, null);  // Skip edges during sim ticks (too expensive)
        ctx.restore();
      })
      .on("end", () => {
        // Simulation settled — draw final frame, zoom to fit, then stop
        ctx.save();
        ctx.clearRect(0, 0, width, h);
        const transform = d3.zoomTransform(canvas);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);
        draw(ctx, nodes, edges, null, null);
        ctx.restore();

        // Zoom to fit the settled layout
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

    // ── Click handler for node selection ──────────────
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const transform = d3.zoomTransform(canvas);
      const mx = (event.clientX - rect.left - transform.x) / transform.k;
      const my = (event.clientY - rect.top - transform.y) / transform.k;

      // Find closest node
      let closest: GraphNode | null = null;
      let minDist = 30; // hit radius
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

    // ── Hover for tooltips ────────────────────────────
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

  // ── Re-highlight selected node without re-running sim ─
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
          className="absolute pointer-events-none px-2 py-1 rounded-lg bg-[#171729]/90 border border-[rgba(216,180,254,0.15)] text-xs text-[#f5f2ff] backdrop-blur-sm z-10 transition-opacity"
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

// ─── Drawing helpers ─────────────────────────────────
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
  // ── Edges ────────────────────────────────────────
  for (const e of edges) {
    const source = e.source as GraphNode;
    const target = e.target as GraphNode;
    if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.12)";
    ctx.lineWidth = Math.max(0.5, Math.min(2, Math.sqrt(
      ((source.linkCount || 0) + (target.linkCount || 0)) / 2
    ) * 0.5));
    ctx.stroke();
  }

  // ── Nodes ────────────────────────────────────────
  for (const n of nodes) {
    if (n.x === undefined || n.y === undefined) continue;

    const r = nodeRadius(n);
    const color = colorForType(n.type);

    // Glow
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = color + "15";
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + "30";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label (only for larger nodes or if zoomed in)
    if (r > 7 || n.linkCount > 2) {
      const label = n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label;
      ctx.font = `${Math.max(8, r * 0.9)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#d9d1ed";
      ctx.textAlign = "center";
      ctx.fillText(label, n.x, n.y + r + 14);
    }
  }
}
