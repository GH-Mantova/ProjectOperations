#!/usr/bin/env node
// PR diff gates (CP-09..CP-13, CP-17, CP-22, CP-23, CP-24, CP-25). Node built-ins only, ASCII-only output.
// Diffs HEAD against the merge-base with origin/main.
//
// PR body source (in priority order):
//   1. CI: PR_NUMBER env var set  -> fetched live via `gh pr view` using GH_TOKEN.
//          Fetching live means re-runs and body edits always see the current body.
//   2. Local: PR_BODY env var     -> used as-is (for local sanity runs).
//   If neither is set the body is treated as empty (all GATE-ALLOW checks pass).
//
// A PR declares legitimate exceptions with marker lines in its body (column 0):
//   GATE-ALLOW: migrations
//   GATE-ALLOW: env-vars
//   GATE-ALLOW: dependencies
//
// CP-23 (seed-without-migration) uses its own column-0 marker as the escape
// hatch, mirroring the GATE-ALLOW convention:
//   SEED-ONLY: dev  -- <reason prod does not need this seed change>
// Rationale: production runs `prisma migrate deploy`, which does NOT run the
// TypeScript seed. So a change that lives only in a seed file never reaches
// production. This has happened twice (#504 tender-package-disciplines, and
// #506 marco super-user parity). See sot/05-decisions-and-lessons.md.
//
// Scope gate (opt-in): a fenced gate-scope block at column 0 in the body, one
// regex per line; every changed file must match at least one regex.
// The opening fence MUST be a line starting at column 0 exactly as:
//   ```gate-scope
// Indented or quoted examples do NOT activate the gate.
//
// Standing rule for PR authors: never place a column-0 gate-scope fence or
// column-0 GATE-ALLOW: lines as documentation in a PR body. Indent examples by
// at least one space so they cannot activate the parsers above.
//
// Verification-checklist gate (CP-22): if the body has a "## Verification"
// heading, every checkbox in that section (until the next "## " heading or
// EOF) must be checked ("- [x]"). Unchecked boxes ("- [ ]") FAIL the gate.
// Only the Verification section is scanned - "## Test plan" and other
// sections may legitimately keep unchecked post-merge items. No Verification
// section -> SKIP.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

let prBody;
const prNumber = process.env.PR_NUMBER;
if (prNumber) {
  try {
    prBody = execFileSync(
      "gh",
      ["pr", "view", prNumber, "--json", "body", "-q", ".body"],
      { encoding: "utf8" }
    );
  } catch (err) {
    process.stderr.write(
      `pr-gates: failed to fetch PR body for #${prNumber}: ${err.message}\n`
    );
    process.exit(1);
  }
} else {
  prBody = process.env.PR_BODY || "";
}
const allows = new Set(
  [...prBody.matchAll(/^GATE-ALLOW: (migrations|env-vars|dependencies)\s*$/gm)].map(
    (m) => m[1]
  )
);

const base = git("merge-base", "origin/main", "HEAD").trim();

const nameStatus = git("diff", "--name-status", base, "HEAD")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...rest] = line.split("\t");
    // Renames/copies (R100, C75) report "old\tnew" - take the new path.
    return { status: status[0], path: rest[rest.length - 1] };
  });

const changedFiles = nameStatus.map((f) => f.path);
const presentFiles = nameStatus.filter((f) => f.status !== "D").map((f) => f.path);

let failed = false;
function report(level, gate, name, detail) {
  console.log(`${level} - ${gate} ${name}${detail ? ` [${detail}]` : ""}`);
  if (level === "FAIL") failed = true;
}

// CP-11 - migrations
{
  const migrations = changedFiles.filter((f) =>
    f.startsWith("apps/api/prisma/migrations/")
  );
  if (migrations.length === 0) {
    report("PASS", "CP-11", "migrations", "no migration changes");
  } else if (allows.has("migrations")) {
    report("ALLOWED", "CP-11", "migrations", migrations.join(", "));
  } else {
    report("FAIL", "CP-11", "migrations", `undeclared: ${migrations.join(", ")}`);
  }
}

// CP-12 - env vars
{
  const diff = git("diff", base, "HEAD", "--", ".env.example");
  const added = [...diff.matchAll(/^\+([A-Z_]+)=/gm)].map((m) => m[1]);
  if (added.length === 0) {
    report("PASS", "CP-12", "env-vars", "no new env vars in .env.example");
  } else if (allows.has("env-vars")) {
    report("ALLOWED", "CP-12", "env-vars", added.join(", "));
  } else {
    report("FAIL", "CP-12", "env-vars", `undeclared: ${added.join(", ")}`);
  }
}

