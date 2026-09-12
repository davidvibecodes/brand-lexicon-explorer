import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force";
import type { GraphNode, GraphEdge } from "@/lib/conceptnet";
import { extractWordFromUri, COLORS } from "@/lib/conceptnet";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  color: string;
  onNodeClick?: (node: GraphNode, clientX: number, clientY: number) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  onCanvasClick?: () => void;
  showMoreButton?: ReactNode;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export default function GraphCanvas({
  nodes,
  edges,
  color,
  onNodeClick,
  onNodeDoubleClick,
  onCanvasClick,
  showMoreButton,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const animFrameRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Track the center node for highlighting
  const centerNode = nodes.find((n) => n.isCenter);

  // Initialize d3-force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const sim = forceSimulation(nodes as any)
      .force(
        "charge",
        forceManyBody()
          .strength(-300)
          .distanceMax(400)
      )
      .force(
        "link",
        forceLink(edges as any)
          .id((d: any) => d.id)
          .distance(120)
          .strength(0.5)
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force(
        "collision",
        forceCollide().radius(40)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    sim.on("tick", () => {
      // Store positions for rendering
      nodes.forEach((n) => {
        nodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
      });
    });

    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, edges, dimensions.width, dimensions.height]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const dpr = window.devicePixelRatio || 1;
      const w = dimensions.width;
      const h = dimensions.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { x: tx, y: ty, k } = transformRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(k, k);

      // Draw edges
      for (const edge of edges) {
        const sourceNode = nodePositionsRef.current.get(
          typeof edge.source === "string" ? edge.source : (edge.source as any).id
        );
        const targetNode = nodePositionsRef.current.get(
          typeof edge.target === "string" ? edge.target : (edge.target as any).id
        );

        if (!sourceNode || !targetNode) continue;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        // Edge opacity based on target node's blur
        const targetGraphNode = nodes.find(
          (n) => n.id === (typeof edge.target === "string" ? edge.target : (edge.target as any).id)
        );
        const edgeOpacity = targetGraphNode ? 1 - targetGraphNode.blur * 0.7 : 0.6;

        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.max(0.15, edgeOpacity);
        ctx.lineWidth = 1.5 / k;
        ctx.stroke();

        // Edge label
        if (k > 0.5) {
          const mx = (sourceNode.x + targetNode.x) / 2;
          const my = (sourceNode.y + targetNode.y) / 2;
          ctx.globalAlpha = Math.max(0.1, edgeOpacity * 0.7);
          ctx.fillStyle = "#888";
          ctx.font = `${10 / k}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(edge.relation, mx, my - 4 / k);
        }
      }

      ctx.globalAlpha = 1;

      // Draw nodes
      for (const node of nodes) {
        const pos = nodePositionsRef.current.get(node.id);
        if (!pos) continue;

        const radius = node.isCenter ? 24 : 16;
        const opacity = Math.max(0.15, 1 - node.blur);

        ctx.globalAlpha = opacity;

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

        const isBrandGreen = node.color === COLORS.green;
        const baseColor = isBrandGreen ? COLORS.green : color;
        ctx.fillStyle = baseColor;
        ctx.fill();

        // White border for center node
        if (node.isCenter) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3 / k;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${node.isCenter ? 13 : 11}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const label = node.label.length > 12
          ? node.label.substring(0, 11) + "…"
          : node.label;
        ctx.fillText(label, pos.x, pos.y);

        // Relation label below non-center nodes
        if (!node.isCenter && node.pos && k > 0.6) {
          ctx.globalAlpha = opacity * 0.6;
          ctx.fillStyle = "#666";
          ctx.font = `${9 / k}px "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(node.pos, pos.x, pos.y + radius + 12 / k);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, color, dimensions]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Find node at position
  const findNodeAt = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const { x: tx, y: ty, k } = transformRef.current;

      // Convert client coords to graph coords
      const gx = (clientX - rect.left - tx) / k;
      const gy = (clientY - rect.top - ty) / k;

      for (const node of nodes) {
        const pos = nodePositionsRef.current.get(node.id);
        if (!pos) continue;
        const r = node.isCenter ? 24 : 16;
        const dx = pos.x - gx;
        const dy = pos.y - gy;
        if (dx * dx + dy * dy < r * r) {
          return node;
        }
      }
      return null;
    },
    [nodes]
  );

  // Mouse interaction
  const lastClickTime = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) {
        // Start dragging the node
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };

        if (simRef.current) {
          const simNode = (simRef.current.nodes() as any[]).find(
            (n) => n.id === node.id
          );
          if (simNode) {
            simNode.fx = simNode.x;
            simNode.fy = simNode.y;
          }
        }
      } else {
        // Start panning
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [findNodeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const node = findNodeAt(e.clientX - dx, e.clientY - dy);

      if (node && simRef.current) {
        // Move the node
        const simNode = (simRef.current.nodes() as any[]).find(
          (n) => n.id === node.id
        );
        if (simNode) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const { x: tx, y: ty, k } = transformRef.current;
            simNode.fx = (e.clientX - rect.left - tx) / k;
            simNode.fy = (e.clientY - rect.top - ty) / k;
          }
        }
      } else {
        // Pan the canvas
        transformRef.current.x += dx;
        transformRef.current.y += dy;
      }

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [findNodeAt]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const node = findNodeAt(e.clientX, e.clientY);

      // Release fixed node
      if (node && simRef.current) {
        const simNode = (simRef.current.nodes() as any[]).find(
          (n) => n.id === node.id
        );
        if (simNode) {
          simNode.fx = null;
          simNode.fy = null;
        }
        simRef.current.alpha(0.3).restart();
      }

      // Handle click / double-click
      const now = Date.now();
      const timeSinceLast = now - lastClickTime.current;
      lastClickTime.current = now;

      if (node) {
        if (timeSinceLast < 300) {
          // Double-click
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
          onNodeDoubleClick?.(node);
        } else {
          // Single click with delay to detect double
          clickTimeoutRef.current = setTimeout(() => {
            onNodeClick?.(node, e.clientX, e.clientY);
            clickTimeoutRef.current = null;
          }, 300);
        }
      } else if (timeSinceLast > 300) {
        onCanvasClick?.();
      }
    },
    [findNodeAt, onNodeClick, onNodeDoubleClick, onCanvasClick]
  );

  // Zoom with scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { x: tx, y: ty, k } = transformRef.current;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newK = Math.max(0.1, Math.min(5, k * factor));

    // Zoom toward mouse position
    transformRef.current.k = newK;
    transformRef.current.x = mx - (mx - tx) * (newK / k);
    transformRef.current.y = my - (my - ty) * (newK / k);
  }, []);

  // Touch support
  const lastTouchDist = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const node = findNodeAt(touch.clientX, touch.clientY);
        isDraggingRef.current = true;
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
      }
    },
    [findNodeAt]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDraggingRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;

        // Pan
        transformRef.current.x += dx;
        transformRef.current.y += dy;

        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (lastTouchDist.current > 0) {
          const factor = dist / lastTouchDist.current;
          const { k } = transformRef.current;
          transformRef.current.k = Math.max(0.1, Math.min(5, k * factor));
        }

        lastTouchDist.current = dist;
      }
    },
    []
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
      lastTouchDist.current = 0;
    }
  }, []);

  // Center graph on nodes
  const centerGraph = useCallback(() => {
    if (nodes.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    nodes.forEach((n) => {
      const pos = nodePositionsRef.current.get(n.id);
      if (pos) {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }
    });

    const graphWidth = maxX - minX + 200;
    const graphHeight = maxY - minY + 200;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const scale = Math.min(
      dimensions.width / graphWidth,
      dimensions.height / graphHeight,
      1.5
    );

    transformRef.current = {
      x: dimensions.width / 2 - cx * scale,
      y: dimensions.height / 2 - cy * scale,
      k: scale,
    };
  }, [nodes, dimensions]);

  // Center on mount or when nodes change significantly
  useEffect(() => {
    const timer = setTimeout(centerGraph, 100);
    return () => clearTimeout(timer);
  }, [centerGraph]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {showMoreButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          {showMoreButton}
        </div>
      )}
    </div>
  );
}
