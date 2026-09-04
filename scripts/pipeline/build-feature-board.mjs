#!/usr/bin/env node
/**
 * build-feature-board.mjs — the feature pipeline board.
 *
 * Emits three files from one walk of the queue:
 *
 *   docs/pipeline/feature-pipeline.json  the data. The seam: if the board ever moves
 *                                        to a DB-backed screen, this is what it reads.
 *   docs/pipeline/feature-pipeline.html  PUBLIC-INTENDED, but NOT SERVED YET.
 *                                        The vite plugin and the staticwebapp.config.json
 *                                        route that would publish it at /feature-pipeline.html
 *                                        are deliberately NOT landed: serving it makes the
 *                                        board readable by anyone with the URL, and that is
 *                                        Marco's call, not this script's. Until then this
 *                                        file is generated and committed, and nothing reads it.
 *   docs/pipeline/board.md               OPERATOR. Never emitted into the build.
 *
 * WHY TWO RENDERED OUTPUTS AND NOT ONE PAGE WITH A FILTER
 * A side-car page has no login — /data-model.html returns 200 to an anonymous
 * request (measured 2026-09-03). So the public half is GENERATED from a filtered
 * set rather than filtered in the browser: a lint verdict, a prompt filename or a
 * PR number cannot leak through a view that was never given them. They are also
 * genuinely different documents. The public half says "cutting costs get their own
 * section, next up"; the operator half says tfm-s11, GATE_RELEASED, size 3.
 *
 * THE AUDIENCE DEFAULT IS `internal`, AND THAT IS DELIBERATE.
 * A prompt with no `audience:` key never reaches the public page. Publication is
 * opt-in per prompt, so a Station 06 run that has never heard of this board cannot
 * accidentally publish anything. Same reason a prompt with no `feature:` title is
 * withheld: without one the only label available is its filename.
 *
 * STAGE IS DERIVED, NEVER STORED. The folder a file sits in, the -HOLD suffix on
 * its name, and the verdict lint-prompt.mjs gives it are the whole input. There is
 * no new bookkeeping for anyone to forget to update.
 *
 * Exit codes:  0 = wrote the outputs.  1 = could not (reason on stderr).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { lint, parseFrontMatter } from "./lint-prompt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PROMPTS = join(REPO, "docs", "pr-prompts");
const OUTDIR = join(REPO, "docs", "pipeline");

const args = new Set(process.argv.slice(2));
const NO_LINT = args.has("--no-lint");
const QUIET = args.has("--quiet");
const log = (...a) => { if (!QUIET) console.error(...a); };

// ---------------------------------------------------------------------------
// Stage model. Ordered; index is the sort key on both outputs.
// ---------------------------------------------------------------------------
export const STAGES = [
  { id: "waiting_on_marco", label: "Waiting on Marco",  publicLabel: "With Marco"  },
  { id: "malformed",        label: "Would open nothing", publicLabel: null         },
  { id: "ready",            label: "Ready to arm",       publicLabel: "Next up"    },
  { id: "gated",            label: "Gated on a slice",   publicLabel: "Planned"    },
  { id: "armed",            label: "Armed",              publicLabel: "In progress"},
  { id: "in_flight",        label: "In flight",          publicLabel: "In progress"},
  { id: "merged",           label: "Merged",             publicLabel: "Shipped"    },
  { id: "parked",           label: "Parked",             publicLabel: null         },
  { id: "abandoned",        label: "Abandoned",          publicLabel: null         },
  { id: "spent",            label: "Already done",       publicLabel: null         },
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/**
 * Map a lint verdict onto a stage.
 *
 * The MISSING_STANDING_AUTHORITY case is why this board exists: before
 * 2026-09-03 that verdict was a warning nobody read, and a prompt carrying it
 * would arm, run, exit 0 and open no PR — indistinguishable from success in
 * every log. It now REJECTs (#1529), and it gets its own stage here rather than
 * being folded into "gated", because the two need opposite actions: a gated
 * prompt waits, a malformed one needs editing.
 */
