---
premise: 'git check-ignore -q "Claude Design/docs/00-design-system.md"'
premise_means: >-
  .gitignore excludes "Claude Design/" wholesale. Exactly ONE of its 81 files is tracked -
  assets/routes.js, which predates the rule. The seven written specification documents (~154 KB,
  54 documented screen sections) are invisible to git, to CI, to GitHub, and to any agent that
  greps the tracked tree - while DOCTRINE says "Claude Design can author interface work the same
  way" and Station 04 treats routes.js as ground truth. A design lane whose output cannot be
  reviewed, diffed or found is the reason all seven are still dated 26 June.
scope:
  - .gitignore
  - Claude Design/README.md
  - Claude Design/docs/00-design-system.md
  - Claude Design/docs/01-commercial.md
  - Claude Design/docs/02-operations.md
  - Claude Design/docs/03-assets-maintenance-forms.md
  - Claude Design/docs/04-workforce-directory-platform.md
  - Claude Design/docs/05-dashboards-admin-account.md
  - Claude Design/docs/06-field-portal-auth.md
  - Claude Design/proposed/README.md
done_when: >-
  ! git check-ignore -q "Claude Design/docs/00-design-system.md" && git ls-files --error-unmatch "Claude Design/docs/01-commercial.md" && git ls-files --error-unmatch "Claude Design/assets/routes.js" && git ls-files --error-unmatch "Claude Design/proposed/README.md" && git check-ignore -q "Claude Design/mockups/tenders.html" && git check-ignore -q "Claude Design/assets/styles.css"
size: 10
gate_allow: none
seed_only: false
escalates: false
cluster: claude-design
cluster_order: 1
---

# CD-S1: make the design specs visible to git, and make their staleness impossible to miss

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

Decided by Marco 2026-09-03: regenerate the six spec docs; leave the 65 mock-ups alone.
**This slice does not regenerate anything.** It removes the reason regeneration is impossible.

## Why this comes first

`git ls-tree -r origin/main -- "Claude Design"` returns **one** file. `git check-ignore` confirms
`docs/`, `mockups/` and `README.md` are all excluded by the bare `Claude Design/` rule. So a prompt
that rewrote the specs would produce **an empty diff**: nothing to review, nothing to merge, no
record that it happened, and the same rot a month later. Un-ignoring the *written* half is the
precondition for every regeneration slice that follows.

**Size 10 is deliberate and stated** (the station's default ceiling is 6). Seven of the ten files
receive one inserted banner each and are otherwise committed byte-for-byte unchanged. The real
change is `.gitignore`, and splitting a mechanical banner insert away from it would leave main in a
state where the docs are visible but silently dated.

## Do

1. **`.gitignore` — un-ignore the written half only.** ⚠️ **The obvious edit does not work.** Git
   cannot re-include a file whose *parent directory* is excluded, so adding
   `!Claude Design/docs/` under a `Claude Design/` rule has no effect. The rule must first stop
   excluding the directory itself:

   ```gitignore
   # Claude Design: the WRITTEN half is tracked and reviewable; the 65 mock-ups,
   # the 194 KB styles.css copy and the assets are not.
   Claude Design/*
   !Claude Design/README.md
   !Claude Design/docs/
   !Claude Design/assets/
   Claude Design/assets/*
   !Claude Design/assets/routes.js
   !Claude Design/proposed/
   ```

   Verify with `git check-ignore -v` on one file from **each of the four** categories before
   committing - a tracked doc, `assets/routes.js`, `proposed/README.md`, and one of `mockups/`
   or `assets/styles.css`. **Use the FILE form, never the directory form**: `check-ignore` on a
   directory prints nothing and exits 1 whether or not a rule ignores its contents, so the
   directory form carries no information at all (DOCTRINE 9.2). Getting this wrong in the
   permissive direction commits a 194 KB stylesheet and 65 HTML files.
2. **`Claude Design/assets/routes.js` must remain tracked, at the same path, unchanged.** It is
   Station 04's ground truth (`04-scanner.md:198`). Confirm with `git ls-files --error-unmatch`
   after the `.gitignore` change. If it drops out of the index, the change is wrong — fix the
   pattern, do not `git add -f` around it.
3. **Commit the seven docs and `README.md` as they are.** Do **not** correct, reword or update any
   content in this slice. What lands is the 26 June text, exactly, so the regeneration slices have
   a real diff to be reviewed against.
4. **Insert one staleness banner at the top of each of the seven docs**, immediately after the H1,
   worded so a reader cannot mistake it for current:

   > ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
   > reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
   > document as the current design without checking it against the running app.

5. **Create `Claude Design/proposed/README.md`** — the home for design intent not yet built, and the
   target of the `design_ref` key (VS-S3). It must state the lifecycle in a few lines: a proposal
   lands here with an id; a prompt cites it as `design_ref`; when the PR implementing it merges,
   the proposal moves to `proposed/_shipped/` stamped with the PR number. Add a one-line
   regeneration status table with a row per doc — `doc | describes | regenerated` — every row
   reading `2026-06-26 | not yet`.
6. **Update `Claude Design/README.md`** to say which half of the folder is tracked and which is not,
   and why.

## Do NOT

- Do NOT un-ignore `mockups/`, `assets/styles.css`, `assets/tokens.css` or any other asset. 65 HTML
  files and a 194 KB stylesheet copy do not belong in the diff.
- Do NOT create `Claude Design/current/`. Generated screenshots are the visual-review chain's
  business (VS-S2), not this slice's, and an empty folder committed now would only rot.
- Do NOT edit any spec's body text beyond inserting the banner. **Regeneration is CD-S2 onward.**
- Do NOT move, rename or edit `routes.js`.
- Do NOT touch `sot/`.

## Verify

- `git check-ignore -v "Claude Design/docs/00-design-system.md"` → **no match** (not ignored).
- `git check-ignore -v "Claude Design/mockups/jobs.html"` → **still ignored**.
- `git check-ignore -v "Claude Design/assets/styles.css"` → **still ignored**.
- `git ls-files "Claude Design" | wc -l` → **10** (routes.js + README + 7 docs + proposed/README).
  If it is materially larger, the `.gitignore` change is too permissive — stop and fix it.
- `git ls-files --error-unmatch "Claude Design/assets/routes.js"` succeeds.
- `git diff --cached --stat` shows each of the seven docs changed by **+7/-0 lines or fewer** —
  proof that only the banner was added.
- `git cat-file -s` on the staged `styles.css` fails (it is not staged).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
