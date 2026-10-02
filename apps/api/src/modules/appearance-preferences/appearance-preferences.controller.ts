import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { AppearancePreferencesService } from "./appearance-preferences.service";

class UpdateAppearancePreferenceDto {
  @IsOptional()
  @IsIn(["comfortable", "compact"])
  density?: string;

  /**
   * null clears the personal choice (falls back to the company theme).
   * A non-null string must be an existing BrandColorScheme.id.
   */
  @IsOptional()
  @IsString()
  colourSchemeId?: string | null;
}

/**
 * Self-only appearance preferences.
 * Any authenticated user may read and update their own row.
 * Guard: JwtAuthGuard only (no permission code needed -- self-only endpoint).
 */
@ApiTags("Appearance Preferences")
@ApiBearerAuth()
@Controller("appearance-preferences")
@UseGuards(JwtAuthGuard)
export class AppearancePreferencesController {
  constructor(private readonly service: AppearancePreferencesService) {}

  @Get("me")
  @ApiOperation({
    summary:
      "Return the current user's display density and colour scheme preference. " +
      "Returns defaults if no preference has been saved."
  })
  getMe(@CurrentUser() actor: { sub: string }) {
    return this.service.getForUser(actor.sub);
  }

  @Put("me")
  @ApiOperation({
    summary:
      "Update the current user's display density and/or colour scheme preference. " +
      "colourSchemeId: null clears the choice and reverts to the company theme."
  })
  putMe(
    @CurrentUser() actor: { sub: string },
    @Body() dto: UpdateAppearancePreferenceDto
  ) {
    return this.service.updateForUser(actor.sub, dto);
  }
}
