# Migration runs

Every one-shot data migration lands its plan output here as a Markdown table. Marco-runs-it
operations (D34) are documented here so the audit trail lives in the repo, not in a shell
scrollback. Files here are append-only history -- do not rewrite past migration-run tables.

## Index

| File | Description | Status |
|---|---|---|
| [tender-folder-copy-2026.md](tender-folder-copy-2026.md) | TFM-S8: 2026 tender folder copy plan. Per-tender copy list captured via `POST /api/v1/admin/imports/sharepoint-legacy-copy/plan`. Marco runs execute by hand after review. | PR open, do-not-merge |

## How this directory works

1. A one-shot capture script in `scripts/migration-runs/` calls the relevant API endpoint
   and writes a plan table into this directory.
2. The PR carrying that table is left open with the `do-not-merge` label until Marco has
   reviewed the plan and executed the migration from his workstation.
3. After execution, Marco amends the PR with a confirmation note (or opens a follow-up PR)
   and the file remains here as a permanent audit record.
4. **Do not delete or rewrite these files.** They are the audit trail for production data
   operations authorised under D34.
