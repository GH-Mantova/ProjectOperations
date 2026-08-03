---
premise: 'grep -lqE "window\.prompt" apps/web/src/pages/admin/AutomationsPage.tsx apps/web/src/pages/contracts/BillingTab.tsx apps/web/src/components/punch/PunchTab.tsx'
premise_means: Three surfaces still call native window.prompt for text entry, and useConfirm has no text-input primitive yet.
scope:
  - apps/web/src/hooks/useConfirm.tsx
  - apps/web/src/components/ConfirmDialog.tsx
  - apps/web/src/pages/admin/AutomationsPage.tsx
  - apps/web/src/pages/contracts/BillingTab.tsx
  - apps/web/src/components/punch/PunchTab.tsx
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.prompt' apps/web/src/pages/admin/AutomationsPage.tsx apps/web/src/pages/contracts/BillingTab.tsx apps/web/src/components/punch/PunchTab.tsx)" && grep -q "usePrompt" apps/web/src/hooks/useConfirm.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Add a text-input dialog primitive (usePrompt) and migrate the 3 native window.prompt sites

The `useConfirm` foundation (`apps/web/src/hooks/useConfirm.tsx` + `components/ConfirmDialog.tsx`,
provider mounted in `ShellLayout.tsx`) provides `confirm()` and `alert()` but has **no text-input
primitive**, so three surfaces still call native `window.prompt`. Add a `prompt` capability to the
existing provider (do NOT create a parallel modal system) and migrate all three call sites.

`ConfirmDialog` was already built to host a field — its Enter handler skips `<textarea>` and its
focus trap already includes `input`/`textarea`. Extend it; do not rebuild it.

## ⛔ ORDERING GUARD — run only AFTER the stragglers migration is on main

Before editing anything, verify the `pr-dialogs-migrate-stragglers` migration (confirm/alert ->
useConfirm on AutomationsPage + BillingTab + MapLocationsTab) has already merged:

    git grep -qE "window\.(confirm|alert)" origin/main -- apps/web/src/pages/admin/AutomationsPage.tsx apps/web/src/pages/contracts/BillingTab.tsx

If that command STILL MATCHES (native confirm/alert present), the stragglers migration has NOT
landed. **STOP immediately with `NO-OP: waiting on stragglers migration` — do not branch, do not
edit.** This PR shares two files with that migration; running first would create a same-file merge
conflict. Only proceed once those files are already on `useConfirm`.

## What to build

1. **`useConfirm.tsx`** — extend the existing `ConfirmProvider`:
   - Add `export interface PromptOptions { title: string; message?: string; defaultValue?: string;
     placeholder?: string; confirmLabel?: string; cancelLabel?: string; multiline?: boolean;
     validate?: (value: string) => string | null; }` (validate returns an error string, or null when ok).
   - Add `prompt: (options: PromptOptions) => Promise<string | null>` to `ConfirmContextValue`
     (resolves the entered string on confirm, `null` on cancel / backdrop / Esc).
   - Add a `"prompt"` arm to the `DialogState` union carrying `options` + `resolve`.
   - Export a `usePrompt()` hook mirroring `useConfirm()` / `useAlert()` (throws outside a provider).
   - Render `ConfirmDialog` for the prompt kind, wiring the input value + validation through.

2. **`ConfirmDialog.tsx`** — add optional input support WITHOUT changing existing confirm/alert
   behaviour:
   - New optional `input?: { defaultValue?: string; placeholder?: string; multiline?: boolean;
     validate?: (value: string) => string | null }`. In input mode, surface the current value to the
     caller on confirm (controlled state or a value arg — implementer's call; keep the existing
     `onConfirm()` path working unchanged for confirm/alert).
   - When `input` is set: render a controlled `<input>` (or `<textarea>` when `multiline`), autofocus
     THE FIELD (not the confirm button), show the `validate` error below the field, and block confirm
     while `validate` returns an error. Single-line input: Enter submits (existing handler). Textarea:
     Enter inserts a newline (already handled).
   - Preserve the a11y focus-trap, Esc/backdrop cancel, and `data-testid="confirm-dialog"`.

3. **Migrate the 3 sites** (preserve exact behaviour + wording):
   - `admin/AutomationsPage.tsx` `testFire`: replace `window.prompt("Test payload (JSON object):",
     "{}")` with `await prompt({ title: "Test payload", message: "JSON object", defaultValue: "{}",
     multiline: true, validate: v => { try { JSON.parse(v); return null; } catch { return "Payload must
     be valid JSON."; } } })`. Return on `null`; then `JSON.parse` the result. Inline validation now
     replaces the separate invalid-JSON dialog on that line — remove that one call (whether it is
     `window.alert` or, if stragglers already migrated it, the `useAlert` alert). Do NOT touch the
     OTHER alert (test-fire-failed) — stragglers owns it.
   - `contracts/BillingTab.tsx` `previewProForma`: replace `window.prompt("Preview month (YYYY-MM):",
     <current month>)` with `await prompt({ title: "Preview month", message: "YYYY-MM", defaultValue:
     new Date().toISOString().slice(0,7) })`. Preserve the `if (!month) return` bail (null/empty both bail).
   - `components/punch/PunchTab.tsx`: replace `window.prompt("Closure note (optional):", "")` with
     `await prompt({ title: "Closure note", message: "Optional", defaultValue: "" })`; map `null` to
     `undefined` to preserve the existing `?? undefined` semantics (empty string stays a valid note).
   - Make each enclosing handler `async`/`await` as needed (all three already are).

4. **Test**: if a unit-test file exists for the hook/dialog, extend it to cover `usePrompt` (resolves
   entered value; resolves `null` on cancel; `validate` blocks confirm). If none exists, do NOT invent
   a framework — note that in the PR body.

## Do NOT
- Do NOT create a second/parallel modal or provider — extend the existing `ConfirmProvider`/`ConfirmDialog`.
- Do NOT change any confirm/alert call owned by the stragglers PR (except the one invalid-JSON dialog
  folded into `validate`). Only touch the `window.prompt` lines otherwise.
- Do NOT change dialog wording, the actions guarded, or unrelated logic. Do NOT touch other files.
- Do NOT touch Azure/Entra/SharePoint. No schema, no migration, no seed. No sot/ edits.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already migrated or if the ordering
  guard trips.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
