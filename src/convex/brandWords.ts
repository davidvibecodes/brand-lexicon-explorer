import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────────

export const listPersonal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const words = await ctx.db
      .query("brand_words")
      .withIndex("by_owner", (q) => q.eq("owner_user_id", userId))
      .collect();

    return Promise.all(
      words.map(async (w) => {
        const assocs = await ctx.db
          .query("brand_associations")
          .withIndex("by_brand_word", (q) => q.eq("brand_word_id", w._id))
          .collect();
        return {
          ...w,
          secondary_count: assocs.filter((a) => a.position === "secondary")
            .length,
        };
      })
    );
  },
});

export const listGlobal = query({
  args: {},
  handler: async (ctx) => {
    const words = await ctx.db
      .query("brand_words")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .collect();

    return Promise.all(
      words.map(async (w) => {
        const assocs = await ctx.db
          .query("brand_associations")
          .withIndex("by_brand_word", (q) => q.eq("brand_word_id", w._id))
          .collect();
        return {
          ...w,
          secondary_count: assocs.filter((a) => a.position === "secondary")
            .length,
        };
      })
    );
  },
});

export const get = query({
  args: { id: v.id("brand_words") },
  handler: async (ctx, { id }) => {
    const word = await ctx.db.get(id);
    if (!word) return null;
    const assocs = await ctx.db
      .query("brand_associations")
      .withIndex("by_brand_word", (q) => q.eq("brand_word_id", id))
      .collect();
    return { ...word, associations: assocs };
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    text: v.string(),
    primary_association_uri: v.string(),
    secondary_uris: v.array(v.string()),
    scope: v.union(v.literal("personal"), v.literal("global")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.scope === "global") {
      const user = await ctx.db.get(userId);
      if (user?.role !== "admin") {
        throw new Error("Only admins can create global brand words");
      }
    }

    const now = Date.now();
    const wordId = await ctx.db.insert("brand_words", {
      owner_user_id: args.scope === "personal" ? userId : undefined,
      scope: args.scope,
      text: args.text,
      primary_association_uri: args.primary_association_uri,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("brand_associations", {
      brand_word_id: wordId,
      concept_uri: args.primary_association_uri,
      position: "primary",
      order: 0,
    });

    for (let i = 0; i < args.secondary_uris.length; i++) {
      await ctx.db.insert("brand_associations", {
        brand_word_id: wordId,
        concept_uri: args.secondary_uris[i],
        position: "secondary",
        order: i + 1,
      });
    }

    return wordId;
  },
});

export const update = mutation({
  args: {
    id: v.id("brand_words"),
    text: v.string(),
    primary_association_uri: v.string(),
    secondary_uris: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Brand word not found");

    if (existing.scope === "global") {
      const user = await ctx.db.get(userId);
      if (user?.role !== "admin") {
        throw new Error("Only admins can edit global brand words");
      }
    } else {
      if (existing.owner_user_id !== userId) {
        throw new Error("Not authorized");
      }
    }

    await ctx.db.patch(args.id, {
      text: args.text,
      primary_association_uri: args.primary_association_uri,
      updated_at: Date.now(),
    });

    // Replace all associations
    const oldAssocs = await ctx.db
      .query("brand_associations")
      .withIndex("by_brand_word", (q) => q.eq("brand_word_id", args.id))
      .collect();
    for (const a of oldAssocs) {
      await ctx.db.delete(a._id);
    }

    await ctx.db.insert("brand_associations", {
      brand_word_id: args.id,
      concept_uri: args.primary_association_uri,
      position: "primary",
      order: 0,
    });

    for (let i = 0; i < args.secondary_uris.length; i++) {
      await ctx.db.insert("brand_associations", {
        brand_word_id: args.id,
        concept_uri: args.secondary_uris[i],
        position: "secondary",
        order: i + 1,
      });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("brand_words") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Brand word not found");

    if (existing.scope === "global") {
      const user = await ctx.db.get(userId);
      if (user?.role !== "admin") {
        throw new Error("Only admins can delete global brand words");
      }
    } else {
      if (existing.owner_user_id !== userId) {
        throw new Error("Not authorized");
      }
    }

    const assocs = await ctx.db
      .query("brand_associations")
      .withIndex("by_brand_word", (q) => q.eq("brand_word_id", id))
      .collect();
    for (const a of assocs) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(id);
  },
});
