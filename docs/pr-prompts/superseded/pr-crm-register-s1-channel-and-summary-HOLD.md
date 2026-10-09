---
premise: '! grep -q "CRM_INTERACTION_CHANNEL_V1" apps/api/src/modules/crm/comms/comms.service.ts'
premise_means: >-
  The Tenders register's Last interaction cell shows only "4 days ago". The approved artboard
  (Claude Design/proposed/crm-visual-parity/Register.dc.html) shows "Phone — 4 days ago" with a
  one-line summary underneath, and CRM_REGISTER_V3 shipped both halves as NO-OPs because the API
  sends neither (TendersRegisterPage.tsx header comment and the Last interaction cell). MEASURED
  2026-10-02 at origin/main def136f5. LastInteractionResult in comms.service.ts carries only
  entityType, entityId, lastMessageAt and loggedBy. No channel is recorded anywhere: CommThread has
  no channel column, LogContactDto has no channel field, and the Log modal never asks. The summary
  exists as CommThread.subject but is not returned, and the modal pre-fills it with
  "Contact — <date>", which says nothing.
design_ref: Claude Design/proposed/crm-register-channel-owner/crm-register-channel-owner-mockup.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter api test && pnpm --filter web test &&
  grep -q "CRM_INTERACTION_CHANNEL_V1" apps/api/src/modules/crm/comms/comms.service.ts &&
  grep -q '@map("channel")' apps/api/prisma/schema.prisma &&
  test -f apps/web/src/pages/crm/__tests__/tenders-register-channel.test.ts &&
  node scripts/pipeline/check-hex-ratchet.mjs
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/comms/comms.service.ts
  - apps/api/src/modules/crm/comms/comms.controller.ts
  - apps/api/src/modules/crm/comms/__tests__/comms.service.spec.ts
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/tenders-register-channel.test.ts
size: 5
gate_allow: migrations
backfill: false
seed_only: false
rollback_strategy: >-
  One additive nullable column (comm_threads.channel). Reverting the code leaves the column unused
  and harmless; a down migration drops it. No existing row changes.
escalates: true
module: crm
---

