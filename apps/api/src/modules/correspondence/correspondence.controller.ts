import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, ArrayNotEmpty, IsArray, IsEmail, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CorrespondenceService, type OwnerKind } from "./correspondence.service";
import type { CorrespondenceInboundRaw } from "./correspondence-adapter.interface";

const OWNER_KINDS: OwnerKind[] = ["client", "tender", "job"];

class SendMessageDto {
  @IsArray() @ArrayNotEmpty() @ArrayMinSize(1) @IsEmail({}, { each: true }) to!: string[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) cc?: string[];
  @IsString() subject!: string;
  @IsString() bodyText!: string;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() threadId?: string;
}

class SimulateInboundDto {
  @IsString() @IsEmail() from!: string;
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) to?: string[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) cc?: string[];
  @IsString() subject!: string;
  @IsString() bodyText!: string;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() externalId?: string;
}

function parseKind(value: string): OwnerKind {
  if (!OWNER_KINDS.includes(value as OwnerKind)) {
    throw new BadRequestException(`ownerKind must be one of ${OWNER_KINDS.join(", ")}`);
  }
  return value as OwnerKind;
}

@ApiTags("Correspondence")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CorrespondenceController {
  constructor(private readonly service: CorrespondenceService) {}

  // Read access is gated with tenders.view as the canonical comm-related
  // permission; clients/jobs viewers also typically hold tenders.view in
  // this product. Field-only roles do not, which is the intended exclusion.
  @Get("correspondence/:ownerKind/:ownerId")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List correspondence threads attached to a client, tender, or job." })
  @ApiResponse({ status: 200, description: "Threads with their messages, newest first." })
  list(@Param("ownerKind") ownerKind: string, @Param("ownerId") ownerId: string) {
    return this.service.listForOwner(parseKind(ownerKind), ownerId);
  }

  @Post("correspondence/:ownerKind/:ownerId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Send a new correspondence message (creates or replies in a thread)." })
  @ApiResponse({ status: 201, description: "Thread and persisted outbound message." })
  send(
    @Param("ownerKind") ownerKind: string,
    @Param("ownerId") ownerId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.sendMessage(actor.sub, {
      ownerKind: parseKind(ownerKind),
      ownerId,
      threadId: dto.threadId,
      to: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      bodyText: dto.bodyText,
      bodyHtml: dto.bodyHtml
    });
  }

  /**
   * Mock-mode entrypoint that simulates an inbound mail reply for tests and
   * dev. The live Graph follow-up will call `recordInbound` directly from a
   * webhook handler instead of going through this route.
   */
  @Post("correspondence/simulate-inbound")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary: "Simulate an inbound mail reply (mock-mode dev/test only). Matches by [ref:<key>] in subject."
  })
  @ApiResponse({ status: 201, description: "Match result + persisted inbound message id." })
  simulate(@Body() dto: SimulateInboundDto) {
    const raw: CorrespondenceInboundRaw = {
      from: dto.from,
      to: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      bodyText: dto.bodyText,
      bodyHtml: dto.bodyHtml,
      externalId: dto.externalId
    };
    return this.service.recordInbound(raw);
  }
}
