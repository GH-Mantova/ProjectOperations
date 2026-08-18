/**
 * SharePoint configuration constants.
 *
 * Environment variables consumed by this module:
 *
 *   SHAREPOINT_LEGACY_TENDERS_ROOT
 *     Path (relative to the SharePoint drive root) of the legacy tenders tree.
 *     Real 2026 tenders live at "2. Quotes/Quotes 2026/{month}/T####" — i.e.
 *     one level deeper than the destination root due to the extra month folder.
 *     Default: "2. Quotes/Quotes 2026" (the production shape as of 2026-08).
 *     Set this var when the legacy library root differs from the default.
 *     Set to an empty string → startup error (misconfiguration is caught early).
 */

/**
 * Path of the legacy tenders tree, relative to the SharePoint drive root.
 *
 * The legacy tree uses a two-level structure:
 *   {legacyTendersRoot}/{month}/{T-number folder}
 * whereas the ERP destination uses a flat single-level:
 *   {tendersRoot}/{folder name}
 *
 * Validated at module-load time: if the env var is present but empty, the
 * application throws a clear startup error naming the variable.
 */
export const legacyTendersRoot: string = (() => {
  const raw = process.env.SHAREPOINT_LEGACY_TENDERS_ROOT;
  if (raw !== undefined && raw.trim() === "") {
    throw new Error(
      "Configuration error: SHAREPOINT_LEGACY_TENDERS_ROOT is set but empty. " +
        'Either remove the env var (to use the default "2. Quotes/Quotes 2026") ' +
        "or set it to a valid non-empty folder path."
    );
  }
  return raw ?? "2. Quotes/Quotes 2026";
})();
