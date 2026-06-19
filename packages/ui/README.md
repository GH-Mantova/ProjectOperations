# @project-ops/ui

Shared UI components for ProjectOperations. The package is consumed two ways:

- **In-repo (apps/web):** resolved to `src/index.ts` via the Vite `resolve.alias`
  and the `@project-ops/ui` entry in `tsconfig.base.json` paths. No rebuild
  needed between edits.
- **External tooling (e.g. Claude Design `/design-sync`):** resolved via
  `main`/`module`/`types`/`exports` to the compiled `dist/` produced by `tsup`.

## Build

```bash
pnpm --filter @project-ops/ui build
```

Emits ESM + `.d.ts` types to `dist/`. `react`, `react-dom`, and `recharts` are
externalised as peer dependencies — they are never bundled.

## Storybook

Not yet wired. Follow-up PR will add stories for each public component and a
`build-storybook` script. Until then, point Claude Design `/design-sync` at the
`dist/` build above.

## CenteredModal

Canonical pop-up component. Visually matches the "Add scope card" discipline picker (the agreed reference design as of June 2026).

Use for confirmations, picker dialogs, and small inline forms. Don't use for full-page editors, anchored popovers, or persistent side panels.

```tsx
import { CenteredModal } from "@project-ops/ui";

<CenteredModal
  title="Delete tender"
  subtitle="This will permanently remove the tender and all its quotes."
  onClose={() => setOpen(false)}
  busy={deleting}
  footer={
    <>
      <button className="s7-btn s7-btn--secondary" onClick={() => setOpen(false)}>Cancel</button>
      <button className="s7-btn s7-btn--danger" onClick={handleDelete}>Delete</button>
    </>
  }
>
  <p>Tender IS-T-001 has 3 quotes and 12 scope items.</p>
</CenteredModal>
```

The `s7-btn*` classes in the example come from the web app's stylesheet (`apps/web/src/styles/`); this package does not define them.

Focus trap is not yet implemented — see the component's JSDoc. Tab navigation will currently escape into the page behind the modal. A follow-up accessibility PR will close that gap.

Migrations of existing pop-ups to this component are landing PR-by-PR — do not bulk-rewrite. New modals MUST use this component.
