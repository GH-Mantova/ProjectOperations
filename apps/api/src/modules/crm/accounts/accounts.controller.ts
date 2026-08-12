import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { AccountsService } from "./accounts.service";

const LIFECYCLE_STATUSES = ["PROSPECT", "ACTIVE", "PAST"] as const;
const ACCOUNT_TYPES = ["CLIENT", "PROSPECT", "HEAD_CONTRACTOR", "SUBCONTRACTOR", "PARTNER", "OTHER"] as const;
const ACCOUNT_SOURCES = ["REFERRAL", "DIRECT", "TENDER_PORTAL", "COLD_OUTREACH", "REPEAT_BUSINESS", "OTHER"] as const;

class ListAccountsQueryDto {
  @IsOptional() @IsIn(LIFECYCLE_STATUSES as unknown as string[]) lifecycleStatus?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Boolean) @Transform(({ value }) => value === "true" || value === true) @IsBoolean()
  includeArchived?: boolean;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateAccountDto {
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsIn(LIFECYCLE_STATUSES as unknown as string[]) lifecycleStatus?: string;
  @IsOptional() @IsIn(ACCOUNT_TYPES as unknown as string[]) accountType?: string;
  @IsOptional() @IsIn(ACCOUNT_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdateAccountDto {
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsIn(LIFECYCLE_STATUSES as unknown as string[]) lifecycleStatus?: string;
  @IsOptional() @IsIn(ACCOUNT_TYPES as unknown as string[]) accountType?: string;
  @IsOptional() @IsIn(ACCOUNT_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

/**
 * CRM-1: REST surface for Account management + Client-360 view.
 *
 * Read routes: crm.view.
 * Mutating routes: crm.manage.
 *
 * The 360 view aggregates contacts + read-only roll-ups (tenders/jobs)
 * WITHOUT modifying the transactional owners.
 */
@ApiTags("CRM Accounts")
@ApiBearerAuth()
@Controller("crm/accounts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List accounts with optional filters." })
  @ApiQuery({ name: "lifecycleStatus", required: false, enum: LIFECYCLE_STATUSES })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "includeArchived", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of accounts." })
  listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.service.listAccounts(query as never);
  }

  @Get(":id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get an account by id." })
  @ApiParam({ name: "id", description: "Account id" })
  @ApiResponse({ status: 200, description: "Account found." })
  @ApiResponse({ status: 404, description: "Account not found." })
  getAccount(@Param("id") id: string) {
    return this.service.getAccount(id);
  }

  @Get(":id/360")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Client-360 view: Account + Client + contacts + read-only roll-ups (tenders, jobs)." })
  @ApiParam({ name: "id", description: "Account id" })
  @ApiResponse({ status: 200, description: "360 view with roll-ups." })
  @ApiResponse({ status: 404, description: "Account not found." })
  getAccount360(@Param("id") id: string) {
    return this.service.getAccount360(id);
  }

  @Post()
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a new account." })
  @ApiResponse({ status: 201, description: "Account created." })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto as never);
  }

  @Patch(":id")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Update an account." })
  @ApiParam({ name: "id", description: "Account id" })
  @ApiResponse({ status: 200, description: "Updated account." })
  @ApiResponse({ status: 404, description: "Account not found." })
  updateAccount(@Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.service.updateAccount(id, dto as never);
  }

  @Post(":id/archive")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Soft-archive an account." })
  @ApiParam({ name: "id", description: "Account id" })
  @ApiResponse({ status: 200, description: "Account archived." })
  @ApiResponse({ status: 400, description: "Already archived." })
  @ApiResponse({ status: 404, description: "Account not found." })
  archiveAccount(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.archiveAccount(id, { actorId: actor.sub });
  }

  @Post(":id/unarchive")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Restore a soft-archived account." })
  @ApiParam({ name: "id", description: "Account id" })
  @ApiResponse({ status: 200, description: "Account restored." })
  @ApiResponse({ status: 400, description: "Account is not archived." })
  @ApiResponse({ status: 404, description: "Account not found." })
  unarchiveAccount(@Param("id") id: string) {
    return this.service.unarchiveAccount(id);
  }
}
