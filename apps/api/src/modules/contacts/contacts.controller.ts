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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ContactsService, ORG_TYPES } from "./contacts.service";

class ListContactsQueryDto {
  @IsOptional() @IsString() @IsIn(ORG_TYPES as unknown as string[]) organisationType?: string;
  @IsOptional() @IsString() organisationId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

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
}

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
  // PR D FIX 3 — reassign a contact between organisations. Both fields
  // must be supplied together for the move to take effect.
  @IsOptional() @IsString() @IsIn(ORG_TYPES as unknown as string[]) organisationType?: string;
  @IsOptional() @IsString() organisationId?: string;
}

@ApiTags("Contacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("contacts")
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

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

  @Get(":id")
  @RequirePermissions("directory.view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a contact. Setting isPrimary=true unsets existing primary." })
  @ApiResponse({ status: 201, description: "Contact created." })
  create(@Body() dto: CreateContactDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto as never, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("directory.manage")
  update(@Param("id") id: string, @Body() dto: UpdateContactDto) {
    return this.service.update(id, dto as never);
  }

  @Delete(":id")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Soft delete — sets isActive=false." })
  remove(@Param("id") id: string) {
    return this.service.softDelete(id);
  }
}
