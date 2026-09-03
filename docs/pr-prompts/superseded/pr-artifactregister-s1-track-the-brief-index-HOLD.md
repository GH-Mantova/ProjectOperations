---
premise: '! git ls-files --error-unmatch docs/design/ARTIFACT-REGISTER.md'
premise_means: >-
  No tracked register of published artifacts exists. MEASURED 2026-09-03 at origin/main de811907:
  a repo-wide sweep for artifact links across *.md, *.ts, *.tsx, *.mjs, *.yaml and *.json finds
  exactly THREE distinct artifact ids - 1c1d373e (16 files), a6a66f6e (2), 453e590b (1) - against
  32 published artifacts. So 29 briefs have no pointer from the code at all, and two of them
  (Prototype vs ERP Forensic, Estimating Module Review) had already completed audits that were
  then re-done from scratch because nothing in the repo said they existed. An agent searches the
  tracked tree; a brief the tracked tree cannot name does not exist to it.
scope:
  - docs/design/ARTIFACT-REGISTER.md
done_when: >-
  git ls-files --error-unmatch docs/design/ARTIFACT-REGISTER.md && test "$(grep -c 'claude.ai/code/artifact/' docs/design/ARTIFACT-REGISTER.md)" -ge 32 && grep -q '1c1d373e' docs/design/ARTIFACT-REGISTER.md && grep -q '59bec032' docs/design/ARTIFACT-REGISTER.md
size: 1
gate_allow: none
seed_only: false
escalates: false
cluster: artifact-register
cluster_order: 1
---

# AR-S1: make the published briefs findable from the tracked tree

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T05:2xZ by the cloud/chat lane.**

One new file. No edits to anything that exists. This is the (a) half of the fix for
"25 of 27 briefs are not referenced anywhere in the repo" — the half that makes a brief findable by
`git grep`. The (b) half, a `design_ref` front-matter key so each prompt cites the artifact it
implements, is already staged separately as `pr-visualreview-s3-design-ref-frontmatter-HOLD.md` and
is **not** this slice's business.

## Why this is one file and not a script

The artifact list is **not derivable from the repository**. It lives in the publisher's gallery, and
no command on this box can enumerate it. So the content below is supplied verbatim and your job is
to write it down accurately — not to discover it, and not to improve it. If a row looks wrong to
you, leave it and say so in the PR body.

## Do

1. **Create `docs/design/ARTIFACT-REGISTER.md`** with exactly the content specified below. Create the
   `docs/design/` directory as part of it.
2. Every row must carry the full URL in the form `https://claude.ai/code/artifact/<id>` so that
   `git grep <id>` finds it. That is the entire point of the file — a bare title is not a pointer.
3. Do not reformat, re-sort or re-word the table. The ids and the classifications are measured.

## The file content

