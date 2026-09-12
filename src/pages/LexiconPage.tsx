import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import GraphCanvas from "@/components/GraphCanvas";
import { SearchBox } from "@/components/SearchBox";
import AddBrandWordPanel from "@/components/AddBrandWordPanel";
import { NodePopover } from "@/components/NodePopover";
import {
  pickRandomSeed,
  extractWordFromUri,
  COLORS,
  type GraphNode,
  type GraphEdge,
} from "@/lib/conceptnet";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, List, Accessibility } from "lucide-react";

export default function LexiconPage() {
  const [centerWord, setCenterWord] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [popover, setPopover] = useState<{
    label: string;
    relation?: string;
    x: number;
    y: number;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [listView, setListView] = useState(false);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  const fetchRelated = useAction(api.concepts.fetchRelated);

  // Load a word's neighborhood
  const loadWord = useCallback(
    async (word: string, currentOffset = 0, append = false) => {
      setLoading(true);
      try {
        const result = await fetchRelated({
          word,
          limit: 15,
          offset: currentOffset,
        });

        const newEdges: GraphEdge[] = result.map((e) => ({
          source: e.startUri,
          target: e.endUri,
          relation: e.relation,
          weight: e.weight,
          surfaceText: e.surfaceText,
        }));

        // Calculate distance from center for blur/opacity
        const maxWeight = Math.max(...result.map((e) => e.weight), 1);
        const minWeight = Math.min(...result.map((e) => e.weight), 0);
        const weightRange = maxWeight - minWeight || 1;

        const newNodes: GraphNode[] = result.map((e) => {
          const word = extractWordFromUri(e.endUri);
          const normalizedWeight = (e.weight - minWeight) / weightRange;
          const blur = 1 - normalizedWeight; // Lower weight = more blur

          return {
            id: e.endUri,
            label: word,
            x: 0,
            y: 0,
            fx: null,
            fy: null,
            isCenter: false,
            color: COLORS.blue,
            opacity: 0.3 + normalizedWeight * 0.7,
            blur: blur * 0.6,
          };
        });

        if (append) {
          setNodes((prev) => {
            const existing = new Set(prev.map((n) => n.id));
            const unique = newNodes.filter((n) => !existing.has(n.id));
            return [...prev, ...unique];
          });
          setEdges((prev) => [...prev, ...newEdges]);
        } else {
          // Center node
          const centerNode: GraphNode = {
            id: `/c/en/${word}`,
            label: word,
            x: 0,
            y: 0,
            fx: 0,
            fy: 0,
            isCenter: true,
            color: COLORS.blue,
            opacity: 1,
            blur: 0,
          };

          setNodes([centerNode, ...newNodes]);
          setEdges(newEdges);
        }

        setCenterWord(word);
        setOffset(currentOffset + result.length);
        setHasMore(result.length === 15);
      } catch (err) {
        console.error("Failed to load word:", err);
      }
      setLoading(false);
    },
    [fetchRelated]
  );

  // Load more edges
  const loadMore = useCallback(() => {
    if (centerWord) {
      loadWord(centerWord, offset, true);
    }
  }, [centerWord, offset, loadWord]);

  // Randomize: pick a random seed word
  const randomize = useCallback(() => {
    const word = pickRandomSeed();
    loadWord(word);
    setOffset(0);
    setHasMore(true);
  }, [loadWord]);

  // Initial load
  useEffect(() => {
    if (!centerWord) {
      randomize();
    }
  }, []);

  // Handle double-click to re-center
  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      const word = node.label;
      loadWord(word);
      setOffset(0);
      setHasMore(true);
    },
    [loadWord]
  );

  // Handle single click for popover
  const handleNodeClick = useCallback(
    (node: GraphNode, clientX: number, clientY: number) => {
      if (node.isCenter) return;

      // Find the edge that connects this node to center
      const connectingEdge = edges.find(
        (e) =>
          (e.source === `/c/en/${centerWord}` && e.target === node.id) ||
          (e.source === node.id && e.target === `/c/en/${centerWord}`)
      );

      setPopover({
        label: node.label,
        relation: connectingEdge?.relation,
        x: clientX,
        y: clientY,
      });
    },
    [edges, centerWord]
  );

  // Search handler
  const handleSearch = useCallback(
    (term: string) => {
      const word = term.replace("/c/en/", "").replace(/_/g, " ");
      loadWord(word);
      setOffset(0);
      setHasMore(true);
    },
    [loadWord]
  );

  // Brand word save handler
  const handleBrandWordSaved = useCallback((wordId: string) => {
    // Close panel and re-center on the brand word
    setPanelOpen(false);
    setPanelWidth(0);
  }, []);

  return (
    <div className="flex h-full">
      {/* Graph / List area */}
      <div
        className="flex-1 relative transition-all duration-200"
        style={{ width: panelOpen ? "calc(100% - 420px)" : "100%" }}
      >
        {/* Top bar with search and controls */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3">
          <SearchBox
            onSelect={handleSearch}
            placeholder="Search any word…"
            className="w-72"
          />

          <div className="flex items-center gap-1.5 ml-auto">
            {/* View mode toggle */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={() =>
                setViewMode((prev) => (prev === "graph" ? "list" : "graph"))
              }
              title={
                viewMode === "graph"
                  ? "Switch to accessible list view"
                  : "Switch to graph view"
              }
            >
              {viewMode === "graph" ? (
                <Accessibility className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </Button>

            {/* Randomize */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={randomize}
              title="Random word"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Add brand word */}
            <Button
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm border border-border"
              onClick={() => {
                setPanelOpen(true);
                setPanelWidth(420);
              }}
              title="Add brand word"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Center word label */}
        {centerWord && (
          <div className="absolute top-16 left-4 z-10">
            <div
              className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold shadow-sm"
              style={{ backgroundColor: COLORS.blue }}
            >
              {centerWord}
            </div>
          </div>
        )}

        {/* Graph canvas or list view */}
        {viewMode === "graph" ? (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            color={COLORS.blue}
            onNodeClick={(node, clientX, clientY) => {
              handleNodeClick(node, clientX, clientY);
            }}
            onNodeDoubleClick={handleNodeDoubleClick}
            showMoreButton={
              hasMore && !loading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  className="bg-background/80 backdrop-blur-sm"
                >
                  Show more
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="h-full overflow-auto pt-24 pb-8 px-6">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.blue }}>
                {centerWord} — Related Concepts
              </h3>
              <div className="space-y-1">
                {edges.map((edge, i) => {
                  const word = extractWordFromUri(edge.target);
                  return (
                    <div
                      key={`${edge.source}-${edge.target}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onDoubleClick={() => {
                        const node: GraphNode = {
                          id: edge.target,
                          label: word,
                          x: 0,
                          y: 0,
                          fx: null,
                          fy: null,
                          isCenter: false,
                          color: COLORS.blue,
                          opacity: 1,
                          blur: 0,
                        };
                        handleNodeDoubleClick(node);
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS.blue }}
                      />
                      <span className="text-sm font-medium">{word}</span>
                      <span className="text-xs text-muted-foreground">
                        {edge.relation}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        w: {edge.weight.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  className="mt-4"
                >
                  Show more
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading concepts…</span>
            </div>
          </div>
        )}

        {/* Attribution footer */}
        <div className="absolute bottom-3 right-4 z-10 text-[10px] text-muted-foreground/60">
          Word data from ConceptNet 5, used under CC BY-SA 4.0
        </div>
      </div>

      {/* Node popover */}
      {popover && (
        <NodePopover
          label={popover.label}
          relation={popover.relation}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
        />
      )}

      {/* Add Brand Word Panel */}
      <AddBrandWordPanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setPanelWidth(0);
        }}
        mode="personal"
        onSaved={handleBrandWordSaved}
      />
    </div>
  );
}
