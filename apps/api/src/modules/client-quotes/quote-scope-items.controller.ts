import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { QuoteScopeItemsService } from "./quote-scope-items.service";

class UpsertQuoteScopeItemDto {
  @IsOptional() @IsString() sourceItemId?: string | null;
  @IsOptional() @IsString() sourceItemType?: string | null;
  @IsOptional() @IsString() label?: string | null;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() qty?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class ReorderEntry {
  @IsString() itemId!: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
}
class ReorderDto {
  @IsArray() order!: ReorderEntry[];
}

@ApiTags("Quote Scope Items")
@ApiBearerAuth()
@Controller("tenders/:tenderId/quotes/:quoteId/scope-items")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuoteScopeItemsController {
  constructor(private readonly service: QuoteScopeItemsService) {}

  @Get()
  @RequirePermissions("tenders.view")
  list(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.list(tenderId, quoteId);
  }

  @Post()
  @RequirePermissions("tenders.manage")
  create(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertQuoteScopeItemDto
  ) {
    return this.service.create(tenderId, quoteId, dto);
  }

  @Patch(":itemId")
  @RequirePermissions("tenders.manage")
  update(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertQuoteScopeItemDto
  ) {
    return this.service.update(tenderId, quoteId, itemId, dto);
  }

  @Delete(":itemId")
  @RequirePermissions("tenders.manage")
  remove(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("itemId") itemId: string
  ) {
    return this.service.remove(tenderId, quoteId, itemId);
  }

  @Post("reorder")
  @RequirePermissions("tenders.manage")
  reorder(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: ReorderDto
  ) {
    return this.service.reorder(tenderId, quoteId, dto.order);
  }

  @Post("reset")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Wipe the quote's scope items and rebuild from current scope+waste+cutting." })
  reset(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.rebuild(tenderId, quoteId, "reset");
  }

  @Post("push-from-scope")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Append any scope/cutting/waste rows not already linked to this quote." })
  push(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.rebuild(tenderId, quoteId, "push");
  }
}
