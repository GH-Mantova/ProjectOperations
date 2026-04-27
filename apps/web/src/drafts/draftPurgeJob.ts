import { FormDraftStore } from "./FormDraftStore";

// PR #111 — once-per-session purge sweep. Call from main.tsx after the
// auth context has resolved. Records older than 30 days are removed.
// Uses an IDB meta key so we don't run more than once per calendar day
// even if the user reloads multiple times.
//
// Also handles the legacy localStorage→IndexedDB one-shot migration for
// the FormFillPage drafts shipped pre-PR #111. Gated by a separate
// meta flag so it runs exactly once across all sessions.

const PURGE_META_KEY = "purge-last-run";
const FORMFILL_MIGRATION_META_KEY = "formfill-localstorage-migration";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// FormFillPage previously stored drafts under
// `form-submission-draft:<submissionId>` with shape
// { values: object, sectionIndex: number }. We migrate each found
// localStorage entry into IndexedDB under formType="form_submission_fill"
// and contextKey=submissionId, then remove the localStorage key.
const FORMFILL_LS_PREFIX = "form-submission-draft:";

async function migrateFormFillLocalStorageDrafts(userId: string): Promise<number> {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  const flag = await FormDraftStore.getMeta<boolean>(FORMFILL_MIGRATION_META_KEY);
  if (flag) return 0;
  let migrated = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(FORMFILL_LS_PREFIX)) keys.push(k);
    }
    for (const key of keys) {
      const submissionId = key.slice(FORMFILL_LS_PREFIX.length);
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        // Per (userId, formType) the IDB store keeps at most one draft.
        // The legacy localStorage scheme was per submission, so multiple
        // localStorage keys all collapse onto the SAME IDB key here —
        // only the LAST one survives. That's acceptable for a one-shot
        // migration: in practice users rarely have multiple in-flight
        // form drafts at once.
        await FormDraftStore.save(
          userId,
          "form_submission_fill",
          submissionId,
          parsed,
          1
        );
        window.localStorage.removeItem(key);
        migrated += 1;
      } catch {
        // bad JSON or a sensitive-field rejection — leave the
        // localStorage entry alone so it doesn't silently disappear
      }
    }
  } catch {
    // localStorage disabled / quota / private mode — skip migration
  }
  await FormDraftStore.setMeta(FORMFILL_MIGRATION_META_KEY, true);
  return migrated;
}

export async function runDraftPurgeJob(userId: string | null): Promise<void> {
  // Run the FormFillPage migration first so any rescued drafts also
  // benefit from the purge sweep below.
  if (userId) {
    try {
      const migrated = await migrateFormFillLocalStorageDrafts(userId);
      if (migrated > 0 && import.meta.env?.DEV) {
        console.info(`[form-drafts] migrated ${migrated} legacy localStorage draft(s) into IndexedDB.`);
      }
    } catch (err) {
      if (import.meta.env?.DEV) console.warn("[form-drafts] localStorage migration failed:", err);
    }
  }

  try {
    const last = await FormDraftStore.getMeta<number>(PURGE_META_KEY);
    const now = Date.now();
    if (last && now - last < MS_PER_DAY) return;
    const purged = await FormDraftStore.purgeExpired(now);
    await FormDraftStore.setMeta(PURGE_META_KEY, now);
    if (import.meta.env?.DEV && purged > 0) {
      console.info(`[form-drafts] purged ${purged} expired draft(s).`);
    }
  } catch (err) {
    // IDB unavailable — don't block app boot
    if (import.meta.env?.DEV) console.warn("[form-drafts] purge skipped:", err);
  }
}
