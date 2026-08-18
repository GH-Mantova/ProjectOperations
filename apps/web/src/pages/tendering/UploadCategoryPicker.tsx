// TFM-S4 — Hierarchical category picker for tender document uploads.
//
// Renders TENDER_FOLDER_STRUCTURE as a two-level tree. The `Quotes` sentinel
// node lazily expands into the tender's tenderClients (passed as a prop —
// the caller already has them from the tender detail query, so no new
// endpoint is needed).
//
// Emits the full slash-separated path as its `value` so callers can pass
// it directly to the upload form's `category` field, which the API then
// routes via resolveUploadPath.

import { useState } from "react";
import { TENDER_FOLDER_STRUCTURE } from "../../lib/document-categories";
import type { FolderNode } from "../../lib/document-categories";

export type TenderClientRef = {
  id: string;
  name: string;
};

type Props = {
  value: string;
  onChange: (path: string) => void;
  tenderClients?: TenderClientRef[];
  disabled?: boolean;
};

// Returns the display label for a path: the last segment after the final "/".
export function labelFor(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

// Builds the effective node list from TENDER_FOLDER_STRUCTURE by expanding
// the Quotes sentinel with the provided clients. Exported for unit testing.
export function buildEffectiveNodes(tenderClients: TenderClientRef[]): FolderNode[] {
  return TENDER_FOLDER_STRUCTURE.map((node) => {
    if (node.path === "Quotes") {
      const clientChildren: FolderNode[] =
        tenderClients.length > 0
          ? tenderClients.map((tc) => ({ path: `Quotes/${tc.name}` }))
          : [];
      return { ...node, children: clientChildren };
    }
    return node;
  });
}

// Returns a flat list of all selectable (leaf) paths from the effective nodes.
// A leaf is a node with no children.
export function collectLeafPaths(nodes: FolderNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      result.push(...collectLeafPaths(node.children));
    } else {
      result.push(node.path);
    }
  }
  return result;
}

export function UploadCategoryPicker({ value, onChange, tenderClients = [], disabled = false }: Props) {
  // Track which parent nodes are expanded.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the parent of the current value on mount.
    const initial = new Set<string>();
    if (value) {
      const parts = value.split("/");
      if (parts.length > 1) {
        initial.add(parts[0]);
      }
    }
    return initial;
  });

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build the effective node list: TENDER_FOLDER_STRUCTURE with the Quotes
  // sentinel replaced by a fully-populated node if clients are available.
  const nodes = buildEffectiveNodes(tenderClients);

  const renderNode = (node: FolderNode, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.path);
    const isSelected = value === node.path;
    // Non-leaf nodes (those with children) are not directly selectable — you
    // must pick a leaf. Exception: if a parent has no children at render time
    // (e.g. Quotes with no clients) it is selectable as a catch-all.
    const isLeaf = !hasChildren;

    return (
      <div key={node.path}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: depth * 16,
            paddingTop: 3,
            paddingBottom: 3,
            cursor: disabled ? "default" : isLeaf ? "pointer" : "default",
            background: isSelected ? "var(--surface-subtle, rgba(254,170,109,0.12))" : "transparent",
            borderRadius: 4,
            userSelect: "none"
          }}
          onClick={() => {
            if (disabled) return;
            if (isLeaf) {
              onChange(node.path);
            } else {
              toggleExpand(node.path);
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isLeaf) {
                onChange(node.path);
              } else {
                toggleExpand(node.path);
              }
            }
          }}
          role={isLeaf ? "option" : "button"}
          aria-selected={isLeaf ? isSelected : undefined}
          aria-expanded={!isLeaf ? isExpanded : undefined}
          tabIndex={disabled ? -1 : 0}
        >
          {!isLeaf ? (
            <span
              style={{
                display: "inline-block",
                width: 12,
                fontSize: 10,
                color: "var(--text-muted)",
                flexShrink: 0,
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 150ms"
              }}
              aria-hidden
            >
              &#9654;
            </span>
          ) : (
            <span style={{ display: "inline-block", width: 12, flexShrink: 0 }} aria-hidden />
          )}
          <span
            style={{
              fontSize: 13,
              color: isSelected ? "var(--brand-accent, #FEAA6D)" : "var(--text-strong)",
              fontWeight: isSelected ? 600 : undefined
            }}
          >
            {node.label ?? labelFor(node.path)}
          </span>
          {isSelected ? (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "var(--brand-accent, #FEAA6D)"
              }}
              aria-hidden
            >
              &#10003;
            </span>
          ) : null}
        </div>

        {!isLeaf && isExpanded && node.children
          ? node.children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  return (
    <div
      role="listbox"
      aria-label="Document category"
      aria-disabled={disabled}
      style={{
        border: "1px solid var(--surface-border)",
        borderRadius: 6,
        background: "var(--surface-base)",
        maxHeight: 260,
        overflowY: "auto",
        padding: "4px 0"
      }}
    >
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  );
}
