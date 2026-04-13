import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AssetsService } from "./assets.service";
import { AssetsQueryDto, UpsertAssetCategoryDto, UpsertAssetDto } from "./dto/assets.dto";

@ApiTags("Assets")
@ApiBearerAuth()
@Controller("assets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get("categories")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "List asset categories" })
  listCategories() {
    return this.service.listCategories();
  }

  @Post("categories")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Create asset category" })
  createCategory(@Body() dto: UpsertAssetCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(undefined, dto, actor.sub);
  }

  @Patch("categories/:id")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Update asset category" })
  updateCategory(@Param("id") id: string, @Body() dto: UpsertAssetCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(id, dto, actor.sub);
  }

  @Get()
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "List assets with assignment visibility" })
  listAssets(@Query() query: AssetsQueryDto) {
    return this.service.listAssets(query);
  }

  @Get(":id")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "Get asset detail including job and shift visibility" })
  getAsset(@Param("id") id: string) {
    return this.service.getAsset(id);
  }

  @Post()
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Create asset" })
  createAsset(@Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(undefined, dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Update asset" })
  updateAsset(@Param("id") id: string, @Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(id, dto, actor.sub);
  }
}
