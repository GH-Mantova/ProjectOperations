# X1. AI Personas (Tendering Assistant)

## Purpose

The conversational AI assistant Raj uses across the Tendering module.
One persona ("Tendering Assistant") active across the whole module with
sub-modes per route (pipeline, register, tender-detail, scope, estimate,
quote, clarifications). Tools per sub-mode let the model read drawings,
look up rates, propose scope/estimate/quote/clarification content, and
read the asbestos register.

§5A.1 was the entire persona rollout. As of 2026-05-24 it is **code-complete**;
sign-off pending Marco's fresh-conversation smoke from re-seeded state.

This is the highest-blast-radius surface in the app. Recently shipped.
High risk for regression.

## Surface area

**Routes (frontend):**
- Persona window: floating bubble bottom-right on every Tendering route,
  draggable (PR B1.8 / #173), minimisable, position persisted to
  localStorage
- Cog icon deep-links to `/admin/ai-settings`
- `/admin/ai-settings` — Company tab (Sean) + My Settings tab (every user)

**API endpoints (key):**
- `GET /api/v1/personas` — list personas
- `POST /api/v1/personas/tendering/chat` — SSE stream
- `POST /api/v1/personas/tendering/conversations/:id/messages` —
  alternative
- `GET/POST/DELETE /api/v1/personas/tendering/conversations` — history
- `POST /api/v1/personas/tendering/scope-proposals/:messageId/accept |
  reject | accept-all | reject-all`
- `POST /api/v1/personas/tendering/estimate-proposals/:messageId/...`
  (PR D / #215)
- `POST /api/v1/personas/tendering/quote-proposals/:messageId/...`
  (PR E / #216)
- `POST /api/v1/personas/tendering/clarification-proposals/:messageId/...`
  (PR F / #217)
- `GET/POST/DELETE /api/v1/ai-settings/company/*`
- `GET/POST/DELETE /api/v1/ai-settings/my/*` (BYOK per PR #134)

**Tools (internal — not user-callable HTTP):**
- `list_tender_drawings`, `extract_drawing_titleblock`, `read_tender_drawing`
- `lookup_rate` (8 types: cutting, core_hole, labour, plant, waste, fuel,
  enclosure, other)
- `propose_scope_items`
- `propose_estimate_items`
- `propose_quote_content`, `list_tender_quotes`
- `propose_clarifications`, `list_tender_clarifications`
- `read_asbestos_register`

**DB entities:**
- `Persona`, `PersonaCompanyInstruction`, `UserPersonaSettings`
- `Conversation` (per user / personaSlug / subMode / contextKey)
- `ConversationMessage` (role, content, metadata JSONB, visibility column)

**Sub-modes (defined in `apps/api/src/modules/personas/definitions/tendering.persona.ts`):**
- `pipeline`, `register`, `tender-detail`, `scope`, `estimate`, `quote`,
  `clarifications`

**Sub-mode tool bindings:**

| Sub-mode | Tools bound |
|---|---|
| pipeline | (drawing tools) — verify |
| register | drawing tools, asbestos register (PR G) |
| tender-detail | drawing, asbestos, lookup_rate |
| scope | drawing, asbestos, lookup_rate, propose_scope_items |
| estimate | drawing, asbestos, lookup_rate, propose_estimate_items |
| quote | drawing, asbestos, lookup_rate, list_tender_quotes,
  propose_quote_content |
| clarifications | drawing, asbestos, lookup_rate,
  list_tender_clarifications, propose_clarifications |

## What should work (functional checklist)

### Persona window
- [ ] Floating bubble bottom-right on every Tendering route
- [ ] No bubble on non-Tendering routes (PR #126 excludes /tenders/dashboard
      and other defunct redirects)
- [ ] Draggable from header bar (open) or pill button (minimised)
- [ ] Minimise affordance collapses to pill while preserving position
- [ ] × resets to default bottom-right corner
- [ ] Position + minimised state persisted to localStorage per
      persona+sub-mode key
- [ ] Viewport clamp on drag / resize / minimise/open swap
- [ ] Pointer + touch + pen all supported
- [ ] Clicks inside the window aren't blocked by drag capture (PR B1.8.1)

### AI Settings
- [ ] Company tab: Sean toggles provider access (Anthropic, OpenAI,
      Gemini, Groq); company key save/delete; AES-256-GCM encryption
      at rest (PR #134)
- [ ] Per-persona config (system prompt overrides, allowed providers)
- [ ] Global "allow user instruction overrides" toggle
- [ ] My Settings tab: provider preference; per-persona settings showing
      company instruction read-only + personal override field if Sean enables
- [ ] BYOK key validation on save (5s timeout)
- [ ] Audit log captures key save / delete / use with userId+provider+source
      only (never the key itself)
- [ ] Three-tier provider resolution: user key → company key → no env
      fallback (PR #134, fixed in PR #138)

### Conversation
- [ ] Auto-resume most recent thread on panel open (PR #136)
- [ ] "New conversation" button
- [ ] History list with delete (user-initiated only — retention is forever)
- [ ] Failed/interrupted streams don't pollute history
- [ ] Conversation persistence per (user, personaSlug, subMode, contextKey)
- [ ] Streaming with SSE — chunks render incrementally
- [ ] Retry button replays last user message (PR #125, no empty array)
- [ ] Empty state copy is correct (PR #129 fixed model-defaults hint)

### Tool calling
- [ ] Multi-turn loop with 10-turn cap, 8-parallel cap (PR #141)
- [ ] Error-as-tool-result policy (errors come back as a fake tool result,
      not raise to user)
- [ ] Tool use streamed: tool_use_started / tool_use_completed events
- [ ] Image content passed on current turn after tool exec (PR #147),
      DB replay marker on older turns

### Drawing tools (scope sub-mode + bound across all 5 tender-scoped
sub-modes per PR #143)
- [ ] `list_tender_drawings` returns PDF/PNG/JPEG only (mime filter,
      PR #145)
- [ ] `extract_drawing_titleblock` returns regex extraction
- [ ] `read_tender_drawing` rasterises page at 1568px max
- [ ] CUID validation works (PR #144 inject tender context → model uses
      CUID, not display code)
- [ ] SharePointFileNotFoundError produces specific user message
      (PR #146)

### Rate lookup (`lookup_rate`)
- [ ] All 8 types: cutting, core_hole, labour, plant, waste, fuel,
      enclosure, other (PR H / #214)
- [ ] Cutting: exact-schedule lookup (equipment / elevation / material /
      depthMm) — PR #148
- [ ] Core hole: base rate per diameter × elevation multiplier
      (Floor=1.0, Wall=1.1, Inverted=2.0) — PR #148
- [ ] Labour: dayRate/nightRate/weekendRate from EstimateLabourRate
- [ ] Plant: EstimatePlantRate (rate + unit + fuelRate)
- [ ] Waste: EstimateWasteRate ((wasteType, facility) unique)
- [ ] All queries filter `isActive: true`
- [ ] No-match path lists available options (not just "not found")
- [ ] Case-insensitive matching via Prisma `mode: "insensitive"`
- [ ] Bound to all 5 tender-scoped sub-modes (PR #149) — NOT register
- [ ] Mandatory policy enforced: no ranges, no year-stamped market refs,
      no market-knowledge estimates, no pre-emptive figures (PR #149)
- [ ] GLOBAL_RATE_FABRICATION_PROHIBITION cannot be loosened by company
      or user instructions (PR #161)
- [ ] Labour-unit correction: AUD per day, not per hour (PR F / #217)

### Proposal cards
- [ ] `propose_scope_items` (scope sub-mode only) — IS-discipline
      constraint at schema level (PR #137)
- [ ] `propose_estimate_items` (estimate sub-mode only) — PR D / #215;
      must call lookup_rate first per system prompt
- [ ] `propose_quote_content` + `list_tender_quotes` (quote sub-mode
      only) — PR E / #216; only DRAFT quotes accept content; cost-line
      prices USER-SUPPLIED (no AI invention)
- [ ] `propose_clarifications` + `list_tender_clarifications`
      (clarifications sub-mode only) — PR F / #217; three discriminated
      kinds: new_rfi, new_note, rfi_response
- [ ] Each proposal type has its own card UI (`*ProposalCardList`)
- [ ] Accept / Edit / Reject / Bulk Accept All / Reject All
- [ ] toolName discriminator in metadata so history rebuild routes each
      proposal type correctly (PR D + E + F)
- [ ] Page reload preserves proposal cards via metadata.toolName branch
      (PR D)

### Asbestos register (`read_asbestos_register`, PR G / #218)
- [ ] Auto-detected by filename keyword: "asbestos register" / "hazmat" /
      "ACM survey" / "Division 6"
- [ ] PDF text layer + first-3-pages image fallback for scanned
- [ ] XLSX every sheet tab-delimited
- [ ] DOCX raw text via mammoth
- [ ] Single-page image supported
- [ ] Bound to all 6 Tendering sub-modes (cross-reference is reference
      material like drawings)

### Legacy AI scope drafting
- [ ] Standalone "Draft scope with Claude" path was DELETED in PR B / #212
- [ ] No orphan helpers left
- [ ] No `.draft-scope-*` CSS

## Recent PRs that shaped it (last ~100 merged)

**Foundation:**
- #117 — Persona registry foundation
- #118 — Persona controller slug-driven permissions
- #119 — Floating window shell + route detection
- #120 — Persona window cog link + excluded routes
- #121 — AI Settings page (replaces stub)
- #122 — Investigation only (legacy AI providers)
- #123 — AI integration MVP (streaming chat)
- #124 — OpenAI provider implementation
- #125 — Retry button replays last message
- #126 — Persona panel header / excluded /tenders/dashboard
- #127 — Doc sanity check
- #128 — Security alerts
- #129 — AI provider model defaults reconcile + empty state copy
- #130 — Track migration_lock.toml
- #131 — SSE error sanitisation
- #132 — Migrate AI scope drafting to persona system
- #133 — End-of-day audit cleanup
- #134 — BYOK encryption + Company key UI — **functional**
- #135 — Sanitise Xero service errors (defence-in-depth pattern)
- #136 — Conversation persistence — **functional**
- #137 — Scope sub-mode tools (proposal cards + tool calling) —
  **functional**
- #138 — AI provider three-tier fallback
- #139 — Drop 8 dead PlatformConfig columns
- #141 — Multi-turn agent loop foundation — **functional**
- #142 — Drawing tools — **functional**
- #143 — Bind drawing tools to all sub-modes
- #144 — Tender context system prompt injection
- #145 — Filter drawings by mime-type
- #146 — Mock adapter persists locally + downloadFileBytes
- #147 — Image content on current turn

**§5A.1 Item 5 tooling chain:**
- #148 — `lookup_rate` cutting + core holes — **functional**
- #149 — lookup_rate bound to all tender-scoped sub-modes
- #151 — Split subMode label from description (UI leak fix)
- #152 — Global rate-fabrication prohibition at intrinsicPrompt
- #154 — pdfjs-dist CVE mitigation
- #160 — Mirror-test cleanup
- #161 — Rate-fabrication override precedence hardening
- #212 — Remove legacy "Draft scope with Claude" path (PR B)
- #213 — PR B follow-up (orphan helpers)
- #214 — Extend lookup_rate to all rate types (PR H) — **functional**
- #215 — `propose_estimate_items` (PR D) — **functional**
- #216 — `propose_quote_content` + `list_tender_quotes` (PR E) —
  **functional**
- #217 — `propose_clarifications` + `list_tender_clarifications`
  (PR F) — **functional**
- #218 — `read_asbestos_register` (PR G) — **functional, completes §5A.1
  tooling**
- #219 — persona sub-mode routing fix + §5A.1 finalisation
- #173 (PR B1.8) — Draggable/minimisable persona window
- #174 (PR B1.8.1) — Click handlers fix

Doc-only:
- #110 — project_instructions chat types update
- #109 — Raw URL for progress.md
- #127 — Doc sanity check

## What to watch for during sanity check

This is **the** highest-priority sanity-check surface. Treat it as a
mini-system.

- **Fresh-conversation smoke from re-seeded state** — Marco's outstanding
  gate. Reseed DB, log in, open Tendering Assistant on IS-T020 demo
  tender, walk through each sub-mode (pipeline, register, tender-detail,
  scope, estimate, quote, clarifications), confirm tools work end-to-end.
- **Tool fabrication prohibition (PRs #148–#161)** — try to coax the
  model into giving a rate as a range, with a year-stamp ("SEQ 2024-25"),
  or as market knowledge. Should refuse and require lookup_rate. This was
  the PR #149 discovery — fake rates appeared in tender-detail tab when
  lookup_rate was unbound.
- **Drawing context bug class (PR #142 → #147)** — five layers of failure
  shipped in series; if a similar fail-step pattern reappears, it's a
  regression of one of #142/#144/#145/#146/#147.
- **Display code vs CUID** — model must pass CUID to tools (PR #144),
  not "IS-T020" display code. If you see a malformed-CUID rejection,
  it's a regression.
- **Image not replayed marker** — should only appear on OLDER turns
  (PR #147). Current turn should always show full image content.
- **Asbestos register filename detection (PR G)** — upload a register
  with a non-matching name; tool should NOT auto-detect. Upload with a
  matching keyword; should detect.
- **Proposal-card history rebuild** — page reload should preserve scope,
  estimate, quote, AND clarification proposal cards on their respective
  surfaces, never mixed.
- **BYOK key validation (PR #134)** — save a bad key; should fail
  cleanly with 5s timeout. Gemini / Groq throw "not yet implemented"
  by design.
- **Conversation persistence (PR #136)** — start a chat, navigate away,
  come back; resume same thread automatically. Delete it; gone.
- **Three-tier provider resolution (PR #138)** — set user pref to
  "system default", company key only — should resolve to company key,
  not error.
- **Draggable + minimisable window state (PR B1.8 + B1.8.1)** —
  drag, minimise, refresh, position preserved, clicks inside still work.
- **Permission gating** — `ai.persona.tendering` controls visibility.
  User without it: no bubble at all.

## Edge cases worth probing

- **No AI keys configured anywhere** — ProviderNotConfiguredError surfaces
  cleanly, not as raw stack trace
- **Long conversation (50+ turns)** — context window limit (PHASE 6 ⏸️
  pagination not yet built — degrade gracefully)
- **Tool times out** — error-as-tool-result fallback
- **Multiple parallel tool calls (8-cap)** — model fires 5 lookups at
  once, all return correctly
- **Drawing tool on encrypted PDF** — clean failure
- **Asbestos register on unsupported file (PSD, RTF)** — clean failure
- **lookup_rate with mistyped equipment name** — case-insensitive +
  list-of-available helps user
- **Network drop mid-stream** — failed stream doesn't pollute history
  (PR #136 + #137)
- **Two browser tabs both editing same tender's scope via persona** —
  proposals applied via Accept; database-level last-write-wins
- **Sub-mode change mid-conversation** — does the conversation
  continue with the new tool slot? (PR #143 binds drawing tools to all
  sub-modes; lookup_rate to 5 of 6)
- **Mobile width** — persona window on phone? Default position bottom-
  right would overlap bottom tab bar; verify
- **Page refresh during streaming** — interrupted stream is NOT persisted
  (PR #136)
