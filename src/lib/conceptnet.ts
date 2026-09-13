// ── ConceptNet Types ─────────────────────────────────────────────────────

export interface ConceptEdge {
  id: string;
  startUri: string;
  endUri: string;
  relation: string;
  weight: number;
  surfaceText?: string;
}

// Normalized edge returned by the fetchRelated action: always oriented so
// that relatedUri/relatedLabel refer to whichever side of the ConceptNet
// assertion is NOT the queried word, regardless of the original direction.
export interface RelatedEdge {
  id: string;
  relatedUri: string;
  relatedLabel: string;
  relation: string;
  weight: number;
  surfaceText?: string;
}

export interface ConceptSuggestion {
  term: string;
  label: string;
  language: string;
}

// ── Graph Types ─────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
  isCenter: boolean;
  color: string;
  opacity: number;
  blur: number;
  pos?: string; // part of speech if available
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
  surfaceText?: string;
}

// ── Brand Word Types ────────────────────────────────────────────────────

export interface BrandWord {
  _id: string;
  owner_user_id?: string;
  scope: "personal" | "global";
  text: string;
  primary_association_uri: string;
  created_at: number;
  updated_at: number;
  secondary_count?: number;
  associations?: BrandAssociation[];
}

export interface BrandAssociation {
  _id: string;
  brand_word_id: string;
  concept_uri: string;
  position: "primary" | "secondary";
  order: number;
}

// ── Colors ──────────────────────────────────────────────────────────────

export const COLORS = {
  blue: "#0F6CBD",
  green: "#107C10",
  blueLight: "#115EA3",
  blueDark: "#0E4775",
  greenLight: "#0B6A0B",
  greenDark: "#084F08",
  // Fluent 2 neutrals
  bgLight: "#FAFAFA",
  bgDark: "#1F1F1F",
  fgLight: "#242424",
  fgDark: "#FFFFFF",
  mutedLight: "#605E5C",
  mutedDark: "#C8C6C4",
  surfaceLight: "#FFFFFF",
  surfaceDark: "#2D2D2D",
  borderLight: "#E0E0E0",
  borderDark: "#404040",
  // Node colors
  nodeBlue: "#0F6CBD",
  nodeBlueHover: "#115EA3",
  nodeGreen: "#107C10",
  nodeGreenHover: "#0B6A0B",
} as const;

// ── Relation type display names ─────────────────────────────────────────

export const RELATION_LABELS: Record<string, string> = {
  RelatedTo: "Related To",
  IsA: "Is A",
  UsedFor: "Used For",
  Synonym: "Synonym",
  Antonym: "Antonym",
  PartOf: "Part Of",
  HasA: "Has A",
  MemberOf: "Member Of",
  AtLocation: "At Location",
  CapableOf: "Capable Of",
  HasProperty: "Has Property",
  HasContext: "Has Context",
  MannerOf: "Manner Of",
  EtymologicallyRelatedTo: "Etymology",
  SimilarTo: "Similar To",
  DerivedFrom: "Derived From",
};

export function extractWordFromUri(uri: string): string {
  // "/c/en/word" → "word"
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  return last.replace(/_/g, " ");
}

// Convert a word into a ConceptNet English concept URI.
// "ice cream" → "/c/en/ice_cream". Use this every time a word becomes a
// /c/en/ path or query argument — never interpolate a raw word string.
// extractWordFromUri above is for DISPLAY labels only; never feed its
// space-converted output back into a URI or API call except via this helper.
export function toConceptUri(word: string): string {
  return `/c/en/${word.trim().toLowerCase().replace(/\s+/g, "_")}`;
}

export function getRelationShortLabel(relation: string): string {
  return RELATION_LABELS[relation] || relation;
}

// ── Seed words weighted toward high-connectivity concepts ───────────────

export const SEED_WORDS = [
  "water", "time", "good", "people", "make", "life", "day",
  "man", "new", "world", "hand", "part", "place", "case",
  "week", "company", "system", "program", "question", "work",
  "government", "number", "night", "point", "home", "water",
  "room", "mother", "area", "money", "story", "fact", "month",
  "lot", "right", "study", "book", "eye", "job", "word",
  "business", "issue", "side", "kind", "head", "house",
  "service", "friend", "father", "power", "hour", "game",
  "line", "end", "member", "law", "car", "city", "community",
  "name", "president", "team", "minute", "idea", "body",
  "information", "back", "parent", "face", "others", "level",
  "office", "door", "health", "person", "art", "war", "history",
  "party", "result", "change", "morning", "reason", "research",
  "girl", "guy", "moment", "air", "teacher", "force", "education",
];

export function pickRandomSeed(): string {
  return SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
}
