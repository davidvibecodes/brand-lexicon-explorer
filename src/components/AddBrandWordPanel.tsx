import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { BrandWord } from "@/lib/conceptnet";
import { extractWordFromUri, toConceptUri } from "@/lib/conceptnet";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editWord?: BrandWord | null;
  mode?: "personal" | "global";
  onSaved?: (wordId: string) => void;
}

interface ConceptResult {
  term: string;
  label: string;
}

// ── Reusable concept search field ────────────────────────────────────────

function ConceptSearchField({
  label,
  value,
  onSelect,
  onClear,
  required,
}: {
  label: string;
  value: ConceptResult | null;
  onSelect: (c: ConceptResult) => void;
  onClear?: () => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConceptResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchAction = useAction(api.concepts.searchConcepts);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchAction({ query: q });
        setResults(res.map((r) => ({ term: r.term, label: r.label })));
        setIsOpen(true);
      } catch {
        setResults([]);
        setIsOpen(false);
      }
      setIsSearching(false);
    },
    [searchAction]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (value) {
    return (
      <div className="space-y-1">
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-2 p-2.5 bg-accent rounded-lg">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#107C10" }}
          />
          <span className="text-sm font-medium">{value.label}</span>
          <span className="text-xs text-muted-foreground">
            ({extractWordFromUri(value.term)})
          </span>
          {onClear && (
            <button
              onClick={onClear}
              className="ml-auto p-1 rounded-sm hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1" ref={wrapperRef}>
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) {
              setIsOpen(true);
            } else {
              setResults([]);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
          }}
          placeholder={`Search for ${label.toLowerCase()}…`}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
          {results.length === 0 && !isSearching ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches found
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.term}
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#107C10" }}
                />
                <span className="truncate">{r.label}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {extractWordFromUri(r.term)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel Component ─────────────────────────────────────────────────

export default function AddBrandWordPanel({
  isOpen,
  onClose,
  editWord,
  mode = "personal",
  onSaved,
}: Props) {
  const { isAuthenticated } = useAuth();
  const createBrandWord = useMutation(api.brandWords.create);
  const updateBrandWord = useMutation(api.brandWords.update);

  const [brandText, setBrandText] = useState("");
  const [primaryAssoc, setPrimaryAssoc] = useState<ConceptResult | null>(null);
  const [secondaryAssocs, setSecondaryAssocs] = useState<ConceptResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Pre-fill for edit mode
  useEffect(() => {
    if (editWord) {
      setBrandText(editWord.text);
      setPrimaryAssoc(
        editWord.primary_association_uri
          ? {
              term: editWord.primary_association_uri,
              label: extractWordFromUri(editWord.primary_association_uri),
            }
          : null
      );
      if (editWord.associations) {
        const secondaries = editWord.associations
          .filter((a) => a.position === "secondary")
          .sort((a, b) => a.order - b.order)
          .map((a) => ({
            term: a.concept_uri,
            label: extractWordFromUri(a.concept_uri),
          }));
        setSecondaryAssocs(secondaries);
      }
      setHasChanges(false);
    } else {
      resetForm();
    }
  }, [editWord, isOpen]);

  const resetForm = () => {
    setBrandText("");
    setPrimaryAssoc(null);
    setSecondaryAssocs([]);
    setHasChanges(false);
    setShowSignInPrompt(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!primaryAssoc) return;

    if (!isAuthenticated) {
      setShowSignInPrompt(true);
      return;
    }

    setIsSaving(true);
    try {
      const secondaryUris = secondaryAssocs.map((a) => a.term);

      if (editWord) {
        await updateBrandWord({
          id: editWord._id as any,
          text: brandText,
          primary_association_uri: primaryAssoc.term,
          secondary_uris: secondaryUris,
        });
      } else {
        await createBrandWord({
          text: brandText,
          primary_association_uri: primaryAssoc.term,
          secondary_uris: secondaryUris,
          scope: mode,
        });
      }

      resetForm();
      onClose();
      onSaved?.(editWord?._id || "");
    } catch (err) {
      console.error("Save failed:", err);
    }
    setIsSaving(false);
  };

  const handleSecondaryRemove = (index: number) => {
    setSecondaryAssocs((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const isSaveDisabled = !primaryAssoc || isSaving;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-200"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {editWord ? "Edit Brand Word" : "Add Brand Word"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {/* Brand Word Input */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Brand Word</Label>
            <Input
              value={brandText}
              onChange={(e) => {
                setBrandText(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Enter a brand word…"
            />
          </div>

          {/* Primary Association */}
          <ConceptSearchField
            label="Primary Association"
            value={primaryAssoc}
            onSelect={(c) => {
              setPrimaryAssoc(c);
              setHasChanges(true);
            }}
            onClear={() => {
              setPrimaryAssoc(null);
              setHasChanges(true);
            }}
            required
          />

          {/* Secondary Associations */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Secondary Associations (optional)
            </Label>

            {secondaryAssocs.map((assoc, i) => (
              <div
                key={`${assoc.term}-${i}`}
                className="flex items-center gap-2 p-2.5 bg-accent rounded-lg"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#107C10" }}
                />
                <span className="text-sm">{assoc.label}</span>
                <span className="text-xs text-muted-foreground">
                  ({extractWordFromUri(assoc.term)})
                </span>
                <button
                  onClick={() => handleSecondaryRemove(i)}
                  className="ml-auto p-1 rounded-sm hover:bg-muted transition-colors"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}

            <SecondaryAssociationInput
              onAdd={(c) => {
                setSecondaryAssocs((prev) => [...prev, c]);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Validation hint */}
          {brandText && !primaryAssoc && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Select a primary association to enable saving.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="flex-1"
              style={{
                backgroundColor: isSaveDisabled ? undefined : "#107C10",
                color: isSaveDisabled ? undefined : "#FFFFFF",
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editWord ? (
                "Update"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sign-in prompt modal */}
      {showSignInPrompt && (
        <SignInPrompt
          onConfirm={() => {
            setShowSignInPrompt(false);
          }}
          onCancel={() => setShowSignInPrompt(false)}
        />
      )}
    </>
  );
}

// ── Secondary Association Input ──────────────────────────────────────────

function SecondaryAssociationInput({
  onAdd,
}: {
  onAdd: (c: ConceptResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConceptResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchAction = useAction(api.concepts.searchConcepts);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchAction({ query: q });
        setResults(res.map((r) => ({ term: r.term, label: r.label })));
        setIsOpen(true);
      } catch {
        setResults([]);
      }
      setIsSearching(false);
    },
    [searchAction]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setIsOpen(true);
              } else {
                setResults([]);
                setIsOpen(false);
              }
            }}
            placeholder="Search and add…"
            className="pl-9 h-8 text-sm"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            if (query.length >= 2) {
              // ConceptNet URIs use underscores for spaces — normalize typed
              // input through the shared helper instead of raw interpolation.
              const trimmed = query.trim();
              onAdd({
                term: toConceptUri(trimmed),
                label: trimmed,
              });
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }
          }}
          disabled={query.length < 2}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-auto">
          {results.map((r) => (
            <button
              key={r.term}
              onClick={() => {
                onAdd(r);
                setQuery("");
                setResults([]);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "#107C10" }}
              />
              <span className="truncate">{r.label}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {extractWordFromUri(r.term)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sign-in Prompt Modal ────────────────────────────────────────────────

function SignInPrompt({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("anonymous");
      onConfirm();
    } catch (err) {
      console.error("Sign-in failed:", err);
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-2">Sign in to save</h3>
        <p className="text-sm text-muted-foreground mb-5">
          You need to be signed in to save brand words. Your draft will be
          preserved.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSignIn} disabled={isLoading} className="flex-1">
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
