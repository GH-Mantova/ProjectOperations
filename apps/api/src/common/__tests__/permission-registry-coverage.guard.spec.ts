import * as fs from "fs";
import * as path from "path";
import { permissionRegistry } from "../permissions/permission-registry";

// Permission-registry coverage guard. `PermissionsGuard` is fail-closed and
// `PermissionsService` upserts only the codes it finds in
// `permission-registry.ts` — so a `@RequirePermissions("x.y")` whose code is
// absent from the registry can never be granted to any role. Every non-super
// user is silently locked out of that endpoint forever, and CI stays green
// because no other test looks at enforcement sites.
//
// This has now shipped three times (workers.manage in PR #658, clients.view
// and clients.manage in PR #655), each caught only by a scanner sweep. This
// guard scans every controller/service/module source file under `apps/api/src`
// for `@RequirePermissions(...)` decorators, extracts each string-literal
// code, and asserts that code is in `permissionRegistry`.
//
// Codes enforced today but not yet registered are listed in
// `KNOWN_UNREGISTERED` so the suite is green on merge. Delete an entry when
// its fix PR merges — the second test below fails if a stale entry remains,
// so the allowlist cannot rot.

const SRC_ROOT = path.resolve(__dirname, "..", "..");

// Codes enforced today but not yet registered. Each has an armed fix prompt;
// DELETE the entry from this list when its PR merges — do not add new ones.
//   clients.view/.manage      -> pr-qa-clients-perms-registry-ready.md
const KNOWN_UNREGISTERED = new Set<string>([]);

interface Occurrence {
  code: string;
  file: string;
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      collectSourceFiles(full, out);
    } else if (
      entry.isFile() &&
      full.endsWith(".ts") &&
      !full.endsWith(".spec.ts") &&
      !full.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

// Anchor to a line-leading `@RequirePermissions(` so we never match the string
// inside a JSDoc block (` * @RequirePermissions("x")` starts with ` * `, not
// `@`). The lazy `[\s\S]*?` supports the variadic multi-code form
// `@RequirePermissions("a", "b")` including across multiple lines.
const DECORATOR_RE = /^\s*@RequirePermissions\(([\s\S]*?)\)/gm;
const STRING_LITERAL_RE = /["']([^"']+)["']/g;

// Object-literal permission maps: `const XYZ_PERMISSIONS: Record<string, string> = { ... }`.
// Timeline (PR #672) hand-rolled a per-entity gate outside the decorator API,
// which the decorator extractor could not see; two of its four codes shipped
// unregistered as permanently-false gates. This extractor scans the map body
// and asserts each dotted string-literal code is registered.
const PERMISSION_MAP_RE = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*(?:PERMISSION|PERMS)[A-Z0-9_]*)\s*:\s*Record<\s*string\s*,\s*string\s*>\s*=\s*\{([\s\S]*?)\}/gm;
const DOTTED_CODE_RE = /["']([a-z][a-z0-9]*\.[a-z][a-z0-9_]*)["']/g;

function extractOccurrences(files: string[]): Occurrence[] {
  const occurrences: Occurrence[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    let deco: RegExpExecArray | null;
    // exec state is per-regex; reset before each file loop
    DECORATOR_RE.lastIndex = 0;
    while ((deco = DECORATOR_RE.exec(src)) !== null) {
      const argSlice = deco[1];
      STRING_LITERAL_RE.lastIndex = 0;
      let str: RegExpExecArray | null;
      while ((str = STRING_LITERAL_RE.exec(argSlice)) !== null) {
        occurrences.push({ code: str[1], file: path.relative(SRC_ROOT, file) });
      }
    }
  }
  return occurrences;
}

function extractMapOccurrences(files: string[]): Occurrence[] {
  const occurrences: Occurrence[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    let map: RegExpExecArray | null;
    PERMISSION_MAP_RE.lastIndex = 0;
    while ((map = PERMISSION_MAP_RE.exec(src)) !== null) {
      const body = map[2];
      DOTTED_CODE_RE.lastIndex = 0;
      let str: RegExpExecArray | null;
      while ((str = DOTTED_CODE_RE.exec(body)) !== null) {
        occurrences.push({ code: str[1], file: path.relative(SRC_ROOT, file) });
      }
    }
  }
  return occurrences;
}

describe("Permission-registry coverage guard — every @RequirePermissions code must be in permissionRegistry", () => {
  const files = collectSourceFiles(SRC_ROOT);
  const occurrences = extractOccurrences(files);
  const mapOccurrences = extractMapOccurrences(files);
  const registryCodes = new Set<string>(permissionRegistry.map((p) => p.code));

  // Positive control. A regex that silently matches nothing would otherwise
  // pass forever while checking nothing — an instrument that cannot fail is
  // not a guard. `@RequirePermissions` is used on ~90 controllers today, so
  // 20 is a safely loose floor that still trips if the extractor breaks.
  it("extractor found @RequirePermissions codes across the API (positive control)", () => {
    const uniqueCodes = new Set(occurrences.map((o) => o.code));
    expect(uniqueCodes.size).toBeGreaterThan(20);
  });

  // Positive control for the object-literal-map extractor. Timeline's
  // `VIEW_PERMISSIONS` map is a known site; if this floor drops to zero the
  // extractor silently matched nothing and the guard is a placebo.
  it("extractor found permission-map codes across the API (positive control)", () => {
    const uniqueCodes = new Set(mapOccurrences.map((o) => o.code));
    expect(uniqueCodes.size).toBeGreaterThan(0);
  });

  it("every enforced code is present in permissionRegistry (or on the KNOWN_UNREGISTERED allowlist)", () => {
    const offenders: string[] = [];
    for (const { code, file } of [...occurrences, ...mapOccurrences]) {
      if (registryCodes.has(code)) continue;
      if (KNOWN_UNREGISTERED.has(code)) continue;
      offenders.push(`  - "${code}" enforced at ${file} is not in permission-registry.ts`);
    }
    if (offenders.length > 0) {
      throw new Error(
        [
          "The following @RequirePermissions codes are not in permission-registry.ts.",
          "PermissionsGuard is fail-closed and PermissionsService only upserts codes that",
          "exist in the registry, so any endpoint enforcing one of these codes is a",
          "permanently-false gate — every non-super-user is locked out forever.",
          "",
          "Fix: add the code to apps/api/src/common/permissions/permission-registry.ts",
          "(and, if it belongs to a new module, register the module in module-registry.ts).",
          "",
          ...offenders
        ].join("\n")
      );
    }
  });

  it("KNOWN_UNREGISTERED contains no code that has since been registered (allowlist cannot rot)", () => {
    const stale = [...KNOWN_UNREGISTERED].filter((code) => registryCodes.has(code));
    if (stale.length > 0) {
      throw new Error(
        [
          "The following codes are on KNOWN_UNREGISTERED but are now in permission-registry.ts.",
          "Their armed fix PR has merged — delete them from the allowlist in this spec:",
          "",
          ...stale.map((c) => `  - "${c}"`)
        ].join("\n")
      );
    }
  });
});
