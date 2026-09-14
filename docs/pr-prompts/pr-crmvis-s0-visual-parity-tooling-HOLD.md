---
premise: '! grep -q "entry.actions" scripts/pipeline/visual-smoke.mjs'
premise_means: The vision review can capture a route but cannot click into a record, cannot skip a screen the seed data does not offer, and has nothing to put beside the capture - the CRM artboards exist only inside a claude.ai artifact no station can open, so no CRM PR has ever been judged against the design it cites.
scope:
  - scripts/pipeline/visual-smoke.mjs
  - scripts/pipeline/render-artboards.mjs
  - scripts/pipeline/screens/crm.json
  - docs/pipeline/SCRIPT-REGISTRY.md
  - docs/pipeline/stations/00-supervisor.md
done_when: pnpm lint && grep -q "entry.actions" scripts/pipeline/visual-smoke.mjs && test -f scripts/pipeline/render-artboards.mjs && test -f scripts/pipeline/screens/crm.json && node scripts/pipeline/render-artboards.mjs --src "Claude Design/proposed/crm-visual-parity" --out /tmp/crmvis-artboards && test -f /tmp/crmvis-artboards/Main.png
size: 4
gate_allow: none
seed_only: false
escalates: false
module: pipeline
cluster: crmvis
cluster_order: 1
requires_on_main: 'Claude Design/proposed/crm-visual-parity/canvas.json'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S0 - render the artboards, put them beside the capture

**Slice 1 of 9** of `crmvis`. Tooling only; no `apps/**` file changes. The eight slices behind
this one each rebuild a CRM screen to look like its artboard in `design_ref`, and each is accepted
by a **side-by-side PNG** (app capture | artboard render) that the vision review judges. This
slice makes that PNG producible by a station that cannot open claude.ai.

**Gate:** the artboard snapshot `Claude Design/proposed/crm-visual-parity/` (nine `.dc.html` +
`canvas.json` + README) is on main - it lands with this prompt's staging PR, not with a builder.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the five files in `scope`.

## Guardrails

- One attempt. If `entry.actions` is already in `visual-smoke.mjs` on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- **No new dependency.** Root `package.json` already has `playwright ^1.59.1` (~49). Compose the
  side-by-side with a Playwright page and two `<img>` data URIs - not pngjs, pixelmatch or sharp.
- The artboards link Google Fonts (`Outfit`, `Syne`). A headless box with no egress hangs on
  `waitUntil: "load"` waiting for `fonts.googleapis.com` - measured 2026-09-14. **Abort every
  non-`file://` request** (`page.route("**/*", …)`) and wait for `domcontentloaded` only; the font
  falls back to `system-ui`, which is fine - the vision review judges layout, hierarchy and colour,
  not glyphs. Each `.dc.html` also loads `./support.js`, which does not exist; ignore the 404.

## Grounded on main (read first; cite line numbers in the PR body)

- `scripts/pipeline/visual-smoke.mjs` (187 lines): logs in as the seed admin (~75), drives
  `screens.json` entries `{name, path, waitFor?}` (~19-23, ~130), one full-page PNG per screen at
  a 1440x900 viewport (~143, ~92), output `docs/pr-reviews/pr-{n}-smoke/{name}.png` or `--out`
  (~137-139). It asserts nothing (~10). Exit 3 on any capture failure (~33). There is **no
  committed screens.json anywhere on main** and no smoke PNG exists for any `crmui-*` PR.
- `docs/pipeline/stations/00-supervisor.md` ~391-428 is the VISION REVIEW rule: capture, keep
  (commit PNGs with `chore(smoke): visual acceptance screens for #{n}`), judge, record, "a visual
  FAIL is a SMOKE FAIL". It judges against *prose* in the PR body; nothing hands it a picture of
  the design.
- `docs/pipeline/SCRIPT-REGISTRY.md` ~86 is the `visual-smoke.mjs` row (`| Script | What it does | When |` table at ~74).
- `Claude Design/proposed/README.md` gives the folder's lifecycle; `Claude Design/proposed/
  crm-visual-parity.md` is the proposal, `crm-visual-parity/` the nine artboards. `canvas.json`
  lists each with `file`, `w`, `h`, `title` (Main 1440x900, BulkLink 1100x900, Nav 560x900).
- `lint-prompt.mjs` ~217-230: a `design_ref` may be an artifact URL or a `Claude Design/` path;
  both shape-only.

## What to build

### 1. `visual-smoke.mjs` - two optional keys per screen, nothing else

- `actions?: Array<{ click: string } | { fill: { selector: string; value: string } } | { waitFor: string }>`
  read as `entry.actions` inside `captureOne(page, baseUrl, entry, outDir)` (~85) - that exact
  spelling is the chain needle S1 gates on - and run in order after `path` loads and before the
  screenshot. `click` uses `page.click`, `waitFor`
  uses `page.waitForSelector`. Account 360 has no stable id in the seed data, so its entry opens
  the list and clicks the first account.
- `optional?: boolean` - when a `waitFor` or an action selector is not found within the timeout,
  print `visual-smoke: SKIPPED <name> (optional): <reason>`, write no PNG and **do not** count it
  toward exit 3. The Review-and-link preview only renders while unlinked clients exist.
- Update the usage comment (~19-23). Every existing entry shape still works unchanged.

### 2. `render-artboards.mjs` - new

```
node scripts/pipeline/render-artboards.mjs --src "<dir with canvas.json>" --out <dir>
     [--compare <smoke-dir> --screens <screens.json>]
