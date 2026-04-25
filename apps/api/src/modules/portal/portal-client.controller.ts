import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PortalClientService } from "./portal-client.service";
import { PortalJwtGuard } from "./portal-jwt.guard";
import { PortalUser } from "./portal-user.decorator";
import type { PortalUserPayload } from "./portal-auth.types";

@ApiTags("portal-client")
@UseGuards(PortalJwtGuard)
@Controller("portal/client")
export class PortalClientController {
  constructor(private readonly service: PortalClientService) {}

  @ApiOperation({ summary: "Portal dashboard counts" })
  @Get("dashboard")
  dashboard(@PortalUser() user: PortalUserPayload) {
    return this.service.getDashboard(user.clientId);
  }

  @ApiOperation({ summary: "List projects for the portal client" })
  @Get("projects")
  projects(@PortalUser() user: PortalUserPayload) {
    return this.service.listProjects(user.clientId);
  }

  @ApiOperation({ summary: "Get a single project (scoped to client)" })
  @Get("projects/:id")
  project(@PortalUser() user: PortalUserPayload, @Param("id") id: string) {
    return this.service.getProject(user.clientId, id);
  }

  @ApiOperation({ summary: "List jobs for the portal client" })
  @Get("jobs")
  jobs(@PortalUser() user: PortalUserPayload) {
    return this.service.listJobs(user.clientId);
  }

  @ApiOperation({ summary: "List quotes for the portal client" })
  @Get("quotes")
  quotes(@PortalUser() user: PortalUserPayload) {
    return this.service.listQuotes(user.clientId);
  }

  @ApiOperation({ summary: "List documents for the portal client" })
  @Get("documents")
  documents(@PortalUser() user: PortalUserPayload) {
    return this.service.listDocuments(user.clientId);
  }

  @ApiOperation({ summary: "Get the portal user's account details" })
  @Get("account")
  account(@PortalUser() user: PortalUserPayload) {
    return this.service.getAccount(user.sub);
  }
}
