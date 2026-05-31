/**
 * Worker competency gate helper — roadmap §7 (compliance-critical).
 *
 * Pure function. Given a worker's qualifications and a list of required
 * qualification codes, returns a structured verdict the caller can use to
 * either block an allocation or surface warnings.
 *
 * This PR builds the helper + a read-only endpoint only. Wiring the gate into
 * the allocation create flow is a deliberate future step (see PR body for §7 context).
 *
 * Schema notes:
 * - The Prisma `WorkerQualification` model uses `expiryDate` (not `expiresAt`).
 * - `WorkerQualification` has NO `status` column today; the helper accepts an
 *   optional `status` field so a caller can still represent revoked/withdrawn
 *   /suspended quals (e.g. from a future schema column or a join). When
 *   `status` is undefined, the qual is treated as active.
 */

export interface WorkerQualificationInput {
  qualType: string;
  expiryDate: Date | null;
  // Optional today: the schema has no status column. When provided, only
  // `'active'` is honoured — any other value (revoked/withdrawn/suspended)
  // causes the qual to be treated as missing.
  status?: string;
}

export interface CompetencyGateResult {
  /** True only when `missing` AND `expired` are both empty. */
  allowed: boolean;
  /** qualType codes the worker does not hold (or holds but is non-active). */
  missing: string[];
  /** qualType codes the worker holds but whose expiryDate is in the past. */
  expired: string[];
  /** qualType codes the worker holds that expire within 30 days. Warning only. */
  expiringSoon: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;

/**
 * Decide whether a worker may be allocated to work requiring `requiredQualTypes`.
 *
 * Rules:
 * - `allowed = true` iff `missing` and `expired` are both empty.
 * - A qual is "active" when its `status` is undefined OR exactly `'active'`.
 *   Any other status (revoked/withdrawn/suspended) is treated as missing.
 * - Expiry: `expiryDate === null` → never expires (counts as active).
 *           `expiryDate < today`  → expired.
 *           `expiryDate <= today + 30 days` → expiringSoon (still counts as allowed).
 *
 * Required codes are de-duplicated before evaluation so callers can pass raw,
 * possibly-noisy lists from URL params without skewing the result arrays.
 */
export function checkCompetencyGate(
  workerQualifications: ReadonlyArray<WorkerQualificationInput>,
  requiredQualTypes: ReadonlyArray<string>,
  today: Date = new Date()
): CompetencyGateResult {
  const todayMs = today.getTime();
  const soonCutoffMs = todayMs + EXPIRING_SOON_DAYS * DAY_MS;

  // Index the worker's active quals (latest-expiring per type wins, so a
  // renewed qual supersedes an older expired copy of the same type).
  const activeByType = new Map<string, Date | null>();
  for (const q of workerQualifications) {
    if (q.status !== undefined && q.status !== "active") continue;
    if (!activeByType.has(q.qualType)) {
      activeByType.set(q.qualType, q.expiryDate);
      continue;
    }
    const prev = activeByType.get(q.qualType) ?? null;
    // `null` (never expires) beats any concrete date.
    if (prev === null || q.expiryDate === null) {
      activeByType.set(q.qualType, null);
      continue;
    }
    if (q.expiryDate.getTime() > prev.getTime()) {
      activeByType.set(q.qualType, q.expiryDate);
    }
  }

  const missing: string[] = [];
  const expired: string[] = [];
  const expiringSoon: string[] = [];
  const seen = new Set<string>();

  for (const code of requiredQualTypes) {
    if (seen.has(code)) continue;
    seen.add(code);

    if (!activeByType.has(code)) {
      missing.push(code);
      continue;
    }
    const exp = activeByType.get(code) ?? null;
    if (exp === null) continue; // never expires
    const expMs = exp.getTime();
    if (expMs < todayMs) {
      expired.push(code);
    } else if (expMs <= soonCutoffMs) {
      expiringSoon.push(code);
    }
  }

  return {
    allowed: missing.length === 0 && expired.length === 0,
    missing,
    expired,
    expiringSoon
  };
}
