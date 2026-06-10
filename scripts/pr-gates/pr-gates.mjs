#!/usr/bin/env node
// PR diff gates (CP-09..CP-13, CP-17). Node built-ins only, ASCII-only output.
// Diffs HEAD against the merge-base with origin/main. PR body arrives via PR_BODY.
//
// A PR declares legitimate exceptions with marker lines in its body:
//   GATE-ALLOW: migrations
//   GATE-ALLOW: env-vars
//   GATE-ALLOW: dependencies
//
// Scope gate (opt-in): a fenced ```gate-scope block in the body, one regex per
// line; every changed file must match at least one regex.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

const prBody = process.env.PR_BODY || "";
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

// CP-17 - DTO validation decorators
{
  const dtoFiles = presentFiles.filter((f) =>
    /^apps\/api\/src\/.*\/dto\/[^/]+\.ts$/.test(f)
  );
  const flagged = [];
  for (const file of dtoFiles) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const declaresClass = /\bclass\s+\w+/.test(content);
    const hasValidatorDecorator = /@(Is\w+|Validate\w*|Type)\(/.test(content);
    if (declaresClass && !hasValidatorDecorator) flagged.push(file);
  }
  if (dtoFiles.length === 0) {
    report("PASS", "CP-17", "dto-validation", "no DTO files changed");
  } else if (flagged.length === 0) {
    report("PASS", "CP-17", "dto-validation", `${dtoFiles.length} DTO file(s) checked`);
  } else {
    report(
      "FAIL",
      "CP-17",
      "dto-validation",
      `class without class-validator decorators: ${flagged.join(", ")}`
    );
  }
}

// CP-09/CP-10 - declared scope (opt-in)
{
  const block = prBody.match(/```gate-scope\r?\n([\s\S]*?)```/);
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

process.exit(failed ? 1 : 0);
