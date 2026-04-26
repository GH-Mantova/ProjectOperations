import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { MasterDataQueryDto } from "./dto/master-data-query.dto";
import {
  UpsertAssetDto,
  UpsertClientDto,
  UpsertCompetencyDto,
  UpsertContactDto,
  UpsertCrewDto,
  UpsertLookupValueDto,
  UpsertResourceTypeDto,
  UpsertSiteDto,
  UpsertWorkerCompetencyDto,
  UpsertWorkerDto
} from "./dto/master-data.dto";
import { MasterDataService } from "./master-data.service";

@ApiTags("Master Data")
@ApiBearerAuth()
@Controller("master-data")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get("clients") @RequirePermissions("masterdata.view") listClients(@Query() q: MasterDataQueryDto) { return this.service.listClients(q); }
  @Post("clients") @RequirePermissions("masterdata.manage") createClient(@Body() dto: UpsertClientDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertClient(undefined, dto, actor.sub); }
  @Patch("clients/:id") @RequirePermissions("masterdata.manage") updateClient(@Param("id") id: string, @Body() dto: UpsertClientDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertClient(id, dto, actor.sub); }

  @Get("contacts") @RequirePermissions("masterdata.view") listContacts(@Query() q: MasterDataQueryDto) { return this.service.listContacts(q); }
  @Post("contacts") @RequirePermissions("masterdata.manage") createContact(@Body() dto: UpsertContactDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertContact(undefined, dto, actor.sub); }
  @Patch("contacts/:id") @RequirePermissions("masterdata.manage") updateContact(@Param("id") id: string, @Body() dto: UpsertContactDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertContact(id, dto, actor.sub); }

  @Get("sites") @RequirePermissions("masterdata.view") listSites(@Query() q: MasterDataQueryDto) { return this.service.listSites(q); }
  @Get("sites/:id") @RequirePermissions("masterdata.view") @ApiOperation({ summary: "Get a site with its linked tenders and projects." }) getSite(@Param("id") id: string) { return this.service.getSite(id); }
  @Post("sites") @RequirePermissions("masterdata.manage") createSite(@Body() dto: UpsertSiteDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertSite(undefined, dto, actor.sub); }
  @Patch("sites/:id") @RequirePermissions("masterdata.manage") updateSite(@Param("id") id: string, @Body() dto: UpsertSiteDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertSite(id, dto, actor.sub); }

  @Get("resource-types") @RequirePermissions("masterdata.view") listResourceTypes(@Query() q: MasterDataQueryDto) { return this.service.listResourceTypes(q); }
  @Post("resource-types") @RequirePermissions("masterdata.manage") createResourceType(@Body() dto: UpsertResourceTypeDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertResourceType(undefined, dto, actor.sub); }
  @Patch("resource-types/:id") @RequirePermissions("masterdata.manage") updateResourceType(@Param("id") id: string, @Body() dto: UpsertResourceTypeDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertResourceType(id, dto, actor.sub); }

  @Get("competencies") @RequirePermissions("masterdata.view") listCompetencies(@Query() q: MasterDataQueryDto) { return this.service.listCompetencies(q); }
  @Post("competencies") @RequirePermissions("masterdata.manage") createCompetency(@Body() dto: UpsertCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCompetency(undefined, dto, actor.sub); }
  @Patch("competencies/:id") @RequirePermissions("masterdata.manage") updateCompetency(@Param("id") id: string, @Body() dto: UpsertCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCompetency(id, dto, actor.sub); }

  @Get("workers") @RequirePermissions("masterdata.view") listWorkers(@Query() q: MasterDataQueryDto) { return this.service.listWorkers(q); }
  @Post("workers") @RequirePermissions("masterdata.manage") createWorker(@Body() dto: UpsertWorkerDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorker(undefined, dto, actor.sub); }
  @Patch("workers/:id") @RequirePermissions("masterdata.manage") updateWorker(@Param("id") id: string, @Body() dto: UpsertWorkerDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorker(id, dto, actor.sub); }

  @Get("crews") @RequirePermissions("masterdata.view") listCrews(@Query() q: MasterDataQueryDto) { return this.service.listCrews(q); }
  @Post("crews") @RequirePermissions("masterdata.manage") createCrew(@Body() dto: UpsertCrewDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCrew(undefined, dto, actor.sub); }
  @Patch("crews/:id") @RequirePermissions("masterdata.manage") updateCrew(@Param("id") id: string, @Body() dto: UpsertCrewDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCrew(id, dto, actor.sub); }

  @Get("assets") @RequirePermissions("masterdata.view") listAssets(@Query() q: MasterDataQueryDto) { return this.service.listAssets(q); }
  @Post("assets") @RequirePermissions("masterdata.manage") createAsset(@Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertAsset(undefined, dto, actor.sub); }
  @Patch("assets/:id") @RequirePermissions("masterdata.manage") updateAsset(@Param("id") id: string, @Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertAsset(id, dto, actor.sub); }

  @Get("worker-competencies") @RequirePermissions("masterdata.view") listWorkerCompetencies(@Query() q: MasterDataQueryDto) { return this.service.listWorkerCompetencies(q); }
  @Post("worker-competencies") @RequirePermissions("masterdata.manage") createWorkerCompetency(@Body() dto: UpsertWorkerCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorkerCompetency(undefined, dto, actor.sub); }
  @Patch("worker-competencies/:id") @RequirePermissions("masterdata.manage") updateWorkerCompetency(@Param("id") id: string, @Body() dto: UpsertWorkerCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorkerCompetency(id, dto, actor.sub); }

  @Get("lookup-values") @RequirePermissions("masterdata.view") listLookupValues(@Query() q: MasterDataQueryDto) { return this.service.listLookupValues(q); }
  @Post("lookup-values") @RequirePermissions("masterdata.manage") createLookupValue(@Body() dto: UpsertLookupValueDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertLookupValue(undefined, dto, actor.sub); }
  @Patch("lookup-values/:id") @RequirePermissions("masterdata.manage") updateLookupValue(@Param("id") id: string, @Body() dto: UpsertLookupValueDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertLookupValue(id, dto, actor.sub); }

  @Get("references")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "Reference data for master-data forms" })
  async references() {
    const [clients, resourceTypes, competencies, workers] = await Promise.all([
      this.service.listClients({ page: 1, pageSize: 100 }),
      this.service.listResourceTypes({ page: 1, pageSize: 100 }),
      this.service.listCompetencies({ page: 1, pageSize: 100 }),
      this.service.listWorkers({ page: 1, pageSize: 100 })
    ]);

    return {
      clients: clients.items,
      resourceTypes: resourceTypes.items,
      competencies: competencies.items,
      workers: workers.items
    };
  }
}
