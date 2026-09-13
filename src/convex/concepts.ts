"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

interface ConceptSuggestion {
  term: string;
  label: string;
  language: string;
}

// Normalized edge shape: always oriented relative to the queried word.
// relatedUri/relatedLabel always point to whichever side of the assertion
// is NOT the query word, no matter which direction ConceptNet asserted it.
export interface RelatedEdge {
  id: string;
  relatedUri: string;
  relatedLabel: string;
  relation: string;
  weight: number;
  surfaceText?: string;
}

// Build the ConceptNet concept URI for a query word the same way the
// frontend does: trimmed, lowercased, spaces → underscores (ConceptNet's
// convention). This is the canonical comparison target for normalization.
function toConceptUri(word: string): string {
  return `/c/en/${word.trim().toLowerCase().replace(/\s+/g, "_")}`;
}

// Fetch related concepts for a word from ConceptNet, normalizing direction
// relative to the queried word. The /c/en/{word} lookup returns edges where
// the word may appear as EITHER e.start or e.end, so we compare the word's
// own URI against both sides and emit the other side as "related".
// Caching is handled by the frontend via separate mutations.
export const fetchRelated = action({
  args: {
    word: v.string(),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (_, { word, limit, offset }): Promise<RelatedEdge[]> => {
    // ConceptNet URIs use underscores for spaces; the path segment must be
    // normalized ("ice cream" → "ice_cream") before hitting the API.
    const uriSegment = word.trim().toLowerCase().replace(/\s+/g, "_");
    const url = `${CONCEPTNET_BASE}/c/en/${encodeURIComponent(uriSegment)}?limit=${limit}&offset=${offset}&filter=/c/en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ConceptNet error: ${res.status}`);

    const data: ConceptNetResponse = await res.json();

    const queryUri = toConceptUri(word);

    const edges = data.edges
      .filter((e) => e.start.language === "en" && e.end.language === "en")
      .sort((a, b) => b.weight - a.weight);

    const normalized: RelatedEdge[] = [];
    for (const e of edges) {
      // Case-insensitive comparison of both sides against the query word's
      // own URI (underscore convention applied above).
      const startIsQuery = e.start.term.trim().toLowerCase() === queryUri;
      const endIsQuery = e.end.term.trim().toLowerCase() === queryUri;

      if (startIsQuery && !endIsQuery) {
        // Query word is the start → the related concept is the end.
        normalized.push({
          id: e["@id"],
          relatedUri: e.end.term,
          relatedLabel: e.end.label,
          relation: e.rel.label,
          weight: e.weight,
          surfaceText: e.surfaceText,
        });
      } else if (endIsQuery && !startIsQuery) {
        // Query word is the end → the related concept is the start.
        normalized.push({
          id: e["@id"],
          relatedUri: e.start.term,
          relatedLabel: e.start.label,
          relation: e.rel.label,
          weight: e.weight,
          surfaceText: e.surfaceText,
        });
      }
      // Self-loops (both sides are the query word) and edges where neither
      // side matches (shouldn't happen) are dropped per the contract.
    }

    return normalized;
  },
});

// Search concepts for typeahead suggestions.
//
// ConceptNet's /query endpoint matches its criteria LITERALLY (the backend
// runs JSONB containment against indexed URI prefix lists — there is no
// wildcard handling anywhere in its query path), so a trailing-* prefix
// search on `start` would silently match nothing. Instead:
//   1. Check the app's own concept_cache table for a label/URI prefix match
//      (concepts already seen by this deployment), and
//   2. fall back to an exact-match /c/en/{q} lookup against ConceptNet only
//      when the cache has nothing.
export const searchConcepts = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<ConceptSuggestion[]> => {
    if (!query || query.length < 2) return [];

    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    if (!q) return [];

    // 1) Local cache first — instant, and no load on the shared API.
    const cached: ConceptSuggestion[] = await ctx.runQuery(
      api.cache.searchCachedConcepts,
      { q }
    );
    if (cached.length > 0) return cached;

    // 2) Cache miss: exact-match lookup of /c/en/{q} on the live API.
    try {
      const res = await fetch(
        `${CONCEPTNET_BASE}/c/en/${encodeURIComponent(q)}?limit=1`
      );
      if (!res.ok) return [];
      const data: ConceptNetResponse = await res.json();
      if (!data.edges || data.edges.length === 0) return [];

      // The exact word exists. Prefer the API's display label from
      // whichever side of the first edge IS the query concept.
      const first = data.edges[0];
      const queryUri = toConceptUri(query);
      const label =
        first.start.term.trim().toLowerCase() === queryUri
          ? first.start.label
          : first.end.term.trim().toLowerCase() === queryUri
            ? first.end.label
            : q;

      return [
        {
          term: queryUri,
          label,
          language: "en",
        },
      ];
    } catch {
      return [];
    }
  },
});
