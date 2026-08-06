import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { HandoverFieldSourceType, HandoverFieldType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type SortableEntity = { id: string; sortOrder: number };

export type FieldTypeName = "text" | "money" | "date" | "list" | "attachment" | "contact";
export type FieldSourceName = "auto" | "capture" | "attach" | "derived";

const FIELD_TYPES: FieldTypeName[] = ["text", "money", "date", "list", "attachment", "contact"];
const FIELD_SOURCES: FieldSourceName[] = ["auto", "capture", "attach", "derived"];

// ─── Key slug helper ─────────────────────────────────────────────────────────

/**
 * Slugify a label into a stable-key candidate. Callers must still resolve
 * collisions against existing keys in scope (section or field within section).
 */
export function slugifyKey(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

/**
 * Resolve a unique key by appending -2, -3, ... when the base collides.
 * `taken` is the set of keys already present in scope.
 */
export function ensureUniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new BadRequestException(`Unable to allocate a unique key for "${base}".`);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HandoverTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the currently-published (isActive=true) template plus its sections
   * and non-retired fields, ordered by sortOrder. Throws 404 if none exists —
   * the seed guarantees version 1, so 404 here signals a seed gap.
   */
  async getActive() {
    const active = await this.prisma.handoverTemplate.findFirst({
      where: { isActive: true },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            fields: {
              where: { retiredAt: null },
              orderBy: { sortOrder: "asc" }
            }
          }
        }
      }
    });
    if (!active) {
      throw new NotFoundException("No active handover template found. Run the seed.");
    }
    return active;
  }

  /**
   * Return the current working draft (publishedAt = null). Returns null when
   * no draft exists so callers can decide whether to create one.
   */
  async findDraft() {
    return this.prisma.handoverTemplate.findFirst({
      where: { publishedAt: null },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            fields: {
              orderBy: { sortOrder: "asc" }
            }
          }
        }
      }
    });
  }

  /**
   * Get the draft or 404 — used by the editor page when a draft is expected.
   */
  async getDraftOrThrow() {
    const draft = await this.findDraft();
    if (!draft) throw new NotFoundException("No draft template exists. Create one first.");
    return draft;
  }

  /**
   * Create a new draft by cloning the active template (sections + non-retired
   * fields). New draft is version = max(version) + 1. Rejects with 409 if a
   * draft already exists (mutually exclusive with active state).
   */
  async createDraftFromActive() {
    const existingDraft = await this.prisma.handoverTemplate.findFirst({
      where: { publishedAt: null }
    });
    if (existingDraft) {
      throw new ConflictException("A draft template already exists. Publish or discard it first.");
    }

    const active = await this.getActive();
    const maxVersion = await this.prisma.handoverTemplate.aggregate({
      _max: { version: true }
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.handoverTemplate.create({
        data: { version: nextVersion, isActive: false }
      });

      for (const section of active.sections) {
        const newSection = await tx.handoverTemplateSection.create({
          data: {
            templateId: draft.id,
            key: section.key,
            label: section.label,
            sortOrder: section.sortOrder
          }
        });
        for (const field of section.fields) {
          await tx.handoverTemplateField.create({
            data: {
              sectionId: newSection.id,
              key: field.key,
              label: field.label,
              type: field.type,
              sourceType: field.sourceType,
              autoBinding: field.autoBinding,
              listId: field.listId,
              required: field.required,
              sortOrder: field.sortOrder
            }
          });
        }
      }

      return tx.handoverTemplate.findUniqueOrThrow({
        where: { id: draft.id },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              fields: { orderBy: { sortOrder: "asc" } }
            }
          }
        }
      });
    });
  }

  // ─── Section ops (draft-only) ──────────────────────────────────────────────

  async addSection(input: { label: string; sortOrder?: number }) {
    const draft = await this.getDraftOrThrow();
    const existing = await this.prisma.handoverTemplateSection.findMany({
      where: { templateId: draft.id },
      select: { key: true, sortOrder: true }
    });
    const taken = new Set(existing.map((s) => s.key));
    const key = ensureUniqueKey(slugifyKey(input.label), taken);
    const sortOrder = input.sortOrder ?? nextSortOrder(existing);

    return this.prisma.handoverTemplateSection.create({
      data: { templateId: draft.id, key, label: input.label, sortOrder }
    });
  }

  /**
   * Rename (label) or reorder a section. `key` is stable and cannot be changed
   * — clients that pass one are ignored.
   */
  async updateSection(sectionId: string, input: { label?: string; sortOrder?: number }) {
    const section = await this.loadDraftSection(sectionId);
    const data: Prisma.HandoverTemplateSectionUpdateInput = {};
    if (input.label !== undefined) data.label = input.label;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    if (Object.keys(data).length === 0) return section;

    return this.prisma.handoverTemplateSection.update({
      where: { id: section.id },
      data
    });
  }

  /**
   * Remove a section from the draft. Cascades to its fields via the schema
   * relation. Safe because deletion only affects draft rows; published
   * versions are untouched and any HandoverValues bound to prior versions'
   * keys are unaffected.
   */
  async removeSection(sectionId: string) {
    const section = await this.loadDraftSection(sectionId);
    await this.prisma.handoverTemplateSection.delete({ where: { id: section.id } });
    return { deleted: true, id: section.id };
  }

  // ─── Field ops (draft-only) ────────────────────────────────────────────────

  async addField(
    sectionId: string,
    input: {
      label: string;
      type: FieldTypeName;
      sourceType: FieldSourceName;
      autoBinding?: string;
      listId?: string;
      required?: boolean;
      sortOrder?: number;
    }
  ) {
    if (!FIELD_TYPES.includes(input.type)) {
      throw new BadRequestException(`type must be one of: ${FIELD_TYPES.join(", ")}`);
    }
    if (!FIELD_SOURCES.includes(input.sourceType)) {
      throw new BadRequestException(`sourceType must be one of: ${FIELD_SOURCES.join(", ")}`);
    }
    if (input.sourceType === "auto" && !input.autoBinding) {
      throw new BadRequestException(`autoBinding is required when sourceType is "auto".`);
    }

    const section = await this.loadDraftSection(sectionId);
    const existing = await this.prisma.handoverTemplateField.findMany({
      where: { sectionId: section.id },
      select: { key: true, sortOrder: true }
    });
    const taken = new Set(existing.map((f) => f.key));
    const key = ensureUniqueKey(slugifyKey(input.label), taken);
    const sortOrder = input.sortOrder ?? nextSortOrder(existing);

    return this.prisma.handoverTemplateField.create({
      data: {
        sectionId: section.id,
        key,
        label: input.label,
        type: input.type as HandoverFieldType,
        sourceType: input.sourceType as HandoverFieldSourceType,
        autoBinding: input.autoBinding,
        listId: input.listId,
        required: input.required ?? false,
        sortOrder
      }
    });
  }

  /**
   * Update a field's mutable attributes. `key` is stable — passing one is
   * rejected so clients cannot silently break existing HandoverValue bindings.
   */
  async updateField(
    fieldId: string,
    input: {
      label?: string;
      sortOrder?: number;
      required?: boolean;
      autoBinding?: string | null;
      listId?: string | null;
    }
  ) {
    const field = await this.loadDraftField(fieldId);
    const data: Prisma.HandoverTemplateFieldUpdateInput = {};
    if (input.label !== undefined) data.label = input.label;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.required !== undefined) data.required = input.required;
    if (input.autoBinding !== undefined) data.autoBinding = input.autoBinding;
    if (input.listId !== undefined) data.listId = input.listId;

    if (Object.keys(data).length === 0) return field;

    return this.prisma.handoverTemplateField.update({
      where: { id: field.id },
      data
    });
  }

  /**
   * Retire (soft-remove) a field. Sets `retiredAt` so historical values keyed
   * to it remain resolvable; never hard-deletes.
   */
  async retireField(fieldId: string) {
    const field = await this.loadDraftField(fieldId);
    if (field.retiredAt) {
      return field;
    }
    return this.prisma.handoverTemplateField.update({
      where: { id: field.id },
      data: { retiredAt: new Date() }
    });
  }

  // ─── Publish ───────────────────────────────────────────────────────────────

  /**
   * Publish the current draft: deactivate the prior active template and flip
   * the draft to isActive with publishedAt=now and publishedById=actor.
   * Prior versions and their sections/fields are left intact (non-destructive
   * versioning). Throws 404 if no draft, 400 if the draft has no sections.
   */
  async publishDraft(publishedById: string) {
    const draft = await this.getDraftOrThrow();
    if (draft.sections.length === 0) {
      throw new BadRequestException("Draft has no sections; add at least one before publishing.");
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.handoverTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      return tx.handoverTemplate.update({
        where: { id: draft.id },
        data: { isActive: true, publishedAt: now, publishedById },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              fields: { orderBy: { sortOrder: "asc" } }
            }
          }
        }
      });
    });
  }

  // ─── Internal loaders ──────────────────────────────────────────────────────

  /**
   * Loads a section and guarantees it belongs to the current draft. Editing
   * the active or a historical template is forbidden — a fresh draft must be
   * created first.
   */
  private async loadDraftSection(sectionId: string) {
    const section = await this.prisma.handoverTemplateSection.findUnique({
      where: { id: sectionId },
      include: { template: true }
    });
    if (!section) throw new NotFoundException(`Section ${sectionId} not found.`);
    if (section.template.publishedAt !== null) {
      throw new ForbiddenException(
        "Section belongs to a published template. Create a new draft to edit."
      );
    }
    return section;
  }

  private async loadDraftField(fieldId: string) {
    const field = await this.prisma.handoverTemplateField.findUnique({
      where: { id: fieldId },
      include: { section: { include: { template: true } } }
    });
    if (!field) throw new NotFoundException(`Field ${fieldId} not found.`);
    if (field.section.template.publishedAt !== null) {
      throw new ForbiddenException(
        "Field belongs to a published template. Create a new draft to edit."
      );
    }
    return field;
  }
}

function nextSortOrder(existing: SortableEntity[] | { sortOrder: number }[]): number {
  const max = existing.reduce((acc, e) => Math.max(acc, e.sortOrder), 0);
  return max + 1;
}