Write this, with a top matter block exactly as shown:

    # Artifact register

    Published artifacts are **design and decision INPUTS**, not source of truth. `/sot/` is source of
    truth; this file is a `docs/`-class index so that a brief can be found from the tracked tree.

    **Why this file exists.** An agent searches the tracked tree. Before this register, 29 of 32
    published artifacts had no pointer from any file in the repository, and two completed audits
    were re-done from scratch because nothing here said they existed.

    **This file is a pointer, not a copy.** Never paste an artifact's content here. An artifact is a
    snapshot and nothing syncs it; a second copy in the repo would rot in a second place. Cite the
    id, say what it covers, and let the reader open it.

    **Adding one:** append a row. **Retiring one:** move it to the Retired table with the reason.
    Never delete a row — a retired brief that vanishes gets rebuilt.

    ## Current and load-bearing

    | Artifact | id | Design of record for |
    |---|---|---|
    | [ProjectOperations Work Breakdown](https://claude.ai/code/artifact/67e448de-aab7-42b6-a4d9-460d959d9c6a) | `67e448de` | The consolidated decision log, punch list, repo map and trap list. Folds 14 earlier artifacts. |
    | [Scope of Works — Discipline Cards](https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035) | `1c1d373e` | The scope-card redesign. Carries `wCalc()` (whole-bin billing), `lBase()` (labour by shift), `TRANSPORT_CAP`, and the TIP-to-waste-facility string join. Cited by 16 files. |
    | [Charging Methods Admin](https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df) | `a6a66f6e` | Rate tables and the formula builder. Models Shift as a KEY column with one VALUE column — "night and weekend are rows, not loadings". Cited by 2 files. |
    | [Estimating Prototype](https://claude.ai/code/artifact/fe7430f5-3378-4f3e-a217-de803d6d7384) | `fe7430f5` | The estimator styling the ERP is meant to follow. |
    | [CRM Module Mock-up](https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c) | `3372e3ff` | The CRM design. Link-shared and carries real client data — internal only. |
    | [The Repo Map](https://claude.ai/code/artifact/453e590b-8450-4054-a4ee-3c9fd6d0560a) | `453e590b` | The folder map and lane table. Superseded in substance by the Work Breakdown's Repo map tab; kept because it is cited. |
    | [Feature Pipeline Board](https://claude.ai/code/artifact/e689d914-eb6b-4332-8fc7-c5a240989c7b) | `e689d914` | Feature pipeline tracking. |

    ## Compliance programme — a separate programme, not ERP work

    Two of these are live self-publishing pages holding saved answers. Folding or deleting them
    destroys working data, not prose.

    | Artifact | id | Covers |
    |---|---|---|
    | [WHS Compliance Map](https://claude.ai/code/artifact/9331c5a3-f65a-46d9-8db5-8dc26565a441) | `9331c5a3` | ISO 9001/14001/45001 and Queensland WHS obligations. |
    | [The Target Map](https://claude.ai/code/artifact/0703dc13-f3f8-4d0b-ad54-11be2538c8cf) | `0703dc13` | The target document set. Fed by The Keep List. |
    | [The Keep List](https://claude.ai/code/artifact/2f4353c7-0789-4b39-8845-bc6cf394ffdd) | `2f4353c7` | 826 files, 597 documents, folder overrides and version picks. Unfinished; holds saved state. |
    | [What I Still Need](https://claude.ai/code/artifact/4bc3864f-bea8-4ec6-992b-d83180d077d2) | `4bc3864f` | 22 questions with saved answers and notes. Holds saved state. |
    | [Section 445 Build Spec](https://claude.ai/code/artifact/b3935f38-1633-4254-a239-a014a3b4b8fb) | `b3935f38` | Asbestos awareness course. Not built. |
    | [The Escalation Gate](https://claude.ai/code/artifact/02588f3f-b59b-4c52-baaa-78c59ed2b717) | `02588f3f` | The compliance escalation gate. |

    ## Folded into the Work Breakdown — read the fold, not these

    Their substance is in `67e448de`. Two are marked because their findings were never actioned and
    are still live.

    | Artifact | id | Note |
    |---|---|---|
    | [PR Master Punch List](https://claude.ai/code/artifact/cd8bad9b-69e4-44f7-b142-27ed3a485af0) | `cd8bad9b` | 89-item predecessor. |
    | [The Marco Queue](https://claude.ai/code/artifact/e9ef7856-b182-4624-8e89-79c400b79e96) | `e9ef7856` | All three items closed. |
    | [Mock-up Against the Repo](https://claude.ai/code/artifact/01ee00bf-d746-41a6-8234-b469cea3c582) | `01ee00bf` | A duplicate of the Forensic from the start. |
    | [ERP Conflict Report](https://claude.ai/code/artifact/ac5abb59-5ad9-4fae-b9b8-6298ad40cf93) | `ac5abb59` | Discipline-list inventory, cutting defects with dollar deltas. |
    | [Eight Calls for Sean](https://claude.ai/code/artifact/5dee1179-b13e-4724-b2c9-47831bd7ce1b) | `5dee1179` | The eight verbatim estimating rulings, D1–D6 and A1–A2. |
    | [Calcs V2 Teardown](https://claude.ai/code/artifact/9d217473-0dec-44e7-b003-f5a7dfc6f984) | `9d217473` | Twelve workbook defects with cell references. |
    | [Prototype vs ERP Forensic](https://claude.ai/code/artifact/6fdb9782-fdc7-42d6-a0cd-ef575e4c7adc) | `6fdb9782` | **Never actioned — findings still live.** 31 claims with file and line. |
    | [Estimating Module Review](https://claude.ai/code/artifact/59bec032-876a-4172-b10c-638e3cc84786) | `59bec032` | **Never actioned — findings still live.** W1–W6 money defects, verified still open on 3 Sep. |
    | [ERP Open Design Decisions](https://claude.ai/code/artifact/ca8d9c08-33fa-4e8d-bdc9-12f9aa8171e3) | `ca8d9c08` | The three open design decisions; D3 time-boxed against slice 11c. |
    | [CRM Roadmap Status](https://claude.ai/code/artifact/bbfb9d68-a087-4179-8fa7-f10d2d8a475d) | `bbfb9d68` | 21 slices scored. |
    | [CRM Build Order](https://claude.ai/code/artifact/9d7bb6c3-d460-4a09-939e-141da0a2f50f) | `9d7bb6c3` | S1–S14 with sizes, gates and the dependency graph. |
    | [Client Ledger Cleanup](https://claude.ai/code/artifact/e2efdfca-8dbb-4612-a175-e6ba6bbfb650) | `e2efdfca` | 175 client rows, 12 duplicate clusters, four rulings. Contains client names — do not mirror them here. |
    | [Client Workspace Build Spec](https://claude.ai/code/artifact/0c495181-67ab-4c38-87fe-e477b459018f) | `0c495181` | Decisions A/B/C and acceptance criteria. |

    ## Retired

    | Artifact | id | Why, and what to mine before deleting |
    |---|---|---|
    | [Project Ops Client Workspace](https://claude.ai/code/artifact/ab19b04b-eb3f-4e9e-9912-1d769673fece) | `ab19b04b` | Superseded by Client Workspace Build Spec. Its **drawings** were never redrawn anywhere — the relationship-health bands, the colleague-strength panel, the activity-rollup selector, and a ten-row ideas table. Mine those first. |
    | [Scope of Works Mock-up](https://claude.ai/code/artifact/5e408c1e-6ad3-4d18-837c-50e14a151857) | `5e408c1e` | Findings superseded by Discipline Cards; the design is still cited. Mine the audit before retiring. |
    | [The Artifact Register](https://claude.ai/code/artifact/957d635c-0974-4817-a1b5-f18dd924a709) | `957d635c` | The published predecessor of this file. |

    ## Not yet classified

    Published 2026-09-03 and not read by the run that built this register. Each needs one line
    saying what it is the design of record for, or a move into Retired.

    | Artifact | id |
    |---|---|
    | [ARCP Review Findings](https://claude.ai/code/artifact/846b795c-f408-493a-9b52-a851e2a760b9) | `846b795c` |
    | [ARCP Section 21 — Coating Removal](https://claude.ai/code/artifact/31091614-115c-4a56-b531-55ddda8549bc) | `31091614` |
    | [Height Access Selection](https://claude.ai/code/artifact/ba803039-1b65-4e18-b4d0-06e0425da158) | `ba803039` |

## Do NOT

- Do NOT copy any artifact's content into this file. It is an index of pointers. A second copy of a
  snapshot rots in a second place, which is the defect this register exists to stop.
- Do NOT reproduce client names, personal names or any figure from the Client Ledger Cleanup brief.
  The row names the brief; that is all it may do.
- Do NOT add a `design_ref` key to any prompt, and do NOT edit `PROMPT-SCHEMA.md`. That is VS-S3's
  scope and touching it here creates a conflict.
- Do NOT edit `.gitignore`, `Claude Design/**`, or anything under `docs/pr-prompts/`.
- Do NOT touch `sot/`. A register of external inputs is operational, not source of truth, and CP-24
  hard-fails a PR that mixes `sot/` with anything else.
- Do NOT write a script to enumerate artifacts. Nothing on this box can read the gallery.

## Verify

- `git ls-files --error-unmatch docs/design/ARTIFACT-REGISTER.md` succeeds.
- `grep -c 'claude.ai/code/artifact/' docs/design/ARTIFACT-REGISTER.md` returns **32 or more**.
- `git grep -l 59bec032` now returns this file — before this change it returned nothing, which is
  the whole finding. Run `git grep -l 6fdb9782` as the second control.
- `git diff --cached --name-only` lists **exactly one** path.
- `git grep -c 'claude.ai/code/artifact/' -- docs/design/ARTIFACT-REGISTER.md` is the only hit
  outside the three ids that were already cited.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
