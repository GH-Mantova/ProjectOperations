import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { WeatherService, type WeatherResponse } from "./weather.service";

/**
 * Weather proxy endpoint powering the "Site weather" dashboard widget.
 * The browser NEVER talks to Open-Meteo directly — it hits this route,
 * which caches upstream results and shields the client from third-party
 * outages. Every authenticated user can call it; there's no per-site
 * permission gate because weather is not sensitive.
 */
@ApiTags("Dashboards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboards/weather")
export class WeatherController {
  constructor(private readonly service: WeatherService) {}

  @Get("site/:siteId")
  @ApiOperation({ summary: "Current conditions + 5-day outlook for a site (Open-Meteo proxy)." })
  @ApiResponse({
    status: 200,
    description:
      "{ site, current, forecast[] } on success; { unavailable: true, site, reason } when Open-Meteo is down or the site cannot be resolved."
  })
  @ApiResponse({ status: 404, description: "Site not found." })
  getSiteWeather(@Param("siteId") siteId: string): Promise<WeatherResponse> {
    return this.service.getSiteWeather(siteId);
  }
}
