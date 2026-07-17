import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

// D365-parity "+ new anything" menu. MVP: renders the compact entity picker
// D365 model apps ship in the header — each item navigates to the entity's
// existing list page with ?new=1 so pages that opt in can auto-open their
// create modal. Pages that don't opt in still land on the correct list, so
// the menu remains useful today without a coordinated migration.

type QuickCreateItem = {
  key: string;
  label: string;
  to: string;
  icon: ReactElement;
  permission?: string;
};

const ITEMS: QuickCreateItem[] = [
  {
    key: "tender",
    label: "Tender",
    to: "/tenders?new=1",
    permission: "tenders.manage",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
      </svg>
    )
  },
  {
    key: "job",
    label: "Job",
    to: "/jobs?new=1",
    permission: "jobs.manage",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    )
  },
  {
    key: "client",
    label: "Client",
    to: "/master-data?tab=clients&new=1",
    permission: "directory.manage",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    )
  },
  {
    key: "contact",
    label: "Contact",
    to: "/directory/contacts?new=1",
    permission: "directory.manage",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  },
  {
    key: "asset",
    label: "Asset",
    to: "/assets?new=1",
    permission: "assets.manage",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l9 5v10l-9 5-9-5V7z" />
      </svg>
    )
  },
  {
    key: "form",
    label: "Form entry",
    to: "/forms?new=1",
    permission: "forms.view",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
      </svg>
    )
  }
];

export function QuickCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = ITEMS.filter((item) => !item.permission || can(user, item.permission));
  if (items.length === 0) return null;

  return (
    <div ref={containerRef} data-testid="quick-create" style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        className="shell__topbar-action"
        onClick={() => setOpen((current) => !current)}
        aria-label="Quick create"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Quick create"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Quick create menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "var(--surface-card, #FFFFFF)",
            border: "1px solid var(--border-default, #E5E7EB)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0, 0, 0, 0.10))",
            padding: 6,
            zIndex: 40
          }}
        >
          <p
            style={{
              margin: 0,
              padding: "6px 10px 4px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "var(--text-muted, #9CA3AF)"
            }}
          >
            Quick create
          </p>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                navigate(item.to);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                border: 0,
                borderRadius: "var(--radius-sm, 6px)",
                background: "transparent",
                color: "var(--text-primary, #0F1117)",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13
              }}
              onMouseEnter={(event) => {
                (event.currentTarget as HTMLButtonElement).style.background = "var(--border-subtle, #F3F4F6)";
              }}
              onMouseLeave={(event) => {
                (event.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span aria-hidden style={{ color: "var(--text-secondary, #6B7280)" }}>{item.icon}</span>
              <span>New {item.label.toLowerCase()}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
