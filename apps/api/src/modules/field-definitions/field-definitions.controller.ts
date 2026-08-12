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
import { FieldAppliesTo } from "@prisma/client";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { FieldDefinitionsService } from "./field-definitions.service";
import { CreateFieldDefinitionDto } from "./dto/create-field-definition.dto";
import { UpdateFieldDefinitionDto } from "./dto/update-field-definition.dto";

@ApiTags("Field Definitions")
@ApiBearerAuth()
@Controller("field-definitions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FieldDefinitionsController {
  constructor(private readonly service: FieldDefinitionsService) {}

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List field definitions, optionally filtered by appliesTo." })
  @ApiQuery({ name: "appliesTo", enum: FieldAppliesTo, required: false })
  @ApiResponse({ status: 200, description: "Array of FieldDefinition." })
  list(@Query("appliesTo") appliesTo?: FieldAppliesTo) {
    return this.service.list(appliesTo);
  }

  @Get(":id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Get a single FieldDefinition by id." })
  @ApiResponse({ status: 200, description: "FieldDefinition." })
  @ApiResponse({ status: 404, description: "Not found." })
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Create a custom field definition (source forced to CUSTOM)." })
  @ApiResponse({ status: 201, description: "Created FieldDefinition." })
  create(@Body() dto: CreateFieldDefinitionDto) {
    return this.service.createCustom(dto);
  }

  @Patch(":id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update mutable fields (label, group, sortOrder, visible, required). key/source/appliesTo are immutable." })
  @ApiResponse({ status: 200, description: "Updated FieldDefinition." })
  @ApiResponse({ status: 400, description: "Immutable field mutation attempted." })
  @ApiResponse({ status: 404, description: "Not found." })
  update(@Param("id") id: string, @Body() dto: UpdateFieldDefinitionDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a CUSTOM field definition. Returns 400 for BUILTIN fields (hide instead)." })
  @ApiResponse({ status: 200, description: "Deleted FieldDefinition." })
  @ApiResponse({ status: 400, description: "Cannot delete BUILTIN field." })
  @ApiResponse({ status: 404, description: "Not found." })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
