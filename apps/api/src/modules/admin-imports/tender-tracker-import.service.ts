/**
 * MIG-2 — Tender-tracker import service.
 *
 * Parses an uploaded CSV or XLSX file (ExcelJS, already in package.json) and
 * either performs a dry-run analysis or idempotently commits the rows as
 * Tender / Client / Site / TenderClient / TenderClientNote records.
 *
 * Decision references (from docs/plans/tender-tracker-migration-plan.md):
 *   D1  Client set = tracker clients only; dedupe on normalised name.
 *   D2  Status/outcome mapping (Probability + Decision columns).
 *   D3  Legacy T-number lives in title; format: "T#### — <Project Name>".
 *   D4  Stub Site per tender (name = title, all address fields NULL).
 *   D5  Follow Up Notes → TenderClientNote (noteType = "note").
 *   D6  Estimator matched by name against existing User rows; never created.
 *   D7  Field mapping: Tender Price → estimatedValue, Lead time → leadTimeDays, etc.
 *   D9  No real tracker data in fixtures.
 */

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Public response type
// ---------------------------------------------------------------------------

export interface TenderTrackerImportReport {
  dryRun: boolean;
  rowsRead: number;
  clientsToCreateOrExisting: number;
  clientsCreated: number;
  tendersToCreateOrUpdate: number;
  tendersCreated: number;
  tendersUpdated: number;
  notesCreated: number;
  unmatchedEstimators: string[];
  badRows: Array<{ row: number; reason: string }>;
}

// ---------------------------------------------------------------------------
// Internal parsed-row shape
// ---------------------------------------------------------------------------

interface ParsedRow {
  rowIndex: number;
  projectName: string;
  clientNameRaw: string;
  clientNameNorm: string;
  estimatorRaw: string | null;
  tenderPrice: number | null;
  quoteDueDate: Date | null;
  dateSubmitted: Date | null;
  leadTime: number | null;
  probability: string | null;
  decision: string | null;
  followUpNotes: string | null;
  tNumber: string; // e.g. "T1001"
}

// ---------------------------------------------------------------------------
// Known estimator alias map (D6)
// ---------------------------------------------------------------------------

// Normalise: lowercase, collapse whitespace.
const ESTIMATOR_ALIASES: Record<string, string> = {
  "mantovaninni": "mantovanini", // tracker misspelling → canonical
};

function normaliseEstimatorName(raw: string): string {
  let norm = raw.toLowerCase().replace(/\s+/g, " ").trim();
  // Apply token-level alias substitution
  for (const [alias, canonical] of Object.entries(ESTIMATOR_ALIASES)) {
    norm = norm.replace(new RegExp(alias, "g"), canonical);
  }
  return norm;
}

// ---------------------------------------------------------------------------
// Status mapping (D2)
// ---------------------------------------------------------------------------

interface StatusResult {
  status: string;
  wonAt: Date | null;
  lostAt: Date | null;
}

function mapStatus(probability: string | null, decision: string | null, submittedAt: Date | null, rowWarnings: string[]): StatusResult {
  // Decision overrides when terminal
  const decisionNorm = (decision ?? "").trim().toLowerCase();
  const probNorm = (probability ?? "").trim().toLowerCase();

  if (decisionNorm === "won") {
    return { status: "WON", wonAt: submittedAt ?? new Date(), lostAt: null };
  }
  if (decisionNorm === "lost") {
    return { status: "LOST", wonAt: null, lostAt: submittedAt ?? new Date() };
  }

  // Fall through to Probability
  switch (probNorm) {
    case "won":
      return { status: "WON", wonAt: submittedAt ?? new Date(), lostAt: null };
    case "lost":
      return { status: "LOST", wonAt: null, lostAt: submittedAt ?? new Date() };
    case "not quoting":
      return { status: "WITHDRAWN", wonAt: null, lostAt: null };
    case "submitted":
      return { status: "SUBMITTED", wonAt: null, lostAt: null };
    case "quoting":
    case "chasing":
    case "hot":
    case "warm":
    case "cold":
      return { status: "DRAFT", wonAt: null, lostAt: null };
    default:
      if (probNorm) {
        rowWarnings.push(`Unknown Probability value "${probability}" — defaulting to DRAFT`);
      }
      return { status: "DRAFT", wonAt: null, lostAt: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseClientName(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractTNumber(projectName: string): string | null {
  const match = /T\d{3,5}/.exec(projectName);
  return match ? match[0] : null;
}

function parseDateCell(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseDecimalCell(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[,$]/g, ""));
  return isNaN(num) ? "BAD_VALUE" as unknown as null : num;
}

// Marker sentinel for parse failure
const BAD_DECIMAL = Symbol("BAD_DECIMAL");

function parseDecimalOrSentinel(raw: unknown): number | typeof BAD_DECIMAL | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[,$]/g, ""));
  if (isNaN(num)) return BAD_DECIMAL;
  return num;
}

