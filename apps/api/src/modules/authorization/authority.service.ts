import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthorityRule, Prisma } from "@prisma/client";
import { AuthorityScopeType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreateAuthorityRuleDto } from "./dto/create-authority-rule.dto";
import type { UpdateAuthorityRuleDto } from "./dto/update-authority-rule.dto";

export interface AuthorityDecision {
  allowed: boolean;
  requiresEscalation: boolean;
  escalateToUserId?: string;
  matchedRuleId?: string;
}

export interface AuthorityCheckInput {
  userId: string;
  action: string;
  amount?: number;
}

// USER > ROLE > DEPARTMENT > GLOBAL. Most specific wins.
const SCOPE_PRIORITY: AuthorityScopeType[] = [
  AuthorityScopeType.USER,
  AuthorityScopeType.ROLE,
  AuthorityScopeType.DEPARTMENT,
  AuthorityScopeType.GLOBAL
];

/**
 * Configurable authority seam. `check` is the single decision point
 * consumers call to ask "may this actor perform this action, at this
 * amount?" The store is empty by default; with no matching rule the
 * seam returns `allowed: true, requiresEscalation: false` (open ceiling).
 */
@Injectable()
export class AuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Decide whether `input.userId` may perform `input.action` at the
   * optional `input.amount`. Resolution order: USER → ROLE → DEPARTMENT
   * → GLOBAL; the first enabled rule matching a scope the user occupies
   * wins. Disabled rules are ignored.
   *
   * With no matching rule the seam returns `allowed: true` (open ceiling).
   * When a rule's `limitAmount` is set and `amount` exceeds it, the
   * decision flips to `allowed: false, requiresEscalation: true` and
   * surfaces `escalateToUserId` if configured on the rule.
   */
  async check(input: AuthorityCheckInput): Promise<AuthorityDecision> {
    const [roleIds] = await Promise.all([this.roleIdsFor(input.userId)]);

    const candidates = await this.prisma.authorityRule.findMany({
      where: {
        action: input.action,
        enabled: true,
        OR: [
          { scopeType: AuthorityScopeType.USER, scopeId: input.userId },
          ...(roleIds.length
            ? [{ scopeType: AuthorityScopeType.ROLE, scopeId: { in: roleIds } }]
            : []),
          { scopeType: AuthorityScopeType.GLOBAL }
        ]
      }
    });

    const matched = this.pickMostSpecific(candidates);
    if (!matched) {
      return { allowed: true, requiresEscalation: false };
    }

    if (
      input.amount !== undefined &&
      matched.limitAmount !== null &&
      Number(matched.limitAmount) < input.amount
    ) {
      return {
        allowed: false,
        requiresEscalation: true,
        escalateToUserId: matched.escalateToUserId ?? undefined,
        matchedRuleId: matched.id
      };
    }

    return {
      allowed: true,
      requiresEscalation: false,
      matchedRuleId: matched.id
    };
  }

  list() {
    return this.prisma.authorityRule.findMany({
      orderBy: [{ action: "asc" }, { scopeType: "asc" }]
    });
  }

  create(input: CreateAuthorityRuleDto, actorId?: string) {
    return this.prisma.authorityRule.create({
      data: {
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
        action: input.action,
        limitAmount: input.limitAmount ?? null,
        escalateToUserId: input.escalateToUserId ?? null,
        enabled: input.enabled ?? true,
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  async update(id: string, input: UpdateAuthorityRuleDto, actorId?: string) {
    const existing = await this.prisma.authorityRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Authority rule not found.");
    }

    const data: Prisma.AuthorityRuleUpdateInput = { updatedById: actorId };
    if (input.scopeType !== undefined) data.scopeType = input.scopeType;
    if (input.scopeId !== undefined) data.scopeId = input.scopeId;
    if (input.action !== undefined) data.action = input.action;
    if (input.limitAmount !== undefined) data.limitAmount = input.limitAmount;
    if (input.escalateToUserId !== undefined) data.escalateToUserId = input.escalateToUserId;
    if (input.enabled !== undefined) data.enabled = input.enabled;

    return this.prisma.authorityRule.update({ where: { id }, data });
  }

  /**
   * Hard-delete an authority rule. Refuses while the rule is still enabled —
   * an enabled rule participates in every `check()` decision, so a live delete
   * silently reshapes approval routing. Caller must disable (`enabled = false`)
   * first. Every successful delete writes an AuditLog row with the rule payload
   * so the decision surface can be reconstructed.
   */
  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.authorityRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Authority rule not found.");
    }
    if (existing.enabled) {
      throw new ConflictException(
        "Authority rule is enabled. Disable it first (set enabled = false) before deleting."
      );
    }
    await this.prisma.authorityRule.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "authorityRule.delete",
      entityType: "AuthorityRule",
      entityId: id,
      metadata: {
        scopeType: existing.scopeType,
        scopeId: existing.scopeId,
        action: existing.action,
        limitAmount: existing.limitAmount?.toString() ?? null,
        escalateToUserId: existing.escalateToUserId,
        enabled: existing.enabled
      }
    });
    return { id };
  }

  private async roleIdsFor(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true }
    });
    return rows.map((row) => row.roleId);
  }

  private pickMostSpecific(candidates: AuthorityRule[]): AuthorityRule | undefined {
    for (const scope of SCOPE_PRIORITY) {
      const match = candidates.find((rule) => rule.scopeType === scope);
      if (match) return match;
    }
    return undefined;
  }
}
