import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// Whitelist of entities the stage-bar engine can operate on. Slice 1
// ships Tender only; extending to a new entity means adding it here and
// wiring the Prisma delegate lookup below — a deliberate speed-bump so a
// misspelled entityType in a config row can't silently traverse arbitrary
// tables. Every new entry MUST also enforce the record's own permission
// upstream at the controller.
const SUPPORTED_ENTITIES = ["Tender"] as const;
type SupportedEntity = (typeof SUPPORTED_ENTITIES)[number];

function isSupportedEntity(value: string): value is SupportedEntity {
  return (SUPPORTED_ENTITIES as readonly string[]).includes(value);
}

type StageHistoryEntry = {
  stageId: string;
  enteredAt: string;
  byUserId: string | null;
};

export type ProcessStageDto = {
  id: string;
  name: string;
  order: number;
  requiredFields: string[];
};

export type ProcessFlowDto = {
  id: string;
  entityType: string;
  name: string;
  active: boolean;
  stages: ProcessStageDto[];
};

export type ProcessInstanceDto = {
  id: string;
  flowId: string;
  entityType: string;
  entityId: string;
  currentStageId: string;
  currentStage: ProcessStageDto;
  history: StageHistoryEntry[];
};

@Injectable()
export class ProcessFlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveFlow(entityType: string): Promise<ProcessFlowDto | null> {
    const flow = await this.prisma.businessProcessFlow.findFirst({
      where: { entityType, active: true },
      include: { stages: { orderBy: { order: "asc" } } }
    });
    return flow ? toFlowDto(flow) : null;
  }

  async getInstance(entityType: string, entityId: string): Promise<{
    flow: ProcessFlowDto;
    instance: ProcessInstanceDto | null;
  }> {
    const flow = await this.getActiveFlow(entityType);
    if (!flow) {
      throw new NotFoundException(`No active process flow for entity "${entityType}"`);
    }

    const instance = await this.prisma.businessProcessInstance.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
      include: { currentStage: true }
    });

    return { flow, instance: instance ? toInstanceDto(instance) : null };
  }

  // Advance an entity's instance to the target stage. Enforces:
  //   - the entity row exists (soft FK is validated here, not in the DB)
  //   - the target stage belongs to the same flow
  //   - the CURRENT stage's requiredFields are all present + non-null on
  //     the target record. This is the D365 "you can't leave a stage
  //     without filling its required fields" rule.
  //
  // Auto-creates the instance if the entity has none yet — the first
  // stage is chosen automatically, so an existing record can be brought
  // onto the flow without a separate "start" call.
  async advance(
    entityType: string,
    entityId: string,
    targetStageId: string,
    actorId: string | null
  ): Promise<ProcessInstanceDto> {
    if (!isSupportedEntity(entityType)) {
      throw new BadRequestException(`Unsupported entity type "${entityType}"`);
    }

    const flow = await this.prisma.businessProcessFlow.findFirst({
      where: { entityType, active: true },
      include: { stages: { orderBy: { order: "asc" } } }
    });
    if (!flow) {
      throw new NotFoundException(`No active process flow for entity "${entityType}"`);
    }

    const targetStage = flow.stages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      throw new BadRequestException("Target stage does not belong to this flow");
    }

    const entityRow = await this.loadEntityRow(entityType, entityId);
    if (!entityRow) {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }

    let instance = await this.prisma.businessProcessInstance.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
      include: { currentStage: true }
    });

    // If we're advancing FORWARD, validate the CURRENT stage's required
    // fields. Advancing backward is always allowed — you can revisit an
    // earlier stage to correct data. If no instance exists yet, we're
    // starting at the target stage; no required-field check.
    if (instance && targetStage.order > instance.currentStage.order) {
      this.assertRequiredFields(entityRow, toStringArray(instance.currentStage.requiredFieldsJson));
    }

    const historyEntry: StageHistoryEntry = {
      stageId: targetStage.id,
      enteredAt: new Date().toISOString(),
      byUserId: actorId
    };

    if (!instance) {
      instance = await this.prisma.businessProcessInstance.create({
        data: {
          flowId: flow.id,
          entityType,
          entityId,
          currentStageId: targetStage.id,
          historyJson: [historyEntry] as unknown as Prisma.InputJsonValue
        },
        include: { currentStage: true }
      });
    } else {
      const nextHistory = [...toHistory(instance.historyJson), historyEntry];
      instance = await this.prisma.businessProcessInstance.update({
        where: { id: instance.id },
        data: {
          currentStageId: targetStage.id,
          historyJson: nextHistory as unknown as Prisma.InputJsonValue
        },
        include: { currentStage: true }
      });
    }

    return toInstanceDto(instance);
  }

  private async loadEntityRow(
    entityType: SupportedEntity,
    entityId: string
  ): Promise<Record<string, unknown> | null> {
    switch (entityType) {
      case "Tender":
        return (await this.prisma.tender.findUnique({ where: { id: entityId } })) as
          | Record<string, unknown>
          | null;
      default: {
        const exhaustive: never = entityType;
        throw new BadRequestException(`Unsupported entity type "${exhaustive as string}"`);
      }
    }
  }

  private assertRequiredFields(row: Record<string, unknown>, requiredFields: string[]): void {
    const missing = requiredFields.filter((key) => {
      const value = row[key];
      return value === null || value === undefined || value === "";
    });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot advance: required fields missing on current stage — ${missing.join(", ")}`
      );
    }
  }
}

function toFlowDto(flow: {
  id: string;
  entityType: string;
  name: string;
  active: boolean;
  stages: Array<{ id: string; name: string; order: number; requiredFieldsJson: Prisma.JsonValue }>;
}): ProcessFlowDto {
  return {
    id: flow.id,
    entityType: flow.entityType,
    name: flow.name,
    active: flow.active,
    stages: flow.stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      requiredFields: toStringArray(s.requiredFieldsJson)
    }))
  };
}

function toInstanceDto(instance: {
  id: string;
  flowId: string;
  entityType: string;
  entityId: string;
  currentStageId: string;
  currentStage: { id: string; name: string; order: number; requiredFieldsJson: Prisma.JsonValue };
  historyJson: Prisma.JsonValue;
}): ProcessInstanceDto {
  return {
    id: instance.id,
    flowId: instance.flowId,
    entityType: instance.entityType,
    entityId: instance.entityId,
    currentStageId: instance.currentStageId,
    currentStage: {
      id: instance.currentStage.id,
      name: instance.currentStage.name,
      order: instance.currentStage.order,
      requiredFields: toStringArray(instance.currentStage.requiredFieldsJson)
    },
    history: toHistory(instance.historyJson)
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toHistory(value: Prisma.JsonValue): StageHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is StageHistoryEntry =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as { stageId?: unknown }).stageId === "string"
  );
}
