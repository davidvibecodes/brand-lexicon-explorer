import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getRelationShortLabel } from "@/lib/conceptnet";

interface Props {
  label: string;
  relation?: string;
  partOfSpeech?: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function NodePopover({
  label,
  relation,
  partOfSpeech,
  x,
  y,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-popover border border-border rounded-xl shadow-lg px-4 py-3 min-w-[180px] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: x + 10, top: y - 20 }}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{label}</h4>
        <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      {relation && (
        <p className="text-xs text-muted-foreground mt-1">
          {getRelationShortLabel(relation)}
        </p>
      )}
      {partOfSpeech && (
        <p className="text-xs text-muted-foreground mt-0.5 italic">
          {partOfSpeech}
        </p>
      )}
    </div>
  );
}
