import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// CFX-5 — File-based Xero contact import (dry-run preview → confirm).
//
// Custom fields NEVER round-trip from an imported file (plan §2 decision 3 —
// Xero rejects unknown columns on import and custom fields are ERP-only).
//
// Bank fields (bankName, bankAccountName, bankBsb, bankAccountNumber):
// - If a matched record already has ANY bank field set → diff carries
//   wouldOverwriteBank:true and commit SKIPS those fields UNLESS the record id
//   is in confirmedOverwriteBankRecordIds.
// - New rows may set bank fields freely.
//
// Preview is in-memory (up to 20, 5-minute TTL). Commit is transactional.

// ── BUILTIN field key set ─────────────────────────────────────────────────────

/**
 * The complete set of BUILTIN field keys that may appear in columnMap.
 * customFields is intentionally absent — never written from import.
 */
export const BUILTIN_FIELD_KEYS = new Set([
  "xeroContactId",
  "name",
  "email",
  "phone",
  "website",
  "abn",
  "code",
  "country",
  "physicalAddress",
  "physicalSuburb",
  "physicalState",
  "physicalPostcode",
  "postalAddress",
  "postalSuburb",
  "postalState",
  "postalPostcode",
  "bankName",
  "bankAccountName",
  "bankBsb",
  "bankAccountNumber",
  "salesAccountCode",
  "purchaseAccountCode",
  "discount"
]);

/**
 * Scalar fields on the Client model that may be written from an import.
 * xeroContactId is excluded (matching only). FK ids and relations are excluded.
 */
export const CLIENT_WRITABLE_KEYS: ReadonlySet<string> = new Set([
  "name",
  "email",
  "phone",
  "website",
  "abn",
  "code",
  "country",
  "physicalAddress",
  "physicalSuburb",
  "physicalState",
  "physicalPostcode",
  "postalAddress",
  "postalSuburb",
  "postalState",
  "postalPostcode",
  "bankName",
  "bankAccountName",
  "bankBsb",
  "bankAccountNumber",
  "salesAccountCode",
  "purchaseAccountCode",
  "discount"
]);

/**
 * Scalar fields on the SubcontractorSupplier model that may be written from an import.
 * xeroContactId is excluded (matching only). `code` is absent — SubcontractorSupplier
 * has no `code` column. FK ids and relations are excluded.
 */
export const SUBCONTRACTOR_WRITABLE_KEYS: ReadonlySet<string> = new Set([
  "name",
  "email",
  "phone",
  "website",
  "abn",
  "country",
  "physicalAddress",
  "physicalSuburb",
  "physicalState",
  "physicalPostcode",
  "postalAddress",
  "postalSuburb",
  "postalState",
  "postalPostcode",
  "bankName",
  "bankAccountName",
  "bankBsb",
  "bankAccountNumber",
  "salesAccountCode",
  "purchaseAccountCode",
  "discount"
]);

/**
 * Filter `data` to only the keys present in `allowed`.
 *
 * Returns the picked subset and a list of keys that were dropped so callers
 * can surface the information without throwing.
 */
export function pickWritableKeys(
  data: Record<string, unknown>,
  allowed: ReadonlySet<string>
): { picked: Record<string, unknown>; dropped: string[] } {
  const picked: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) {
      picked[key] = value;
    } else {
      dropped.push(key);
    }
  }
  return { picked, dropped };
}

/** Bank-related field keys — subject to overwrite-protection logic. */
const BANK_FIELD_KEYS = new Set([
  "bankName",
  "bankAccountName",
  "bankBsb",
  "bankAccountNumber"
]);

/** Required BUILTIN fields that must be mapped for a preview to proceed. */
const REQUIRED_BUILTIN_KEYS = ["name"];

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * AU ABN checksum validation.
 *
 * Algorithm: subtract 1 from the first digit, then multiply each digit by its
 * weight [10,1,3,5,7,9,11,13,15,17,19], sum the results; valid if divisible
 * by 89.
 *
 * Returns null when valid; returns a human-readable reason when invalid.
 */
