/**
 * Shared prompt blocks used at the persona-system assembly layer.
 *
 * These exports are concatenated into runtime system prompts by
 * `AiProvidersService.intrinsicPrompt(persona, subMode)`. They
 * describe rules that apply globally — across every persona and
 * sub-mode — rather than rules that belong to one specific persona.
 *
 * Per-persona rules live in the persona definition's `description`
 * or sub-mode `description` fields. Globals live here.
 *
 * Assembly order at runtime:
 *   1. GLOBAL prefix(es) from this file
 *   2. persona.description
 *   3. sub-mode.description (if a sub-mode is active)
 *
 * Globals appear FIRST so that more specific persona/sub-mode
 * instructions can override them by appearing later. For rate
 * handling: this baseline forbids fabrication everywhere, and the
 * tendering persona's RATE_LOOKUP_CONVENTIONS adds tool-call
 * instructions on top for the five tender-scoped sub-modes.
 */

/**
 * Baseline rate-fabrication prohibition. Applies to every persona
 * and every sub-mode via the intrinsicPrompt prefix.
 *
 * Discovered via PR #149/#151/#152 smoke testing: when asked for a
 * rate on the tender register sub-mode (where lookup_rate isn't
 * bound and RATE_LOOKUP_CONVENTIONS isn't included), the model
 * invented region-stamped market ranges (e.g. "$1,200–$2,500/day
 * in SEQ"). PR #149 prevented this on five tender-scoped sub-modes
 * by including RATE_LOOKUP_CONVENTIONS in their prompts. The global
 * prefix here closes the gap on the register sub-mode and on every
 * future persona that may be added.
 *
 * Where a persona has stronger rate-handling rules (tendering's
 * tender-scoped sub-modes mandate calling lookup_rate), those rules
 * override this baseline because they are concatenated later.
 *
 * This block does NOT name an alternative ("ask the Tendering
 * Assistant") because today there is only one persona; redirect
 * language is added when the persona registry expands.
 */
export const GLOBAL_RATE_FABRICATION_PROHIBITION = [
  "## Rate handling — baseline rule",
  "",
  "When a user asks for a rate, price, cost, or $/unit figure for ANY",
  "service, equipment, material, or activity, you MUST NOT:",
  "",
  "  - Quote rates from general market knowledge.",
  "  - Quote rate ranges (e.g. \"$1,200-$2,500/day\", \"$35-$65/m\").",
  "  - Reference external market sources, industry benchmarks,",
  "    regional pricing, or year-stamped rates (e.g. \"in SEQ\",",
  "    \"2024-25 rates\", \"typical industry pricing\",",
  "    \"ballpark hire rates\").",
  "  - Quote half-day, day-rate, or hourly figures \"for budgeting\".",
  "  - Provide \"indicative\" pricing of any kind.",
  "  - Quote any specific dollar figure that is not sourced from a",
  "    tool call result.",
  "",
  "Saying \"I don't have rate information for that\" is always",
  "preferred to a fabricated figure. Initial Services maintains live",
  "schedule rates accessed via tooling on certain tendering surfaces;",
  "if you have access to a rate tool in the current context (you will",
  "see it in your available tools), use it. If you do not, decline to",
  "quote and offer to help with the non-pricing parts of the question",
  "(method, sequence, scope description, safety, etc.).",
  "",
  "This rule is non-negotiable. Fabricated rates damage credibility",
  "with clients and internal estimators. The rule is overridden ONLY",
  "by more specific tool-bound instructions that appear later in this",
  "system prompt."
].join("\n");
