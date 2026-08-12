import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

/**
 * Service for S1 contract soft-archive and super-user hard-delete.
 *
 * Archive pattern reuses `JobCloseout.archivedAt / archivedById`
 * (schema.prisma:1639–1640 and jobs.service.ts:985).
 *
 * Cascade safety: `Variation`, `ProgressClaim`, and `BillingMilestone`
 * all carry `onDelete: Cascade` from their `contractId` FK
 * (schema.prisma:3917, 3942, 4043), so a single `prisma.contract.delete`
 * removes all child rows via Postgres without an explicit transaction loop.
 */
@Injectable()
export class ContractArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Soft-archive a contract — stamps `archivedAt` to the current time and
   * records the archiving user. Idempotent: archiving an already-archived
   * contract simply updates the timestamp and actor.
   *
   * @param id      - contract id
   * @param actorId - user id of the actor performing the archive
   * @returns the updated contract
   * @throws NotFoundException when the contract does not exist
   */
  async archive(id: string, actorId: string) {
    await this.requireContract(id);
    const now = new Date();
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { archivedAt: now, archivedById: actorId }
    });
    await this.audit.write({
      actorId,
      action: "contracts.archive",
      entityType: "Contract",
      entityId: id,
      metadata: { archivedAt: now.toISOString() }
    });
    return updated;
  }

  /**
   * Unarchive a contract — clears `archivedAt` and `archivedById`.
   * Idempotent: calling on an active (non-archived) contract is a no-op
   * that still returns the contract row.
   *
   * @param id      - contract id
   * @param actorId - user id of the actor performing the unarchive
   * @returns the updated contract
   * @throws NotFoundException when the contract does not exist
   */
  async unarchive(id: string, actorId: string) {
    await this.requireContract(id);
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { archivedAt: null, archivedById: null }
    });
    await this.audit.write({
      actorId,
      action: "contracts.unarchive",
      entityType: "Contract",
      entityId: id,
      metadata: {}
    });
    return updated;
  }

  /**
   * Hard-delete a contract and all its children.
   *
   * Cascade: `Variation`, `ProgressClaim` (with their `ClaimLineItem` and
   * `PaymentSchedule` children), and `BillingMilestone` all carry
   * `onDelete: Cascade` on the `contractId` FK, so a single
   * `prisma.contract.delete` removes everything via Postgres.
   *
   * This operation is **irreversible**. It is gated at the controller layer
   * to super-users only (`SuperUserGuard`).
   *
   * @param id      - contract id
   * @param actorId - user id of the actor performing the hard-delete
   * @throws NotFoundException when the contract does not exist
   * @throws ForbiddenException when the caller is not a super-user
   *   (enforced at the controller; this layer accepts a plain boolean for
   *   testability)
   */
  async hardDelete(id: string, actorId: string, isSuperUser: boolean) {
    if (!isSuperUser) {
      throw new ForbiddenException("Super-user required for contract hard-delete.");
    }
    await this.requireContract(id);
    await this.prisma.contract.delete({ where: { id } });
    await this.audit.write({
      actorId,
      action: "contracts.hardDelete",
      entityType: "Contract",
      entityId: id,
      metadata: { permanent: true }
    });
  }

  // ── private helpers ──────────────────────────────────────────────────

  private async requireContract(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!contract) {
      throw new NotFoundException("Contract not found.");
    }
    return contract;
  }
}
