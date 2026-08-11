# ProjectOperations — Consolidated Activity Log (2026-08-04 → 2026-08-05)

**Generated:** 2026-08-05 ~01:35 UTC (11:35 AEST) by the Cowork "program-slice chain" chat, at Marco's request
("record all actions taken by you and any other active chat so nothing goes missing").

**Sources (authoritative):** GitHub PRs (merged/open/closed with timestamps), branch names, the on-disk queue
folders (`docs/pr-prompts/**`), the queue-sync ledger, and this chat's own action history. Timestamps are UTC
from GitHub where a PR exists; local (AEST = UTC+10) where noted from the file system.

> Attribution note: GitHub shows every automated PR as author `GH-Mantova`, so individual *chats* cannot be
> told apart by author. Work is grouped by **program/work-stream** (unambiguous from branch + subject), and this
> chat's own actions are called out explicitly because they are known first-hand. At least **three chats** were
> active in this window: this one (program-slice chain), plus PR-Master/cron chats driving the API-key-vault and
> Smart-Wizard/Settings programs.

---

## 1. LIVE STATE (as of ~01:35 UTC 2026-08-05)

**Open PRs**
- **#923 — F-2a** `feat(forms): F-2a — FormRule definition column + shared rule-definition types`
  (`slice-f2a-formrule-definition-expand`). **DO-NOT-MERGE (escalates: schema) — awaiting Marco's review/merge.**
  This is the gate that releases the rest of the Forms v2 slice chain.
- **#925 — Settings SLICE 4 arm** `docs(pipeline): arm settings-restructure SLICE 4 (Notifications inbox -> /inbox)`
  — opened by ANOTHER chat at 01:19 UTC. Docs/arming PR (not this chat's).

**Queue folders** (`C:\ProjectOperations2\docs\pr-prompts`): ROOT armed ≈ 27 · processed 2376 · no-pr-opened 12 ·
failed 14 · blocked 3 · needs-marco 2 · paused 2.

**needs-marco/ (2):** includes `pr-subbie-rate-cards-scope-pricing-HOLD.md` (RC-3 — parked; its "PR-213" gate is a
placeholder, real dep not built yet).

---

## 2. THIS CHAT — Program-Slice Chain (six-program build) — detailed

**Planning + staging (this session)**
- Authored **34 slice prompts** across the six planned programs (Forms v2 F-2a…F-13 + contract, Realtime/SSE,
  subcontractor rate cards, progress-claim autogen, tender win/loss, multi-tenant) using 6 parallel sub-agents,
  each grounded on origin/main; validated all 34 against the intake-lint static rules (fields, size ≤10,
  migration/gate/rollback coherence, standing-authority block).
- **#921 (merged 23:19)** `stage: program slice prompts (33 HOLD + F-2a armed)` — committed 33 prompts as
  `*-HOLD.md` (staged, not dispatched) + F-2a as `*-ready.md` (chain head) + RC-3 parked in `needs-marco/`.
- Set the chain to self-serialize: each successor armed `HOLD→ready` + `requires_merged:[predecessor PR#]`, so only
  one PR is ever in flight; every schema slice is `escalates` (do-not-merge) so Marco gates each.

**Getting F-2a to actually run**
- Diagnosed that F-2a was armed on origin/main but not dispatching: the arm→queue reconcile (`queue-sync`) runs on
  the supervisor's ~2-hourly cadence, not on merge. Verified via read-only dry-run it "would-arm".
- Respected the pipeline concurrency guard (stood off while the board was busy with review-job churn).
- In a confirmed **SAFE window**, forced the reconcile from a **clean worktree off origin/main** and **surgically
  materialized only F-2a** (byte-exact, ledger-guarded) — deliberately NOT the two unrelated `synthetic-fixtures`
  prompts. Watcher then built F-2a and opened **#923**.

**#922 fix (another chat's PR, unblocked by this chat)**
- **#922** `SLICE 3 — Settings group visible…` was red on **CP-22** (one unchecked checklist box in the PR body;
  real build/lint/test were green). Ticked the box (truthful — those CI jobs ran green) and re-ran the gate →
  **passed**; #922 later **merged (01:18)**.

**Arming F-2b**
- **#924 (merged 01:30)** `arm: F-2b (rules-eval-unify) gated on F-2a #923` — renamed
  `pr-fv2-rules-eval-unify` HOLD→ready and inserted `requires_merged:[923]`. Caught and fixed a UTF-8 em-dash
  corruption (PowerShell 5.1 `Get-Content` ANSI misread) before pushing — re-did the transform byte-exact/UTF-8.
- A watch loop (scheduled self-pings) is running to arm each next slice (F-2c, F-3, …) as its predecessor's PR opens.

