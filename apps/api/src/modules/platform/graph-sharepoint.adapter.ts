import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientSecretCredential, TokenCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {
  EnsureFolderInput,
  EnsureFolderResult,
  SharePointAdapter,
  UploadFileInput,
  UploadFileResult
} from "./sharepoint.adapter";

type GraphDriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
  eTag?: string;
  parentReference?: { path?: string };
  ["@microsoft.graph.downloadUrl"]?: string;
};

@Injectable()
export class GraphSharePointAdapter implements SharePointAdapter {
  private readonly logger = new Logger(GraphSharePointAdapter.name);
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  async ensureFolder(input: EnsureFolderInput): Promise<EnsureFolderResult> {
    try {
      const client = this.getClient();
      const segments = input.relativePath.split("/").filter(Boolean);
      if (segments.length === 0) {
        throw new Error("relativePath must contain at least one segment.");
      }

      const parentPath = segments.slice(0, -1).join("/");
      const folderName = segments[segments.length - 1];
      const parentApi = parentPath
        ? `/sites/${input.siteId}/drives/${input.driveId}/root:/${encodeURI(parentPath)}:/children`
        : `/sites/${input.siteId}/drives/${input.driveId}/root/children`;

      const result = (await client.api(parentApi).post({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace"
      })) as GraphDriveItem;

      if (!result.id) {
        throw new Error("Graph ensureFolder returned no id.");
      }

      return {
        siteId: input.siteId,
        driveId: input.driveId,
        itemId: result.id,
        name: result.name ?? folderName,
        relativePath: input.relativePath
      };
    } catch (error) {
      this.logAndThrow("ensureFolder", error, {
        siteId: input.siteId,
        driveId: input.driveId,
        relativePath: input.relativePath
      });
    }
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    try {
      const client = this.getClient();
      const encodedName = encodeURIComponent(input.name);
      const api = `/sites/${input.siteId}/drives/${input.driveId}/items/${input.folderId}:/${encodedName}:/content`;
      const request = client.api(api);
      if (input.mimeType) {
        request.header("Content-Type", input.mimeType);
      }

      const result = (await request.put(input.content)) as GraphDriveItem;

      if (!result.id || !result.webUrl) {
        throw new Error("Graph uploadFile returned incomplete item.");
      }

      return {
        id: result.id,
        webUrl: result.webUrl,
        eTag: result.eTag ?? ""
      };
    } catch (error) {
      this.logAndThrow("uploadFile", error, {
        siteId: input.siteId,
        driveId: input.driveId,
        folderId: input.folderId,
        name: input.name
      });
    }
  }

  async getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }): Promise<string> {
    try {
      const client = this.getClient();
      const api = `/sites/${input.siteId}/drives/${input.driveId}/items/${input.fileId}`;
      const item = (await client.api(api).select("id,name,@microsoft.graph.downloadUrl").get()) as GraphDriveItem;

      const url = item["@microsoft.graph.downloadUrl"];
      if (!url) {
        throw new Error("Graph getDownloadUrl returned no downloadUrl.");
      }
      return url;
    } catch (error) {
      this.logAndThrow("getDownloadUrl", error, {
        siteId: input.siteId,
        driveId: input.driveId,
        fileId: input.fileId
      });
    }
  }

  private getClient(): Client {
    if (this.client) return this.client;

    // Both legacy SHAREPOINT_* and the spec-aligned AZURE_* env names are
    // accepted. AZURE_* wins when both are set.
    const tenantId =
      this.configService.get<string>("AZURE_TENANT_ID") ??
      this.configService.get<string>("SHAREPOINT_TENANT_ID");
    const clientId =
      this.configService.get<string>("AZURE_CLIENT_ID") ??
      this.configService.get<string>("SHAREPOINT_CLIENT_ID");
    const clientSecret =
      this.configService.get<string>("AZURE_CLIENT_SECRET") ??
      this.configService.get<string>("SHAREPOINT_CLIENT_SECRET");

    if (!tenantId || !clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "SharePoint Graph adapter requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET (or the legacy SHAREPOINT_* equivalents)."
      );
    }

    const credential: TokenCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"]
    });

    this.client = Client.initWithMiddleware({ authProvider });
    return this.client;
  }

  private logAndThrow(operation: string, error: unknown, context: Record<string, unknown>): never {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      `SharePoint Graph ${operation} failed: ${message} | context=${JSON.stringify(context)}`,
      stack
    );
    throw new ServiceUnavailableException(`SharePoint Graph ${operation} failed: ${message}`);
  }
}
