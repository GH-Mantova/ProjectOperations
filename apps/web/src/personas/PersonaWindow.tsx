import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChatPanel } from "./ChatPanel";
import { useActivePersona } from "./PersonaContext";
import { activePersonaKey, panelContent } from "./persona-window-helpers";

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

export function PersonaWindow() {
  const { activePersona } = useActivePersona();
  const [isOpen, setIsOpen] = useState(false);
  const key = activePersonaKey(activePersona);

  // Reset to closed whenever the active persona+sub-mode changes (or
  // disappears). The user explicitly opens each time.
  useEffect(() => {
    setIsOpen(false);
  }, [key]);

  if (!activePersona) return null;
  const content = panelContent(activePersona);
  if (!content) return null;

  return (
    <div className="persona-window">
      {isOpen ? (
        <div className="persona-window__panel" role="dialog" aria-label={content.title}>
          <header className="persona-window__panel-header">
            <div>
              <div className="persona-window__panel-title">{content.title}</div>
              <div className="persona-window__panel-subtitle">{content.subtitle}</div>
            </div>
            <button
              type="button"
              className="persona-window__icon-button"
              onClick={() => setIsOpen(false)}
              aria-label="Close persona window"
            >
              {ICON_CLOSE}
            </button>
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
          onClick={() => setIsOpen(true)}
          aria-label={`Open ${content.title}`}
        >
          {ICON_BOT}
          <span className="persona-window__button-label">{content.title}</span>
        </button>
      )}
    </div>
  );
}
