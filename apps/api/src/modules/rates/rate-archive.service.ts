import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

/**
 * S2 vendor delete safeguard for the rate hub (rate-hub-sor-integration-plan.md).
 *
 * Mirrors ContractArchiveService (PR #1042). The rate hub treats
 * SubcontractorSupplier rows as "vendors": everyday manage-rights users
 * soft-archive; only super-users can permanently delete, and only when no
 * live Commitment still references the vendor.
 *
 * Live-reference guard: a Commitment in DRAFT or APPROVED status still
 * points at this vendor and would lose that link (Commitment.supplierId is
 * onDelete: SetNull — a delete would silently orphan the historical
 * record). Archive instead so history remains intact.
 */
@Injectable()
export class RateArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Soft-archive a vendor — stamps `archivedAt = now` and records the actor.
   * Idempotent: archiving an already-archived vendor refreshes the timestamp.
   *
   * @param id      - SubcontractorSupplier id
   * @param actorId - user id performing the archive
   * @throws NotFoundException when the vendor does not exist
   */
  async archive(id: string, actorId: string) {
    await this.requireVendor(id);
    const now = new Date();
    const updated = await this.prisma.subcontractorSupplier.update({
      where: { id },
      data: { archivedAt: now, archivedById: actorId }
    });
    await this.audit.write({
      actorId,
      action: "subcontractors.archive",
      entityType: "SubcontractorSupplier",
      entityId: id,
      metadata: { archivedAt: now.toISOString() }
    });
    return updated;
  }

  /**
   * Unarchive a vendor — clears `archivedAt` and `archivedById`. Idempotent
   * on an already-active vendor.
   */
  async unarchive(id: string, actorId: string) {
    await this.requireVendor(id);
    const updated = await this.prisma.subcontractorSupplier.update({
      where: { id },
      data: { archivedAt: null, archivedById: null }
    });
    await this.audit.write({
      actorId,
      action: "subcontractors.unarchive",
      entityType: "SubcontractorSupplier",
      entityId: id,
      metadata: {}
    });
    return updated;
  }

  /**
   * Hard-delete a vendor and its rate rows. Irreversible.
   *
   * Guardrails:
   *   1. Super-user only (accepts a plain boolean for testability; the
   *      controller enforces via SuperUserGuard).
   *   2. Blocked when any live Commitment (DRAFT or APPROVED) still points
   *      at this vendor — historical rows would silently orphan otherwise
   *      because Commitment.supplierId is onDelete: SetNull. Archive instead.
   *
   * SubcontractorRate rows cascade via `onDelete: Cascade` on their FK.
   */
  async hardDelete(id: string, actorId: string, isSuperUser: boolean) {
    if (!isSuperUser) {
      throw new ForbiddenException("Super-user required for vendor hard-delete.");
    }
    await this.requireVendor(id);

    const liveCommitments = await this.prisma.commitment.count({
      where: {
        supplierId: id,
        status: { in: ["DRAFT", "APPROVED"] }
      }
    });
    if (liveCommitments > 0) {
      throw new ConflictException(
        `Vendor has ${liveCommitments} active references and cannot be permanently deleted. Archive it instead.`
      );
    }

    await this.prisma.subcontractorSupplier.delete({ where: { id } });
    await this.audit.write({
      actorId,
      action: "subcontractors.hardDelete",
      entityType: "SubcontractorSupplier",
      entityId: id,
      metadata: { permanent: true }
    });
  }

  private async requireVendor(id: string) {
    const vendor = await this.prisma.subcontractorSupplier.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!vendor) {
      throw new NotFoundException("Vendor not found.");
    }
    return vendor;
  }
}
