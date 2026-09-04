#!/usr/bin/env node
// check-pipeline-heartbeat.mjs — does the pipeline still run at all?
//
// THE HOLE THIS FILLS. On 2026-09-02 all four scheduled stations were disabled at
// 17:19 local and restored at 09:58 the next morning: 16.6 hours with nothing
// running. `check-breadcrumb.mjs --freshness` does its job and would have named the
// silent stations — but its only consumer is Station 00, and Station 00 was one of
// the disabled tasks. The pipeline asks "is anything failing to run?" only from
// INSIDE a run. Switch the runs off and the question stops being asked.
//
// So this check must not run on the same machine or the same scheduler. It runs as a
// GitHub Actions scheduled workflow, on GitHub's clock, where the act that disables
// the stations cannot reach it.
//
// WHY IT WATCHES THE WHOLE PIPELINE AND NOT EACH STATION.
// The obvious design is per-station freshness. It is the wrong one here, for two
// reasons. First, the correct per-station threshold is an OPEN QUESTION with Marco
// (escalation #23: the 2x rule makes exactly one missed daily occurrence invisible),
// and baking a contested number into an alarm that pages a human is how alarms get
// muted. Second, a single station having a bad day is not this alarm's business —
// Station 00 already reports that, and it is right to. THIS alarm exists for the case
// where NOBODY is reporting, which is unambiguous, needs no per-station tuning, and is
// exactly the 16.6-hour incident.
//
// So: alarm when NO station has filed a breadcrumb for THRESHOLD_HOURS. With 00 hourly
// and 04 four-hourly, total silence for six hours is not a quiet patch.
//
// MERGE LATENCY IS ACCOUNTED FOR, NOT IGNORED. A breadcrumb reaches `main` only when a
// board PR merges, so this check sees the pipeline through up to ~1 h of lag. That is
// noise at a six-hour threshold, and it is why the threshold is not tighter.
//
// A DECLARED PAUSE IS NOT AN OUTAGE. The 16.6 h was Marco, deliberately. An alarm that
// pages him for a window he chose gets muted within a fortnight, and then it is not an
// alarm. `docs/pipeline/pause.json` with a future `until` silences this and says so.
//
// Exit 0 = alive, or paused.  Exit 1 = silent (the workflow fails and notifies).
// Exit 2 = could not tell (bad input) — deliberately NOT an alarm.

import { readFileSync, existsSync, readdirSync } from "node:fs";

export const DEFAULT_THRESHOLD_HOURS = 6;
export const PAUSE_FILE = "docs/pipeline/pause.json";
const DIR = "docs/pr-prompts";

// Same shape lint-station and check-breadcrumb use. Kept local rather than imported so
// this check has no dependency on the thing it is watching.
const NAME_RE = /^00-(\d\d)-([A-Za-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([A-Za-z0-9-]+)\.md$/;

/**
 * Newest breadcrumb timestamp across ALL stations, in ms, or null when there is none.
 * @param {string[]} filenames  basenames only
 * @returns {{ ms: number, station: string, stamp: string } | null}
 */
export function newestBreadcrumb(filenames) {
  let best = null;
  for (const f of filenames ?? []) {
    const m = typeof f === "string" ? f.match(NAME_RE) : null;
    if (!m) continue;
    const [, station, , date, hhmm] = m;
    const stamp = `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`;
    const ms = Date.parse(stamp);
    if (Number.isNaN(ms)) continue;
    if (!best || ms > best.ms) best = { ms, station, stamp };
  }
  return best;
}

/**
 * Parse a declared pause. Anything unparseable is NO pause — a malformed file must not
 * silence the alarm, because that is the failure mode that hides an outage.
 * @param {string|null} text
 * @returns {{ untilMs: number, reason: string } | null}
 */
export function parsePause(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  const untilMs = Date.parse(j.until);
  if (Number.isNaN(untilMs)) return null;
  return { untilMs, reason: typeof j.reason === "string" ? j.reason : "(no reason given)" };
}

/**
 * The whole decision, pure.
 * @returns {{ ok: boolean, state: "paused"|"alive"|"silent"|"unknown", message: string }}
 */
export function evaluateHeartbeat({ nowMs, newest, pause, thresholdHours = DEFAULT_THRESHOLD_HOURS }) {
  if (pause && pause.untilMs > nowMs) {
    const hrs = ((pause.untilMs - nowMs) / 3.6e6).toFixed(1);
    return { ok: true, state: "paused", message: `PAUSED for another ${hrs}h — ${pause.reason}` };
  }
  if (!newest) {
    // No breadcrumbs at all. On a real repo this means the glob or the path is wrong,
    // not that the pipeline is dead — so it is "unknown", never an alarm.
    return { ok: true, state: "unknown", message: "no breadcrumbs found — cannot tell, not alarming" };
  }
  const ageH = (nowMs - newest.ms) / 3.6e6;
  if (ageH > thresholdHours) {
    return {
      ok: false,
      state: "silent",
      message:
        `NO station has reported for ${ageH.toFixed(1)}h (threshold ${thresholdHours}h). ` +
        `Newest is station ${newest.station} at ${newest.stamp}. ` +
        `Either the scheduler is off, the machine is down, or the app is not running. ` +
        `If this was deliberate, declare it in ${PAUSE_FILE}.`,
    };
  }
  return {
    ok: true,
    state: "alive",
    message: `alive — newest breadcrumb is station ${newest.station} at ${newest.stamp} (${ageH.toFixed(1)}h ago)`,
  };
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (invokedDirectly) {
  const thresholdHours = Number(process.env.HEARTBEAT_THRESHOLD_HOURS || DEFAULT_THRESHOLD_HOURS);
  if (!existsSync(DIR)) {
    console.log(`SKIP: ${DIR} not found — run from the repo root.`);
    process.exit(2);
  }
  const newest = newestBreadcrumb(readdirSync(DIR));
  const pause = existsSync(PAUSE_FILE) ? parsePause(readFileSync(PAUSE_FILE, "utf8")) : null;
  const r = evaluateHeartbeat({ nowMs: Date.now(), newest, pause, thresholdHours });
  console.log(`[heartbeat] ${r.state.toUpperCase()}: ${r.message}`);
  process.exit(r.ok ? 0 : 1);
}
