---
premise: '! grep -q "Assumptions" apps/web/src/personas/ChatPanel.tsx'
premise_means: The Tendering Assistant panel (personas/ChatPanel.tsx, with New/History tabs) has no Assumptions & Exclusions tab; the A/E editor is only reachable as a separate floating editor.
scope:
  - apps/web/src/personas/ChatPanel.tsx
  - apps/web/src/pages/tendering/AssumptionsExclusionsFloatingEditor.tsx
  - apps/web/src/pages/tendering/TenderDetailPage.tsx
done_when: pnpm build && pnpm lint && grep -q "Assumptions" apps/web/src/personas/ChatPanel.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Add an "Assumptions & Exclusions" tab to the Tendering Assistant (after History)

## Context (verified on origin/main)
`apps/web/src/personas/ChatPanel.tsx` is the assistant panel — it renders a `New` tab (line ~147) and
a `History` tab (line ~156). The Assumptions/Exclusions editor already exists as
`apps/web/src/pages/tendering/AssumptionsExclusionsFloatingEditor.tsx` (shipped in #238, opened as a
floating editor). Marco wants A/E reachable as a **tab after History** inside the assistant, in the
tender context.

## What to build
ChatPanel is a SHARED persona panel (used beyond tendering), so do NOT hardcode a tender concept into
it. Instead:
1. Give `ChatPanel` an optional prop for host-injected extra tab(s) (e.g. `extraTabs`: label + node),
   rendered AFTER the History tab, with the same tab-switching behaviour.
2. Extract the A/E editor's inner content from `AssumptionsExclusionsFloatingEditor.tsx` into a
   reusable piece (or render the existing component in an embedded, non-floating mode) so it can be
   dropped into a tab. Preserve its load/save behaviour and `readOnly` handling.
3. In the tendering host (`TenderDetailPage.tsx`, where the assistant is mounted for a tender), pass an
   "Assumptions & Exclusions" extra tab wired to the current `tenderId`. Only the tendering host does
   this — other personas get no extra tab.

## Do NOT
- Do NOT hardcode tendering/A-E logic inside the generic `ChatPanel`.
- Do NOT remove the existing floating editor / Alt+A entry point (leave it working).
- Do NOT change the A/E API endpoints or data shape.

## VERIFY
- `pnpm build && pnpm lint`
- Web unit tests pass (`pnpm --filter @project-ops/web test`).
- `grep -q "Assumptions" apps/web/src/personas/ChatPanel.tsx` (or the extraTabs plumbing is present).

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if already on main. Never ask a question or
"stand by" for approval. Read the CI job log before diagnosing any failure.
