import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { ApiKeysService, type KeyScope } from "./api-keys.service";
import {
  CreateApiCredentialDto,
  ReorderApiCredentialsDto,
  UpdateApiCredentialDto
} from "./dto/api-credential.dto";
import {
  CreateApiKeyTypeDto,
  UpdateApiKeyTypeDto
} from "./dto/api-key-type.dto";

// SLICE-4a — Vault management REST API. All routes are behind JWT auth. Per-
// route permission enforcement is duplicated in ApiKeysService (§6.4 defence
// in depth). NO route ever returns a decrypted key value (§6.2 — full stop).
@ApiTags("API Keys")
@ApiBearerAuth()
@Controller("api-keys")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  // ── Credentials ───────────────────────────────────────────────────

  @Get("credentials")
  @ApiOperation({
    summary:
      "List ApiCredential rows. scope=company requires super-user + platform.admin. scope=user returns the caller's own rows (super-users may audit other users' status-only)."
  })
  @ApiResponse({ status: 200, description: "Array of credential summaries — never includes plaintext or ciphertext." })
  async listCredentials(
    @CurrentUser() actor: AuthenticatedUser,
    @Query("scope") scope?: string
  ) {
    const s = this.assertScope(scope ?? "company");
    return this.service.listCredentials(s, actor);
  }

  @Post("credentials")
  @ApiOperation({
    summary:
      "Create an ApiCredential. Encrypts the key immediately; runs per-type validation and stamps validatedAt on success."
  })
  @ApiResponse({ status: 201, description: "Credential summary (no plaintext key ever returned)." })
  async createCredential(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateApiCredentialDto
  ) {
    return this.service.createCredential(dto, actor);
  }

  @Patch("credentials/:id")
  @ApiOperation({
    summary:
      "Update name/type/enabled/order/config, and rotate the key if `key` is supplied. Rotation re-encrypts and clears validatedAt."
  })
  @ApiResponse({ status: 200, description: "Updated credential summary." })
  async updateCredential(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateApiCredentialDto
  ) {
    return this.service.updateCredential(id, dto, actor);
  }

  @Post("credentials/reorder")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Reorder company-scope credentials. The nth id in `ids` receives `order = n+1`. Used by the geocoding chain."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async reorderCredentials(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderApiCredentialsDto
  ) {
    if (!Array.isArray(dto.ids)) {
      throw new BadRequestException("`ids` must be an array of credential ids.");
    }
    return this.service.reorderCredentials(dto.ids, actor);
  }

  @Delete("credentials/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Delete an ApiCredential row. User rows are self-only." })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async deleteCredential(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string
  ) {
    return this.service.deleteCredential(id, actor);
  }

  @Post("credentials/:id/test")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Run per-type validation for the stored key. Never returns the key. On success, stamps validatedAt."
  })
  @ApiResponse({ status: 200, description: "{ ok, validatedAt?, reason? }." })
  async testCredential(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string
  ) {
    return this.service.testCredential(id, actor);
  }

  // ── ApiKeyType (Manage Types) ─────────────────────────────────────

  @Get("types")
  @ApiOperation({ summary: "List ApiKeyType rows (id/name/description/systemKind/credentialCount)." })
  @ApiResponse({ status: 200, description: "Array of type summaries." })
  async listTypes() {
    return this.service.listTypes();
  }

  @Post("types")
  @ApiOperation({
    summary:
      "Create a new user-defined ApiKeyType. systemKind is always null on user-created types (only seeded types have a systemKind)."
  })
  @ApiResponse({ status: 201, description: "Type summary." })
  async createType(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateApiKeyTypeDto
  ) {
    return this.service.createType(dto, actor);
  }

  @Patch("types/:id")
  @ApiOperation({
    summary:
      "Rename / update description of an ApiKeyType. Renames cascade automatically because credentials reference typeId, not the name."
  })
  @ApiResponse({ status: 200, description: "Updated type summary." })
  async updateType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateApiKeyTypeDto
  ) {
    return this.service.updateType(id, dto, actor);
  }

  @Delete("types/:id")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Delete an ApiKeyType. Returns 409 while any ApiCredential references it — reassign first."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async deleteType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string
  ) {
    return this.service.deleteType(id, actor);
  }

  private assertScope(raw: string): KeyScope {
    if (raw !== "company" && raw !== "user") {
      throw new ForbiddenException(`Unknown scope '${raw}'. Expected 'company' or 'user'.`);
    }
    return raw;
  }
}
