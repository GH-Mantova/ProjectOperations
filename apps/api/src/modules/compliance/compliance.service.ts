import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { EmailService } from "../email/email.service";

const DAY_MS = 24 * 60 * 60 * 1000;

const QUAL_TYPES = [
  "white_card",
  "asbestos_a",
  "asbestos_b",
  "forklift",
  "ewp",
  "rigger",
  "scaffolder",
  "first_aid",
  "warden",
  "dogman",
  "crane",
  "electrical",
  "plumbing",
  "other"
] as const;

const CRITICAL_LICENCE_TYPES = ["asbestos_a", "asbestos_b", "qbcc", "demolition", "waste_transport"];
const CRITICAL_INSURANCE_TYPES = ["public_liability", "workers_compensation"];

export type ComplianceStatus = "not_set" | "active" | "expiring_30" | "expiring_7" | "expired";

type AlertType = "expiring_30" | "expiring_7" | "expired";

export type ExpiryRow = {
  id: string;
  itemType: "licence" | "insurance" | "qualification";
  type: string;
  number: string | null;
  expiryDate: Date | null;
  status: ComplianceStatus;
  daysUntilExpiry: number | null;
  entityType: "client" | "subcontractor" | "worker";
  entityId: string;
  entityName: string;
};

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ─── Status computation ─────────────────────────────────────────────────
  computeStatus(expiryDate: Date | null): ComplianceStatus {
    if (!expiryDate) return "not_set";
    const now = Date.now();
    const exp = new Date(expiryDate).getTime();
    if (exp < now) return "expired";
    if (exp - now <= 7 * DAY_MS) return "expiring_7";
    if (exp - now <= 30 * DAY_MS) return "expiring_30";
    return "active";
  }

  daysUntilExpiry(expiryDate: Date | null): number | null {
    if (!expiryDate) return null;
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / DAY_MS);
  }

  // ─── Expiring items aggregator ──────────────────────────────────────────
  async getExpiringItems(daysAhead = 30) {
    const cutoff = new Date(Date.now() + daysAhead * DAY_MS);

    const [licences, insurances, qualifications] = await Promise.all([
      this.prisma.entityLicence.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } }
        },
        orderBy: { expiryDate: "asc" }
      }),
      this.prisma.entityInsurance.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } }
        },
        orderBy: { expiryDate: "asc" }
      }),
      this.prisma.workerQualification.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: { workerProfile: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { expiryDate: "asc" }
      })
    ]);

    const mapLicence = (row: (typeof licences)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "licence",
      type: row.licenceType,
      number: row.licenceNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: row.client ? "client" : "subcontractor",
      entityId: (row.client?.id ?? row.subcontractor?.id) ?? "",
      entityName: (row.client?.name ?? row.subcontractor?.name) ?? "—"
    });
    const mapInsurance = (row: (typeof insurances)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "insurance",
      type: row.insuranceType,
      number: row.policyNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: row.client ? "client" : "subcontractor",
      entityId: (row.client?.id ?? row.subcontractor?.id) ?? "",
      entityName: (row.client?.name ?? row.subcontractor?.name) ?? "—"
    });
    const mapQualification = (row: (typeof qualifications)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "qualification",
      type: row.qualType,
      number: row.licenceNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: "worker",
      entityId: row.workerProfile.id,
      entityName: `${row.workerProfile.firstName} ${row.workerProfile.lastName}`
    });

    return {
      licences: licences.map(mapLicence),
      insurances: insurances.map(mapInsurance),
      qualifications: qualifications.map(mapQualification)
    };
  }

  // ─── Daily alert cron ───────────────────────────────────────────────────
  // 7am AEST = 21:00 UTC the previous day. nestjs/schedule treats the spec
  // as UTC unless a timeZone is provided.
  @Cron("0 21 * * *", { name: "compliance-expiry-alerts", timeZone: "UTC" })
  async runDailyComplianceTasks() {
    try {
      const sent = await this.checkAndSendExpiryAlerts();
      this.logger.log(`Compliance: ${sent} new expiry alerts sent.`);
      const blocked = await this.autoBlockExpiredSubcontractors();
      this.logger.log(`Compliance: ${blocked.blocked} blocked, ${blocked.unblocked} unblocked.`);
    } catch (err) {
      this.logger.error(`Compliance daily task failed: ${(err as Error).message}`);
    }
  }

  async checkAndSendExpiryAlerts(): Promise<number> {
    const data = await this.getExpiringItems(30);
    const allRows: ExpiryRow[] = [...data.licences, ...data.insurances, ...data.qualifications];

    const recipients = await this.findComplianceAdmins();
    if (recipients.length === 0) return 0;

    const tiers: Array<{ alertType: AlertType; predicate: (r: ExpiryRow) => boolean }> = [
      { alertType: "expired", predicate: (r) => r.status === "expired" },
      { alertType: "expiring_7", predicate: (r) => r.status === "expiring_7" },
      { alertType: "expiring_30", predicate: (r) => r.status === "expiring_30" }
    ];

    let sent = 0;
    for (const tier of tiers) {
      const tierRows = allRows.filter(tier.predicate);
      if (tierRows.length === 0) continue;

      // Look up what alerts have already been sent for this tier so we don't
      // spam users every day.
      const existing = await this.prisma.complianceAlert.findMany({
        where: { alertType: tier.alertType, itemId: { in: tierRows.map((r) => r.id) } },
        select: { itemId: true }
      });
      const alreadySent = new Set(existing.map((a) => a.itemId));
      const newRows = tierRows.filter((r) => !alreadySent.has(r.id));
      if (newRows.length === 0) continue;

      const subject =
        tier.alertType === "expired"
          ? `[URGENT] ${newRows.length} compliance items expired — IS Operations`
          : tier.alertType === "expiring_7"
            ? `[URGENT] ${newRows.length} compliance items expiring within 7 days — IS Operations`
            : `${newRows.length} compliance items expiring within 30 days — IS Operations`;

      const html = this.renderAlertEmail(newRows, tier.alertType);
      const text = newRows
        .map(
          (r) =>
            `${r.entityName} — ${r.itemType} ${r.type} — ${r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : "no expiry"} (${r.daysUntilExpiry ?? "—"} days)`
        )
        .join("\n");

      void this.email.sendNotificationEmail({
        trigger: "compliance.expiry_reminder",
        subject,
        html,
        text
      });

      for (const user of recipients) {
        for (const row of newRows) {
          const title =
            tier.alertType === "expired"
              ? `Expired: ${row.itemType} on ${row.entityName}`
              : `Expiring soon: ${row.itemType} on ${row.entityName}`;
          await this.notifications.create({
            userId: user.id,
            title,
            body: `${row.type.replace(/_/g, " ")}${
              row.expiryDate ? ` expires ${new Date(row.expiryDate).toLocaleDateString("en-AU")}` : ""
            }.`,
            severity: tier.alertType === "expiring_30" ? "LOW" : "HIGH",
            linkUrl: "/compliance"
          });
        }
      }

      // Persist dedup records — one per (item, tier, recipient).
      await this.prisma.complianceAlert.createMany({
        data: newRows.flatMap((row) =>
          recipients.map((user) => ({
            entityType: row.entityType,
            entityId: row.entityId,
            itemType: row.itemType,
            itemId: row.id,
            alertType: tier.alertType,
            sentToUserId: user.id
          }))
        ),
        skipDuplicates: true
      });

      sent += newRows.length;
    }

    return sent;
  }

  async autoBlockExpiredSubcontractors(): Promise<{ blocked: number; unblocked: number }> {
    const now = new Date();
    const subs = await this.prisma.subcontractorSupplier.findMany({
      where: { prequalStatus: "approved" },
      include: {
        licences: true,
        insurances: true
      }
    });

    let blockedCount = 0;
    let unblockedCount = 0;

    for (const sub of subs) {
      const expiredCriticalLicence = sub.licences.find(
        (l) => CRITICAL_LICENCE_TYPES.includes(l.licenceType) && l.expiryDate && l.expiryDate < now
      );
      const expiredCriticalInsurance = sub.insurances.find(
        (i) => CRITICAL_INSURANCE_TYPES.includes(i.insuranceType) && i.expiryDate && i.expiryDate < now
      );
      const shouldBlock = Boolean(expiredCriticalLicence || expiredCriticalInsurance);

      if (shouldBlock && !sub.complianceBlocked) {
        const reason = expiredCriticalLicence
          ? `Critical licence expired: ${expiredCriticalLicence.licenceType}`
          : `Critical insurance expired: ${expiredCriticalInsurance?.insuranceType}`;
        await this.prisma.subcontractorSupplier.update({
          where: { id: sub.id },
          data: {
            complianceBlocked: true,
            complianceBlockReason: reason,
            complianceBlockedAt: now
          }
        });
        blockedCount += 1;
        await this.notifyAdmins(
          `${sub.name} automatically blocked`,
          reason,
          "HIGH"
        );
      } else if (!shouldBlock && sub.complianceBlocked && sub.complianceBlockReason?.startsWith("Critical")) {
        // Auto-block was set by us; renewals brought everything back under
        // control, so we can lift the block.
        await this.prisma.subcontractorSupplier.update({
          where: { id: sub.id },
          data: {
            complianceBlocked: false,
            complianceBlockReason: null,
            complianceBlockedAt: null
          }
        });
        unblockedCount += 1;
        await this.notifyAdmins(`${sub.name} compliance block lifted`, `All critical items now active.`, "LOW");
      }
    }

    return { blocked: blockedCount, unblocked: unblockedCount };
  }

  async listBlockedSubcontractors() {
    return this.prisma.subcontractorSupplier.findMany({
      where: { complianceBlocked: true },
      orderBy: { complianceBlockedAt: "desc" }
    });
  }

  async manualBlock(id: string, blocked: boolean, reason: string | null) {
    const exists = await this.prisma.subcontractorSupplier.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException("Subcontractor not found.");
    return this.prisma.subcontractorSupplier.update({
      where: { id },
      data: {
        complianceBlocked: blocked,
        complianceBlockReason: blocked ? reason ?? "Manual block" : null,
        complianceBlockedAt: blocked ? new Date() : null
      }
    });
  }

  // ─── Worker qualifications CRUD ─────────────────────────────────────────
  async listQualifications(workerProfileId: string) {
    await this.requireWorker(workerProfileId);
    const rows = await this.prisma.workerQualification.findMany({
      where: { workerProfileId },
      orderBy: [{ expiryDate: "asc" }, { qualType: "asc" }]
    });
    return rows.map((r) => ({ ...r, status: this.computeStatus(r.expiryDate) }));
  }

  async createQualification(
    workerProfileId: string,
    input: {
      qualType?: string;
      licenceNumber?: string | null;
      issuingAuthority?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
      notes?: string | null;
    },
    actorId?: string
  ) {
    await this.requireWorker(workerProfileId);
    if (!input.qualType || !QUAL_TYPES.includes(input.qualType as never)) {
      throw new BadRequestException(`qualType must be one of: ${QUAL_TYPES.join(", ")}`);
    }
    return this.prisma.workerQualification.create({
      data: {
        workerProfileId,
        qualType: input.qualType,
        licenceNumber: input.licenceNumber ?? null,
        issuingAuthority: input.issuingAuthority ?? null,
        issueDate: this.parseDate(input.issueDate),
        expiryDate: this.parseDate(input.expiryDate),
        notes: input.notes ?? null,
        createdById: actorId ?? null
      }
    });
  }

  async updateQualification(
    workerProfileId: string,
    qualId: string,
    input: {
      qualType?: string;
      licenceNumber?: string | null;
      issuingAuthority?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
      notes?: string | null;
    }
  ) {
    const existing = await this.prisma.workerQualification.findFirst({
      where: { id: qualId, workerProfileId }
    });
    if (!existing) throw new NotFoundException("Qualification not found.");
    if (input.qualType && !QUAL_TYPES.includes(input.qualType as never)) {
      throw new BadRequestException(`qualType must be one of: ${QUAL_TYPES.join(", ")}`);
    }
    const data: Record<string, unknown> = {};
    if (input.qualType !== undefined) data.qualType = input.qualType;
    if (input.licenceNumber !== undefined) data.licenceNumber = input.licenceNumber;
    if (input.issuingAuthority !== undefined) data.issuingAuthority = input.issuingAuthority;
    if (input.issueDate !== undefined) data.issueDate = this.parseDate(input.issueDate);
    if (input.expiryDate !== undefined) data.expiryDate = this.parseDate(input.expiryDate);
    if (input.notes !== undefined) data.notes = input.notes;
    return this.prisma.workerQualification.update({ where: { id: qualId }, data });
  }

  async deleteQualification(workerProfileId: string, qualId: string) {
    const existing = await this.prisma.workerQualification.findFirst({
      where: { id: qualId, workerProfileId }
    });
    if (!existing) throw new NotFoundException("Qualification not found.");
    await this.prisma.workerQualification.delete({ where: { id: qualId } });
    return { id: qualId };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private async findComplianceAdmins() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              rolePermissions: { some: { permission: { code: "compliance.admin" } } }
            }
          }
        }
      },
      select: { id: true, email: true }
    });
  }

  private async notifyAdmins(title: string, body: string, severity: "LOW" | "HIGH") {
    const recipients = await this.findComplianceAdmins();
    for (const user of recipients) {
      await this.notifications.create({
        userId: user.id,
        title,
        body,
        severity,
        linkUrl: "/compliance"
      });
    }
  }

  private renderAlertEmail(rows: ExpiryRow[], tier: AlertType): string {
    const headerColour = tier === "expired" ? "#dc2626" : tier === "expiring_7" ? "#f97316" : "#eab308";
    const tierLabel = tier === "expired" ? "Expired" : tier === "expiring_7" ? "Expiring within 7 days" : "Expiring within 30 days";
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.entityName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.itemType}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.type.replace(/_/g, " ")}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.expiryDate ? new Date(r.expiryDate).toLocaleDateString("en-AU") : "—"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.daysUntilExpiry ?? "—"} days</td>
        </tr>`
      )
      .join("");
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1117">
      <h2 style="color:${headerColour};margin:0 0 12px">${tierLabel}: ${rows.length} item${rows.length === 1 ? "" : "s"}</h2>
      <p>Review at <a href="/compliance">the compliance dashboard</a>.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px">
        <thead><tr style="background:#f6f6f6">
          <th style="padding:6px 10px;text-align:left">Entity</th>
          <th style="padding:6px 10px;text-align:left">Type</th>
          <th style="padding:6px 10px;text-align:left">Item</th>
          <th style="padding:6px 10px;text-align:left">Expiry</th>
          <th style="padding:6px 10px;text-align:left">Days</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  }

  private async requireWorker(id: string) {
    const w = await this.prisma.workerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!w) throw new NotFoundException("Worker profile not found.");
    return w;
  }

  private parseDate(v: string | null | undefined): Date | null {
    if (v === undefined || v === null || v === "") return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid date format.");
    return d;
  }
}
