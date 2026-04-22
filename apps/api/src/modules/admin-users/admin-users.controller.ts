import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
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

@ApiTags("Admin Users")
@ApiBearerAuth()
@Controller("admin/users")
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary:
      "List users visible to the caller. Super Users see everyone; Admins see everyone except Admins and Super Users; others are 403."
  })
  @ApiResponse({ status: 403, description: "Caller is neither Admin nor Super User." })
  list(@CurrentUser() actor: { sub: string }) {
    return this.service.list(actor.sub);
  }

  @Post()
  @ApiOperation({
    summary:
      "Create a user. Admins cannot assign the Admin role; only Super Users can create other Super Users."
  })
  @ApiResponse({ status: 409, description: "Email already exists." })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(actor.sub, dto);
  }

  @Patch(":userId")
  @ApiOperation({
    summary:
      "Update a user. Admins cannot modify Admins / Super Users. Cannot deactivate your own account."
  })
  update(
    @Param("userId") userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.update(actor.sub, userId, dto);
  }

  @Delete(":userId")
  @ApiOperation({ summary: "Soft-delete (deactivate) a user. Same tier rules as PATCH." })
  deactivate(@Param("userId") userId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deactivate(actor.sub, userId);
  }
}
