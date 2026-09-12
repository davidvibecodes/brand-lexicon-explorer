import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import type { GraphNode, GraphEdge } from "@/lib/conceptnet";
import { COLORS } from "@/lib/conceptnet";

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

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
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
  const simRef = useRef<{ nodes: SimNode[]; alpha: number } | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const animFrameRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastNodePosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const tickRef = useRef(0);

  // Initialize custom force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    // Convert to simulation nodes
    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.id,
      x: dimensions.width / 2 + (Math.random() - 0.5) * 200,
      y: dimensions.height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      fx: n.isCenter ? dimensions.width / 2 : null,
      fy: n.isCenter ? dimensions.height / 2 : null,
    }));

    const sim = {
      nodes: simNodes,
      alpha: 1.0,
      alphaDecay: 0.02,
      velocityDecay: 0.3,
    };

    // Build edge index
    const edgeMap = new Map<string, string[]>();
    for (const e of edges) {
      const s = typeof e.source === "string" ? e.source : (e.source as any).id;
      const t = typeof e.target === "string" ? e.target : (e.target as any).id;
      if (!edgeMap.has(s)) edgeMap.set(s, []);
      edgeMap.get(s)!.push(t);
      if (!edgeMap.has(t)) edgeMap.set(t, []);
      edgeMap.get(t)!.push(s);
    }

    let running = true;
    let frameCount = 0;

    const tick = () => {
      if (!running) return;
      
      frameCount++;
      sim.alpha *= (1 - sim.alphaDecay);
      if (sim.alpha < 0.001) sim.alpha = 0;

      const alpha = sim.alpha;

      // Center force
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const centerStrength = 0.05 * alpha;

      // Re-center only center node
      for (const n of sim.nodes) {
        const nodeData = nodes.find((nd) => nd.id === n.id);
        if (nodeData?.isCenter) {
          n.vx += (cx - n.x) * centerStrength;
          n.vy += (cy - n.y) * centerStrength;
        }
      }

      // Link force (spring)
      const linkDistance = 150;
      const linkStrength = 0.4 * alpha;

      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as any).id;
        const t = typeof e.target === "string" ? e.target : (e.target as any).id;
        const sn = sim.nodes.find((n) => n.id === s);
        const tn = sim.nodes.find((n) => n.id === t);
        if (!sn || !tn) continue;

        const dx = tn.x - sn.x;
        const dy = tn.y - sn.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - linkDistance) * linkStrength;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (sn.fx !== null && sn.fx !== undefined) {
          // Don't move fixed nodes via links
        } else {
          sn.vx += fx;
          sn.vy += fy;
        }
        if (tn.fx !== null && tn.fx !== undefined) {
          // Don't move fixed nodes via links
        } else {
          tn.vx -= fx;
          tn.vy -= fy;
        }
      }

      // Many-body force (repulsion)
      const chargeStrength = -800 * alpha;
      for (let i = 0; i < sim.nodes.length; i++) {
        for (let j = i + 1; j < sim.nodes.length; j++) {
          const a = sim.nodes[i];
          const b = sim.nodes[j];
          if (a.fx !== null && a.fx !== undefined && b.fx !== null && b.fx !== undefined) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          const force = chargeStrength / distSq;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (a.fx === null || a.fx === undefined) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (b.fx === null || b.fx === undefined) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // Apply velocities
      for (const n of sim.nodes) {
        if (n.fx !== null && n.fx !== undefined) {
          n.vx *= 0.5;
          n.vy *= 0.5;
        }
        n.vx *= (1 - sim.velocityDecay);
        n.vy *= (1 - sim.velocityDecay);
        n.x += n.vx;
        n.y += n.vy;
      }

      // Store positions
      for (const n of sim.nodes) {
        lastNodePosRef.current.set(n.id, { x: n.x, y: n.y });
      }

      if (sim.alpha > 0.001 || frameCount < 5) {
        requestAnimationFrame(tick);
      }
    };

    // Initial positioning
    tick();

    simRef.current = sim;

    return () => {
      running = false;
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
        const sourcePos = lastNodePosRef.current.get(
          typeof edge.source === "string" ? edge.source : (edge.source as any).id
        );
        const targetPos = lastNodePosRef.current.get(
          typeof edge.target === "string" ? edge.target : (edge.target as any).id
        );

        if (!sourcePos || !targetPos) continue;

        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);

        const targetNode = nodes.find(
          (n) => n.id === (typeof edge.target === "string" ? edge.target : (edge.target as any).id)
        );
        const edgeOpacity = targetNode ? Math.max(0.15, 1 - targetNode.blur * 0.7) : 0.6;

        ctx.strokeStyle = color;
        ctx.globalAlpha = edgeOpacity;
        ctx.lineWidth = 1.5 / k;
        ctx.stroke();

        if (k > 0.5) {
          const mx = (sourcePos.x + targetPos.x) / 2;
          const my = (sourcePos.y + targetPos.y) / 2;
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
        const pos = lastNodePosRef.current.get(node.id);
        if (!pos) continue;

        const radius = node.isCenter ? 24 : 16;
        const opacity = Math.max(0.15, 1 - node.blur);

        ctx.globalAlpha = opacity;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

        const isBrandGreen = node.color === COLORS.green;
        const baseColor = isBrandGreen ? COLORS.green : color;
        ctx.fillStyle = baseColor;
        ctx.fill();

        if (node.isCenter) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3 / k;
          ctx.stroke();
        }

        ctx.fillStyle = "#fff";
        ctx.font = `bold ${node.isCenter ? 13 : 11}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const label = node.label.length > 12
          ? node.label.substring(0, 11) + "…"
          : node.label;
        ctx.fillText(label, pos.x, pos.y);

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

  const findNodeAt = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const { x: tx, y: ty, k } = transformRef.current;

      const gx = (clientX - rect.left - tx) / k;
      const gy = (clientY - rect.top - ty) / k;

      for (const node of nodes) {
        const pos = lastNodePosRef.current.get(node.id);
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

  const lastClickTime = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) {
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };

        // Fix node position during drag
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && simRef.current) {
          const simNode = simRef.current.nodes.find((n) => n.id === node.id);
          if (simNode) {
            simNode.fx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
            simNode.fy = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          }
        }
      } else {
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [findNodeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const node = findNodeAt(e.clientX - dx, e.clientY - dy);

      if (node && simRef.current) {
        const simNode = simRef.current.nodes.find((n) => n.id === node.id);
        if (simNode) {
          const { x: tx, y: ty, k } = transformRef.current;
          simNode.fx = (e.clientX - rect.left - tx) / k;
          simNode.fy = (e.clientY - rect.top - ty) / k;
        }
      } else {
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

      if (node && simRef.current) {
        const simNode = simRef.current.nodes.find((n) => n.id === node.id);
        if (simNode) {
          simNode.fx = simNode.x;
          simNode.fy = simNode.y;
        }
      }

      const now = Date.now();
      const timeSinceLast = now - lastClickTime.current;
      lastClickTime.current = now;

      if (node) {
        if (timeSinceLast < 300) {
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
          onNodeDoubleClick?.(node);
        } else {
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { x: tx, y: ty, k } = transformRef.current;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newK = Math.max(0.1, Math.min(5, k * factor));

    transformRef.current.k = newK;
    transformRef.current.x = mx - (mx - tx) * (newK / k);
    transformRef.current.y = my - (my - ty) * (newK / k);
  }, []);

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

  const centerGraph = useCallback(() => {
    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const pos of lastNodePosRef.current.values()) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }

    if (minX === Infinity) return;

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

  useEffect(() => {
    const timer = setTimeout(centerGraph, 150);
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