# Tenders register: record the channel, show channel and summary in Last interaction

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`: panel 1 (register rows) and panel 3 (Log form).

## Marco's rulings (2026-10-02)

- Channels: **Phone, Email, Meeting, Site visit, Other.**
- Channel is **required** for every new log. Older logs, which have none, show without it.
- Mock-up approved, including: Subject becomes "Summary", starts empty, and an old default
  subject falls back to the first line of the notes.

Tag the new code with `CRM_INTERACTION_CHANNEL_V1` in a comment.

## 1. Schema: one nullable column

`model CommThread` gains:

```prisma
/// CRM_INTERACTION_CHANNEL_V1: how a logged contact was made. Null for
/// conversation threads and for logged contacts recorded before this column.
/// Validated at the DTO layer (phone | email | meeting | site_visit | other),
/// stored as String like entityType.
channel     String?        @map("channel")
```

Write the migration with `prisma migrate dev --create-only` and check it contains a single
`ALTER TABLE "comm_threads" ADD COLUMN "channel" TEXT;` and nothing else. **No backfill.**

Then regenerate the data-model map: `node scripts/data-model/build-relationship-map.mjs`, and
commit `docs/data-model/**`. The PR body must carry `GATE-ALLOW: migrations` bare, at column 0.

## 2. API

`comms.controller.ts`:

- Add `export const COMM_CHANNELS = ["phone", "email", "meeting", "site_visit", "other"] as const;`
  next to `COMM_ENTITY_TYPES`, wherever that lives.
- `LogContactDto` gains `@IsIn(COMM_CHANNELS as unknown as string[]) channel!: string;`. It is
  **required**. Pass it through to `service.logContact`.

`comms.service.ts`:

- `LogContactInput` gains `channel`. `logContact` validates it again (throw
  `BadRequestException("channel must be one of: phone, email, meeting, site_visit, other.")`) and
  writes it to the thread.
- `LastInteractionResult` gains `channel: string | null` and `summary: string`.
- Both `lastInteractionFor` and `lastInteractionBatch` select `thread.subject` and `thread.channel`,
  and build the result through **one** shared private helper, so the two endpoints cannot drift.
- `summary` rule, a pure exported function `interactionSummary(subject, body)`:
  - if `subject`, trimmed, is non-empty and is **not** the old default (matches
    `/^Contact\s+[—-]\s+\d{1,2}\/\d{1,2}\/\d{4}$/`), return the subject;
  - otherwise return the first non-empty line of `body`;
  - truncate to 80 characters, ending in `…` when cut.

Do not change `conversation` threads or any other comms route.

## 3. Web: `TendersRegisterPage.tsx` and helpers

### The Log form (panel 3)

- First field: **Channel**, required. Five toggle buttons in a row, labelled Phone, Email, Meeting,
  Site visit, Other. Wrap them in `role="radiogroup"` with `aria-label="Channel"`. Each is
  `role="radio"` with `aria-checked`, and arrow keys move between them. No default selection.
- **Subject → "Summary"**, with hint text "one line, shown on the register". It **starts empty**,
  with the placeholder `e.g. Chased addendum 3`. Remove the `Contact — <date>` pre-fill. Keep it
  required.
- `LogPayload` gains `channel`. `validateLogPayload` returns `"Pick how you made contact."` when the
  channel is missing, and checks it first. Show the error under the channel row.
- Send `channel` in the `/crm/comms/log-contact` body.

### The Last interaction cell (panel 1)

- `LastInteraction` type gains `channel: string | null` and `summary: string`.
- Line 1: `<Channel label> — <relative time>` when a channel exists, otherwise just
  `<relative time>`. Use a `CHANNEL_LABEL` map in the helpers (`site_visit` → "Site visit").
- Line 2: the summary in the existing muted sub-line style (`crm-cell-sub` or the `relativeTime`
  token style), one line, `text-overflow: ellipsis`, with the full text in `title`.
- The amber "stale" colour on the relative time stays exactly as it is today.
- "Never logged" rows are unchanged.
- Remove the two NO-OP comments (the file header's and the cell's). Replace them with one line
  pointing at `CRM_INTERACTION_CHANNEL_V1`.
- CSV export: add `Last interaction channel` and `Last interaction summary` columns after the
  existing last-interaction column in `buildCrmRegisterCsv`.

**Zero colour literals.** Use the tokens in `apps/web/src/styles/tokens.css` and existing
`crm.css` classes. `check-hex-ratchet.mjs` treats any new file as required-clean.

## Tests

API: extend `comms.service.spec.ts`:

1. `logContact` stores the channel; a missing or unknown channel throws.
2. `lastInteractionBatch` returns `channel` and `summary` for a new log.
3. A legacy thread (channel null, subject `Contact — 20/09/2026`, body
   `"Left voicemail for Dan\nmore"`) returns `channel: null`, `summary: "Left voicemail for Dan"`.
4. `interactionSummary` truncates at 80 characters with `…`; a real subject wins over the body.
5. **Negative control:** a subject that merely starts with "Contact" (e.g. "Contact form sent")
   is kept as typed.

Web: new `__tests__/tenders-register-channel.test.ts`:

1. `validateLogPayload` rejects a missing channel with the exact message, and accepts all five.
2. `CHANNEL_LABEL` covers all five API values.
3. The cell formatter renders `Phone — 4 days ago` with a channel, and only `4 days ago` without.
4. CSV includes the two new columns.

The existing register suites (`crm-s8-register-helpers`, `crmvis-s4-register`,
`tenders-register-interaction`, ...) must stay green. Update their fixtures only where the
`LogPayload` or `LastInteraction` shape now needs `channel` or `summary`, and say which in the PR
body.

## Out of scope

- The Accounts page log form (CRM-S6), which writes relationship notes, not `log-contact`.
- Any backfill of old logs' channel.
- The Owner picker. That is `pr-crm-register-s2-owner-picker`.

`escalates: true`: it carries a migration. The PR opens labelled `do-not-merge`, and Marco
releases it.