```

- Reads `canvas.json`, renders each artboard's `.dc.html` at its own `w`x`h` (viewport = size,
  not full-page) to `<out>/<basename>.png` (`Main.dc.html` -> `Main.png`). Requests aborted and
  `domcontentloaded` as the guardrail says.
- With `--compare`: for every screens entry carrying `artboard: "<basename>"`, if
  `<smoke-dir>/<name>.png` exists, compose `<smoke-dir>/<name>.compare.png` - app capture left,
  artboard right, both scaled to 1440 wide, a 24px label strip above each (`app · <name>` /
  `artboard · <title>`), page background `#F6F6F6`. Cap the app capture at the artboard's height
  plus 300px (the full-page capture of a long list is not the comparison). Missing capture ->
  `render-artboards: no capture for <name>, skipped`, exit 0.
- Exit codes: 0 rendered, 1 bad args / no canvas.json, 3 any artboard failed to render.
- Header comment in the house style of `visual-smoke.mjs` (~2-35), naming this as the second
  half of the vision review and pointing at `Claude Design/proposed/crm-visual-parity/README.md`.

### 3. `scripts/pipeline/screens/crm.json` - the eight CRM screens

| name | path | actions | artboard | optional |
|---|---|---|---|---|
| `accounts-list` | `/crm/accounts` | waitFor `text=Accounts` | `Main` | |
| `relationships` | `/crm/accounts?tab=relationships` | waitFor `text=Recent notes` | `Relationships` | |
| `account-360` | `/crm/accounts` | click `table tbody tr:first-child a` | `Account360` | true |
| `register` | `/crm/register` | waitFor `text=Register` | `Register` | |
| `followups` | `/crm/register?tab=follow-ups` | waitFor `text=Never logged` | `FollowUps` | |
| `bulk-link` | `/crm/accounts` | click `text=Review and link` | `BulkLink` | true |
| `comms-inbox` | `/crm/comms` | waitFor `text=Untriaged` | `Intake` | |
| `comms-threads` | `/crm/comms?tab=threads` | waitFor `text=Threads` | `Comms` | |

`artboard` is a key the smoke tool ignores and `render-artboards.mjs` reads. Keep the name
column stable - S1-S8's PR bodies declare these names.

### 4. Docs

- `SCRIPT-REGISTRY.md`: a `pipeline\render-artboards.mjs` row beside ~86, and extend the
  `visual-smoke.mjs` row with "`actions` / `optional` per screen".
- `00-supervisor.md` VISION REVIEW: one new bullet between **Capture** and **Keep** - **Compare.**
  when the PR body names a screens file whose entries carry `artboard`, run
  `render-artboards.mjs --src "Claude Design/proposed/<folder>" --out <tmp> --compare docs/pr-reviews/pr-{n}-smoke --screens <file>`
  and judge the `.compare.png` (kept and committed like the captures). An artboard's orange dots
  and amber foot strip are annotations, never UI. Nothing else in the rule changes.

## Do NOT

- Do NOT touch `apps/**`, `Claude Design/**`, `smoke-pr.ps1`, `lint-prompt.mjs` or `/sot/`.
- Do NOT add a pixel-diff threshold or any assertion - the tool captures and composes, the
  station judges (`visual-smoke.mjs` ~10 is the contract).
- Do NOT commit any PNG.

## VERIFY

```
pnpm lint
grep -q "entry.actions" scripts/pipeline/visual-smoke.mjs
node scripts/pipeline/render-artboards.mjs --src "Claude Design/proposed/crm-visual-parity" --out /tmp/crmvis-artboards
ls /tmp/crmvis-artboards   # nine PNGs, Main.png 1440x900, BulkLink.png 1100x900
node -e "JSON.parse(require('fs').readFileSync('scripts/pipeline/screens/crm.json','utf8')).length===8||process.exit(1)"
```

Open the PR titled `feat(pipeline): S0 - render CRM artboards and compose side-by-side captures for the vision review`
and leave it UNMERGED.
