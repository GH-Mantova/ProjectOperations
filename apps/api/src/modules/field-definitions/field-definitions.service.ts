import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FieldAppliesTo, FieldSource } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateFieldDefinitionDto {
  key: string;
  label: string;
  group?: string;
  sortOrder?: number;
  visible?: boolean;
  required?: boolean;
  appliesTo: FieldAppliesTo;
  source?: FieldSource;
}

export interface UpdateFieldDefinitionDto {
  label?: string;
  group?: string;
  sortOrder?: number;
  visible?: boolean;
  required?: boolean;
  // Immutable — will be rejected if supplied:
  key?: unknown;
  source?: unknown;
  appliesTo?: unknown;
}

@Injectable()
export class FieldDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(appliesTo?: FieldAppliesTo) {
    if (appliesTo) {
      return this.prisma.fieldDefinition.findMany({
        where: {
          OR: [{ appliesTo }, { appliesTo: FieldAppliesTo.BOTH }]
        },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }]
      });
    }
    return this.prisma.fieldDefinition.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }]
    });
  }

  async get(id: string) {
    return this.prisma.fieldDefinition.findUniqueOrThrow({ where: { id } });
  }

  async createCustom(dto: CreateFieldDefinitionDto) {
    // Always force source=CUSTOM — callers cannot create BUILTIN rows via this method.
    return this.prisma.fieldDefinition.create({
      data: {
        key: dto.key,
        label: dto.label,
        group: dto.group ?? "General",
        sortOrder: dto.sortOrder ?? 0,
        visible: dto.visible ?? true,
        required: dto.required ?? false,
        appliesTo: dto.appliesTo,
        source: FieldSource.CUSTOM
      }
    });
  }

  async update(id: string, dto: UpdateFieldDefinitionDto) {
    // Reject any attempt to mutate immutable fields.
    if ("key" in dto && dto.key !== undefined) {
      throw new BadRequestException("Field key is immutable and cannot be changed.");
    }
    if ("source" in dto && dto.source !== undefined) {
      throw new BadRequestException("Field source is immutable and cannot be changed.");
    }
    if ("appliesTo" in dto && dto.appliesTo !== undefined) {
      throw new BadRequestException("Field appliesTo is immutable and cannot be changed.");
    }

    await this.get(id); // throws NotFoundException if missing

    return this.prisma.fieldDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        group: dto.group,
        sortOrder: dto.sortOrder,
        visible: dto.visible,
        required: dto.required
      }
    });
  }

  async remove(id: string) {
    const field = await this.prisma.fieldDefinition.findUnique({ where: { id } });
    if (!field) {
      throw new NotFoundException(`FieldDefinition "${id}" not found.`);
    }
    if (field.source === FieldSource.BUILTIN) {
      throw new BadRequestException("Built-in fields can only be hidden, not deleted.");
    }
    return this.prisma.fieldDefinition.delete({ where: { id } });
  }
}
