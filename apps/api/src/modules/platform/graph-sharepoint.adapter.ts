import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ClientSecretCredential,
  CredentialUnavailableError,
  ManagedIdentityCredential,
  TokenCredential
} from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {
  DownloadFileBytesInput,
  EnsureFolderInput,
  EnsureFolderResult,
  ResolveDriveInput,
  ResolveSiteInput,
  SharePointAdapter,
  SharePointFileNotFoundError,
  UploadFileInput,
  UploadFileResult
} from "./sharepoint.adapter";

export type SharePointAuthMode = "managed-identity" | "client-secret";

// Explicit selection over DefaultAzureCredential's silent fallback chain.
// Unset → client-secret so existing deployments and local dev keep working.
export function resolveSharePointAuthMode(config: {
  get: <T = string>(key: string) => T | undefined;
}): SharePointAuthMode {
  const raw = (config.get<string>("SHAREPOINT_AUTH_MODE") ?? "client-secret").trim().toLowerCase();
  if (raw === "managed-identity") return "managed-identity";
  if (raw === "" || raw === "client-secret") return "client-secret";
  throw new ServiceUnavailableException(
    `SHAREPOINT_AUTH_MODE must be "managed-identity" or "client-secret" (got "${raw}").`
  );
}

// Module-level so unit tests can exercise both branches without spinning
// up a Graph Client. `logOnce` fires once per process — pass a no-op in
// tests. The managed-identity branch wraps the credential so that a
// missing IMDS endpoint surfaces an honest error naming the mode, per
// sot/01 §6 (failure honesty).
let authModeLogged = false;
export function resetSharePointAuthModeLoggedForTests(): void {
  authModeLogged = false;
}

export function buildSharePointCredential(
  mode: SharePointAuthMode,
  config: { get: <T = string>(key: string) => T | undefined },
  logOnce: (line: string) => void
): TokenCredential {
  if (mode === "managed-identity") {
    const userAssignedClientId = config.get<string>("AZURE_MANAGED_IDENTITY_CLIENT_ID");
    const base = userAssignedClientId
      ? new ManagedIdentityCredential({ clientId: userAssignedClientId })
      : new ManagedIdentityCredential();

    if (!authModeLogged) {
      logOnce(
        `SharePoint Graph auth: managed-identity (${userAssignedClientId ? `user-assigned clientId=${userAssignedClientId}` : "system-assigned"})`
      );
      authModeLogged = true;
    }

    return {
      async getToken(scopes, options) {
        try {
          return await base.getToken(scopes, options);
        } catch (err) {
          if (err instanceof CredentialUnavailableError) {
            throw new ServiceUnavailableException(
              `SHAREPOINT_AUTH_MODE=managed-identity but no managed identity is available in this environment. Managed identity only works when the API runs on an Azure host (App Service / Container Apps / VM) with an identity assigned. For local development or CI, set SHAREPOINT_AUTH_MODE=client-secret. Underlying error: ${err.message}`
            );
          }
          throw err;
        }
      }
    };
  }

  // Both legacy SHAREPOINT_* and the spec-aligned AZURE_* env names are
  // accepted. AZURE_* wins when both are set.
  const tenantId =
    config.get<string>("AZURE_TENANT_ID") ?? config.get<string>("SHAREPOINT_TENANT_ID");
  const clientId =
    config.get<string>("AZURE_CLIENT_ID") ?? config.get<string>("SHAREPOINT_CLIENT_ID");
  const clientSecret =
    config.get<string>("AZURE_CLIENT_SECRET") ?? config.get<string>("SHAREPOINT_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new ServiceUnavailableException(
      "SharePoint Graph adapter (SHAREPOINT_AUTH_MODE=client-secret) requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET (or the legacy SHAREPOINT_* equivalents)."
    );
  }

  if (!authModeLogged) {
    logOnce(`SharePoint Graph auth: client-secret (clientId=${clientId})`);
    authModeLogged = true;
  }

  return new ClientSecretCredential(tenantId, clientId, clientSecret);
}

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

  // PR #146 — implements the new interface method against Graph.
  // Resolves the short-lived download URL via Graph metadata, then
  // streams the bytes back into a Buffer. 404 from Graph maps to
  // SharePointFileNotFoundError so callers (drawing tools handlers,
  // future asbestos register reader) can surface a specific message.
  async downloadFileBytes(input: DownloadFileBytesInput): Promise<Buffer> {
    let url: string;
    try {
      url = await this.getDownloadUrl(input);
    } catch (err) {
      // getDownloadUrl wraps a Graph 404 in ServiceUnavailableException;
      // sniff the message to detect the not-found case and re-cast.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("itemNotFound") || msg.includes("404")) {
        throw new SharePointFileNotFoundError(input.fileId, input.siteId, input.driveId);
      }
      throw err;
    }
    const res = await fetch(url);
    if (res.status === 404) {
      throw new SharePointFileNotFoundError(input.fileId, input.siteId, input.driveId);
    }
    if (!res.ok) {
      throw new Error(`Graph downloadFileBytes failed: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // PR-64 — Look up the site ID for a SharePoint site via
  // `GET /sites/{hostname}:{sitePath}`. Called once by
  // SharePointService and cached.
  async resolveSiteId(input: ResolveSiteInput): Promise<string> {
    try {
      const client = this.getClient();
      const normalisedPath = input.sitePath.startsWith("/") ? input.sitePath : `/${input.sitePath}`;
      const api = `/sites/${input.hostname}:${normalisedPath}`;
      const result = (await client.api(api).select("id").get()) as { id?: string };
      if (!result.id) {
        throw new Error(`Graph /sites/${input.hostname}:${normalisedPath} returned no id.`);
      }
      return result.id;
    } catch (error) {
      this.logAndThrow("resolveSiteId", error, {
        hostname: input.hostname,
        sitePath: input.sitePath
      });
    }
  }

  // PR-64 — Find the drive (library) ID matching the configured
  // library name. The site's default "Documents" library is the
  // expected production target; this lets the operator change the name
  // without code changes.
  async resolveDriveId(input: ResolveDriveInput): Promise<string> {
    try {
      const client = this.getClient();
      const api = `/sites/${input.siteId}/drives`;
      const result = (await client.api(api).select("id,name").get()) as {
        value?: Array<{ id?: string; name?: string }>;
      };
      const drives = result.value ?? [];
      const match = drives.find((d) => d.name === input.libraryName);
      if (!match?.id) {
        const available = drives.map((d) => d.name ?? "?").join(", ");
        throw new Error(
          `Library "${input.libraryName}" not found on site ${input.siteId}. Available drives: ${available || "(none)"}.`
        );
      }
      return match.id;
    } catch (error) {
      this.logAndThrow("resolveDriveId", error, {
        siteId: input.siteId,
        libraryName: input.libraryName
      });
    }
  }

  private getClient(): Client {
    if (this.client) return this.client;

    const mode = resolveSharePointAuthMode(this.configService);
    const credential = buildSharePointCredential(mode, this.configService, (line) =>
      this.logger.log(line)
    );
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