// CP-13 - runtime dependencies (devDependencies changes are always allowed)
{
  const pkgFiles = changedFiles.filter(
    (f) => f.endsWith("package.json") && !f.includes("node_modules")
  );
  const newDeps = [];
  for (const pkg of pkgFiles) {
    let baseDeps = {};
    try {
      baseDeps = JSON.parse(git("show", `${base}:${pkg}`)).dependencies || {};
    } catch {
      // File did not exist at base - every dependency is new.
    }
    let headDeps = {};
    try {
      headDeps = JSON.parse(readFileSync(pkg, "utf8")).dependencies || {};
    } catch {
      continue; // Deleted at head.
    }
    for (const dep of Object.keys(headDeps)) {
      if (!(dep in baseDeps)) newDeps.push(`${pkg}: ${dep}`);
    }
  }
  if (newDeps.length === 0) {
    report("PASS", "CP-13", "dependencies", "no new runtime dependencies");
  } else if (allows.has("dependencies")) {
    report("ALLOWED", "CP-13", "dependencies", newDeps.join(", "));
  } else {
    report("FAIL", "CP-13", "dependencies", `undeclared: ${newDeps.join(", ")}`);
  }
}

// CP-17 - DTO validation decorators on REQUEST-INPUT DTOs only.
// A DTO class is "input" iff a controller binds it via @Body() / @Query() /
// @Param() as the parameter's TYPE. Output/response DTOs (returned from
// handlers, used only for Swagger typing) are not flagged - they carry no
// runtime input to validate.
{
  const dtoFiles = presentFiles.filter((f) =>
    /^apps\/api\/src\/.*\/dto\/[^/]+\.ts$/.test(f)
  );

  // Build the set of class names used as request input across the whole API
  // by scanning every *.controller.ts under apps/api/src for parameter
  // bindings of the form `@Body|Query|Param(...) name: ClassName`. The
  // string-key forms `@Body('field') f: string` don't match because the type
  // is a primitive (lowercase).
  const inputClasses = new Set();
  if (dtoFiles.length > 0) {
    const controllerFiles = git("ls-files", "apps/api/src")
      .split("\n")
      .filter((f) => f.endsWith(".controller.ts"));
    const inputRe =
      /@(?:Body|Query|Param)\([^)]*\)\s*\w+\s*:\s*([A-Z]\w+)/g;
    for (const cf of controllerFiles) {
      let content;
      try {
        content = readFileSync(cf, "utf8");
      } catch {
        continue;
      }
      for (const m of content.matchAll(inputRe)) {
        inputClasses.add(m[1]);
      }
    }
  }

  const flagged = [];
  let inputDtosChecked = 0;
  for (const file of dtoFiles) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const classNames = [...content.matchAll(/\bclass\s+(\w+)/g)].map((m) => m[1]);
    if (classNames.length === 0) continue;
    const hasValidatorDecorator = /@(Is\w+|Validate\w*|Type)\(/.test(content);
    for (const name of classNames) {
      if (!inputClasses.has(name)) continue;
      inputDtosChecked += 1;
      if (!hasValidatorDecorator) flagged.push(`${file}:${name}`);
    }
  }
  if (dtoFiles.length === 0) {
    report("PASS", "CP-17", "dto-validation", "no DTO files changed");
  } else if (inputDtosChecked === 0) {
    report(
      "PASS",
      "CP-17",
      "dto-validation",
      `${dtoFiles.length} DTO file(s) changed, no request-input DTOs (output-only)`
    );
  } else if (flagged.length === 0) {
    report(
      "PASS",
      "CP-17",
      "dto-validation",
      `${inputDtosChecked} input DTO class(es) checked`
    );
  } else {
    report(
      "FAIL",
      "CP-17",
      "dto-validation",
      `input DTO class without class-validator decorators: ${flagged.join(", ")}`
    );
  }
}

// CP-09/CP-10 - declared scope (opt-in)
{
  // Opening fence must be at column 0 (^```gate-scope). Indented/quoted examples
  // inside PR body documentation cannot activate this gate.
  const block = prBody.match(/^```gate-scope[ \t]*\r?\n([\s\S]*?)^```/m);
  if (!block) {
    report("SKIP", "CP-09/10", "scope", "no gate-scope block declared (opt-in)");
  } else {
    const patterns = block[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => new RegExp(l));
    const strays = changedFiles.filter((f) => !patterns.some((p) => p.test(f)));
    if (strays.length === 0) {
      report("PASS", "CP-09/10", "scope", `${changedFiles.length} file(s) in scope`);
    } else {
      report("FAIL", "CP-09/10", "scope", `out of declared scope: ${strays.join(", ")}`);
    }
  }
}

