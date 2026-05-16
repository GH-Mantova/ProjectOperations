import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { ChatPanel } from "./ChatPanel";
import { useActivePersona } from "./PersonaContext";
import {
  activePersonaKey,
  clampWindowPosition,
  panelContent,
  personaWindowStorageKeys,
  type WindowPosition
} from "./persona-window-helpers";

const ICON_BOT = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

const ICON_SETTINGS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ICON_CLOSE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// PR B1.8.1 — pointer-move pixels required to promote a click into a
// drag. Anything smaller is treated as a click so onClick handlers
// (minimise/close buttons, pill-to-open) still fire. 4px is the same
// threshold @dnd-kit uses by default and the de-facto web standard.
const DRAG_THRESHOLD_PX = 4;

// PR B1.8 — minimise glyph. Single horizontal line; mirrors the OS
// "minimise window" affordance.
const ICON_MINIMISE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="6" y1="18" x2="18" y2="18" />
  </svg>
);

// Read once on mount. Returns undefined when localStorage is unavailable
// or the value can't be parsed — caller falls back to default placement.
function readStoredPosition(key: string): WindowPosition | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<WindowPosition>;
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* localStorage disabled or JSON malformed — silently fall back. */
  }
  return undefined;
}

function readStoredMinimised(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStoredPosition(key: string, pos: WindowPosition): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    /* quota / unavailable — drop silently, ephemeral state is fine. */
  }
}

function writeStoredMinimised(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* see writeStoredPosition. */
  }
}