**Earlier in this chat's session (2026-08-04) — planning/decisions**
- **#899 (06:03)** sot-02 roadmap reconcile. **#903 (06:14)** SLICE-0 plans batch 1 (Forms v2 whole program F-2→F-13
  + subcontractor rate cards). **#905 (19:28)** SLICE-0 plans batch 2 (realtime websockets, multi-tenant,
  progress-claim, win/loss). **#907 (19:13)** sot-02: move planned items into §3.
- **Architecture decisions locked with Marco:** **#915 (21:51)** realtime = **SSE** (not WebSockets) + multi-tenant =
  **model A** (row-level nullable tenantId); **#916 (22:02)** sot-02 §6 resolved decisions #8/#9.
- Produced/updated the program audit doc and recorded dispositions + decisions to project memory.

---

## 3. FULL BOARD HISTORY since 2026-08-04 — by work-stream (all chats/crons)

### A. API-key vault + geocoding provider-failover (overnight program — other chat/cron)
- #885 stage SLICE-0 vault plan (00:38) · #887 SLICE-0 unified vault+geocoding plan (01:15)
- #888 stage SLICE-1 models (01:39) · #889 SLICE-1 ApiCredential/ApiKeyType models + migration (02:13)
- #890 stage SLICE-2 seam (02:39) · #892 SLICE-2 ApiKeysService.resolve() legacy-primary (03:53)
- #893 stage SLICE-3 (04:06) · **#898 CLOSED-unmerged** SLICE-3 fix-forward attempt (05:05) ·
  #895 SLICE-3 backfill + flip resolve() vault-first (05:09)
- #900 stage SLICE-5 (05:23) · #901 SLICE-5 GeocodingChainService (06:27)
- #908 arm SLICE-6 (06:55) · #909 SLICE-6 Google/Geocodify/MapTiler/Nominatim adapters (07:48)
- #911 arm SLICE-7 (08:21) · #912 SLICE-7 custom REST adapter, SSRF-hardened (09:05)
- #913 arm SLICE-4a; stage 4b/4c HOLD (21:13) · #917 SLICE-4a vault management API (22:43)

### B. Smart Wizard metadata-catalog (other chat/cron)
- #874 SLICE-0 plan (00:12) · #894 stage catalog fix prompts (04:41) · #896 SLICE-1 bundle catalog into API build (05:37)
- #904 SLICE-2 catalog resolver (07:13) · #910 SLICE-3 verify runbook (08:05) · #914 sot lesson LL-58 (21:25)
- #918 stage intent-first SW SLICE-0 prompt (23:32) · #920 SLICE-0 intent-first SW plan (00:15, Aug 5)

### C. Settings restructure (other chat/cron)
- #878 SLICE-2 vitest in CI (00:27) · #919 arm SLICE-3 (23:06) · **#922 SLICE-3 visible + per-item gates (merged 01:18)**
  [CP-22 gate fixed by this chat] · **#925 arm SLICE-4 (OPEN, 01:19)**

### D. Synthetic fixtures (other chat/cron)
- #883 SLICE-1 Xero synthetic provider + idempotency ref (00:48) · #891 stage slices 2 (graph-mail) + 3 (forms-ingestion) (03:19)

### E. Tendering (other chat/cron)
- #879 Assumptions & Exclusions tab (01:27) · #880 waste transport sub-row default-expand (02:26)

### F. Dialogs / offline (this chat's program, ran overnight)
- #906 wrap /field OfflineProvider in ErrorBoundary (18:47) · #897 usePrompt primitive + migrate 3 window.prompt sites (18:59)
- #902 arm offline-provider error-boundary (05:51)

### G. Misc fix
- #886 e2e: assert timeline system-entry by title not capped count (01:02)

### H. SoT / roadmap / decisions + Program-slice chain (this chat)
- #899, #903, #905, #907, #915, #916 (see §2) · #921 stage slice prompts (23:19) · #923 F-2a (OPEN) · #924 arm F-2b (01:30)

---

## 4. OPEN ITEMS / WATCH-OUTS

- **#923 (F-2a)** needs Marco's merge to release F-2b and the rest of the Forms v2 chain.
- **RC-3** (subbie scope-line pricing) parked in `needs-marco/` — needs the real subcontractor-assignment dependency
  before it can be armed (its "PR-213" gate is a placeholder).
- **failed/ (14)** and **no-pr-opened/ (12)** are mostly older (07-20 → 08-04): expired-OAuth runs, a tendering-e2e
  CI failure (#784 line), two Smart-Wizard catalog slices that exited without a PR (08-04 14:24/14:51/15:56) — worth a
  scanner pass if those slices are still wanted.
- **Cross-chat coordination:** multiple chats arm prompts into the same queue. The one-PR-in-flight discipline +
  `requires_merged` gating + the supervisor concurrency guard are what keep them from colliding. The two
  `synthetic-fixtures` prompts remain armed on origin/main but were intentionally NOT materialized by this chat.

---

*This log is a point-in-time reconstruction. The live board (GitHub PRs + `docs/pr-prompts/**`) is always
authoritative; sot/02 carries program roadmap state.*