// CP-23 - seed changes must ship with a migration (or explicit dev-only marker).
// Production runs `prisma migrate deploy`, not `pnpm seed`, so a seed-only
// change never reaches prod. Two silent regressions to date (#504, #506).
// The check: if any file under apps/api/prisma/seed* (or apps/api/prisma/seed/*)
// is touched AND no NEW folder was added under apps/api/prisma/migrations/,
// fail unless the body contains a column-0 `SEED-ONLY: dev` line.
{
  const seedRe = /^apps\/api\/prisma\/seed(?:[^/]*|\/.*)$/;
  const seedChanges = changedFiles.filter((f) => seedRe.test(f));
  if (seedChanges.length === 0) {
    report("PASS", "CP-23", "seed-without-migration", "no seed files changed");
  } else {
    // A new migration folder shows up as one or more Added ("A") files under
    // apps/api/prisma/migrations/<folder>/. Prisma migration folders are
    // immutable once merged, so any A-status file under migrations/ implies
    // a newly added folder.
    const newMigrationFiles = nameStatus.filter(
      (f) =>
        f.status === "A" &&
        /^apps\/api\/prisma\/migrations\/[^/]+\//.test(f.path)
    );
    const seedOnlyDev = /^SEED-ONLY:\s*dev\b/m.test(prBody);
    if (newMigrationFiles.length > 0) {
      const folders = new Set(
        newMigrationFiles.map((f) => f.path.split("/")[4])
      );
      report(
        "PASS",
        "CP-23",
        "seed-without-migration",
        `migration added alongside seed: ${[...folders].join(", ")}`
      );
    } else if (seedOnlyDev) {
      report(
        "ALLOWED",
        "CP-23",
        "seed-without-migration",
        `SEED-ONLY: dev marker present (${seedChanges.join(", ")})`
      );
    } else {
      process.stdout.write(
        "::error::This PR changes a Prisma seed but adds no migration.\n" +
          "\n" +
          "Production runs `prisma migrate deploy`, which does NOT run the TypeScript seed.\n" +
          "A seed-only change will therefore NEVER reach production.\n" +
          "\n" +
          "If this data must exist in production, add an idempotent (insert-if-absent /\n" +
          "guarded UPDATE) migration alongside the seed change.\n" +
          "\n" +
          "If this seed change is genuinely dev/test-only and is NOT needed in production,\n" +
          "add this line to the PR body to acknowledge it and pass this gate:\n" +
          "\n" +
          "    SEED-ONLY: dev  -- <one line saying why prod does not need this>\n" +
          "\n" +
          "See sot/05-decisions-and-lessons.md (#504, #506).\n"
      );
      report(
        "FAIL",
        "CP-23",
        "seed-without-migration",
        `seed touched with no migration: ${seedChanges.join(", ")}`
      );
    }
  }
}

// CP-24 - sot purity: a code PR must never touch /sot/. SoT edits land via a
// dedicated doc-reconcile PR (sot/ + docs/ only). Mixing code with sot/ causes
// merge conflicts when two PRs append to the same governance doc. This happened
// on 2026-07-13: PR #543 (a CI PR) and an in-flight doc-reconcile PR both
// appended to sot/05. HARD BLOCK - no escape hatch. See sot/05 LL-36.
// docs/** is intentionally NOT in codeFiles: doc-reconcile PRs legitimately
// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).
{
  const sotRe = /^sot\//;
  const codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/;
  const sotFiles = changedFiles.filter((f) => sotRe.test(f));
  const codeFilesForSot = changedFiles.filter((f) => codeRe.test(f));
  if (sotFiles.length === 0) {
    report("PASS", "CP-24", "sot-purity", "no sot/ files changed");
  } else if (codeFilesForSot.length === 0) {
    report(
      "PASS",
      "CP-24",
      "sot-purity",
      `sot-only change (doc-reconcile PR): ${sotFiles.join(", ")}`
    );
  } else {
    process.stdout.write(
      "::error::This PR changes files under sot/ AND changes code. Both cannot ride in one PR.\n" +
        "\n" +
        "sot/ is the source of truth. Feature/fix/CI PRs must NEVER touch it -- SoT edits\n" +
        "land via a dedicated doc-reconcile PR. Mixing them causes merge conflicts when\n" +
        "two PRs append to the same governance doc. This happened on 2026-07-13: PR #543\n" +
        "(a CI PR) and an in-flight doc-reconcile PR both appended to sot/05.\n" +
        "\n" +
        `  sot/ files changed:  ${sotFiles.join(", ")}\n` +
        `  code files changed:  ${codeFilesForSot.join(", ")}\n` +
        "\n" +
        "HOW TO FIX (30 seconds -- your lesson will NOT be lost):\n" +
        "\n" +
        "  1. Revert the sot/ changes from this PR:\n" +
        "         git checkout origin/main -- sot/\n" +
        "\n" +
        "  2. Write the content to a doc-reconcile prompt instead:\n" +
        "         docs/pr-prompts/pr-sot-<slug>-ready.md\n" +
        "\n" +
        "     Put the exact text you wanted to add to sot/ inside it, naming the target\n" +
        "     file and section. The PR-watcher will land it through the correct channel.\n" +
        "     See docs/pr-prompts/TEMPLATE-sot-reconcile.md for the skeleton.\n" +
        "\n" +
        "  3. Push. This gate turns green.\n" +
        "\n" +
        "Recording the lesson is REQUIRED, not optional -- step 2 is not a way of\n" +
        "discarding it. A lesson dropped to make CI green is a worse outcome than the\n" +
        "conflict this gate prevents.\n"
    );
    report(
      "FAIL",
      "CP-24",
      "sot-purity",
      `sot/ + code in same PR (sot: ${sotFiles.join(", ")}; code: ${codeFilesForSot.join(", ")})`
    );
  }
}

