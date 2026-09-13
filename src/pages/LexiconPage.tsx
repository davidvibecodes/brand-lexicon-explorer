import { useState, useEffect, useCallback } from "react";
import { useAction, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import GraphCanvas from "@/components/GraphCanvas";
import { SearchBox } from "@/components/SearchBox";
import AddBrandWordPanel from "@/components/AddBrandWordPanel";
import { NodePopover } from "@/components/NodePopover";
import {
  pickRandomSeed,
  extractWordFromUri,
  toConceptUri,
  COLORS,
  type GraphNode,
  type GraphEdge,
  type RelatedEdge,
} from "@/lib/conceptnet";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, List, Accessibility, AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router";

// Shape returned by the cache query (edge_cache rows).
interface CachedEdgeRow {
  start_uri: string;
  end_uri: string;
  relation: string;
  weight: number;
  surface_text?: string;
}

// Pull the raw query word out of a /c/en/ URI WITHOUT converting underscores
// to spaces — that output is going straight back into a URI/API call, so it
// must stay in ConceptNet's underscore form. (extractWordFromUri is for
// display only.)
function uriToQueryWord(uri: string): string {
  return uri.startsWith("/c/en/") ? uri.slice("/c/en/".length) : uri;
}

// Normalize a cached edge_cache row (raw start/end) relative to the center
// word's URI, producing the same RelatedEdge shape the live action returns.
// Cached rows carry no labels, so the label is derived from the related
// URI for display only.
function normalizeCachedEdge(
  row: CachedEdgeRow,
  centerUri: string
): RelatedEdge | null {
  let relatedUri: string;
  if (row.start_uri === centerUri) {
    relatedUri = row.end_uri;
  } else if (row.end_uri === centerUri) {
    relatedUri = row.start_uri;
  } else {
    // Neither side is the center word — cache inconsistency; drop it.
    return null;
  }
  return {
    id: `${row.start_uri}|${row.relation}|${row.end_uri}`,
    relatedUri,
    relatedLabel: extractWordFromUri(relatedUri),
    relation: row.relation,
    weight: row.weight,
    surfaceText: row.surface_text,
  };
}

export default function LexiconPage() {
  const [centerWord, setCenterWord] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popover, setPopover] = useState<{
    label: string;
    relation?: string;
    x: number;
    y: number;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  const fetchRelated = useAction(api.concepts.fetchRelated);
  const upsertEdge = useMutation(api.cache.upsertEdge);
  const insertConcept = useMutation(api.cache.insertConcept);
  const convex = useConvex();
  const [searchParams] = useSearchParams();

  // Load a word's neighborhood.
  // Order of operations per word page: 1) DB cache lookup, 2) live
  // ConceptNet fetch on cache miss, 3) cache write-back after a live fetch.
  const loadWord = useCallback(
    async (word: string, currentOffset = 0, append = false) => {
      setLoading(true);
      if (!append) {
        // Fresh center: clear old content so a failure lands on the error
        // state instead of silently showing a stale graph.
        setNodes([]);
        setEdges([]);
      }

      const centerUri = toConceptUri(word);

      try {
        let result: RelatedEdge[];

        // 1) Server-side cache first — revisits of a seen word are instant.
        let cached: CachedEdgeRow[] | null = null;
        try {
          cached = await convex.query(api.cache.getCachedEdgesByUri, {
            concept_uri: centerUri,
            limit: 15,
            offset: currentOffset,
          });
        } catch {
          cached = null; // cache read failure → fall through to live fetch
        }

        if (cached && cached.length > 0) {
          result = cached
            .map((row) => normalizeCachedEdge(row, centerUri))
            .filter((e): e is RelatedEdge => e !== null);
        } else {
          // 2) Cache miss → live ConceptNet fetch.
          result = await fetchRelated({
            word,
            limit: 15,
            offset: currentOffset,
          });

          // 3) Write back to the cache (non-blocking). Edges are stored
          // oriented from the center word so cache reads normalize cleanly.
          void Promise.all([
            insertConcept({
              concept_uri: centerUri,
              label: extractWordFromUri(centerUri),
              language: "en",
              degree: result.length,
            }),
            ...result.map((e) =>
              upsertEdge({
                edge_id: e.id,
                start_uri: centerUri,
                end_uri: e.relatedUri,
                relation: e.relation,
                weight: e.weight,
                surface_text: e.surfaceText,
              })
            ),
          ]).catch((cacheErr) => {
            console.error("Cache write-back failed:", cacheErr);
          });
        }

        const maxWeight = Math.max(...result.map((e) => e.weight), 1);
        const minWeight = Math.min(...result.map((e) => e.weight), 0);
        const weightRange = maxWeight - minWeight || 1;

        // Satellite nodes come strictly from relatedUri/relatedLabel.
        const newEdges: GraphEdge[] = result.map((e) => ({
          source: centerUri,
          target: e.relatedUri,
          relation: e.relation,
          weight: e.weight,
          surfaceText: e.surfaceText,
        }));

        const newNodes: GraphNode[] = result.map((e) => {
          const normalizedWeight = (e.weight - minWeight) / weightRange;
          const blur = 1 - normalizedWeight; // Lower weight = more blur

          return {
            id: e.relatedUri,
            label: e.relatedLabel,
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
          const centerNode: GraphNode = {
            id: centerUri,
            label: extractWordFromUri(centerUri), // display only
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

        setError(null);
        setCenterWord(uriToQueryWord(centerUri));
        setOffset(currentOffset + result.length);
        setHasMore(result.length === 15);
      } catch (err) {
        console.error("Failed to load word:", err);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong while loading this word."
        );
      }
      setLoading(false);
    },
    [fetchRelated, convex, insertConcept, upsertEdge]
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
    setOffset(0);
    setHasMore(true);
    loadWord(word);
  }, [loadWord]);

  // Initial load: honor ?word= (view-as-graph deep link), else randomize
  useEffect(() => {
    const initialWord = searchParams.get("word");
    if (initialWord) {
      loadWord(decodeURIComponent(initialWord));
    } else {
      randomize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle double-click to re-center. node.id is the related concept's URI;
  // slice the raw segment (underscores intact) — never route the display
  // label back through a URI.
  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      const word = uriToQueryWord(node.id);
      setOffset(0);
      setHasMore(true);
      loadWord(word);
    },
    [loadWord]
  );

  // Handle single click for popover
  const handleNodeClick = useCallback(
    (node: GraphNode, clientX: number, clientY: number) => {
      if (node.isCenter) return;

      const centerUri = toConceptUri(centerWord);
      const connectingEdge = edges.find(
        (e) => e.source === centerUri && e.target === node.id
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

  // Search handler: SearchBox passes the full concept URI; slice the raw
  // word segment out of it.
  const handleSearch = useCallback(
    (term: string) => {
      setOffset(0);
      setHasMore(true);
      loadWord(uriToQueryWord(term));
    },
    [loadWord]
  );

  // Brand word save handler
  const handleBrandWordSaved = useCallback((_wordId: string) => {
    setPanelOpen(false);
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
            placeholder="Search the lexicon…"
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
              onClick={() => setPanelOpen(true)}
              title="Add brand word"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Center word label */}
        {centerWord && !error && (
          <div className="absolute top-16 left-4 z-10">
            <div
              className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold shadow-sm"
              style={{ backgroundColor: COLORS.blue }}
            >
              {extractWordFromUri(toConceptUri(centerWord))}
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
              hasMore && !loading && !error ? (
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
                {extractWordFromUri(toConceptUri(centerWord))} — Related Concepts
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
              {hasMore && !error && (
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
        {loading && nodes.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading concepts…</span>
            </div>
          </div>
        )}

        {/* Error / empty state — never a silent blank screen */}
        {!loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Couldn't load this word</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {error ??
                  "No related concepts were found for this word. Try another one."}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (centerWord) {
                      loadWord(centerWord);
                    } else {
                      randomize();
                    }
                  }}
                >
                  Try again
                </Button>
                <Button size="sm" onClick={randomize}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Randomize
                </Button>
              </div>
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
        onClose={() => setPanelOpen(false)}
        mode="personal"
        onSaved={handleBrandWordSaved}
      />
    </div>
  );
}
