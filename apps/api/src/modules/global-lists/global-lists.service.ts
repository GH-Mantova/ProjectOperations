import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { GlobalList, GlobalListItem, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type ResolvedListItem = {
  id: string;
  value: string;
  label: string;
  metadata: Prisma.JsonValue | null;
  sortOrder: number;
  isArchived: boolean;
  createdById: string | null;
  source: "static" | "dynamic";
};

export type ResolvedList = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "STATIC" | "DYNAMIC";
  sourceModule: string | null;
  isSystem: boolean;
  itemCount: number;
  items: ResolvedListItem[];
};

@Injectable()
export class GlobalListsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const lists = await this.prisma.globalList.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { items: { where: { isArchived: false } } } } }
    });
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      description: l.description,
      type: l.type,
      sourceModule: l.sourceModule,
      isSystem: l.isSystem,
      itemCount: l.type === "DYNAMIC" ? null : l._count.items
    }));
  }

  async getBySlug(slug: string): Promise<ResolvedList> {
    const list = await this.prisma.globalList.findUnique({ where: { slug } });
    if (!list) throw new NotFoundException(`List "${slug}" not found.`);
    const items =
      list.type === "DYNAMIC"
        ? await this.resolveDynamicItems(list)
        : (
            await this.prisma.globalListItem.findMany({
              where: { listId: list.id },
              orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
            })
          ).map<ResolvedListItem>((i) => ({
            id: i.id,
            value: i.value,
            label: i.label,
            metadata: i.metadata ?? null,
            sortOrder: i.sortOrder,
            isArchived: i.isArchived,
            createdById: i.createdById,
            source: "static"
          }));
    return {
      id: list.id,
      name: list.name,
      slug: list.slug,
      description: list.description,
      type: list.type,
      sourceModule: list.sourceModule,
      isSystem: list.isSystem,
      itemCount: items.filter((i) => !i.isArchived).length,
      items
    };
  }

  async createList(
    actorId: string,
    dto: { name: string; slug: string; description?: string | null; type?: "STATIC" }
  ) {
    if (dto.type && dto.type !== "STATIC") {
      throw new BadRequestException("Only STATIC lists can be created via this API.");
    }
    const cleanSlug = slugify(dto.slug);
    if (!cleanSlug) throw new BadRequestException("Slug must contain at least one alphanumeric character.");
    const existing = await this.prisma.globalList.findFirst({
      where: { OR: [{ slug: cleanSlug }, { name: dto.name }] }
    });
    if (existing) throw new ConflictException("A list with this name or slug already exists.");
    return this.prisma.globalList.create({
      data: {
        name: dto.name.trim(),
        slug: cleanSlug,
        description: dto.description?.trim() || null,
        type: "STATIC",
        isSystem: false,
        createdById: actorId
      }
    });
  }

  async createItem(
    slug: string,
    actor: { id: string; isAdmin: boolean },
    dto: { value?: string; label: string; metadata?: Prisma.JsonValue | null; sortOrder?: number }
  ) {
    const list = await this.requireStaticList(slug);
    const label = dto.label.trim();
    if (!label) throw new BadRequestException("Label is required.");
    const value = (dto.value?.trim() || slugify(label)).toLowerCase();
    if (!value) throw new BadRequestException("Could not derive a value from the label.");
    const conflict = await this.prisma.globalListItem.findUnique({
      where: { listId_value: { listId: list.id, value } }
    });
    if (conflict) {
      if (conflict.isArchived) {
        // Only the original creator or an admin may unarchive + overwrite
        // another user's archived item — otherwise this is an edit-by-proxy.
        if (conflict.createdById !== actor.id && !actor.isAdmin) {
          throw new ConflictException(
            "An archived item with this value already exists. Ask an administrator to restore it."
          );
        }
        return this.prisma.globalListItem.update({
          where: { id: conflict.id },
          data: { isArchived: false, label, metadata: dto.metadata ?? undefined }
        });
      }
      throw new ConflictException(`Value "${value}" already exists in list "${slug}".`);
    }
    const nextSortOrder =
      dto.sortOrder ??
      (await this.prisma.globalListItem.count({ where: { listId: list.id, isArchived: false } }));
    return this.prisma.globalListItem.create({
      data: {
        listId: list.id,
        value,
        label,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: nextSortOrder,
        isArchived: false,
        createdById: actor.id
      }
    });
  }

  async updateItem(
    slug: string,
    itemId: string,
    actor: { id: string; isAdmin: boolean },
    dto: { label?: string; metadata?: Prisma.JsonValue | null; sortOrder?: number; isArchived?: boolean }
  ) {
    const list = await this.requireStaticList(slug);
    const item = await this.prisma.globalListItem.findUnique({ where: { id: itemId } });
    if (!item || item.listId !== list.id) throw new NotFoundException("List item not found.");
    this.assertEditable(item, actor);
    return this.prisma.globalListItem.update({
      where: { id: itemId },
      data: {
        label: dto.label !== undefined ? dto.label.trim() : undefined,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: dto.sortOrder,
        isArchived: dto.isArchived
      }
    });
  }

  async archiveItem(slug: string, itemId: string, actor: { id: string; isAdmin: boolean }) {
    const list = await this.requireStaticList(slug);
    const item = await this.prisma.globalListItem.findUnique({ where: { id: itemId } });
    if (!item || item.listId !== list.id) throw new NotFoundException("List item not found.");
    this.assertEditable(item, actor);
    return this.prisma.globalListItem.update({
      where: { id: itemId },
      data: { isArchived: true }
    });
  }

  async reorder(
    slug: string,
    actor: { id: string; isAdmin: boolean },
    order: Array<{ itemId: string; sortOrder: number }>
  ) {
    const list = await this.requireStaticList(slug);
    // System lists are seeded by the platform and define canonical ordering;
    // only admins may re-sequence them. User-created lists are free-for-all,
    // matching the existing add/archive permission model.
    if (list.isSystem && !actor.isAdmin) {
      throw new ForbiddenException("Only administrators can reorder items on system lists.");
    }
    if (order.length === 0) return { updated: 0 };
    const ids = order.map((o) => o.itemId);
    const existing = await this.prisma.globalListItem.findMany({
      where: { id: { in: ids }, listId: list.id },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const missing = ids.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException({ message: "Some item IDs are not in this list.", invalid: missing });
    }
    await this.prisma.$transaction(
      order.map((o) =>
        this.prisma.globalListItem.update({
          where: { id: o.itemId },
          data: { sortOrder: o.sortOrder }
        })
      )
    );
    return { updated: order.length };
  }

  private async requireStaticList(slug: string): Promise<GlobalList> {
    const list = await this.prisma.globalList.findUnique({ where: { slug } });
    if (!list) throw new NotFoundException(`List "${slug}" not found.`);
    if (list.type === "DYNAMIC") {
      throw new BadRequestException(
        `List "${slug}" is DYNAMIC — items are sourced from ${list.sourceModule}. Manage them in that module.`
      );
    }
    return list;
  }

  private assertEditable(item: GlobalListItem, actor: { id: string; isAdmin: boolean }) {
    if (actor.isAdmin) return;
    if (item.createdById !== actor.id) {
      throw new ForbiddenException("Only admins can modify items created by other users.");
    }
  }

  private async resolveDynamicItems(list: GlobalList): Promise<ResolvedListItem[]> {
    const module = list.sourceModule ?? "";
    if (module === "assets") {
      const assets = await this.prisma.asset.findMany({
        where: { status: { not: "RETIRED" } },
        include: { category: true },
        orderBy: { name: "asc" }
      });
      const filtered =
        list.slug === "plant"
          ? assets.filter((a) => /plant|equipment/i.test(a.category?.name ?? ""))
          : assets;
      return filtered.map((a, index) => ({
        id: a.id,
        value: a.id,
        label: a.name,
        metadata: { assetCode: a.assetCode, category: a.category?.name ?? null },
        sortOrder: index,
        isArchived: false,
        createdById: null,
        source: "dynamic"
      }));
    }
    if (module === "workers") {
      const workers = await this.prisma.worker.findMany({
        where: { status: { not: "TERMINATED" } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      return workers.map((w, index) => ({
        id: w.id,
        value: w.id,
        label: `${w.firstName} ${w.lastName}`.trim(),
        metadata: { status: w.status, employmentType: w.employmentType },
        sortOrder: index,
        isArchived: false,
        createdById: null,
        source: "dynamic"
      }));
    }
    return [];
  }
}

const MAX_SLUG_INPUT = 200;

// Linear-time slugify with explicit input cap. Previous chained regex
// (/[^a-z0-9-]+/g plus /^-+|-+$/g) triggered CodeQL's polynomial-regex
// warning because the `+g` quantifier on arbitrary input is not trivially
// linear. This version walks the characters once and then collapses a
// bounded run, so worst-case time is O(n) regardless of input shape.
function slugify(input: string): string {
  const trimmed = (input ?? "").trim().slice(0, MAX_SLUG_INPUT).toLowerCase();
  if (!trimmed) return "";
  const chars: string[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const c = trimmed.charCodeAt(i);
    const isLower = c >= 97 && c <= 122;
    const isDigit = c >= 48 && c <= 57;
    const isDash = c === 45;
    chars.push(isLower || isDigit || isDash ? trimmed[i] : "-");
  }
  // Collapse runs of dashes without regex, O(n).
  const collapsed: string[] = [];
  let prevDash = false;
  for (const ch of chars) {
    const isDash = ch === "-";
    if (isDash && prevDash) continue;
    collapsed.push(ch);
    prevDash = isDash;
  }
  // Trim leading/trailing dashes.
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === "-") start += 1;
  while (end > start && collapsed[end - 1] === "-") end -= 1;
  return collapsed.slice(start, end).join("");
}