export function PersonaWindow() {
  const { activePersona } = useActivePersona();
  const [isOpen, setIsOpen] = useState(false);
  const key = activePersonaKey(activePersona);
  const storageKeys = personaWindowStorageKeys(key);

  // Position is undefined when the user hasn't moved the bubble yet — in
  // that case we render at the CSS default (bottom-right) and skip
  // inline left/top so the existing CSS rules win. As soon as the user
  // drags (or we read a stored position) we switch to inline placement.
  const [position, setPosition] = useState<WindowPosition | undefined>(undefined);
  const [isMinimised, setIsMinimised] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  // PR B1.8.1 — drag state lives in a ref with two phases:
  //   - `started=false`: pointer is down but movement hasn't crossed
  //     DRAG_THRESHOLD_PX yet, so we have NOT called setPointerCapture
  //     and the native click event will still fire on pointerup.
  //   - `started=true`: the user has dragged past the threshold;
  //     setPointerCapture is on, position updates are live, and the
  //     pointerup *suppresses* the click (clickSuppressedRef).
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    bubbleSize: { width: number; height: number };
    started: boolean;
  } | null>(null);
  // When true, the next click event on this component should be swallowed
  // because it is the trailing edge of a real drag gesture rather than a
  // click. Cleared synchronously inside the click handler.
  const clickSuppressedRef = useRef(false);

  // Reset the open state whenever the active persona+sub-mode changes
  // (matches pre-B1.8 behavior); also load the stored position +
  // minimised state for the new persona.
  useEffect(() => {
    setIsOpen(false);
    if (!storageKeys) {
      setPosition(undefined);
      setIsMinimised(false);
      return;
    }
    setPosition(readStoredPosition(storageKeys.position));
    setIsMinimised(readStoredMinimised(storageKeys.minimised));
  }, [key, storageKeys?.position, storageKeys?.minimised]);

  // Clamp the saved position whenever the viewport resizes so the bubble
  // never ends up off-screen after a window resize.
  useEffect(() => {
    if (!position || !rootRef.current) return;
    const onResize = () => {
      const node = rootRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const clamped = clampWindowPosition(
        position,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      if (clamped.x !== position.x || clamped.y !== position.y) {
        setPosition(clamped);
        if (storageKeys) writeStoredPosition(storageKeys.position, clamped);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, storageKeys?.position]);

  // Re-clamp once after the bubble's rendered size is known. Stored
  // positions captured for a wider/taller variant (open vs minimised)
  // may overflow in the other variant.
  useLayoutEffect(() => {
    if (!position || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const clamped = clampWindowPosition(
      position,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight }
    );
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
      if (storageKeys) writeStoredPosition(storageKeys.position, clamped);
    }
    // We intentionally only re-clamp on these triggers, not on every
    // position change (which would loop).
  }, [isMinimised, isOpen, position, storageKeys?.position]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // Left-mouse only; touch + pen still pass.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const node = rootRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      // PR B1.8.1 — DO NOT setPointerCapture here. Capturing on the
      // initial mousedown stops the browser from firing the trailing
      // click event, which broke every left-click on the minimise/close
      // buttons and the pill itself. We only capture once movement
      // exceeds DRAG_THRESHOLD_PX in onPointerMove below.
      dragRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        startX: e.clientX,
        startY: e.clientY,
        bubbleSize: { width: rect.width, height: rect.height },
        started: false
      };
      // No preventDefault either — the browser-native click chain has to
      // run for the buttons inside to receive their click events.
    },
    []
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      // Phase 1 → 2 transition: only promote the gesture to a real drag
      // once the pointer has moved past the threshold. This is what
      // lets a brief click pass through to onClick handlers.
      if (!drag.started) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        drag.started = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* setPointerCapture can throw if the pointer is gone — ignore */
        }
      }

      const candidate: WindowPosition = {
        x: e.clientX - drag.offsetX,
        y: e.clientY - drag.offsetY
      };
      const clamped = clampWindowPosition(
        candidate,
        drag.bubbleSize,
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPosition(clamped);
    },
    []
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const wasRealDrag = drag.started;
      dragRef.current = null;
      if (wasRealDrag) {
        setIsDragging(false);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* pointer capture already released — ignore */
        }
        // The trailing click event on the pill should be swallowed so
        // we don't accidentally re-open after dragging. The flag is
        // cleared synchronously inside the click handler.
        clickSuppressedRef.current = true;
        // Persist the final position.
        setPosition((current) => {
          if (current && storageKeys) writeStoredPosition(storageKeys.position, current);
          return current;
        });
      }
      // If the gesture never crossed the threshold, do nothing — let
      // the native click event fire on the originally clicked element.
    },
    [storageKeys?.position]
  );

  const handleMinimise = useCallback(() => {
    setIsOpen(false);
    setIsMinimised(true);
    if (storageKeys) writeStoredMinimised(storageKeys.minimised, true);
  }, [storageKeys?.minimised]);

  const handleClose = useCallback(() => {
    // PR B1.8 Decision #1 — × clears the saved position and minimised
    // state so the bubble returns to the default bottom-right corner.
    setIsOpen(false);
    setIsMinimised(false);
    setPosition(undefined);
    if (storageKeys) {
      try {
        window.localStorage.removeItem(storageKeys.position);
        window.localStorage.removeItem(storageKeys.minimised);
      } catch {
        /* ignore */
      }
    }
  }, [storageKeys?.position, storageKeys?.minimised]);

  const handleOpenFromPill = useCallback(() => {
    setIsOpen(true);
    setIsMinimised(false);
    if (storageKeys) writeStoredMinimised(storageKeys.minimised, false);
  }, [storageKeys?.minimised]);

  if (!activePersona) return null;
  const content = panelContent(activePersona);
  if (!content) return null;

  // Inline placement overrides only kick in once the user has moved
  // the bubble; otherwise the existing bottom-right CSS rule wins.
  const inlineStyle: CSSProperties | undefined = position
    ? {
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto"
      }
    : undefined;

  return (
    <div
      ref={rootRef}
      className="persona-window"
      style={inlineStyle}
      data-dragging={isDragging ? "true" : undefined}
    >
      {isOpen && !isMinimised ? (
        <div className="persona-window__panel" role="dialog" aria-label={content.title}>
          <header
            className="persona-window__panel-header"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          >
            <div>
              <div className="persona-window__panel-title">{content.title}</div>
              <div className="persona-window__panel-subtitle">{content.subtitle}</div>
            </div>
            <div style={{ display: "inline-flex", gap: 4 }}>
              <button
                type="button"
                className="persona-window__icon-button"
                // PR B1.8.1 — stop the pointerdown bubbling to the
                // draggable header so clicking these buttons never
                // primes a drag gesture on the parent.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleMinimise}
                aria-label="Minimise persona window"
                title="Minimise"
              >
                {ICON_MINIMISE}
              </button>
              <button
                type="button"
                className="persona-window__icon-button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleClose}
                aria-label="Close persona window"
                title="Close (resets position)"
              >
                {ICON_CLOSE}
              </button>
            </div>
          </header>
          <div className="persona-window__panel-body">
            <ChatPanel />
          </div>
          <footer className="persona-window__panel-footer">
            <Link
              to="/admin/ai-settings"
              className="persona-window__icon-button"
              aria-label="AI settings"
              title="AI settings"
            >
              {ICON_SETTINGS}
            </Link>
          </footer>
        </div>
      ) : (
        <button
          type="button"
          className="persona-window__button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
            // PR B1.8.1 — if the click is the trailing edge of a real
            // drag (pointer travelled past DRAG_THRESHOLD_PX), swallow
            // it. Otherwise the user genuinely tapped/clicked the pill,
            // so open the panel.
            if (clickSuppressedRef.current) {
              clickSuppressedRef.current = false;
              e.preventDefault();
              return;
            }
            handleOpenFromPill();
          }}
          aria-label={`Open ${content.title}`}
          style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        >
          {ICON_BOT}
          <span className="persona-window__button-label">{content.title}</span>
        </button>
      )}
    </div>
  );
}