export function stageFromVerdict(r) {
  if (!r) return "ready";
  if (r.stale) return "spent";
  if (r.ok) return "ready";                       // ADMIT, incl. PROMOTE (gate released)
  switch (r.code) {
    case "HUMAN_GATE_PRESENT":        return "waiting_on_marco";
    case "MISSING_STANDING_AUTHORITY":return "malformed";
    case "GATE_NOT_RELEASED":
    case "FILE_GATE_NOT_RELEASED":
    case "CLUSTER_GATE_NOT_RELEASED": return "gated";
    default:                          return "malformed";
  }
}

// ---------------------------------------------------------------------------
// Queue folders. Flat listings only.
//
// These counts are FILES-THAT-ARE-PROMPTS, not files. status-sweep.ps1 counts
// every file in the folder, so its numbers are larger (measured 2026-09-03:
// no-pr-opened 109 files vs 10 prompts, because each run leaves a .log and a
// .report.md beside the prompt). Neither is wrong; they answer different
// questions. This board answers "how many pieces of work", so it counts *.md
// that are not logs or reports, and says so on the page.
// ---------------------------------------------------------------------------
const FOLDER_STAGE = {
  "needs-marco":  "waiting_on_marco",
  paused:         "parked",
  blocked:        "parked",
  failed:         "abandoned",
  "no-pr-opened": "abandoned",
  superseded:     "abandoned",
  processed:      "merged",
};

const isPromptFile = (n) =>
  n.endsWith(".md") &&
  !n.endsWith(".log") && !n.endsWith(".report.md") &&
  !n.startsWith("00-") &&                       // station breadcrumbs, not prompts
  n !== "PROMPT-SCHEMA.md" && n !== "BACKLOG-DECISIONS.md" &&
  !n.startsWith("TEMPLATE-");

function listPrompts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => isPromptFile(n))
    .filter((n) => { try { return statSync(join(dir, n)).isFile(); } catch { return false; } })
    .sort();
}

