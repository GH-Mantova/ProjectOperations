# 00-SUPERVISOR → STATIONS 05 & 06 — 2026-08-20 08:30Z
# D<n> NAMESPACE RESOLUTION — a five-slice CHAIN. Marco approved. Read before touching any D-number.

MARCO'S INSTRUCTION, VERBATIM — it governs the whole design:
  "option 1, ensure chain-wiring everything so no prs are opened before they should"
  "as long as chain-wiring and pr arming - opening - green - merge - main order is
   preserved throughout"

This is NOT five prompts to arm in parallel. Stage all five as -HOLD. Station 00 arms S1 only;
each later slice is armed after its predecessor is green and ON MAIN. Every slice ALSO carries a
requires_on_main gate on a real token the previous slice writes — the watcher DEFERS an unmet
gate and re-checks each rescan, so nothing can open early. Gates are the safety net, arming is
the schedule. Do both.

## WHY (measured at origin/main fa061e02)

D<n> currently has FIVE meanings. A bare D3 means three different things, two of them in
production code comments:
  Marco D3  = Payroll -> Xero export (Building & Construction Award)
  TFM   D3  = T-number is the idempotency key in Tender.title
  EA    D3  = turnaround = days-to-quote (submittedAt - createdAt)

THE SHARP ONE IS D8:
  Marco D8  = branding on system-generated docs only
  TFM   D8  = "Copy via the EXISTING Graph seam - no new Graph/MSAL client.
               escalates: true - AZURE environment."
Azure is Marco's ABSOLUTE hard stop. An agent resolving the wrong D8 either loses an Azure
constraint it must obey, or invents one that does not exist.

Enforcement case, from the register Station 05 landed in sot/05 (#1287):
  "A checker that fails on any D<n> present in the repo but absent from this register would be
   WRONG, not merely noisy - it would demand that a spreadsheet cell reference and three
   unrelated plan-local decision lists be registered as Marco's decisions."
Until D<n> means ONE thing, the register cannot be enforced.

## THE CHAIN

S1  TFM series -> TFM-D3 / TFM-D8 / TFM-D9        [Station 06]  gate: none (chain head)
    docs/plans/tender-tracker-migration-plan.md
    apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts  (comments :12-16)
    docs/data-model/tender-migration/MIG-1-DONE.md
    DO NOT touch docs/pr-prompts/superseded/** - archived history. S4 excludes it instead.
    KEEP the existing "Decision references (from docs/plans/...)" attribution line.

S2  EA series -> EA-D3 / EA-D4 / EA-D5            [Station 06]
    gate: requires_on_main: apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts :: TFM-D3
    ^^ gate on the file S1 ACTUALLY edits. A gate on a file the chain never writes is FILE_GATE_DEAD.
    docs/plans/estimating-analytics-plan.md
    apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts  (:7-10)
    apps/api/src/modules/reporting/estimating-analytics-report.definitions.spec.ts
    apps/api/src/modules/reporting/reporting.service.ts
    docs/plans/bid-prioritisation-plan.md
    docs/plans/estimator-allocation-workload-plan.md
    docs/pr-prompts/pr-ea-s1-report-defs-HOLD.md
    docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md
    THIS is the series that actually misleads: its code comment gives NO source, just
    "// Decision D3:". ADD the attribution line as well as the prefix.
    Two touched files are -HOLD prompts: re-lint both, paste verdicts in the PR body,
    do NOT change their premises or gates.

S3  sot/06 widget IDs -> W1..W5, and PR-chain labels disambiguated   [Station 05]
    gate: requires_on_main: apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts :: EA-D3
    sot/06-active-specs.md holds 20 D<n> tokens and NOT ONE is a decision citation:
      6 are dashboard widget IDs (:1223-1227) -> rename to W1..W5
      the rest are PR-chain labels in an A/B/C/D work breakdown -> do NOT renumber the chain;
      make every occurrence read "PR D1" rather than a bare D1.
    ALSO in this slice: add ONE line to the register header in sot/05-decisions-and-lessons.md
    stating D<n> is now exclusive to the register, carrying the literal marker:
        D_NAMESPACE_EXCLUSIVE
    That is S4's proof-of-landing gate. Attach it to a REAL statement, never a stub.
    CP-24: this slice is sot/ ONLY. No scripts/, no apps/. pr-gates.mjs:327 hard-blocks sot/+code.

S4  checker, WARN-ONLY                            [Station 06]
    gate: requires_on_main: sot/05-decisions-and-lessons.md :: D_NAMESPACE_EXCLUSIVE
    scripts/pipeline/check-d-register.mjs - fail on any D<n> cited but absent from the register.
    REQUIRED EXCLUSIONS, each measured:
      docs/pr-prompts/superseded/**          archived history (deliberately not renamed in S1)
      the sot/05 register rows themselves    it defines them; must not flag itself
      TFM-D* / EA-D* / W*                    namespaced by S1-S3
      "PR D<n>"                              the sot/06 work-breakdown chain
      mergeCells("A1:D1") in estimate-excel.builder.ts:62 ; fixture ZZTEST-BP0A3-D1
    SHIP WARN-ONLY. Hard-on red-lights every PR - scheduler-resourcing-spec.md alone has 40 refs.
    Wire into the SAME CI job as the sot-reference checkers, not a fifth standalone script.
    Tests with a POSITIVE CONTROL: unregistered D99 must warn; registered D48 must not.

S5  flip checker to fail                          [Station 06]
    gate: requires_on_main on a real symbol from S4, PLUS a human precondition Station 00
    enforces: ONE clean warn-only run on main must be read first.

## NOT IN SCOPE
- Renumbering Marco's register. D-allocation is his. S1-S3 rename only FOREIGN series.
- The D42 contradiction flagged in the register (says never merge SLICE 0 gate PRs; the log
  records #1146/#1149/#1150 were merged). Marco's ruling, separately.

Nothing in this chain touches schema, seed, migrations, permissions or any runtime path.
Comments, plan prose, table labels only.

-- Station 00, Supervisor. Full handover text is with Marco.
