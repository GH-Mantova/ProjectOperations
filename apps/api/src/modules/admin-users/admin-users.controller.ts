import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { AdminUsersService } from "./admin-users.service";

class CreateUserDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;
  @IsString() roleId!: string;
  @IsString() @MinLength(8) temporaryPassword!: string;
  @IsOptional() @IsBoolean() forcePasswordReset?: boolean;
  @IsOptional() @IsBoolean() isSuperUser?: boolean;
}

class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isSuperUser?: boolean;
}

// Declarative permission gates layered on top of the service-side tier check
// (defence-in-depth). Codes reused from the /users controller so the two
// user-management surfaces gate on the same registry entries — no new codes.
// `deactivate` and `resetPassword` are user-state mutations, so both take
// `users.update`; there is no separate `users.delete` in the registry.
@ApiTags("Admin Users")
@ApiBearerAuth()
@Controller("admin/users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @RequirePermissions("users.view")
  @ApiOperation({
    summary:
      "List users visible to the caller. Super Users see everyone; Admins see everyone except Admins and Super Users; others are 403."
  })
  @ApiResponse({ status: 403, description: "Caller is neither Admin nor Super User." })
  list(@CurrentUser() actor: { sub: string }) {
    return this.service.list(actor.sub);
  }

  @Post()
  @RequirePermissions("users.create")
  @ApiOperation({
    summary:
      "Create a user. Admins cannot assign the Admin role; only Super Users can create other Super Users."
  })
  @ApiResponse({ status: 409, description: "Email already exists." })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(actor.sub, dto);
  }

  @Patch(":userId")
  @RequirePermissions("users.update")
  @ApiOperation({
    summary:
      "Update a user. Admins cannot modify Admins / Super Users. Cannot deactivate your own account."
  })
  @ApiResponse({ status: 200, description: "Update a user. Admins cannot modify Admins / Super Users. Cannot deactivate your own account." })
  update(
    @Param("userId") userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.update(actor.sub, userId, dto);
  }

  @Delete(":userId")
  @RequirePermissions("users.update")
  @ApiOperation({ summary: "Soft-delete (deactivate) a user. Same tier rules as PATCH." })
  @ApiResponse({ status: 200, description: "Soft-delete (deactivate) a user. Same tier rules as PATCH." })
  deactivate(@Param("userId") userId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deactivate(actor.sub, userId);
  }

  @Post(":userId/reset-password")
  @RequirePermissions("users.update")
  @ApiOperation({
    summary:
      "Reset password for a user — generates a temp password and forces reset on next login."
  })
  @ApiParam({ name: "userId", description: "The target user's id" })
  @ApiResponse({ status: 201, description: "Temp password returned. Communicate out of band." })
  @ApiResponse({ status: 400, description: "Cannot reset your own password via this endpoint." })
  @ApiResponse({ status: 403, description: "Insufficient permission to reset this user." })
  @ApiResponse({ status: 404, description: "User not found or inactive." })
  async resetPassword(@Param("userId") userId: string, @CurrentUser() actor: { sub: string }) {
    const result = await this.service.resetPassword(actor.sub, userId);
    return {
      ...result,
      message:
        "Communicate this password to the user out of band. They will be forced to reset it on their next login."
    };
  }
}