// ---------------------------------------------------------------------------
// GitHub + the running API. Both OPTIONAL and both fail soft.
//
// DOCTRINE 7: a broken instrument must never be reported as a measurement. If gh
// is missing or unauthenticated the board says so on its face rather than
// rendering an empty "In flight" column that reads as "nothing is in flight".
// ---------------------------------------------------------------------------
function openPullRequests() {
  try {
    const out = execFileSync("gh",
      ["pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,headRefName"],
      { cwd: REPO, encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
    return { ok: true, prs: JSON.parse(out) };
  } catch (err) {
    return { ok: false, reason: (err && err.message ? err.message : String(err)).slice(0, 120) };
  }
}

function deployedCommit() {
  const url = process.env.FEATURE_BOARD_API_URL;
  if (!url) return { ok: false, reason: "FEATURE_BOARD_API_URL not set" };
  try {
    const out = execFileSync("curl",
      ["-sS", "--max-time", "20", url.replace(/\/+$/, "") + "/version"],
      { encoding: "utf8", timeout: 25000, stdio: ["ignore", "pipe", "ignore"] });
    const j = JSON.parse(out);
    // health.service.ts falls back to the literal "unknown" when GIT_SHA is unset
    // at build time. That is not a commit and must not be rendered as one.
    if (!j.commit || j.commit === "unknown") return { ok: false, reason: "API reports commit=unknown" };
    return { ok: true, commit: String(j.commit) };
  } catch (err) {
    return { ok: false, reason: (err && err.message ? err.message : String(err)).slice(0, 120) };
  }
}

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------
function readPrompt(dir, name, stageHint) {
  const file = join(dir, name);
  let fm = null;
  try { fm = parseFrontMatter(readFileSync(file, "utf8")); } catch { /* unreadable: treat as bare */ }

  const slug = name.replace(/^pr-/, "").replace(/-HOLD\.md$/i, "").replace(/-ready\.md$/i, "").replace(/\.md$/, "");
  let stage = stageHint;
  let verdict = null;

  if (stageHint === "briefed") {
    const hold = /-HOLD\.md$/i.test(name);
    stage = hold ? "ready" : "armed";
    if (hold && !NO_LINT) {
      try {
        const r = lint(file, { repoRoot: REPO });
        verdict = r && (r.ok ? (r.released && r.released.length ? "PROMOTE" : "ADMIT") : (r.stale ? "STALE" : r.code));
        stage = stageFromVerdict(r);
      } catch (err) {
        verdict = "LINT_ERROR";
        stage = "ready";
        log(`  ! lint threw on ${name}: ${(err && err.message) || err}`);
      }
    }
  }

  return {
    slug,
    file: name,
    stage,
    verdict,
    size: fm && fm.size != null ? Number(fm.size) : null,
    escalates: !!(fm && fm.escalates),
    // The four board keys. All optional; all default to the safe direction.
    feature: fm && typeof fm.feature === "string" ? fm.feature.trim() : null,
    area: fm && typeof fm.feature_area === "string" ? fm.feature_area.trim() : "Unassigned",
    audience: fm && typeof fm.audience === "string" ? fm.audience.trim().toLowerCase() : "internal",
    note: fm && typeof fm.feature_note === "string" ? fm.feature_note.trim() : null,
  };
}

function collect() {
  const items = [];
  log("· walking docs/pr-prompts/");
  const top = listPrompts(PROMPTS);
  log(`  ${top.length} at top level${NO_LINT ? " (lint skipped)" : " — linting each, this is the slow part"}`);
  for (const n of top) items.push(readPrompt(PROMPTS, n, "briefed"));

  for (const [folder, stage] of Object.entries(FOLDER_STAGE)) {
    const dir = join(PROMPTS, folder);
    const names = listPrompts(dir);
    log(`  ${String(names.length).padStart(5)} in ${folder}/`);
    for (const n of names) items.push(readPrompt(dir, n, stage));
  }
  return items;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function byArea(items) {
  const m = new Map();
  for (const it of items) {
    if (!m.has(it.area)) m.set(it.area, []);
    m.get(it.area).push(it);
  }
  for (const list of m.values()) {
    list.sort((a, b) => (STAGE_INDEX[a.stage] - STAGE_INDEX[b.stage]) || a.slug.localeCompare(b.slug));
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * The public page. Built from a FILTERED SET, never a filtered view:
 * only items that opted in with an audience and carry a human-readable title.
 * No slug, no filename, no verdict, no PR number reaches this renderer.
 */
export function renderPublic(items, stamp) {
  const shown = items
    .filter((i) => i.audience !== "internal" && i.feature)
    .filter((i) => ["ready", "gated", "armed", "in_flight", "merged", "waiting_on_marco"].includes(i.stage));

  const groups = byArea(shown);
  const rows = groups.map(([area, list]) => `
    <section class="mod">
      <h2>${esc(area)}</h2>
      <ul>${list.map((i) => {
        const s = STAGES[STAGE_INDEX[i.stage]];
        return `<li><span class="t">${esc(i.feature)}</span>${
          i.note ? `<span class="n">${esc(i.note)}</span>` : ""
        }<span class="p p-${i.stage}">${esc(s.publicLabel || "Planned")}</span></li>`;
      }).join("")}</ul>
    </section>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>What we're building — Project Operations</title>
<style>
:root{--bg:#eef0f4;--fg:#12151c;--mut:#5d6675;--card:#fff;--line:#d9dee7;--ok:#047857;--soon:#2f5fd0;--plan:#7b8492;--marco:#b45309}
@media(prefers-color-scheme:dark){:root{--bg:#0d1015;--fg:#e7eaf0;--mut:#98a2b3;--card:#171b23;--line:#2a313d;--ok:#3fd2a0;--soon:#7ea2ff;--plan:#8b94a3;--marco:#e0a33c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.w{max-width:820px;margin:0 auto;padding:40px 22px 70px}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.02em}
.lede{color:var(--mut);margin:0 0 6px}
.stamp{color:var(--mut);font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}
.mod{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-top:16px}
.mod h2{font-size:16px;margin:0 0 10px}
.mod ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.mod li{display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:start}
.t{font-weight:600}
.n{grid-column:1;color:var(--mut);font-size:13px}
.p{grid-row:1;grid-column:2;font-size:12px;font-weight:600;white-space:nowrap;padding:2px 9px;border-radius:99px;border:1px solid currentColor}
.p-ready,.p-armed,.p-in_flight{color:var(--soon)}
.p-merged{color:var(--ok)}
.p-gated{color:var(--plan)}
.p-waiting_on_marco{color:var(--marco)}
.empty{color:var(--mut);background:var(--card);border:1px dashed var(--line);border-radius:10px;padding:22px;margin-top:16px}
</style></head><body><div class="w">
<h1>What we're building</h1>
<p class="lede">Where each part of the system has got to, and when it reaches you.</p>
<p class="stamp">Updated ${esc(stamp)}</p>
${rows || `<div class="empty">Nothing is published to this page yet. An item appears here once its
prompt names a <code>feature</code> and an <code>audience</code>; until then the work is tracked
internally only.</div>`}
</div></body></html>
`;
}

/** The operator page. Everything, including the things the public half must never carry. */
export function renderOperator(items, stamp, prs, deployed) {
  const L = [];
  L.push("# Feature pipeline — operator view", "");
  L.push(`Generated ${stamp}. Never emitted into the web build — see build-feature-board.mjs.`, "");

  const counts = {};
  for (const i of items) counts[i.stage] = (counts[i.stage] || 0) + 1;
  L.push("| stage | count |", "|---|---:|");
  for (const s of STAGES) if (counts[s.id]) L.push(`| ${s.label} | ${counts[s.id]} |`);
  L.push("", `**Total prompts: ${items.length}**`, "");

  L.push("## Instruments", "");
  L.push(prs.ok
    ? `- \`gh\`: OK — ${prs.prs.length} open PR(s).`
    : `- \`gh\`: **UNAVAILABLE** — ${prs.reason}. "In flight" is [CANNOT MEASURE], not zero.`);
  L.push(deployed.ok
    ? `- deployed commit: \`${deployed.commit}\``
    : `- deployed commit: **[CANNOT MEASURE]** — ${deployed.reason}.`);
  L.push(NO_LINT ? "- lint: **SKIPPED** (`--no-lint`); stages are filename-derived only." : "- lint: ran per top-level HOLD.", "");

  const live = items.filter((i) => !["merged", "abandoned"].includes(i.stage));
  L.push("## Live work by area", "");
  for (const [area, list] of byArea(live)) {
    L.push(`### ${area} — ${list.length}`, "");
    L.push("| prompt | stage | verdict | size | audience |", "|---|---|---|---:|---|");
    for (const i of list) {
      L.push(`| \`${i.slug}\` | ${STAGES[STAGE_INDEX[i.stage]].label} | ${i.verdict || "—"} | ${i.size ?? "—"} | ${i.audience}${i.escalates ? " · escalates" : ""} |`);
    }
    L.push("");
  }

  if (prs.ok && prs.prs.length) {
    L.push("## Open PRs", "");
    for (const p of prs.prs) L.push(`- #${p.number} \`${p.headRefName}\` — ${p.title}`);
    L.push("");
  }
  return L.join("\n");
}

// ---------------------------------------------------------------------------
function main() {
  if (!existsSync(PROMPTS)) {
    console.error(`build-feature-board: no ${PROMPTS} — run from the repo, or check the checkout.`);
    process.exit(1);
  }
  const t0 = Date.now();
  const items = collect();
  const prs = openPullRequests();
  const deployed = deployedCommit();
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  // in_flight is the one stage that cannot be derived from disk. Only set it when
  // gh actually answered; otherwise leave the prompt where the queue put it, so a
  // dead instrument reads as "unknown", never as "nothing in flight".
  if (prs.ok) {
    const branches = new Set(prs.prs.map((p) => p.headRefName));
    for (const i of items) if (i.stage === "armed" && branches.has(i.slug)) i.stage = "in_flight";
  }

  mkdirSync(OUTDIR, { recursive: true });
  const payload = { generatedAt: stamp, stages: STAGES, items,
                    instruments: { gh: prs.ok, deployedCommit: deployed.ok ? deployed.commit : null } };
  writeFileSync(join(OUTDIR, "feature-pipeline.json"), JSON.stringify(payload, null, 1) + "\n");
  writeFileSync(join(OUTDIR, "feature-pipeline.html"), renderPublic(items, stamp));
  writeFileSync(join(OUTDIR, "board.md"), renderOperator(items, stamp, prs, deployed) + "\n");

  const pub = items.filter((i) => i.audience !== "internal" && i.feature).length;
  log(`· wrote 3 files in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${items.length} prompts, ${pub} published publicly`);
}

// Same guard as lint-prompt.mjs:1618 — the pure renderers are imported by the
// tests, and importing this file must not run a board build as a side effect.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
