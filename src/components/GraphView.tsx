"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import type { CountryData } from "@/lib/aggregation";

interface GraphNode {
  id: string;
  label: string;
  type: "artist" | "country" | "genre" | "language";
  val: number; // node size
  color: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const NODE_COLORS = {
  country: "#1DB954",   // Spotify green
  artist: "#b3b3b3",    // light grey
  genre: "#e040fb",     // vivid pink
  language: "#40c4ff",  // cyan
};

const LINK_COLORS = {
  country: "rgba(29,185,84,0.7)",
  genre: "rgba(224,64,251,0.5)",
  language: "rgba(64,196,255,0.5)",
};

function buildGraphData(countryData: CountryData[]): GraphData {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  for (const country of countryData) {
    if (country.countryCode === "XX") continue;

    const cId = `country:${country.countryCode}`;
    if (!nodes.has(cId)) {
      nodes.set(cId, {
        id: cId,
        label: country.countryName,
        type: "country",
        val: Math.max(4, Math.sqrt(country.artistCount) * 3),
        color: NODE_COLORS.country,
      });
    }

    for (const artist of country.topArtists) {
      const aId = `artist:${artist.id}`;
      if (!nodes.has(aId)) {
        nodes.set(aId, {
          id: aId,
          label: artist.name,
          type: "artist",
          val: 2,
          color: NODE_COLORS.artist,
        });
      }
      links.push({ source: aId, target: cId, color: LINK_COLORS.country });

      for (const genre of (artist.genres ?? []).slice(0, 2)) {
        const gId = `genre:${genre}`;
        if (!nodes.has(gId)) {
          nodes.set(gId, {
            id: gId,
            label: genre,
            type: "genre",
            val: 1.5,
            color: NODE_COLORS.genre,
          });
        }
        // Increment genre node size
        const gNode = nodes.get(gId)!;
        gNode.val = Math.min(10, gNode.val + 0.3);
        links.push({ source: aId, target: gId, color: LINK_COLORS.genre });
      }
    }

    for (const lang of country.languages) {
      const lId = `language:${lang}`;
      if (!nodes.has(lId)) {
        nodes.set(lId, {
          id: lId,
          label: lang,
          type: "language",
          val: 3,
          color: NODE_COLORS.language,
        });
      }
      const lNode = nodes.get(lId)!;
      lNode.val = Math.min(12, lNode.val + 0.5);
      links.push({ source: cId, target: lId, color: LINK_COLORS.language });
    }
  }

  return { nodes: Array.from(nodes.values()), links };
}

export default function GraphView({ countryData }: { countryData: CountryData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [ForceGraph, setForceGraph] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Dynamically import react-force-graph-2d (client-only)
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const prevData = useRef<GraphData>({ nodes: [], links: [] });

  const graphData = useMemo(() => {
    const newData = buildGraphData(countryData);
    
    // Stable identity mapping: Preserve exactly the same objects for existing nodes
    // so that react-force-graph doesn't reset velocity/x/y physics.
    const oldNodes = new Map(prevData.current.nodes.map((n) => [n.id, n]));
    
    for (let i = 0; i < newData.nodes.length; i++) {
      const newNode = newData.nodes[i];
      const existing = oldNodes.get(newNode.id);
      if (existing) {
        // Carry forward mutable attributes but keep old reference!
        existing.val = newNode.val;
        existing.color = newNode.color;
        // Replace in new array with exact old reference
        newData.nodes[i] = existing;
      }
    }
    
    prevData.current = newData;
    return newData;
  }, [countryData]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node || null);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = Math.sqrt(node.val) * 2.5;
      const isHovered = hoveredNode?.id === node.id;
      const fontSize = Math.max(10 / globalScale, 1.5);

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = isHovered ? 1 : (node.type === "artist" ? 0.5 : 0.8);
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Draw label for non-artist nodes, or when hovered/zoomed
      if (node.type !== "artist" || isHovered || globalScale > 2.5) {
        ctx.font = `${node.type === "artist" ? "" : "bold "}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#fff" : "rgba(255,255,255,0.7)";
        ctx.fillText(node.label, x, y + r + 2 / globalScale);
      }
    },
    [hoveredNode]
  );

  if (!ForceGraph) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <ForceGraph
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeVal="val"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
          const r = Math.sqrt(node.val) * 2.5;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r + 2, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={(link: GraphLink) => link.color}
        linkWidth={3}
        linkDirectionalParticles={0}
        onNodeHover={handleNodeHover}
        backgroundColor="transparent"
        cooldownTicks={100}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.3}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 bg-surface/80 backdrop-blur-sm rounded-xl px-4 py-2 pointer-events-none">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 right-4 bg-surface border border-border rounded-xl px-4 py-3 pointer-events-none shadow-lg max-w-[200px]">
          <div className="text-xs text-accent uppercase font-semibold tracking-wider mb-1">{hoveredNode.type}</div>
          <div className="text-sm font-medium truncate">{hoveredNode.label}</div>
        </div>
      )}
    </div>
  );
}
