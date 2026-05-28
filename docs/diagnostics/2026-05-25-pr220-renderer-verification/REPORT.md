# PR #220 — Renderer Infrastructure Verification

- **Date:** 2026-05-25 (AEST)
- **Author:** Cowork (local diagnostic agent)
- **PR:** #220 — `[5A.2] HTML→PDF renderer infrastructure (Puppeteer)`
- **Commit reviewed:** `9b363e2` (branch `feat/5a2-html-pdf-renderer`)
- **Method:** full code review of the diff + ran the 14 non-Chromium unit tests
  from a fresh clone of the PR branch. The 4 Puppeteer integration tests are
  left to CI (the Cowork sandbox cannot install Chromium's system libraries
  without root).

---

## §1 — Verdict

PR #220 is **sound to merge as infrastructure.** It implements the renderer
prompt accurately, the diff is clean, and the 14 logic tests pass. Four
findings below — none block #220 itself (the renderer is not yet called by
anything), but findings 1, 2 and 4 should be resolved **before §5A.2 PR 2**
wires the renderer to real quote rendering.

## §2 — Test execution

Ran from `apps/api`:

```
PASS src/modules/pdf-rendering/__tests__/template-helpers.spec.ts
PASS src/modules/pdf-rendering/__tests__/pdf-render-types.spec.ts
Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
```

The 4 integration tests in `pdf-renderer.integration.spec.ts` launch real
Chromium and are gated by CI (the PR adds `npx puppeteer browsers install
chrome` to the API test workflow).

## §3 — What is correct (verified in the diff)

- Lazy **single shared** Chromium; concurrent launches coalesce via a
  `launching` promise; `disconnected` event nulls the handle so the next
  render relaunches; `OnModuleDestroy` closes the browser.
- Launch args include the three required flags — `--no-sandbox`,
  `--disable-setuid-sandbox`, `--disable-dev-shm-usage`.
- `nest-cli.json` adds an `assets` copy rule for
  `modules/pdf-rendering/templates/**` → `dist/src`. Without this the
  templates + fonts would not reach the build output and `loadTemplate`
  would fail at runtime. Correctly handled.
- `loadTemplateFile` has a path-traversal guard and injects a
  `<base href="file://…/templates/">` tag so the bundled `@font-face` fonts
  resolve under `page.setContent`.
- `PDF_RENDER_DEFAULTS` matches the IS PDF spec (§11): A4, margins
  top 25 / right 15 / bottom 20 / left 15 mm, `printBackground: true`.
- `puppeteer` is lazy-`require`d inside `launchBrowser()`, so importing the
  module does not load Chromium — good for boot time and testability.
- **PDFKit is untouched** — `quote-pdf.builder.ts` / `quote-pdf.service.ts`
  are absent from the diff, as scoped.
- Docs updated: `progress.md` (including backfilled #218/#219 entries),
  `roadmap.md` §5A.2, `project_instructions.md` §13.

## §4 — Findings

### Finding 1 — Concurrency guard is racy and does not actually limit renders (moderate)

In `pdf-renderer.service.ts`, `renderHtmlToPdf`:

```
if (this.inFlight >= MAX_CONCURRENT_RENDERS) { throw ... }
const browser = await this.getBrowser();   // await
const page = await browser.newPage();      // await
this.inFlight++;                           // increment happens HERE
```

`inFlight` is incremented only **after** two `await` points past the check.
Genuinely concurrent `renderHtmlToPdf` calls all pass the `>= 4` check while
`inFlight` is still at its old value — none has incremented yet — so the cap
never engages under concurrency, which is the one situation it exists for.
**Fix:** increment `inFlight` synchronously, immediately after the check and
before the awaits (keep the `finally` decrement). Also note the guard *throws*
rather than queueing — acceptable per the brief, but a bounded queue would be
more robust once real endpoints call it.

### Finding 2 — Fonts may not be loaded when the PDF is generated (moderate)

```
await page.setContent(html, { waitUntil: "domcontentloaded", ... });
const pdfUint8 = await page.pdf({ ... });
```

`waitUntil: "domcontentloaded"` resolves before `@font-face` web fonts finish
loading. `page.pdf()` can therefore run before Outfit/Syne are applied,
producing fallback-font output — which defeats the reason the fonts were
bundled. The integration tests assert valid-PDF/page-count, not font fidelity,
so they will not catch this. **Fix:** use `waitUntil: "load"` (or
`"networkidle0"`) and `await page.evaluate(() => document.fonts.ready)` before
`page.pdf()`. Worth fixing before PR 2 renders a real quote for Sean's sign-off.

### Finding 3 — `interpolate()` does not HTML-escape (low / advisory)

`interpolate()` substitutes `{{key}}` with `String(value)` unescaped. Fine for
PR 1 (only the static sample template). But PRs 2–4 will interpolate real quote
and client data — values containing `<`, `&`, etc. would break layout or
inject markup. The document-migration PRs must escape interpolated data, or
add escaping to the helper.

### Finding 4 — Azure deployment not addressed (must fix before PR 2)

PR #220 adds the Chromium install step to the CI **test** workflow (`ci.yml`)
only. `deploy.yml` is untouched, so the deployed Azure Web App has no
guaranteed Chromium. Harmless for #220 (the renderer is unused in production),
but the first production quote PDF rendered through it will fail at runtime
unless the deploy provides Chromium. Resolve before §5A.2 PR 2.

## §5 — Recommendation

Let #220 merge. Before §5A.2 PR 2 (Quote migration): fix findings 1 and 2
(small changes in `pdf-renderer.service.ts`), resolve finding 4 (Azure
Chromium), and have the migration PRs handle finding 3 (escape interpolated
data). These can be a short fast-follow PR or folded into PR 2's preparation —
MAIN's call.

*Report produced by Cowork. Not committed by Cowork.*
