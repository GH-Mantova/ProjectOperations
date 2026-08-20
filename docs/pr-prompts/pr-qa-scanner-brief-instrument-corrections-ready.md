---
premise: 'grep -q "could sort before same-day timestamped migrations" docs/pipeline/stations/04-scanner.md'
premise_means: The 04-scanner station brief still states the migration sort hazard in the wrong direction, so sub-check (e) is calibrated against a false model of how Prisma orders migration folders.
scope:
  - docs/pipeline/stations/04-scanner.md
done_when: '! grep -q "could sort before same-day timestamped migrations" docs/pipeline/stations/04-scanner.md && grep -q "SCANNER_BRIEF_CALIBRATED_2026_08_21" docs/pipeline/stations/04-scanner.md'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# 04-scanner brief: three measured defects in the Part 0 instrument spec

STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never
ask a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
This is a docs-only change: touch **only** `docs/pipeline/stations/04-scanner.md`. Do not mix in
`sot/` (CP-24 hard-fails a PR mixing code and `sot/`).

---

## Why this is being changed

`docs/pipeline/stations/04-scanner.md` is the calibration spec for the scanner's Part 0 static
audit. Three of its statements do not match the repository. A station brief that misdescribes the
system produces DOCTRINE §7 instrument lies: a confident, coherent, wrong verdict.

All three were measured on `origin/main` at SHA `a561b703`, 2026-08-21.

### Defect 1 — sub-check (e), the migration sort direction is INVERTED. [MEASURED]

Line 24 currently reads that a bare `YYYYMMDD_` migration prefix "could sort **before** same-day
timestamped migrations".

Sort order probe, run in a clean `origin/main` worktree:

```
node -e "console.log(JSON.stringify(['20260420_feat_x','20260420120000_y','20260420010000_z'].sort()))"
-> ["20260420010000_z","20260420120000_y","20260420_feat_x"]
```

`_` is 0x5F; the ASCII digits are 0x30-0x39. A bare `YYYYMMDD_` folder therefore sorts **AFTER**
every 14-digit same-day sibling, never before. The real hazard is the opposite of the documented
one: a bare-prefixed backfill runs **last** within its day, so it lands after a same-day schema
change it may have been written to precede.

There are **58 bare-prefix folders among 227 migrations** on main — all historical. A guard for new
ones already exists at `apps/api/src/common/__tests__/migration-naming.guard.spec.ts` (shipped via
`pr-migration-naming-guard-ready.md`, now under `superseded/cleared-2026-08-20-verified-shipped/`).
The brief does not mention that guard, so the scanner re-derives the same 58-row list every run.

**Change required:** state the direction correctly (bare sorts AFTER), state the real consequence,
and point the reader at the existing guard spec so the sub-check becomes "report NEW offenders the
guard does not already cover" rather than a full re-enumeration.

### Defect 2 — sub-check (a) prescribes greps for a pattern the codebase has migrated off. [MEASURED]

Line 20 instructs the scanner to grep `permissions.includes(`, redirect guards (`<Navigate to=`),
and `roles?.some(r => r.name === "Admin")`. Mechanism census over `apps/web/src`:

| pattern | hits | files |
|---|---|---|
| `can(` | 77 | 38 |
| `isSuperUser` | 101 | 28 |
| `isAdminUser` | 25 | 9 |
| `RequirePermission` | 30 | 4 |
| `permissions.includes(` | 16 | 8 |
| `<Navigate` | 37 | 7 |
| `roles.some` | **1** | 1 |

Of the 37 `<Navigate>` sites, **exactly 1** is permission-gated at all. Running the brief's
prescribed greps therefore returns "0 findings" from an instrument that is very nearly blind — the
precise failure §7 exists to prevent ("a check never seen to succeed is not a check").

The actual gate is the shared helper at `apps/web/src/auth/permissions.ts`:

```ts
export function can(user, code) {
  if (!user) return false;
  return user.isSuperUser === true || user.permissions.includes(code);
}
```

