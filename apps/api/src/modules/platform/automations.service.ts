import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AutomationEngineService } from "./automation-engine.service";
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto
} from "./dto/automation.dto";

/**
 * CRUD + test-fire surface for automation rules. The evaluation loop itself
 * lives in `AutomationEngineService`; this service is the admin-facing shell.
 */
@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly engine: AutomationEngineService
  ) {}

  list() {
    return this.prisma.automationRule.findMany({
      orderBy: [{ enabled: "desc" }, { createdAt: "desc" }]
    });
  }

  async get(id: string) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Automation rule ${id} not found`);
    return rule;
  }

  async recentRuns(ruleId: string, limit = 20) {
    await this.get(ruleId);
    return this.prisma.automationRuleRun.findMany({
      where: { ruleId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit))
    });
  }

  async create(dto: CreateAutomationRuleDto, actorId?: string) {
    const rule = await this.prisma.automationRule.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        triggerEntity: dto.trigger.entity,
        triggerEvent: dto.trigger.event,
        conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
        createdById: actorId ?? null,
        updatedById: actorId ?? null
      }
    });
    await this.auditService.write({
      actorId,
      action: "automation.rule.create",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: { name: rule.name, trigger: `${rule.triggerEntity}.${rule.triggerEvent}` }
    });
    return rule;
  }

  async update(id: string, dto: UpdateAutomationRuleDto, actorId?: string) {
    await this.get(id);
    const data: Prisma.AutomationRuleUpdateInput = { updatedById: actorId ?? null };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.trigger !== undefined) {
      data.triggerEntity = dto.trigger.entity;
      data.triggerEvent = dto.trigger.event;
    }
    if (dto.conditions !== undefined) {
      data.conditions = dto.conditions as unknown as Prisma.InputJsonValue;
    }
    if (dto.actions !== undefined) {
      data.actions = dto.actions as unknown as Prisma.InputJsonValue;
    }
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const rule = await this.prisma.automationRule.update({ where: { id }, data });
    await this.auditService.write({
      actorId,
      action: "automation.rule.update",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: { enabled: rule.enabled }
    });
    return rule;
  }

  async remove(id: string, actorId?: string) {
    const rule = await this.get(id);
    await this.prisma.automationRule.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "automation.rule.delete",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: { name: rule.name }
    });
    return { id };
  }

  /**
   * Fire a synthetic event through the engine using this rule's trigger.
   * Lets an admin sanity-check a rule without waiting for a real domain
   * event. Payload is caller-supplied; conditions are evaluated against it.
   */
  async testFire(id: string, payload: Record<string, unknown>, actorId?: string) {
    const rule = await this.get(id);
    await this.engine.dispatch({
      entity: rule.triggerEntity,
      event: rule.triggerEvent,
      entityId: null,
      payload: payload ?? {},
      actorId: actorId ?? null
    });
    // Return the newest run row so the admin sees the outcome.
    const [latest] = await this.prisma.automationRuleRun.findMany({
      where: { ruleId: rule.id },
      orderBy: { createdAt: "desc" },
      take: 1
    });
    return { rule, latestRun: latest ?? null };
  }
}
