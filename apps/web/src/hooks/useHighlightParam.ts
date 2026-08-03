import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const HIGHLIGHT_DURATION_MS = 2400;

// Reads ?highlight=<id> emitted by CommandPalette / GlobalSearch, strips it
// from the URL after consumption so refresh/back doesn't re-trigger, and
// exposes a ref registrar so pages can attach it to the matching row/card.
// Scrolls the matched element into view and applies the `.search-highlight`
// class for a brief visual emphasis using brand tokens.
export function useHighlightParam(): {
  highlightId: string | null;
  registerHighlightRef: (id: string) => (el: HTMLElement | null) => void;
  isHighlighted: (id: string) => boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = searchParams.get("highlight");
  const [highlightId, setHighlightId] = useState<string | null>(paramId);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paramId) return;
    if (consumedRef.current === paramId) return;
    consumedRef.current = paramId;
    setHighlightId(paramId);

    const next = new URLSearchParams(searchParams);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
  }, [paramId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!highlightId) return;
    // Defer to next tick so refs registered on the same render are populated.
    const scrollTimer = window.setTimeout(() => {
      const el = refs.current.get(highlightId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const clearTimer = window.setTimeout(() => {
      setHighlightId((current) => (current === highlightId ? null : current));
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightId]);

  const registerHighlightRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    },
    []
  );

  const isHighlighted = useCallback((id: string) => id === highlightId, [highlightId]);

  return { highlightId, registerHighlightRef, isHighlighted };
}
