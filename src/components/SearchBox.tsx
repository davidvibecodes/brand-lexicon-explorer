import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ConceptSuggestion } from "@/lib/conceptnet";

interface Props {
  onSelect: (word: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBox({
  onSelect,
  placeholder = "Search concepts…",
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ConceptSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchConcepts = useAction(api.concepts.searchConcepts);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchConcepts({ query: q });
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      }
      setIsSearching(false);
    },
    [searchConcepts]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (suggestion: ConceptSuggestion) => {
    setQuery(suggestion.label);
    setIsOpen(false);
    onSelect(suggestion.term);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(-1);
            if (e.target.value.length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-8 h-9 bg-background/80 backdrop-blur-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
          {isSearching && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches found
            </div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={s.term}
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                  i === highlightedIndex ? "bg-accent" : ""
                }`}
              >
                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{s.label}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {s.term.replace("/c/en/", "")}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
