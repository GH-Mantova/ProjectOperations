import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ContactsService, ORG_TYPES } from "./contacts.service";

/**
 * Query parameters for `GET /contacts`. All fields are optional. `search`
 * does a case-insensitive substring match across `firstName` / `lastName`
 * / `email`. `organisationType` is validated against {@link ORG_TYPES}.
 * Pagination defaults to page 1, limit 25 (capped at 100 server-side).
 */
class ListContactsQueryDto {
  @IsOptional() @IsString() @IsIn(ORG_TYPES as unknown as string[]) organisationType?: string;
  @IsOptional() @IsString() organisationId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

/**
 * Payload for `POST /contacts`. `organisationType`, `organisationId`,
 * `firstName`, and `lastName` are required. Setting `isPrimary = true`
 * demotes the existing primary contact on the same organisation in the
 * same transaction.
 */
class CreateContactDto {
  @IsString() @IsIn(ORG_TYPES as unknown as string[]) organisationType!: string;
  @IsString() organisationId!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() mobile?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isAccountsContact?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() hasPortalAccess?: boolean;
  @IsOptional() @IsString() notes?: string | null;

  @ApiPropertyOptional({ description: "CC this contact on invoice/quote emails sent to their organisation." })
  @IsOptional() @IsBoolean() includeInInvoiceEmails?: boolean;
}

/**
 * Payload for `PATCH /contacts/:id`. All fields are optional. Supplying
 * `organisationType` AND `organisationId` together reassigns the contact
 * to a new owning organisation (see PR D FIX 3) — both fields must be
 * present for the move to take effect.
 */
class UpdateContactDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() mobile?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isAccountsContact?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() hasPortalAccess?: boolean;
  @IsOptional() @IsString() notes?: string | null;

  @ApiPropertyOptional({ description: "CC this contact on invoice/quote emails sent to their organisation." })
  @IsOptional() @IsBoolean() includeInInvoiceEmails?: boolean;
  // PR D FIX 3 — reassign a contact between organisations. Both fields
  // must be supplied together for the move to take effect.
  @IsOptional() @IsString() @IsIn(ORG_TYPES as unknown as string[]) organisationType?: string;
  @IsOptional() @IsString() organisationId?: string;
}

/**
 * HTTP surface for the cross-organisation polymorphic Contact CRUD — list,
 * get, create, patch, and soft-delete contacts that may be anchored to a
 * CLIENT, SUBCONTRACTOR, or SUPPLIER.
 *
 * All routes are protected by JWT + the `PermissionsGuard`. Read routes
 * require `directory.view`; mutating routes require `directory.manage`.
 * Routes are thin delegators to {@link ContactsService}; the service layer
 * owns validation, primary-contact uniqueness, and contact reassignment
 * across organisations.
 */
@ApiTags("Contacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("contacts")
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  /** Paginated list of contacts across CLIENT / SUBCONTRACTOR / SUPPLIER, with filters and search. */
  @Get()
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "List contacts across CLIENT, SUBCONTRACTOR, SUPPLIER organisations." })
  @ApiQuery({ name: "organisationType", required: false })
  @ApiQuery({ name: "organisationId", required: false })
  @ApiQuery({ name: "isActive", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  list(@Query() q: ListContactsQueryDto) {
    return this.service.list(q);
  }

  /** Fetch a single contact by id, or 404. */
  @Get(":id")
  @RequirePermissions("directory.view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  /** Create a contact under a CLIENT / SUBCONTRACTOR / SUPPLIER; `isPrimary` demotes existing primary on the same parent. */
  @Post()
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a contact. Setting isPrimary=true unsets existing primary." })
  @ApiResponse({ status: 201, description: "Contact created." })
  create(@Body() dto: CreateContactDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto as never, actor.sub);
  }

  /** Patch a contact; supplying `organisationType` + `organisationId` together reassigns it to a different organisation. */
  @Patch(":id")
  @RequirePermissions("directory.manage")
  update(@Param("id") id: string, @Body() dto: UpdateContactDto) {
    return this.service.update(id, dto as never);
  }

  /** Soft-delete by flipping `isActive` to false; row preserved for historical references. */
  @Delete(":id")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Soft delete — sets isActive=false." })
  remove(@Param("id") id: string) {
    return this.service.softDelete(id);
  }
}
