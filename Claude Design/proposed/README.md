# Claude Design — proposed

Design intent that has not yet shipped. This folder is the target of the `design_ref` key on
prompts that touch the UI.

## Lifecycle

1. **Propose.** Write a proposal here as `<id>.md` where `<id>` is a short kebab-case slug
   (e.g. `job-detail-header-2026-09`). The proposal states the change, the surface it affects,
   and the mockups or references that make it concrete.
2. **Cite.** A prompt implementing the proposal names it as `design_ref: proposed/<id>.md`.
3. **Ship.** When the PR that implements the proposal merges, move the file to
   `proposed/_shipped/<id>.md` and stamp its top line with the merged PR number and date.

A proposal that has shipped stays in `_shipped/` as a permanent record; a proposal that is
withdrawn is deleted with a note in the PR description.

## Regeneration status of the 26 June snapshots

The 7 spec docs in `Claude Design/docs/` are frozen at 2026-06-26. Every regeneration slice
updates this table with the merged PR and date; a row that still reads `not yet` is a doc that
the running app has drifted from.

| doc                                        | describes                              | regenerated |
|--------------------------------------------|----------------------------------------|-------------|
| 00-design-system.md                        | tokens, components, layout, a11y       | not yet     |
| 01-commercial.md                           | Tendering, Contracts                   | not yet     |
| 02-operations.md                           | Projects, Jobs, Scheduler, Sites       | not yet     |
| 03-assets-maintenance-forms.md             | Assets, Maintenance, Forms             | not yet     |
| 04-workforce-directory-platform.md         | Workforce, Directory, Platform         | not yet     |
| 05-dashboards-admin-account.md             | Dashboards, Admin, Account             | not yet     |
| 06-field-portal-auth.md                    | Field app, Client portal, Auth         | not yet     |
