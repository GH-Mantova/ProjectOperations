# docs/pr-prompts - prompt queue

This folder is the prompt queue. Each prompt moves through six states during its life.
The full standard - folder names, the fsWatch constraint, exceptions vocabulary, and the
migration rules - lives in `docs/pipeline/QUEUE-LAYOUT.md`.

## The six states

| state | where | meaning |
|---|---|---|
| brainstorm | `brainstorm/` | being thought about; not a prompt yet; nothing reads it |
| draft | `draft/` | written, not approved; inert - no gate, no arm, no build |
| hold | `*-HOLD.md` (root) | approved and staged; on main; waiting on its gate |
| armed | `*-ready.md` (root) | the rename IS the dispatch; watcher fires immediately on this |
| merged | `merged/` | its PR is confirmed MERGED on main |
| superseded | `superseded/` | replaced; the replacement is named inside the file |

Files in the root that do not match `*-HOLD.md` or `*-ready.md` are either reports
(which belong in `reports/`) or exceptions (which belong in `exceptions/<reason>/`).

See `docs/pipeline/QUEUE-LAYOUT.md` for the full standard.
