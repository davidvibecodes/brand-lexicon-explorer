import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    }).index("email", ["email"]),

    brand_words: defineTable({
      owner_user_id: v.optional(v.id("users")),
      scope: v.union(v.literal("personal"), v.literal("global")),
      text: v.string(),
      primary_association_uri: v.string(),
      created_at: v.number(),
      updated_at: v.number(),
    })
      .index("by_owner", ["owner_user_id"])
      .index("by_scope", ["scope"])
      .index("by_text", ["text"]),

    brand_associations: defineTable({
      brand_word_id: v.id("brand_words"),
      concept_uri: v.string(),
      position: v.union(v.literal("primary"), v.literal("secondary")),
      order: v.number(),
    }).index("by_brand_word", ["brand_word_id"]),

    concept_cache: defineTable({
      concept_uri: v.string(),
      label: v.string(),
      language: v.string(),
      degree: v.number(),
    }).index("by_uri", ["concept_uri"]),

    edge_cache: defineTable({
      start_uri: v.string(),
      end_uri: v.string(),
      relation: v.string(),
      weight: v.number(),
      surface_text: v.optional(v.string()),
    })
      .index("by_start", ["start_uri", "weight"])
      .index("by_end", ["end_uri", "weight"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