export function validateAbn(raw: string): string | null {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) {
    return `ABN must be 11 digits (got '${raw}')`;
  }
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digitNums = digits.split("").map(Number);
  digitNums[0] = (digitNums[0] ?? 0) - 1;
  const sum = digitNums.reduce(
    (acc, digit, idx) => acc + digit * (weights[idx] ?? 0),
    0
  );
  if (sum % 89 !== 0) {
    return `ABN failed checksum (got '${raw}')`;
  }
  return null;
}

/**
 * AU BSB validation: must be exactly 6 digits (hyphens are stripped).
 *
 * Returns null when valid; returns a human-readable reason when invalid.
 */
export function validateBsb(raw: string): string | null {
  const stripped = raw.replace(/-/g, "");
  if (!/^\d{6}$/.test(stripped)) {
    return `BSB must be 6 digits (got '${raw}')`;
  }
  return null;
}

// ── RFC 4180 CSV parser ───────────────────────────────────────────────────────

/**
 * Minimal RFC 4180 CSV parser.
 *
 * Accepts LF, CRLF, and CR line endings. Quoted fields may contain commas,
 * quotes (doubled), and newlines. Returns an array of string arrays; each
 * inner array represents one row. Empty trailing line is suppressed.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let pos = 0;

  // Normalise all line endings to LF so the loop only sees one newline char.
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Snapshot length before the loop so CodeQL sees a fixed (non-user-controlled)
  // loop bound. The caller is responsible for enforcing a size limit before calling
  // this function (see MAX_FILE_BYTES check in previewImport).
  const srcLen = src.length;

  while (pos < srcLen) {
    const ch = src[pos];

    if (inQuotes) {
      if (ch === '"') {
        if (src[pos + 1] === '"') {
          // Escaped quote — emit one quote and skip both chars.
          field += '"';
          pos += 2;
          continue;
        }
        // Closing quote.
        inQuotes = false;
        pos++;
        continue;
      }
      field += ch;
      pos++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      pos++;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      pos++;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      pos++;
      continue;
    }

    field += ch;
    pos++;
  }

  // Flush trailing content (file without trailing newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing empty row (artefact of files that end with a newline).
  const last = rows[rows.length - 1];
  if (last && last.every((c) => c === "")) {
    rows.pop();
  }

  return rows;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImportAppliesTo = "CLIENT" | "VENDOR";

export type DiffEntry = {
  field: string;
  from: unknown;
  to: unknown;
  wouldOverwriteBank?: boolean;
};

export type ImportRow = {
  rowIndex: number;
  action: "matched-by-xero-id" | "matched-by-name" | "new" | "rejected";
  matchedRecordId?: string;
  diffs?: DiffEntry[];
  reason?: string;
};

export type ImportPreview = {
  previewId: string;
  appliesTo: ImportAppliesTo;
  rows: ImportRow[];
  fileSha256: string;
  createdAt: Date;
};

// Internal richer representation stored in the preview cache.
type CachedPreview = ImportPreview & {
  /**
   * Per matched/new row: the data payload ready for upsert,
   * EXCLUDING any bank fields that were suppressed due to existing bank data
   * (those are in bankFieldsSuppressed and their values can be read from
   * the corresponding ImportRow diffs where wouldOverwriteBank=true).
   */
  _writePayloads: Array<{
    rowIndex: number;
    action: ImportRow["action"];
    matchedRecordId?: string;
    data: Record<string, unknown>;
    /** Field keys whose values were suppressed due to existing bank data. */
    bankFieldsSuppressed: string[];
  }>;
  expiresAt: number;
};

// ── Preview cache ─────────────────────────────────────────────────────────────

const PREVIEW_CACHE_MAX = 20;
const PREVIEW_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum CSV file size accepted by previewImport (5 MiB). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Simple bounded map. Insertion order is used as eviction order.
const previewCache = new Map<string, CachedPreview>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (entry.expiresAt <= now) {
      previewCache.delete(key);
    }
  }
}

function storePreview(preview: CachedPreview): void {
  evictExpired();
  if (previewCache.size >= PREVIEW_CACHE_MAX) {
    // Evict the oldest entry (first inserted).
    const oldest = previewCache.keys().next().value as string | undefined;
    if (oldest !== undefined) {
      previewCache.delete(oldest);
    }
  }
  previewCache.set(preview.previewId, preview);
}

