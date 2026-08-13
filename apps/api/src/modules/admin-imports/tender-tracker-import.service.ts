/**
 * MIG-2 -- Tender-tracker import service.
 *
 * Parses an uploaded CSV or XLSX file (ExcelJS) and either performs a dry-run
 * analysis or idempotently commits the rows as Tender / Client / Site /
 * TenderClient / TenderClientNote records.
 *
 * Status/probability mapping refined 2026-08-13 with Marco against the real
 * tracker columns:
 *   - T-number comes from the dedicated "Tender No." column (fallback: name).
 *   - Title is built once as "T#### - <Project Name>" (no doubled number).
 *   - Tender number = the clean T-number.
 *   - Probability="Won"  -> CONTRACT_ISSUED   (we won  => contract)
 *   - Probability="Lost" -> LOST
 *   - Client Project Status="Won"/"In Progress" -> AWARDED (client awarded)
 *   - Client Project Status="Lost" -> LOST
 *   - Decision="Not quoting" -> WITHDRAWN
 *   - Decision="Submitted"   -> SUBMITTED
 *   - Decision="Quoting" or "Started quoting" populated -> IN_PROGRESS
 *   - otherwise -> DRAFT
 *   - Probability rating words (Hot/Warm/Cold/Chasing/Tendering/Not Started)
 *     map to the numeric Tender.probability (%).
 *   - Estimator "Russel/Russell Cummings" -> Sean Lattin (not an ERP user).
 */

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../prisma/prisma.service";
import { TenderNumberService } from "../tendering/tender-number.service";

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
  probabilityNum: number | null;
  decision: string | null;
  clientProjectStatus: string | null;
  startedQuoting: boolean;
  followUpNotes: string | null;
  tNumber: string;
}

// Token-level spelling fixes (normalise: lowercase, collapse whitespace).
const ESTIMATOR_ALIASES: Record<string, string> = {
  "mantovaninni": "mantovanini",
};

// Whole-name reassignment to a DIFFERENT existing user (not a spelling fix).
// Russel Cummings is not an ERP user; his tenders are assigned to Sean Lattin.
const ESTIMATOR_REASSIGN: Record<string, string> = {
  "russel cummings": "sean lattin",
  "russell cummings": "sean lattin",
};

function normaliseEstimatorName(raw: string): string {
  let norm = raw.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [alias, canonical] of Object.entries(ESTIMATOR_ALIASES)) {
    norm = norm.replace(new RegExp(alias, "g"), canonical);
  }
  if (ESTIMATOR_REASSIGN[norm]) {
    norm = ESTIMATOR_REASSIGN[norm];
  }
  return norm;
}

interface StatusResult {
  status: string;
  wonAt: Date | null;
  lostAt: Date | null;
}

function mapStatus(
  probability: string | null,
  decision: string | null,
  clientProjectStatus: string | null,
  startedQuoting: boolean,
  submittedAt: Date | null
): StatusResult {
  const prob = (probability ?? "").trim().toLowerCase();
  const dec = (decision ?? "").trim().toLowerCase();
  const cps = (clientProjectStatus ?? "").trim().toLowerCase();
  const stamp = submittedAt ?? new Date();

  if (prob === "won") return { status: "CONTRACT_ISSUED", wonAt: stamp, lostAt: null };
  if (prob === "lost") return { status: "LOST", wonAt: null, lostAt: stamp };
  if (cps === "won" || cps === "in progress") return { status: "AWARDED", wonAt: null, lostAt: null };
  if (cps === "lost") return { status: "LOST", wonAt: null, lostAt: stamp };
  if (dec === "not quoting") return { status: "WITHDRAWN", wonAt: null, lostAt: null };
  if (dec === "submitted") return { status: "SUBMITTED", wonAt: null, lostAt: null };
  if (dec === "quoting" || startedQuoting) return { status: "IN_PROGRESS", wonAt: null, lostAt: null };
  return { status: "DRAFT", wonAt: null, lostAt: null };
}

// Tracker "Probability" holds outcome words (Won/Lost) AND likelihood ratings.
// Only the ratings map to the numeric Tender.probability (%).
function probabilityRating(probability: string | null): number | null {
  switch ((probability ?? "").trim().toLowerCase()) {
    case "hot": return 80;
    case "warm": return 50;
    case "chasing": return 40;
    case "tendering": return 30;
    case "cold": return 20;
    case "not started": return 10;
    default: return null;
  }
}

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

const BAD_DECIMAL = Symbol("BAD_DECIMAL");

function parseDecimalOrSentinel(raw: unknown): number | typeof BAD_DECIMAL | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[,$]/g, ""));
  if (isNaN(num)) return BAD_DECIMAL;
  return num;
}

