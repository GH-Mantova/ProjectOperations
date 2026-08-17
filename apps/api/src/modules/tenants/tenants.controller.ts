import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { SuperUserGuard } from "../../common/auth/super-user.guard";
import { TenantsService } from "./tenants.service";

// ─── DTOs ────────────────────────────────────────────────────────────────────

class CreateTenantDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(50) code?: string;
}

class UpdateTenantDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(50) code?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class AssignUserDto {
  @IsString() userId!: string;
}

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * TenantsController — MT-5.
 *
 * All endpoints are guarded by JwtAuthGuard + SuperUserGuard.
 * Non-super-users cannot reach any of these routes.
 */
@ApiTags("Tenants")
@ApiBearerAuth()
@Controller("tenants")
@UseGuards(JwtAuthGuard, SuperUserGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @ApiOperation({ summary: "List all Tenant rows. Super-user only." })
  listTenants() {
    return this.service.listTenants();
  }

  @Post()
  @ApiOperation({ summary: "Create a new Tenant. Super-user only." })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.service.createTenant({ name: dto.name, code: dto.code });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partial-update a Tenant (name, code, isActive). Super-user only." })
  updateTenant(@Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.service.updateTenant(id, {
      name: dto.name,
      code: dto.code,
      isActive: dto.isActive
    });
  }

  @Get(":id/users")
  @ApiOperation({ summary: "List users assigned to a tenant (homeTenantId). Super-user only." })
  listTenantUsers(@Param("id") id: string) {
    return this.service.listTenantUsers(id);
  }

  @Patch(":id/assign-user")
  @ApiOperation({
    summary:
      "Set User.homeTenantId to :id. Validates user exists and is active. Super-user only."
  })
  assignUser(@Param("id") id: string, @Body() dto: AssignUserDto) {
    return this.service.assignUser(id, dto.userId);
  }
}