`isAdminUser()` short-circuits on `isSuperUser` the same way, and `RequirePermissions`
(`apps/web/src/components/SettingsShell.tsx:185`) routes through `can()`. Parity is therefore
structurally correct for every caller of the helpers, and the only real risk surface is a **bare**
`permissions?.includes(` that bypasses them — 15 such sites exist, **14** carry an explicit
`isSuperUser` check and the 15th is a line inside
`apps/web/src/auth/__tests__/superuser-parity.guard.test.ts`, i.e. the CI guard that already
enforces this sub-check automatically.

**Change required:** rewrite sub-check (a) to (i) name `can()` / `isAdminUser()` /
`RequirePermissions` as the sanctioned mechanism, (ii) target bare `permissions?.includes(` sites
that do not also test `isSuperUser` as the actual defect signal, (iii) cite
`superuser-parity.guard.test.ts` as the existing automated enforcement, and (iv) require a
**positive control** — report the count of correctly-super-aware sites alongside any zero, so a
blind detector cannot be mistaken for a clean result.

### Defect 3 — the file carries real double-encoded mojibake in its bytes. [MEASURED]

Not a reader artefact. Verified with `node` (which decodes UTF-8 correctly), per DOCTRINE §7
standing guard 3:

```
bytes=22681   U+FFFD count=0
slice around "full timestamps": "full timestamps Ã¢â‚¬â€ see sot/05)"
hex: 20 c383 c2a2 c3a2 e280 9a c2ac c3a2 e2...
```

`c383 c2a2 c3a2 e2809a c2ac c3a2 ...` is the UTF-8 encoding of `Ã¢â‚¬â€`, which is itself the
Windows-1252 misreading of the UTF-8 em-dash `—` (`e2 80 94`). The file was decoded as cp1252 and
re-saved as UTF-8 at some point. **Zero U+FFFD**, so nothing was lost and the repair is
deterministic: every `Ã¢â‚¬â€` sequence becomes a single em-dash `—`.

**Change required:** repair the sequences and write the file back as **BOM-less UTF-8**. Do the
edit with `node` (`fs.readFileSync(p,'utf8')` / `fs.writeFileSync(p, s, 'utf8')`), **not** with
PowerShell `Set-Content` (writes a BOM) or `>` (writes UTF-16) — see the tooling lessons.

## The work

1. Fix Defect 1 in sub-check (e): correct the direction, state the real consequence, cite
   `apps/api/src/common/__tests__/migration-naming.guard.spec.ts`.
2. Fix Defect 2 in sub-check (a): re-point it at `can()` / `isAdminUser()` / `RequirePermissions`
   and bare `permissions?.includes(`; cite `superuser-parity.guard.test.ts`; require the positive
   control alongside any zero.
3. Fix Defect 3: repair the mojibake with `node`, write BOM-less UTF-8.
4. Add a single marker line so the fix is greppable and this prompt dies on landing:
   `SCANNER_BRIEF_CALIBRATED_2026_08_21 - sub-checks (a) and (e) re-pointed at measured mechanisms; encoding repaired.`
   Place it as a normal line in the Part 0 section (**not** a heading, and not indented).

## Verification before you open the PR

```
grep -c "could sort before same-day timestamped migrations" docs/pipeline/stations/04-scanner.md   # must be 0
grep -c "SCANNER_BRIEF_CALIBRATED_2026_08_21" docs/pipeline/stations/04-scanner.md                 # must be 1
node -e "const s=require('fs').readFileSync('docs/pipeline/stations/04-scanner.md','utf8');console.log('mojibake:',(s.match(/Ã¢â¬/g)||[]).length)"   # must be 0
git diff --numstat                                                                                  # must be ONE file
```

`git diff --numstat` matters: a whole-file rewrite that changes line endings will show hundreds of
changed lines instead of a handful. If you see that, you have introduced CRLF churn — redo the edit
in place.

## Out of scope

Do not touch `sot/`, `scripts/pipeline/**`, or any application code. Do not attempt to fix the 58
historical bare-prefix migrations — they are grandfathered and the naming guard covers new ones.
