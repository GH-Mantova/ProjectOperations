import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { TimelineService, type TimelineItem, type TimelineCursor } from "./timeline.service";

// The permission a caller needs to READ a given entity's timeline. Writes
// re-use the same guard — anyone who can see the record can drop a note
// on it, matching how CorrespondenceService gates comm reads.
const VIEW_PERMISSIONS: Record<string, string> = {
  Job: "jobs.view",
  Tender: "tenders.view",
  Client: "directory.view",
  Contact: "directory.view"
};

class AddNoteDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
}

@ApiTags("Timeline")
@ApiBearerAuth()
@Controller("timeline")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

  @Get(":entityType/:entityId")
  // Guarded per-entity in-code below. We can't decorate here because the
  // required permission depends on the path param, and PermissionsGuard
  // reads the decorator at class-init time. Instead, the controller does
  // the permission check itself using the caller's granted list.
  @ApiOperation({
    summary:
      "Merged activity timeline for a record. Combines notes, status changes, attachments, and (where present) correspondence and progress entries."
  })
  @ApiParam({ name: "entityType", enum: ["Job", "Tender", "Client", "Contact"] })
  @ApiQuery({ name: "limit", required: false, description: "Max items (default 50, max 200)." })
  @ApiQuery({
    name: "kinds",
    required: false,
    description: "Comma-separated filter: note,status,attachment,system,correspondence,progress."
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "ISO date string (YYYY-MM-DD). Filter to items with createdAt >= from."
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "ISO date string (YYYY-MM-DD). Filter to items with createdAt <= end-of-day(to) (inclusive)."
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Opaque base64-encoded cursor string from a previous response's nextCursor field. Only valid within the same from/to/kinds filter."
  })
  @ApiResponse({
    status: 200,
    description: "{ entityType, entityId, items[], nextCursor } sorted newest first. nextCursor is a base64 string when a further page exists, else null."
  })
  async list(
    @Param("entityType") entityTypeRaw: string,
    @Param("entityId") entityId: string,
    @Query("limit") limitRaw: string | undefined,
    @Query("kinds") kindsRaw: string | undefined,
    @Query("from") fromRaw: string | undefined,
    @Query("to") toRaw: string | undefined,
    @Query("cursor") cursorRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const entityType = this.service.parseEntityType(entityTypeRaw);
    this.ensureViewer(entityType, user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const kinds = kindsRaw
      ? (kindsRaw.split(",").map((s) => s.trim()).filter(Boolean) as TimelineItem["kind"][])
      : undefined;

    // Parse from/to date strings
    let from: Date | undefined;
    let to: Date | undefined;
    if (fromRaw !== undefined) {
      if (isNaN(Date.parse(fromRaw))) {
        throw new BadRequestException(`Invalid "from" date: "${fromRaw}". Expected an ISO date string.`);
      }
      from = new Date(fromRaw);
    }
    if (toRaw !== undefined) {
      if (isNaN(Date.parse(toRaw))) {
        throw new BadRequestException(`Invalid "to" date: "${toRaw}". Expected an ISO date string.`);
      }
      to = new Date(toRaw);
    }

    // Decode opaque base64 cursor
    let cursor: TimelineCursor | undefined;
    if (cursorRaw !== undefined) {
      try {
        const decoded = Buffer.from(cursorRaw, "base64").toString("utf8");
        const parsed = JSON.parse(decoded) as { createdAt: string; id: string };
        cursor = { createdAt: new Date(parsed.createdAt), id: parsed.id };
        if (isNaN(cursor.createdAt.getTime()) || typeof cursor.id !== "string") {
          throw new Error("invalid fields");
        }
      } catch {
        throw new BadRequestException(`Invalid cursor value. Expected a base64-encoded cursor string from a previous response.`);
      }
    }

    const result = await this.service.list(entityType, entityId, { limit, kinds, from, to, cursor });

    // Re-encode nextCursor as opaque base64 string for the wire format
    const nextCursor: string | null = result.nextCursor !== null
      ? Buffer.from(JSON.stringify({ createdAt: result.nextCursor.createdAt.toISOString(), id: result.nextCursor.id })).toString("base64")
      : null;

    return {
      entityType: result.entityType,
      entityId: result.entityId,
      items: result.items,
      nextCursor
    };
  }

  @Post(":entityType/:entityId/notes")
  @ApiOperation({ summary: "Add a manual note to the timeline for a record." })
  @ApiParam({ name: "entityType", enum: ["Job", "Tender", "Client", "Contact"] })
  @ApiResponse({ status: 201, description: "The persisted note as a timeline item." })
  addNote(
    @Param("entityType") entityTypeRaw: string,
    @Param("entityId") entityId: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const entityType = this.service.parseEntityType(entityTypeRaw);
    this.ensureViewer(entityType, user);
    return this.service.addNote(entityType, entityId, dto.body, user.sub);
  }

  private ensureViewer(entityType: string, user: AuthenticatedUser) {
    const required = VIEW_PERMISSIONS[entityType];
    // Fail closed: an entity type without a mapped permission is not viewable
    // by anyone except super-users, so newly-added entity types can't slip
    // through unauthenticated if the map isn't updated in the same change.
    if (!required) {
      if (user?.isSuperUser) return;
      throw new ForbiddenException(`No permission mapping for entity type: ${entityType}`);
    }
    if (user?.isSuperUser) return;
    const permissions = user?.permissions ?? [];
    if (permissions.includes(required)) return;
    throw new ForbiddenException(`Missing required permission: ${required}`);
  }
}
