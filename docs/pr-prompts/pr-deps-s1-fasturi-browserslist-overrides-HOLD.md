---
premise: '! grep -q browserslist package.json'
premise_means: >-
  Six of the seven open high-severity Dependabot alerts are cleared by two pnpm overrides and
  neither is in place. MEASURED 2026-09-03 at origin/main de811907 via the Dependabot API - fast-uri
  carries four alerts (GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf,
  GHSA-jqff-g426-hqxp), all patched in 4.1.3, and the lock resolves 4.1.2 because the existing
  override pins the floor one patch too low. browserslist carries two (GHSA-c83g-rgw3-j3cx,
  GHSA-73wf-gq98-2v4g), patched in 4.28.7, lock resolves 4.28.2, and it has no override at all. All
  seven are transitive runtime dependencies in pnpm-lock.yaml, so no direct dependency changes.
scope:
  - package.json
  - pnpm-lock.yaml
done_when: >-
  grep -q "4.1.3" package.json && grep -q browserslist package.json && ! grep -q "fast-uri@4.1.2" pnpm-lock.yaml && ! grep -q "browserslist@4.28.2" pnpm-lock.yaml && pnpm build
size: 2
gate_allow: dependencies
seed_only: false
escalates: false
---

# DEPS-S1: two override bumps clear six of the seven high-severity advisories

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T05:3xZ.**

Three packages, seven alerts, and **six of them are one bump each**. Both are transitive runtime
dependencies, so nothing in any workspace `package.json` dependency list changes.

| Package | Alerts | Lock resolves | Patched in | Override today |
|---|---|---|---|---|
| `fast-uri` | #93 #94 #95 #96 | `4.1.2` | `4.1.3` | `">=4.1.2"` — **one patch too low** |
| `browserslist` | #91 #92 | `4.28.2` | `4.28.7` | none |
| `extract-zip` | #88 | `2.0.1` | **none exists** | — out of scope, see below |

## Do

1. **`package.json`, in the existing `pnpm.overrides` block** — change the `fast-uri` entry from
   `">=4.1.2"` to `">=4.1.3"`, and add a `browserslist` entry of `">=4.28.7"`. Keep the block's
   existing style: same quoting, same one-entry-per-line layout, appended in the same manner as the
   entries already there.
2. **Refresh the lock**: `pnpm install --lockfile-only`, then confirm the two resolutions moved.
   Commit `pnpm-lock.yaml` with it. A `package.json` override with a stale lock fixes nothing — the
   lock is the artifact the scanner reads.
3. **Run `pnpm build` and `pnpm lint` before opening the PR.** `browserslist` feeds the web build's
   target resolution; a minor bump is expected to be inert but that is a claim to test, not assume.
4. **Declare the gate.** Put `GATE-ALLOW: dependencies` **bare, at column 0** in the PR body. CP-11
   hard-fails an undeclared dependency change, and the marker does not match its regex if it is
   indented or carries a heading or a trailing period.
5. **In the PR body, state which alert numbers this closes** — #91, #92, #93, #94, #95, #96 — and
   state plainly that **#88 is not closed and why**.

## `extract-zip` #88 is deliberately out of scope

`extract-zip <= 2.0.1` (GHSA-jmr9-qjv8-65gv, unvalidated symlink path traversal) has **no patched
version at all** — the Dependabot record's `first_patched_version` is empty. There is nothing to bump
to. Pinning a floor that does not exist would fail the install; overriding it to a fork would be a
supply-chain decision, not a version bump. It reaches the tree through a single parent and is a build
and test-time tool, not shipped application code, but that is a mitigation to be argued rather than a
fix. **Leave it open and leave the alert open.** It is handled by `pr-deps-s2`, which removes the
package from the tree entirely by bumping `puppeteer` — a separate slice on purpose, so a
PDF-rendering regression cannot ride along with a routine security bump.

## Do NOT

- Do NOT add, remove or bump any entry in a workspace `dependencies` or `devDependencies` block. The
  fix is an override; the direct dependency graph does not change.
- Do NOT touch any other entry in the existing overrides block. Several of them are load-bearing and
  a drive-by bump turns a two-line security fix into an unreviewable diff.
- Do NOT run a bare `pnpm install` that rewrites unrelated resolutions. Use `--lockfile-only` and
  read the diff before committing it.
- Do NOT attempt to resolve, override, fork or suppress `extract-zip`.
- Do NOT touch `sot/`.

## Verify

- `grep -n "fast-uri" package.json` shows `">=4.1.3"`.
- `grep -n "browserslist" package.json` shows `">=4.28.7"`.
- `grep -c "fast-uri@4.1.2" pnpm-lock.yaml` returns **0**; `grep -c "browserslist@4.28.2"` returns **0**.
- `git diff --stat` lists exactly two files. If the lock diff runs to hundreds of unrelated lines,
  the install rewrote more than it should have — reset and redo with `--lockfile-only`.
- `pnpm build` and `pnpm lint` both exit 0.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run. Finishing the work and then asking for permission is
> indistinguishable from failing.
