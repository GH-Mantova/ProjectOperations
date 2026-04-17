import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { EnsureFolderInput, EnsureFolderResult, SharePointAdapter } from "./sharepoint.adapter";

@Injectable()
export class GraphSharePointAdapter implements SharePointAdapter {
  async ensureFolder(_input: EnsureFolderInput): Promise<EnsureFolderResult> {
    throw new ServiceUnavailableException(
      "SharePoint Graph adapter is not enabled in this environment."
    );
  }
}
