import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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

/**
 * HTTP surface for the master-data module — REST routes for clients, contacts,
 * sites, resource types, competencies, workers, crews, assets, worker-competencies,
 * and lookup values.
 *
 * All routes are protected by JWT + the `PermissionsGuard`. Read routes require
 * `masterdata.view`; mutating routes require `masterdata.manage`. Each handler
 * is a thin delegator to {@link MasterDataService}; the service layer owns
 * validation, audit, and any non-trivial business logic.
 */
@ApiTags("Master Data")
@ApiBearerAuth()
@Controller("master-data")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  /** Paginated list of clients (with sites + polymorphic contacts hydrated). */
  @Get("clients")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List clients." })
  @ApiResponse({ status: 200, description: "Paginated clients." })
  listClients(@Query() q: MasterDataQueryDto) { return this.service.listClients(q); }
  /** Create a new client; rejects duplicate names and partial payment-terms pairs. */
  @Post("clients")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a client." })
  @ApiResponse({ status: 201, description: "Client created." })
  createClient(@Body() dto: UpsertClientDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertClient(undefined, dto, actor.sub); }
  /** Patch an existing client by id; same invariants as create. */
  @Patch("clients/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a client." })
  @ApiResponse({ status: 200, description: "Updated client." })
  @ApiResponse({ status: 404, description: "Client not found." })
  updateClient(@Param("id") id: string, @Body() dto: UpsertClientDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertClient(id, dto, actor.sub); }

  /** Paginated list of CLIENT-owned contacts (optionally filtered by `clientId`). */
  @Get("contacts")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List contacts." })
  @ApiResponse({ status: 200, description: "Paginated contacts." })
  listContacts(@Query() q: MasterDataQueryDto) { return this.service.listContacts(q); }
  /** Create a contact anchored to a client via polymorphic organisation key. */
  @Post("contacts")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a contact." })
  @ApiResponse({ status: 201, description: "Contact created." })
  createContact(@Body() dto: UpsertContactDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertContact(undefined, dto, actor.sub); }
  /** Patch an existing contact by id. */
  @Patch("contacts/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a contact." })
  @ApiResponse({ status: 200, description: "Updated contact." })
  @ApiResponse({ status: 404, description: "Contact not found." })
  updateContact(@Param("id") id: string, @Body() dto: UpsertContactDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertContact(id, dto, actor.sub); }

  /** Paginated list of sites with their owning client. */
  @Get("sites")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List sites." })
  @ApiResponse({ status: 200, description: "Paginated sites." })
  listSites(@Query() q: MasterDataQueryDto) { return this.service.listSites(q); }
  /** Get one site with its linked tenders + de-duplicated projects, or 404. */
  @Get("sites/:id")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "Get a site with its linked tenders and projects." })
  @ApiResponse({ status: 200, description: "Site with its linked tenders and projects." })
  @ApiResponse({ status: 404, description: "Site not found." })
  getSite(@Param("id") id: string) { return this.service.getSite(id); }
  /** Create a site; rejects duplicate names. */
  @Post("sites")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a site." })
  @ApiResponse({ status: 201, description: "Site created." })
  createSite(@Body() dto: UpsertSiteDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertSite(undefined, dto, actor.sub); }
  /** Patch an existing site by id; rejects renames that collide. */
  @Patch("sites/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a site." })
  @ApiResponse({ status: 200, description: "Updated site." })
  @ApiResponse({ status: 404, description: "Site not found." })
  updateSite(@Param("id") id: string, @Body() dto: UpsertSiteDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertSite(id, dto, actor.sub); }
  /** Delete a site; refuses (409) if linked tenders, jobs, or form submissions exist. */
  @Delete("sites/:id")
  @RequirePermissions("masterdata.manage")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a site (refuses if linked tenders, jobs, or form submissions exist)." })
  @ApiResponse({ status: 204, description: "Site deleted" })
  @ApiResponse({ status: 404, description: "Site not found" })
  @ApiResponse({ status: 409, description: "Site has linked tenders, jobs, or form submissions" })
  deleteSite(@Param("id") id: string, @CurrentUser() actor: { sub: string }) { return this.service.deleteSite(id, actor.sub); }

  /** Paginated list of resource types. */
  @Get("resource-types")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List resource types." })
  @ApiResponse({ status: 200, description: "Paginated resource types." })
  listResourceTypes(@Query() q: MasterDataQueryDto) { return this.service.listResourceTypes(q); }
  /** Create a resource type. */
  @Post("resource-types")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a resource type." })
  @ApiResponse({ status: 201, description: "Resource type created." })
  createResourceType(@Body() dto: UpsertResourceTypeDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertResourceType(undefined, dto, actor.sub); }
  /** Patch an existing resource type by id. */
  @Patch("resource-types/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a resource type." })
  @ApiResponse({ status: 200, description: "Updated resource type." })
  @ApiResponse({ status: 404, description: "Resource type not found." })
  updateResourceType(@Param("id") id: string, @Body() dto: UpsertResourceTypeDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertResourceType(id, dto, actor.sub); }

  /** Paginated list of competencies with their worker-competency rows included. */
  @Get("competencies")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List competencies." })
  @ApiResponse({ status: 200, description: "Paginated competencies." })
  listCompetencies(@Query() q: MasterDataQueryDto) { return this.service.listCompetencies(q); }
  /** Create a competency definition. */
  @Post("competencies")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a competency." })
  @ApiResponse({ status: 201, description: "Competency created." })
  createCompetency(@Body() dto: UpsertCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCompetency(undefined, dto, actor.sub); }
  /** Patch an existing competency by id. */
  @Patch("competencies/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a competency." })
  @ApiResponse({ status: 200, description: "Updated competency." })
  @ApiResponse({ status: 404, description: "Competency not found." })
  updateCompetency(@Param("id") id: string, @Body() dto: UpsertCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCompetency(id, dto, actor.sub); }

  /** Paginated list of workers with resource type + competency assignments. */
  @Get("workers")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List workers." })
  @ApiResponse({ status: 200, description: "Paginated workers." })
  listWorkers(@Query() q: MasterDataQueryDto) { return this.service.listWorkers(q); }
  /** Create a worker record. */
  @Post("workers")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a worker." })
  @ApiResponse({ status: 201, description: "Worker created." })
  createWorker(@Body() dto: UpsertWorkerDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorker(undefined, dto, actor.sub); }
  /** Patch an existing worker by id. */
  @Patch("workers/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a worker." })
  @ApiResponse({ status: 200, description: "Updated worker." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  updateWorker(@Param("id") id: string, @Body() dto: UpsertWorkerDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorker(id, dto, actor.sub); }

  /** Paginated list of crews with their members. */
  @Get("crews")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List crews." })
  @ApiResponse({ status: 200, description: "Paginated crews." })
  listCrews(@Query() q: MasterDataQueryDto) { return this.service.listCrews(q); }
  /** Create a crew (and optionally seed its initial member list). */
  @Post("crews")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a crew." })
  @ApiResponse({ status: 201, description: "Crew created." })
  createCrew(@Body() dto: UpsertCrewDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCrew(undefined, dto, actor.sub); }
  /** Patch a crew by id; supplying `workerIds` replaces the membership wholesale. */
  @Patch("crews/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a crew." })
  @ApiResponse({ status: 200, description: "Updated crew." })
  @ApiResponse({ status: 404, description: "Crew not found." })
  updateCrew(@Param("id") id: string, @Body() dto: UpsertCrewDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertCrew(id, dto, actor.sub); }

  /** Paginated list of assets with their resource type. */
  @Get("assets")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List assets." })
  @ApiResponse({ status: 200, description: "Paginated assets." })
  listAssets(@Query() q: MasterDataQueryDto) { return this.service.listAssets(q); }
  /** Create an asset. */
  @Post("assets")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create an asset." })
  @ApiResponse({ status: 201, description: "Asset created." })
  createAsset(@Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertAsset(undefined, dto, actor.sub); }
  /** Patch an existing asset by id. */
  @Patch("assets/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update an asset." })
  @ApiResponse({ status: 200, description: "Updated asset." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  updateAsset(@Param("id") id: string, @Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertAsset(id, dto, actor.sub); }

  /** Paginated list of worker-competency assignments (newest first). */
  @Get("worker-competencies")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List worker-competency assignments." })
  @ApiResponse({ status: 200, description: "Paginated worker-competency assignments." })
  listWorkerCompetencies(@Query() q: MasterDataQueryDto) { return this.service.listWorkerCompetencies(q); }
  /** Assign a competency to a worker; coerces date strings into Date columns. */
  @Post("worker-competencies")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Assign a competency to a worker." })
  @ApiResponse({ status: 201, description: "Worker-competency assignment created." })
  createWorkerCompetency(@Body() dto: UpsertWorkerCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorkerCompetency(undefined, dto, actor.sub); }
  /** Patch a worker-competency assignment by id. */
  @Patch("worker-competencies/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a worker-competency assignment." })
  @ApiResponse({ status: 200, description: "Updated worker-competency assignment." })
  @ApiResponse({ status: 404, description: "Worker-competency assignment not found." })
  updateWorkerCompetency(@Param("id") id: string, @Body() dto: UpsertWorkerCompetencyDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertWorkerCompetency(id, dto, actor.sub); }

  /** Paginated list of lookup values ordered by category then sortOrder. */
  @Get("lookup-values")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "List lookup values." })
  @ApiResponse({ status: 200, description: "Paginated lookup values." })
  listLookupValues(@Query() q: MasterDataQueryDto) { return this.service.listLookupValues(q); }
  /** Create a lookup value. */
  @Post("lookup-values")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Create a lookup value." })
  @ApiResponse({ status: 201, description: "Lookup value created." })
  createLookupValue(@Body() dto: UpsertLookupValueDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertLookupValue(undefined, dto, actor.sub); }
  /** Patch a lookup value by id. */
  @Patch("lookup-values/:id")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({ summary: "Update a lookup value." })
  @ApiResponse({ status: 200, description: "Updated lookup value." })
  @ApiResponse({ status: 404, description: "Lookup value not found." })
  updateLookupValue(@Param("id") id: string, @Body() dto: UpsertLookupValueDto, @CurrentUser() actor: { sub: string }) { return this.service.upsertLookupValue(id, dto, actor.sub); }

  /**
   * Bundle the first 100 clients, resource types, competencies, and workers
   * into one payload so master-data forms can populate their selects with a
   * single round-trip instead of four list calls. The 100-row cap is a
   * deliberate UI shortcut — beyond that, callers should hit the individual
   * paginated endpoints.
   */
  @Get("references")
  @RequirePermissions("masterdata.view")
  @ApiOperation({ summary: "Reference data for master-data forms" })
  @ApiResponse({ status: 200, description: "Reference data for master-data forms." })
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
