import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────────

// Label/URI prefix search over concepts already cached by this deployment.
// Backs searchConcepts' cache-first tier (ConceptNet's /query endpoint has
// no wildcard support, so prefix expansion happens here against our own
// data instead). Exact match first, then by degree (connectivity).
export const searchCachedConcepts = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const prefix = `/c/en/${q}`;
    const all = await ctx.db.query("concept_cache").collect();
    return all
      .filter((c) => c.concept_uri.startsWith(prefix))
      .sort((a, b) => {
        const aExact = a.concept_uri === prefix ? 1 : 0;
        const bExact = b.concept_uri === prefix ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return b.degree - a.degree;
      })
      .slice(0, 8)
      .map((c) => ({
        term: c.concept_uri,
        label: c.label,
        language: c.language,
      }));
  },
});

export const getCachedEdgesByWord = query({
  args: {
    word: v.string(),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, { word, limit, offset }) => {
    // Mirror toConceptUri from the frontend lib: trim, lowercase, and
    // convert spaces to underscores so multi-word concepts resolve to the
    // same URI the rest of the app writes and reads.
    const term = `/c/en/${word.trim().toLowerCase().replace(/\s+/g, "_")}`;
    const allEdges = await ctx.db
      .query("edge_cache")
      .withIndex("by_start", (q) => q.eq("start_uri", term))
      .order("desc")
      .collect();

    return allEdges.slice(offset, offset + limit);
  },
});

export const getCachedEdgesByUri = query({
  args: {
    concept_uri: v.string(),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, { concept_uri, limit, offset }) => {
    // Check both directions
    const asStart = await ctx.db
      .query("edge_cache")
      .withIndex("by_start", (q) => q.eq("start_uri", concept_uri))
      .order("desc")
      .collect();

    const asEnd = await ctx.db
      .query("edge_cache")
      .withIndex("by_end", (q) => q.eq("end_uri", concept_uri))
      .order("desc")
      .collect();

    // Merge and deduplicate
    const allEdges = [...asStart, ...asEnd];
    const seen = new Set<string>();
    const unique = allEdges.filter((e) => {
      const key = `${e.start_uri}|${e.end_uri}|${e.relation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(offset, offset + limit);
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const upsertEdge = mutation({
  args: {
    edge_id: v.string(),
    start_uri: v.string(),
    end_uri: v.string(),
    relation: v.string(),
    weight: v.number(),
    surface_text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate by querying edges with same start
    const existing = await ctx.db
      .query("edge_cache")
      .withIndex("by_start", (q) => q.eq("start_uri", args.start_uri))
      .collect();

    const isDuplicate = existing.some(
      (e) =>
        e.end_uri === args.end_uri &&
        e.relation === args.relation &&
        e.start_uri === args.start_uri
    );

    if (!isDuplicate) {
      await ctx.db.insert("edge_cache", {
        start_uri: args.start_uri,
        end_uri: args.end_uri,
        relation: args.relation,
        weight: args.weight,
        surface_text: args.surface_text,
      });
    }
  },
});

export const insertConcept = mutation({
  args: {
    concept_uri: v.string(),
    label: v.string(),
    language: v.string(),
    degree: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("concept_cache")
      .withIndex("by_uri", (q) => q.eq("concept_uri", args.concept_uri))
      .first();

    if (!existing) {
      await ctx.db.insert("concept_cache", args);
    }
  },
});
