/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The absence of a CSS rule for a variant used in TSX is a silent failure:
// the button renders as bare text next to a bordered neighbour. .s7-btn--danger
// shipped in five places before any rule was defined. This guard reads tokens.css
// as text, walks apps/web/src/**/*.tsx, and fails if any used variant is undefined.

const __dirname = dirname(fileURLToPath(import.meta.url));
const webSrc = resolve(__dirname, "..", "..");
const tokensCssPath = resolve(webSrc, "styles", "tokens.css");

const SELECTOR_RE = /\.s7-btn--([a-z0-9-]+)\b/g;
const CLASSNAME_RE = /s7-btn--([a-z0-9-]+)/g;

function collectDefinedVariants(): Set<string> {
  const css = readFileSync(tokensCssPath, "utf-8");
  const names = new Set<string>();
  for (const m of css.matchAll(SELECTOR_RE)) names.add(m[1]);
  return names;
}

function collectUsedVariants(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const stack: string[] = [webSrc];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const source = readFileSync(full, "utf-8");
      for (const m of source.matchAll(CLASSNAME_RE)) {
        const variant = m[1];
        // Size modifiers (sm, lg) are variants in the same namespace and define
        // real rules in tokens.css — treat them exactly like primary/danger.
        const rel = relative(webSrc, full).replace(/\\/g, "/");
        const files = used.get(variant);
        if (files) {
          if (!files.includes(rel)) files.push(rel);
        } else {
          used.set(variant, [rel]);
        }
      }
    }
  }
  return used;
}

describe("s7-btn variant coverage: every used variant must have a CSS rule", () => {
  const defined = collectDefinedVariants();
  const used = collectUsedVariants();

  it("every s7-btn--<name> used in a .tsx has a matching rule in tokens.css", () => {
    const missing: string[] = [];
    for (const [variant, files] of used) {
      if (!defined.has(variant)) {
        missing.push(`  s7-btn--${variant}  (used in: ${files.join(", ")})`);
      }
    }
    expect(
      missing,
      `Variants used in TSX but never defined in tokens.css:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  // Positive control: an extractor that silently matches nothing is not a
  // guard. "primary" must be both defined and used. If this fails, the
  // scanners are broken — not the codebase.
  it("positive control: primary is both defined and used", () => {
    expect(defined.has("primary")).toBe(true);
    expect(used.has("primary")).toBe(true);
  });
});
