import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterSearchEntryDto } from "./dto/register-search-entry.dto";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  register(input: RegisterSearchEntryDto) {
    return this.prisma.searchEntry.upsert({
      where: {
        id: `${input.entityType}:${input.entityId}`
      },
      update: {
        title: input.title,
        subtitle: input.subtitle,
        body: input.body,
        module: input.module,
        url: input.url
      },
      create: {
        id: `${input.entityType}:${input.entityId}`,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        subtitle: input.subtitle,
        body: input.body,
        module: input.module,
        url: input.url
      }
    });
  }

  search(query?: string) {
    return this.prisma.searchEntry.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { subtitle: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } },
              { module: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: [{ module: "asc" }, { title: "asc" }],
      take: 25
    });
  }
}
