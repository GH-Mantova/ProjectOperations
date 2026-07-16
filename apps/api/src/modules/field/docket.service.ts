import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateDocketAttachmentDto,
  CreateDocketDto,
  DocketListQueryDto
} from "./dto/docket.dto";

const SEQ_ID = 1;

@Injectable()
export class DocketService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sequential docket number ──────────────────────────────────────────────
  private async nextDocketNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.docketNumberSequence.upsert({
        where: { id: SEQ_ID },
        create: { id: SEQ_ID, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `DKT-${String(row.lastNumber).padStart(6, "0")}`;
    });
  }

  // ─── Create docket ─────────────────────────────────────────────────────────
  async createDocket(dto: CreateDocketDto) {
    // Validate worker exists
    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { id: true }
    });
    if (!worker) throw new NotFoundException("Worker not found");

    // Validate optional job
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
        select: { id: true }
      });
      if (!job) throw new BadRequestException("Job not found");
    }

    // Validate optional asset
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: dto.assetId },
        select: { id: true }
      });
      if (!asset) throw new BadRequestException("Asset not found");
    }

    const docketNumber = await this.nextDocketNumber();

    return this.prisma.docket.create({
      data: {
        docketNumber,
        type: dto.type,
        jobId: dto.jobId ?? null,
        assetId: dto.assetId ?? null,
        workerId: dto.workerId,
        materialWasteType: dto.materialWasteType ?? null,
        quantity: dto.quantity !== undefined ? dto.quantity : null,
        unit: dto.unit ?? null,
        fromLocation: dto.fromLocation ?? null,
        toLocation: dto.toLocation ?? null,
        signedByName: dto.signedByName ?? null,
        gpsLat: dto.gpsLat !== undefined ? dto.gpsLat : null,
        gpsLng: dto.gpsLng !== undefined ? dto.gpsLng : null,
        status: "CAPTURED",
        capturedAt: new Date(dto.capturedAt)
      },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
        job: { select: { id: true, jobNumber: true, name: true } },
        asset: { select: { id: true, assetCode: true, name: true } },
        attachments: true
      }
    });
  }

  // ─── List dockets ──────────────────────────────────────────────────────────
  async listDockets(query: DocketListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.jobId) where["jobId"] = query.jobId;
    if (query.assetId) where["assetId"] = query.assetId;
    if (query.workerId) where["workerId"] = query.workerId;
    if (query.type) where["type"] = query.type;
    if (query.status) where["status"] = query.status;

    if (query.from || query.to) {
      const capturedAt: Record<string, Date> = {};
      if (query.from) capturedAt["gte"] = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setUTCHours(23, 59, 59, 999);
        capturedAt["lte"] = toDate;
      }
      where["capturedAt"] = capturedAt;
    }

    const [total, items] = await Promise.all([
      this.prisma.docket.count({ where }),
      this.prisma.docket.findMany({
        where,
        orderBy: { capturedAt: "desc" },
        skip,
        take: limit,
        include: {
          worker: { select: { id: true, firstName: true, lastName: true } },
          job: { select: { id: true, jobNumber: true, name: true } },
          asset: { select: { id: true, assetCode: true, name: true } },
          attachments: { select: { id: true, kind: true, storageUrl: true, capturedAt: true } }
        }
      })
    ]);

    return { items, total, page, limit };
  }

  // ─── Get single docket ─────────────────────────────────────────────────────
  async getDocket(id: string) {
    const docket = await this.prisma.docket.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
        job: { select: { id: true, jobNumber: true, name: true } },
        asset: { select: { id: true, assetCode: true, name: true } },
        attachments: true
      }
    });
    if (!docket) throw new NotFoundException("Docket not found");
    return docket;
  }

  // ─── Add attachment ────────────────────────────────────────────────────────
  async addAttachment(docketId: string, dto: CreateDocketAttachmentDto) {
    // Verify docket exists
    const docket = await this.prisma.docket.findUnique({
      where: { id: docketId },
      select: { id: true }
    });
    if (!docket) throw new NotFoundException("Docket not found");

    return this.prisma.docketAttachment.create({
      data: {
        docketId,
        kind: dto.kind,
        storageUrl: dto.storageUrl,
        mimeType: dto.mimeType ?? null,
        capturedAt: new Date(dto.capturedAt)
      }
    });
  }

  // ─── CSV export ────────────────────────────────────────────────────────────
  async exportCsv(query: DocketListQueryDto): Promise<string> {
    // Fetch all matching (no pagination for export, cap at 5000)
    const where: Record<string, unknown> = {};
    if (query.jobId) where["jobId"] = query.jobId;
    if (query.assetId) where["assetId"] = query.assetId;
    if (query.workerId) where["workerId"] = query.workerId;
    if (query.type) where["type"] = query.type;
    if (query.status) where["status"] = query.status;

    if (query.from || query.to) {
      const capturedAt: Record<string, Date> = {};
      if (query.from) capturedAt["gte"] = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setUTCHours(23, 59, 59, 999);
        capturedAt["lte"] = toDate;
      }
      where["capturedAt"] = capturedAt;
    }

    const rows = await this.prisma.docket.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      take: 5000,
      include: {
        worker: { select: { firstName: true, lastName: true } },
        job: { select: { jobNumber: true, name: true } },
        asset: { select: { assetCode: true, name: true } }
      }
    });

    const header = [
      "docket_number",
      "type",
      "status",
      "captured_at",
      "worker",
      "job_number",
      "job_name",
      "asset_code",
      "asset_name",
      "material_waste_type",
      "quantity",
      "unit",
      "from_location",
      "to_location",
      "signed_by_name"
    ].join(",");

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const str = String(v);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = rows.map((r) =>
      [
        r.docketNumber,
        r.type,
        r.status,
        r.capturedAt.toISOString(),
        `${r.worker.firstName} ${r.worker.lastName}`,
        r.job?.jobNumber ?? "",
        r.job?.name ?? "",
        r.asset?.assetCode ?? "",
        r.asset?.name ?? "",
        r.materialWasteType ?? "",
        r.quantity?.toString() ?? "",
        r.unit ?? "",
        r.fromLocation ?? "",
        r.toLocation ?? "",
        r.signedByName ?? ""
      ]
        .map(escape)
        .join(",")
    );

    return [header, ...lines].join("\r\n");
  }
}
