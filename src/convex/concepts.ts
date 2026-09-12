"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const CONCEPTNET_BASE = "https://api.conceptnet.io";

interface ConceptNetNode {
  label: string;
  term: string;
  language: string;
}

interface ConceptNetEdge {
  "@id": string;
  start: ConceptNetNode;
  end: ConceptNetNode;
  rel: { label: string };
  weight: number;
  surfaceText?: string;
}

interface ConceptNetResponse {
  edges: ConceptNetEdge[];
}

export interface FetchedEdge {
  id: string;
  startUri: string;
  endUri: string;
  relation: string;
  weight: number;
  surfaceText?: string;
}

// Fetch related concepts for a word from ConceptNet
// Caching is handled by the frontend via separate mutations
export const fetchRelated = action({
  args: {
    word: v.string(),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (_, { word, limit, offset }): Promise<FetchedEdge[]> => {
    const url = `${CONCEPTNET_BASE}/c/en/${encodeURIComponent(word)}?limit=${limit}&offset=${offset}&filter=/c/en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ConceptNet error: ${res.status}`);

    const data: ConceptNetResponse = await res.json();

    const edges = data.edges
      .filter((e) => e.start.language === "en" && e.end.language === "en")
      .sort((a, b) => b.weight - a.weight);

    return edges.map((e): FetchedEdge => ({
      id: e["@id"],
      startUri: e.start.term,
      endUri: e.end.term,
      relation: e.rel.label,
      weight: e.weight,
      surfaceText: e.surfaceText,
    }));
  },
});

// Search concepts by prefix for typeahead suggestions
export const searchConcepts = action({
  args: { query: v.string() },
  handler: async (_, { query }) => {
    if (!query || query.length < 2) return [];

    const url = `${CONCEPTNET_BASE}/query?start=/c/en/${encodeURIComponent(query)}*&limit=10&filter=/c/en`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data: ConceptNetResponse = await res.json();

      const seen = new Set<string>();
      const results: Array<{
        term: string;
        label: string;
        language: string;
      }> = [];

      for (const edge of data.edges) {
        for (const node of [edge.start, edge.end]) {
          if (!seen.has(node.term) && node.language === "en") {
            seen.add(node.term);
            results.push({
              term: node.term,
              label: node.label,
              language: node.language,
            });
          }
        }
      }

      return results.slice(0, 8);
    } catch {
      return [];
    }
  },
});