function retrievePreview(previewId: string): CachedPreview | undefined {
  evictExpired();
  const entry = previewCache.get(previewId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    previewCache.delete(previewId);
    return undefined;
  }
  return entry;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the given existing record has ANY bank field set (non-null, non-empty).
 */
function recordHasBankFields(record: Record<string, unknown>): boolean {
  for (const key of BANK_FIELD_KEYS) {
    const val = record[key];
    if (val !== null && val !== undefined && String(val).trim() !== "") {
      return true;
    }
  }
  return false;
}

/**
 * Validate per-cell values for a data row.
 *
 * Returns a human-readable rejection reason, or null if the row is valid.
 */
function validateRowCells(cells: Record<string, string>): string | null {
  // name is required.
  if ((cells["name"] ?? "").trim() === "") {
    return "required column 'name' is empty";
  }

  // ABN — validate checksum if present and non-empty.
  const abn = (cells["abn"] ?? "").trim();
  if (abn !== "") {
    const abnError = validateAbn(abn);
    if (abnError) return abnError;
  }

  // BSB — validate format if present and non-empty.
  const bsb = (cells["bankBsb"] ?? "").trim();
  if (bsb !== "") {
    const bsbError = validateBsb(bsb);
    if (bsbError) return bsbError;
  }

  return null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class XeroContactImportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dry-run: parse the uploaded CSV, map columns, match rows to existing
   * records, compute diffs and surface bank-overwrite warnings.
   *
   * No writes are performed.
   */
  async previewImport(input: {
    fileBytes: Buffer;
    appliesTo: ImportAppliesTo;
    columnMap: Record<string, string>;
    actorUserId: string;
  }): Promise<ImportPreview> {
    const { fileBytes, appliesTo, columnMap } = input;

    // Validate that required BUILTIN keys are present in the column map.
    for (const required of REQUIRED_BUILTIN_KEYS) {
      if (!(required in columnMap)) {
        throw new BadRequestException(
          `required column '${required}' not mapped — please map this column before previewing`
        );
      }
    }

    // Validate that all mapped keys are known BUILTIN keys.
    for (const key of Object.keys(columnMap)) {
      if (!BUILTIN_FIELD_KEYS.has(key)) {
        throw new BadRequestException(
          `unknown field key '${key}' in columnMap — only BUILTIN keys may be mapped`
        );
      }
    }

    // Enforce file size limit before any parsing.
    if (fileBytes.length > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Uploaded file exceeds the maximum allowed size of ${MAX_FILE_BYTES / 1024 / 1024} MiB`
      );
    }

    // Compute file SHA-256 hash.
    const fileSha256 = createHash("sha256").update(fileBytes).digest("hex");

    // Parse CSV.
    const text = fileBytes.toString("utf-8");
    const allRows = parseCsv(text);
    if (allRows.length === 0) {
      throw new BadRequestException("Uploaded file is empty or contains no parseable rows");
    }

    const headerRow = allRows[0];
    if (!headerRow || headerRow.length === 0) {
      throw new BadRequestException("File has no header row");
    }

    // Build header → column-index map (case-insensitive).
    const headerIndex = new Map<string, number>();
    for (let idx = 0; idx < headerRow.length; idx++) {
      headerIndex.set((headerRow[idx] ?? "").trim().toLowerCase(), idx);
    }

    // For each BUILTIN key in columnMap, resolve the column index in the file.
    // columnMap is: { builtinKey → userHeaderName }
    const keyToColIdx = new Map<string, number>();
    for (const [builtinKey, userHeader] of Object.entries(columnMap)) {
      const colIdx = headerIndex.get(userHeader.trim().toLowerCase());
      if (colIdx === undefined) {
        throw new BadRequestException(
          `mapped header '${userHeader}' for field '${builtinKey}' not found in the uploaded file`
        );
      }
      keyToColIdx.set(builtinKey, colIdx);
    }

    const dataRows = allRows.slice(1);

    // Load all existing records for matching.
    const existingByXeroId = new Map<string, Record<string, unknown>>();
    const existingByNameLower = new Map<string, Record<string, unknown>>();

    if (appliesTo === "CLIENT") {
      const clients = await this.prisma.client.findMany({ where: { isActive: true } });
      for (const client of clients) {
        const rec = client as Record<string, unknown>;
        const xeroId = rec["xeroContactId"];
        if (xeroId) existingByXeroId.set(String(xeroId).trim(), rec);
        const name = rec["name"];
        if (name) existingByNameLower.set(String(name).toLowerCase().trim(), rec);
      }
    } else {
      const vendors = await this.prisma.subcontractorSupplier.findMany({
        where: { isActive: true }
      });
      for (const vendor of vendors) {
        const rec = vendor as Record<string, unknown>;
        const xeroId = rec["xeroContactId"];
        if (xeroId) existingByXeroId.set(String(xeroId).trim(), rec);
        const name = rec["name"];
        if (name) existingByNameLower.set(String(name).toLowerCase().trim(), rec);
      }
    }

    // Process each data row.
    const previewRows: ImportRow[] = [];
    const writePayloads: CachedPreview["_writePayloads"] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const rawRow = dataRows[rowIndex];
      if (!rawRow) continue;

      // Extract cell values by the mapped column indices.
      const cellValues: Record<string, string> = {};
      for (const [builtinKey, colIdx] of keyToColIdx) {
        cellValues[builtinKey] = (rawRow[colIdx] ?? "").trim();
      }

      // Reject rows that fail validation.
      const rejectionReason = validateRowCells(cellValues);
      if (rejectionReason) {
        previewRows.push({ rowIndex, action: "rejected", reason: rejectionReason });
        continue;
      }

      // Determine action: matched-by-xero-id > matched-by-name > new.
      let action: ImportRow["action"] = "new";
      let matchedRecord: Record<string, unknown> | undefined;

      const rowXeroId = (cellValues["xeroContactId"] ?? "").trim();
      const rowName = (cellValues["name"] ?? "").trim();

      if (rowXeroId && existingByXeroId.has(rowXeroId)) {
        action = "matched-by-xero-id";
        matchedRecord = existingByXeroId.get(rowXeroId);
      } else if (rowName && existingByNameLower.has(rowName.toLowerCase())) {
        action = "matched-by-name";
        matchedRecord = existingByNameLower.get(rowName.toLowerCase());
      }

      const matchedRecordId =
        matchedRecord !== undefined ? String(matchedRecord["id"] ?? "") : undefined;

      // Determine whether this existing record has bank data that must be protected.
      const hasBankProtection =
        matchedRecord !== undefined && recordHasBankFields(matchedRecord);

      // Compute diffs and build the write payload.
      const diffs: DiffEntry[] = [];
      const dataPayload: Record<string, unknown> = {};
      const bankFieldsSuppressed: string[] = [];

      for (const builtinKey of keyToColIdx.keys()) {
        // xeroContactId is used for matching only — never written as a data field.
        if (builtinKey === "xeroContactId") continue;

        const incomingValue = (cellValues[builtinKey] ?? "").trim();
        const isBank = BANK_FIELD_KEYS.has(builtinKey);

        if (matchedRecord !== undefined) {
          // Matched row: only write fields that actually differ.
          // Empty incoming value = "no change proposed" for matched rows.
          if (incomingValue === "") continue;

          const currentValue = matchedRecord[builtinKey] ?? null;
          const currentNorm =
            currentValue === null || currentValue === undefined ? "" : String(currentValue);

          if (incomingValue !== currentNorm) {
            const diff: DiffEntry = { field: builtinKey, from: currentValue, to: incomingValue };
            if (isBank && hasBankProtection) {
              diff.wouldOverwriteBank = true;
            }
            diffs.push(diff);
          }

          // Bank fields are excluded from the payload when the record has bank data
          // and the caller has not yet confirmed the overwrite for this record.
          // (The commit path re-adds them when confirmedOverwriteBankRecordIds includes
          // this record's id.)
          if (isBank && hasBankProtection) {
            if (incomingValue !== (matchedRecord[builtinKey] !== null && matchedRecord[builtinKey] !== undefined ? String(matchedRecord[builtinKey]) : "")) {
              bankFieldsSuppressed.push(builtinKey);
            }
            continue;
          }

          if (incomingValue !== currentNorm) {
            dataPayload[builtinKey] = incomingValue === "" ? null : incomingValue;
          }
        } else {
          // New row: include all non-empty fields.
          if (incomingValue !== "") {
            dataPayload[builtinKey] = incomingValue;
          }
        }
      }

      // Ensure name is in payload for new rows.
      if (!matchedRecord && rowName) {
        dataPayload["name"] = rowName;
      }

      previewRows.push({
        rowIndex,
        action,
        matchedRecordId,
        diffs: diffs.length > 0 ? diffs : undefined
      });

      writePayloads.push({
        rowIndex,
        action,
        matchedRecordId,
        data: dataPayload,
        bankFieldsSuppressed
      });
    }

    // Cache and return the preview.
    const previewId = randomUUID();
    const createdAt = new Date();
    const cachedPreview: CachedPreview = {
      previewId,
      appliesTo,
      rows: previewRows,
      fileSha256,
      createdAt,
      _writePayloads: writePayloads,
      expiresAt: Date.now() + PREVIEW_TTL_MS
    };

    storePreview(cachedPreview);

    return { previewId, appliesTo, rows: previewRows, fileSha256, createdAt };
  }

  /**
   * Commit a previously-previewed import.
   *
   * Throws NotFoundException if the previewId has expired or is unknown.
   * Wraps all upserts in a single Prisma transaction — rolls back entirely on
   * any error; no partial writes.
   */
  async commitImport(input: {
    previewId: string;
    actorUserId: string;
    confirmedOverwriteBankRecordIds?: string[];
  }): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    droppedFields: Record<string, number>;
  }> {
    const { previewId, actorUserId, confirmedOverwriteBankRecordIds = [] } = input;
    const confirmedSet = new Set(confirmedOverwriteBankRecordIds);

    const cached = retrievePreview(previewId);
    if (!cached) {
      throw new NotFoundException(
        `Preview '${previewId}' not found or has expired — re-run the preview before committing`
      );
    }

    const { appliesTo, _writePayloads: payloads } = cached;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const droppedFields: Record<string, number> = {};

    const allowedKeys =
      appliesTo === "CLIENT" ? CLIENT_WRITABLE_KEYS : SUBCONTRACTOR_WRITABLE_KEYS;

    await this.prisma.$transaction(async (tx) => {
      for (const payload of payloads) {
        if (payload.action === "rejected") {
          skipped++;
          continue;
        }

        // Start with the base payload (bank fields excluded for protected records).
        const finalData: Record<string, unknown> = { ...payload.data };

        // Re-include bank fields for confirmed record ids.
        if (
          payload.matchedRecordId &&
          confirmedSet.has(payload.matchedRecordId) &&
          payload.bankFieldsSuppressed.length > 0
        ) {
          // Find the values from the diff entries (they were recorded with wouldOverwriteBank).
          const previewRow = cached.rows.find((row) => row.rowIndex === payload.rowIndex);
          if (previewRow?.diffs) {
            for (const diff of previewRow.diffs) {
              if (diff.wouldOverwriteBank) {
                finalData[diff.field] = diff.to;
              }
            }
          }
        }

        // Filter to only allow-listed keys before writing.
        const { picked: writeData, dropped } = pickWritableKeys(finalData, allowedKeys);
        for (const key of dropped) {
          droppedFields[key] = (droppedFields[key] ?? 0) + 1;
        }

        if (Object.keys(writeData).length === 0 && payload.action !== "new") {
          // Nothing to update for this matched row.
          skipped++;
          continue;
        }

        if (appliesTo === "CLIENT") {
          if (payload.action === "new") {
            await tx.client.create({
              data: writeData as Prisma.ClientUncheckedCreateInput
            });
            inserted++;
          } else if (payload.matchedRecordId) {
            await tx.client.update({
              where: { id: payload.matchedRecordId },
              data: writeData as Prisma.ClientUncheckedUpdateInput
            });
            updated++;
          }
        } else {
          if (payload.action === "new") {
            await tx.subcontractorSupplier.create({
              data: {
                ...writeData,
                createdById: actorUserId
              } as Prisma.SubcontractorSupplierUncheckedCreateInput
            });
            inserted++;
          } else if (payload.matchedRecordId) {
            await tx.subcontractorSupplier.update({
              where: { id: payload.matchedRecordId },
              data: writeData as Prisma.SubcontractorSupplierUncheckedUpdateInput
            });
            updated++;
          }
        }
      }
    });

    // Remove from cache after successful commit.
    previewCache.delete(previewId);

    return { inserted, updated, skipped, droppedFields };
  }
}
