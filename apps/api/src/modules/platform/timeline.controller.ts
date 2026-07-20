import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { TimelineService, type TimelineItem } from "./timeline.service";

// The permission a caller needs to READ a given entity's timeline. Writes
// re-use the same guard — anyone who can see the record can drop a note
// on it, matching how CorrespondenceService gates comm reads.
const VIEW_PERMISSIONS: Record<string, string> = {
  Job: "jobs.view",
  Tender: "tenders.view",
  Client: "clients.view",
  Contact: "contacts.view"
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
  @ApiResponse({ status: 200, description: "{ entityType, entityId, items[] } sorted newest first." })
  async list(
    @Param("entityType") entityTypeRaw: string,
    @Param("entityId") entityId: string,
    @Query("limit") limitRaw: string | undefined,
    @Query("kinds") kindsRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const entityType = this.service.parseEntityType(entityTypeRaw);
    this.ensureViewer(entityType, user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const kinds = kindsRaw
      ? (kindsRaw.split(",").map((s) => s.trim()).filter(Boolean) as TimelineItem["kind"][])
      : undefined;
    return this.service.list(entityType, entityId, { limit, kinds });
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
    if (!required) return;
    const permissions = user?.permissions ?? [];
    if (permissions.includes(required)) return;
    throw new ForbiddenException(`Missing required permission: ${required}`);
  }
}