// CP-22 - verification checklist (only the "## Verification" section is scanned)
{
  const lines = prBody.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Verification\s*$/.test(l));
  if (start === -1) {
    report("SKIP", "CP-22", "verification-checklist", "no Verification section");
  } else {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) {
        end = i;
        break;
      }
    }
    const section = lines.slice(start + 1, end);
    const unchecked = section.filter((l) => /^\s*-\s\[ \]/.test(l));
    const checked = section.filter((l) => /^\s*-\s\[[xX]\]/.test(l));
    if (unchecked.length === 0) {
      report(
        "PASS",
        "CP-22",
        "verification-checklist",
        `${checked.length} checkbox(es) checked, none unchecked`
      );
    } else {
      report(
        "FAIL",
        "CP-22",
        "verification-checklist",
        `unchecked: ${unchecked.map((l) => l.trim()).join(" | ")}`
      );
    }
  }
}


// CP-25 - failure honesty (sot/01 SECTION 6): permission failures must not
// silently redirect. Any newly ADDED line under apps/web/src/pages/ that
// matches `Navigate to="/"` is treated as a permission-redirect regression
// and must instead render <NoAccess required={...} />. Legitimate uses
// (route-level catch-all redirects, canonical-URL rewrites) can opt out
// with the trailing comment `// eslint-ok: not-a-permission-redirect`.
{
  const diff = git("diff", "--unified=0", base, "HEAD", "--", "apps/web/src/pages");
  const offenders = [];
  let currentFile = null;
  for (const line of diff.split(/\r?\n/)) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }
    if (!currentFile || !line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);

    // Skip COMMENTS. A gate that flags its own documentation is a bad gate.
    //
    // BUG THIS FIXES (caught on #561, 2026-07-14): the PR that REMOVES silent redirects
    // documented the old behaviour in a test comment --
    //     //   1. non-admin users got <Navigate to="/" replace /> - a silent bounce
    // -- and CP-25 failed the PR for *describing* the very bug it was deleting. The gate
    // cannot tell code from prose unless we teach it to.
    //
    // Deliberately narrow: line comments (//, *, /*) and JSX comment openers. A string
    // literal containing the pattern is still flagged - that is a judgement call we want
    // a human to make, not something to silently wave through.
    const stripped = added.trim();
    const isComment =
      stripped.startsWith("//") ||
      stripped.startsWith("*") ||
      stripped.startsWith("/*") ||
      stripped.startsWith("{/*");
    if (isComment) continue;

    if (/Navigate\s+to="\/"/.test(added) && !/eslint-ok:\s*not-a-permission-redirect/.test(added)) {
      offenders.push(`${currentFile}: ${added.trim()}`);
    }
  }
  if (offenders.length === 0) {
    report("PASS", "CP-25", "failure-honesty", "no new permission-redirects in apps/web/src/pages");
  } else {
    report(
      "FAIL",
      "CP-25",
      "failure-honesty",
      `permission-redirect regression ÔÇö use <NoAccess required={...} /> instead ` +
        `(sot/01 SECTION 6). Offenders: ${offenders.join(" | ")}. ` +
        `If this is a legitimate non-permission redirect, append ` +
        `// eslint-ok: not-a-permission-redirect on the same line.`
    );
  }
}


process.exit(failed ? 1 : 0);
