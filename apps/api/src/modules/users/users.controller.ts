import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users.view")
  @ApiOperation({ summary: "List users" })
  list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @RequirePermissions("users.create")
  @ApiOperation({ summary: "Create a user" })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { sub: string }) {
    return this.usersService.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("users.update")
  @ApiOperation({ summary: "Update a user" })
  update(
    @Param("id") userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.usersService.update(userId, dto, actor.sub);
  }
}