const HEADER_MAP: Record<string, string> = {
  "tender no.": "tenderNo",
  "tender no": "tenderNo",
  "tender number": "tenderNo",
  "project name": "projectName",
  "client company name": "clientCompanyName",
  "client project status": "clientProjectStatus",
  "started quoting": "startedQuoting",
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
      const ab = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(ab).set(buffer);
      await wb.xlsx.load(ab);
    } else {
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

  const headerRow = sheet.getRow(1);
  const headerIndex: Record<number, string> = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = (cell.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const mapped = HEADER_MAP[text];
    if (mapped) headerIndex[colNumber] = mapped;
  });

  const rows: RowMap[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: RowMap = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const field = headerIndex[colNumber];
      if (field) obj[field] = cell.value;
    });
    rows.push(obj);
  });

  return { rows };
}

function mapRow(
  raw: RowMap,
  rowIndex: number,
  badRows: Array<{ row: number; reason: string }>
): ParsedRow | null {
  const projectNameRaw = typeof raw["projectName"] === "string" ? raw["projectName"].trim() : "";
  const clientNameRaw = typeof raw["clientCompanyName"] === "string" ? raw["clientCompanyName"].trim() : "";

  if (!projectNameRaw) {
    badRows.push({ row: rowIndex, reason: "Missing or empty Project Name" });
    return null;
  }
  if (!clientNameRaw) {
    badRows.push({ row: rowIndex, reason: "Missing or empty Client Company Name" });
    return null;
  }

  // Prefer the dedicated "Tender No." column; fall back to the Project Name.
  const tenderNoRaw = raw["tenderNo"] != null ? String(raw["tenderNo"]).trim() : "";
  const tNumber = /^T\d{3,5}$/i.test(tenderNoRaw)
    ? tenderNoRaw.toUpperCase()
    : extractTNumber(projectNameRaw);
  if (!tNumber) {
    badRows.push({ row: rowIndex, reason: `No T-number found in Tender No. or Project Name: "${projectNameRaw}"` });
    return null;
  }

  // Strip any leading "T#### - " already embedded so the title is built once.
  let projectName = projectNameRaw.replace(/^\s*T\d{3,5}\s*[—–-]\s*/i, "").trim();
  if (!projectName) projectName = projectNameRaw;

  const estimatorRaw = raw["estimator"] ? String(raw["estimator"]).trim() || null : null;

  const priceRaw = raw["tenderPrice"];
  const priceSentinel = priceRaw !== undefined && priceRaw !== null && priceRaw !== ""
    ? parseDecimalOrSentinel(priceRaw)
    : null;
  let tenderPrice: number | null = null;
  if (priceSentinel === BAD_DECIMAL) {
    badRows.push({ row: rowIndex, reason: `Unparseable Tender Price: "${priceRaw}" -- field set to null` });
    tenderPrice = null;
  } else {
    tenderPrice = priceSentinel as number | null;
  }

  const quoteDueDate = parseDateCell(raw["quoteDueDate"]);
  const dateSubmitted = parseDateCell(raw["dateSubmitted"]);

  let leadTime: number | null = null;
  if (raw["leadTime"] !== undefined && raw["leadTime"] !== null && raw["leadTime"] !== "") {
    const lt = parseInt(String(raw["leadTime"]), 10);
    leadTime = isNaN(lt) ? null : lt;
  }

  const probability = raw["probability"] ? String(raw["probability"]).trim() || null : null;
  const decision = raw["decision"] ? String(raw["decision"]).trim() || null : null;
  const clientProjectStatus = raw["clientProjectStatus"] ? String(raw["clientProjectStatus"]).trim() || null : null;
  const startedQuoting = raw["startedQuoting"] !== undefined
    && raw["startedQuoting"] !== null
    && String(raw["startedQuoting"]).trim() !== "";
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
    probabilityNum: probabilityRating(probability),
    decision,
    clientProjectStatus,
    startedQuoting,
    followUpNotes,
    tNumber,
  };
}

@Injectable()
export class TenderTrackerImportService {
  private readonly logger = new Logger(TenderTrackerImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenderNumbers: TenderNumberService
  ) {}

  async import(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    dryRun: boolean,
    actorId: string
  ): Promise<TenderTrackerImportReport> {
    const { rows: rawRows, error: parseError } = await parseWorkbook(buffer, mimeType, originalName);
    if (parseError) {
      throw new BadRequestException(parseError);
    }

    const badRows: Array<{ row: number; reason: string }> = [];
    const parsedRows: ParsedRow[] = [];

    rawRows.forEach((raw, idx) => {
      const row = mapRow(raw, idx + 2, badRows);
      if (row) parsedRows.push(row);
    });

    const clientNormSet = new Set<string>();
    for (const row of parsedRows) {
      clientNormSet.add(row.clientNameNorm);
    }

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

    return await this.commitRows(parsedRows, actorId, report);
  }