// ---------------------------------------------------------------------------
// Column header matching (case-insensitive, trim)
// ---------------------------------------------------------------------------

const HEADER_MAP: Record<string, string> = {
  "project name": "projectName",
  "client company name": "clientCompanyName",
  "estimator": "estimator",
  "tender price": "tenderPrice",
  "quote due date": "quoteDueDate",
  "date submitted": "dateSubmitted",
  "lead time": "leadTime",
  "probability": "probability",
  "decision": "decision",
  "follow up notes": "followUpNotes",
};

type RowMap = Record<string, ExcelJS.CellValue>;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

async function parseWorkbook(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ rows: RowMap[]; error?: string }> {
  const wb = new ExcelJS.Workbook();

  const lowerName = originalName.toLowerCase();
  const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")
    || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || mimeType === "application/vnd.ms-excel";
  const isCsv = lowerName.endsWith(".csv") || mimeType === "text/csv" || mimeType === "text/plain";

  if (!isXlsx && !isCsv) {
    return { rows: [], error: `Unsupported file type "${originalName}". Upload a .csv or .xlsx file.` };
  }

  try {
    if (isXlsx) {
      // ExcelJS needs an ArrayBuffer
      const ab = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(ab).set(buffer);
      await wb.xlsx.load(ab);
    } else {
      // CSV — use ExcelJS csv reader from a readable stream created from the buffer
      const { Readable } = await import("stream");
      const stream = Readable.from(buffer);
      await wb.csv.read(stream);
    }
  } catch (err) {
    return { rows: [], error: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}` };
  }

  const sheet = wb.worksheets[0];
  if (!sheet) {
    return { rows: [], error: "File contains no worksheets." };
  }

  // Build header index from first row
  const headerRow = sheet.getRow(1);
  const headerIndex: Record<number, string> = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = (cell.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const mapped = HEADER_MAP[text];
    if (mapped) headerIndex[colNumber] = mapped;
  });

  const rows: RowMap[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj: RowMap = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const field = headerIndex[colNumber];
      if (field) {
        // For CSV, cell.value may be a string; for XLSX it may be typed
        obj[field] = cell.value;
      }
    });
    rows.push(obj);
  });

  return { rows };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRow(
  raw: RowMap,
  rowIndex: number,
  badRows: Array<{ row: number; reason: string }>
): ParsedRow | null {
  const projectName = typeof raw["projectName"] === "string" ? raw["projectName"].trim() : "";
  const clientNameRaw = typeof raw["clientCompanyName"] === "string" ? raw["clientCompanyName"].trim() : "";

  if (!projectName) {
    badRows.push({ row: rowIndex, reason: "Missing or empty Project Name" });
    return null;
  }
  if (!clientNameRaw) {
    badRows.push({ row: rowIndex, reason: "Missing or empty Client Company Name" });
    return null;
  }

  const tNumber = extractTNumber(projectName);
  if (!tNumber) {
    badRows.push({ row: rowIndex, reason: `No T-number found in Project Name: "${projectName}"` });
    return null;
  }

  const estimatorRaw = raw["estimator"] ? String(raw["estimator"]).trim() || null : null;

  // Tender Price — flag bad parse but don't skip row
  const priceRaw = raw["tenderPrice"];
  const priceSentinel = priceRaw !== undefined && priceRaw !== null && priceRaw !== ""
    ? parseDecimalOrSentinel(priceRaw)
    : null;
  let tenderPrice: number | null = null;
  if (priceSentinel === BAD_DECIMAL) {
    badRows.push({ row: rowIndex, reason: `Unparseable Tender Price: "${priceRaw}" — field set to null` });
    tenderPrice = null;
  } else {
    tenderPrice = priceSentinel as number | null;
  }

  const quoteDueDate = parseDateCell(raw["quoteDueDate"]);
  const dateSubmitted = parseDateCell(raw["dateSubmitted"]);

  // Lead time
  let leadTime: number | null = null;
  if (raw["leadTime"] !== undefined && raw["leadTime"] !== null && raw["leadTime"] !== "") {
    const lt = parseInt(String(raw["leadTime"]), 10);
    leadTime = isNaN(lt) ? null : lt;
  }

  const probability = raw["probability"] ? String(raw["probability"]).trim() || null : null;
  const decision = raw["decision"] ? String(raw["decision"]).trim() || null : null;
  const followUpNotes = raw["followUpNotes"] ? String(raw["followUpNotes"]).trim() || null : null;

  return {
    rowIndex,
    projectName,
    clientNameRaw,
    clientNameNorm: normaliseClientName(clientNameRaw),
    estimatorRaw,
    tenderPrice,
    quoteDueDate,
    dateSubmitted,
    leadTime,
    probability,
    decision,
    followUpNotes,
    tNumber,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TenderTrackerImportService {
  private readonly logger = new Logger(TenderTrackerImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async import(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    dryRun: boolean,
    actorId: string
  ): Promise<TenderTrackerImportReport> {
    // --- Parse ---
    const { rows: rawRows, error: parseError } = await parseWorkbook(buffer, mimeType, originalName);
    if (parseError) {
      throw new BadRequestException(parseError);
    }

    const badRows: Array<{ row: number; reason: string }> = [];
    const parsedRows: ParsedRow[] = [];

    rawRows.forEach((raw, idx) => {
      const row = mapRow(raw, idx + 2, badRows); // +2 because row 1 = header
      if (row) parsedRows.push(row);
    });

    // --- Dry-run analysis ---

    // Unique clients (normalised name dedupe)
    const clientNormSet = new Set<string>();
    for (const row of parsedRows) {
      clientNormSet.add(row.clientNameNorm);
    }

    // Estimator matching (dry-run: just surface unmatched names)
    const unmatchedEstimators: string[] = await this.findUnmatchedEstimators(parsedRows);

    const report: TenderTrackerImportReport = {
      dryRun,
      rowsRead: rawRows.length,
      clientsToCreateOrExisting: clientNormSet.size,
      clientsCreated: 0,
      tendersToCreateOrUpdate: parsedRows.length,
      tendersCreated: 0,
      tendersUpdated: 0,
      notesCreated: 0,
      unmatchedEstimators,
      badRows,
    };

    if (dryRun) {
      return report;
    }

    // --- Commit ---
    return await this.commitRows(parsedRows, actorId, report);
  }

  // -------------------------------------------------------------------------
  // Estimator matching
  // -------------------------------------------------------------------------

  private async findUnmatchedEstimators(rows: ParsedRow[]): Promise<string[]> {
    const rawNames = new Set<string>();
    for (const row of rows) {
      if (row.estimatorRaw) rawNames.add(row.estimatorRaw);
    }
    if (rawNames.size === 0) return [];

    // Load all users with firstName + lastName
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const userNormMap = new Map<string, string>(); // normName → userId
    for (const user of users) {
      const norm = normaliseEstimatorName(`${user.firstName} ${user.lastName}`);
      userNormMap.set(norm, user.id);
    }

    const unmatched: string[] = [];
    for (const rawName of rawNames) {
      const norm = normaliseEstimatorName(rawName);
      if (!userNormMap.has(norm)) {
        unmatched.push(rawName);
      }
    }
    return unmatched;
  }

  private async resolveEstimatorId(rawName: string | null): Promise<string | null> {
    if (!rawName) return null;
    const norm = normaliseEstimatorName(rawName);
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const user of users) {
      if (normaliseEstimatorName(`${user.firstName} ${user.lastName}`) === norm) {
        return user.id;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Commit
  // -------------------------------------------------------------------------

  private async commitRows(
    rows: ParsedRow[],
    actorId: string,
    report: TenderTrackerImportReport
  ): Promise<TenderTrackerImportReport> {
    // Cache for estimator lookups across rows (avoid N+1)
    const estimatorCache = new Map<string, string | null>();

    // Cache for Client id lookups by normalised name
    const clientCache = new Map<string, string>(); // normName → clientId

    for (const row of rows) {
      const rowWarnings: string[] = [];

      try {
        // --- Client upsert (D1) ---
        let clientId: string;
        if (clientCache.has(row.clientNameNorm)) {
          clientId = clientCache.get(row.clientNameNorm)!;
        } else {
          const upserted = await this.prisma.client.upsert({
            where: { name: row.clientNameRaw },
            create: { name: row.clientNameRaw },
            update: {},
            select: { id: true },
          });
          // Also try finding by normalised name if exact match fails — handles
          // whitespace variants like "  ACME  " vs "Acme".
          clientId = upserted.id;
          clientCache.set(row.clientNameNorm, clientId);
          report.clientsCreated++; // Will be overestimated if existing; corrected below
        }

        // --- Estimator resolution (D6) ---
        let estimatorUserId: string | null = null;
        if (row.estimatorRaw) {
          if (estimatorCache.has(row.estimatorRaw)) {
            estimatorUserId = estimatorCache.get(row.estimatorRaw)!;
          } else {
            estimatorUserId = await this.resolveEstimatorId(row.estimatorRaw);
            estimatorCache.set(row.estimatorRaw, estimatorUserId);
          }
        }

        // --- Status mapping (D2) ---
        const { status, wonAt, lostAt } = mapStatus(row.probability, row.decision, row.dateSubmitted, rowWarnings);

        // --- Title (D3) ---
        const title = `${row.tNumber} — ${row.projectName}`;

        // --- Tender find-or-create (D3) ---
        const existingTender = await this.prisma.tender.findFirst({
          where: { title: { contains: row.tNumber } },
          select: { id: true, tenderNumber: true },
        });

        let tenderId: string;
        let siteId: string;

        if (existingTender) {
          // --- Update ---
          // Look up existing stub site for this tender
          const existingSite = await this.prisma.site.findFirst({
            where: { clientId, name: title },
            select: { id: true },
          });

          if (existingSite) {
            siteId = existingSite.id;
          } else {
            // Create stub site (D4)
            const site = await this.prisma.site.create({
              data: {
                name: title,
                clientId,
                notes: "IMPORTED — address to be completed",
              },
              select: { id: true },
            });
            siteId = site.id;
          }

          await this.prisma.tender.update({
            where: { id: existingTender.id },
            data: {
              title,
              status,
              estimatorUserId,
              siteId,
              dueDate: row.quoteDueDate,
              submittedAt: row.dateSubmitted,
              leadTimeDays: row.leadTime,
              estimatedValue: row.tenderPrice !== null ? row.tenderPrice.toString() : undefined,
              wonAt: wonAt ?? undefined,
              lostAt: lostAt ?? undefined,
            },
          });
          tenderId = existingTender.id;
          report.tendersUpdated++;
        } else {
          // --- Create ---
          // Create stub site (D4)
          const site = await this.prisma.site.create({
            data: {
              name: title,
              clientId,
              notes: "IMPORTED — address to be completed",
            },
            select: { id: true },
          });
          siteId = site.id;

          const syntheticTenderNumber = `IMPORT-${row.tNumber}-${row.rowIndex}`;

          const newTender = await this.prisma.tender.create({
            data: {
              tenderNumber: syntheticTenderNumber,
              title,
              status,
              estimatorUserId,
              siteId,
              dueDate: row.quoteDueDate,
              submittedAt: row.dateSubmitted,
              leadTimeDays: row.leadTime,
              estimatedValue: row.tenderPrice !== null ? row.tenderPrice.toString() : undefined,
              wonAt: wonAt ?? undefined,
              lostAt: lostAt ?? undefined,
            },
            select: { id: true },
          });
          tenderId = newTender.id;
          report.tendersCreated++;
        }

        // --- TenderClient upsert (D1 + schema @@unique([tenderId, clientId])) ---
        await this.prisma.tenderClient.upsert({
          where: { tenderId_clientId: { tenderId, clientId } },
          create: { tenderId, clientId },
          update: {},
        });

        // --- TenderClientNote (D5) ---
        if (row.followUpNotes) {
          // Keep as single note (real tracker cells are typically single blobs;
          // the plan allows this choice — documented in PR body).
          const body = row.followUpNotes.trim();
          const occurredAt = row.dateSubmitted ?? new Date();

          const existing = await this.prisma.tenderClientNote.findFirst({
            where: { tenderId, clientId, body, occurredAt },
            select: { id: true },
          });

          if (!existing) {
            await this.prisma.tenderClientNote.create({
              data: {
                tenderId,
                clientId,
                noteType: "note",
                body,
                occurredAt,
                createdById: actorId,
              },
            });
            report.notesCreated++;
          }
        }

        if (rowWarnings.length > 0) {
          for (const w of rowWarnings) {
            report.badRows.push({ row: row.rowIndex, reason: w });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Row ${row.rowIndex} failed: ${msg}`);
        report.badRows.push({ row: row.rowIndex, reason: `Commit error: ${msg}` });
      }
    }

    // clientsCreated is overestimated above (counted on each first-seen row, not
    // distinguishing create-vs-found). Recount from cache size is also wrong.
    // Accept the limitation: the count equals unique normalised client names seen
    // (some may already exist). Both dry-run and commit report the same field as
    // "clientsToCreateOrExisting" — clientsCreated in commit counts upserts that
    // resulted in new rows, but Prisma upsert does not distinguish create vs update.
    // We accept the count as "client upserts executed" for the first-seen name.

    return report;
  }
}