  private async findUnmatchedEstimators(rows: ParsedRow[]): Promise<string[]> {
    const rawNames = new Set<string>();
    for (const row of rows) {
      if (row.estimatorRaw) rawNames.add(row.estimatorRaw);
    }
    if (rawNames.size === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const userNormMap = new Map<string, string>();
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

  private async commitRows(
    rows: ParsedRow[],
    actorId: string,
    report: TenderTrackerImportReport
  ): Promise<TenderTrackerImportReport> {
    const estimatorCache = new Map<string, string | null>();
    const clientCache = new Map<string, string>();

    for (const row of rows) {
      try {
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
          clientId = upserted.id;
          clientCache.set(row.clientNameNorm, clientId);
          report.clientsCreated++;
        }

        let estimatorUserId: string | null = null;
        if (row.estimatorRaw) {
          if (estimatorCache.has(row.estimatorRaw)) {
            estimatorUserId = estimatorCache.get(row.estimatorRaw)!;
          } else {
            estimatorUserId = await this.resolveEstimatorId(row.estimatorRaw);
            estimatorCache.set(row.estimatorRaw, estimatorUserId);
          }
        }

        const { status, wonAt, lostAt } = mapStatus(
          row.probability,
          row.decision,
          row.clientProjectStatus,
          row.startedQuoting,
          row.dateSubmitted
        );

        const title = `${row.tNumber} — ${row.projectName}`;

        const existingTender = await this.prisma.tender.findFirst({
          where: { title: { startsWith: `${row.tNumber} ` } },
          select: { id: true, tenderNumber: true, siteId: true },
        });

        let tenderId: string;
        let siteId: string;

        if (existingTender) {
          if (existingTender.siteId) {
            siteId = existingTender.siteId;
            await this.prisma.site.update({
              where: { id: siteId },
              data: { name: title },
            });
          } else {
            const site = await this.prisma.site.create({
              data: { name: title, clientId, notes: "IMPORTED — address to be completed" },
              select: { id: true },
            });
            siteId = site.id;
          }

          // Assign a canonical ERP number only if the existing one is not
          // already canonical (idempotent: re-runs keep a good number).
          let numberPatch: {
            tenderNumber?: string;
            clientSlugSnapshot?: string;
            revisionNumber?: number;
          } = {};
          if (!TenderNumberService.TENDER_NUMBER_REGEX.test(existingTender.tenderNumber ?? "")) {
            const gen = await this.tenderNumbers.generate(
              row.clientNameRaw,
              row.dateSubmitted ?? row.quoteDueDate ?? new Date()
            );
            numberPatch = {
              tenderNumber: gen.tenderNumber,
              clientSlugSnapshot: gen.clientSlugSnapshot,
              revisionNumber: gen.revisionNumber,
            };
          }
          await this.prisma.tender.update({
            where: { id: existingTender.id },
            data: {
              ...numberPatch,
              title,
              status,
              probability: row.probabilityNum ?? undefined,
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
          const site = await this.prisma.site.create({
            data: { name: title, clientId, notes: "IMPORTED — address to be completed" },
            select: { id: true },
          });
          siteId = site.id;

          const gen = await this.tenderNumbers.generate(
            row.clientNameRaw,
            row.dateSubmitted ?? row.quoteDueDate ?? new Date()
          );
          const newTender = await this.prisma.tender.create({
            data: {
              tenderNumber: gen.tenderNumber,
              clientSlugSnapshot: gen.clientSlugSnapshot,
              revisionNumber: gen.revisionNumber,
              title,
              status,
              probability: row.probabilityNum ?? undefined,
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

        await this.prisma.tenderClient.upsert({
          where: { tenderId_clientId: { tenderId, clientId } },
          create: { tenderId, clientId },
          update: {},
        });

        if (row.followUpNotes) {
          const body = row.followUpNotes.trim();
          const occurredAt = row.dateSubmitted ?? new Date();
          const existing = await this.prisma.tenderClientNote.findFirst({
            where: { tenderId, clientId, body, occurredAt },
            select: { id: true },
          });
          if (!existing) {
            await this.prisma.tenderClientNote.create({
              data: { tenderId, clientId, noteType: "note", body, occurredAt, createdById: actorId },
            });
            report.notesCreated++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Row ${row.rowIndex} failed: ${msg}`);
        report.badRows.push({ row: row.rowIndex, reason: `Commit error: ${msg}` });
      }
    }

    return report;
  }
}
