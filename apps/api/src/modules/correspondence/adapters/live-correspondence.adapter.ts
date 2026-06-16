import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type {
  CorrespondenceAdapter,
  CorrespondenceSendInput,
  CorrespondenceSendResult
} from "../correspondence-adapter.interface";

/**
 * Live Microsoft Graph correspondence adapter — STUB.
 *
 * Follow-up work: implement outbound send via the existing
 * OutlookEmailProvider auth flow and add inbound polling/subscription against
 * GET /users/{id}/mailFolders/Inbox/messages. Requires additional Entra
 * application permissions (Mail.Read / Mail.Read.Shared) beyond what the
 * notifications mailer uses (Mail.Send), and Marco's sign-off before the
 * tenant grant is requested.
 */
@Injectable()
export class LiveCorrespondenceAdapter implements CorrespondenceAdapter {
  readonly mode = "live" as const;
  private readonly logger = new Logger(LiveCorrespondenceAdapter.name);

  async send(_input: CorrespondenceSendInput): Promise<CorrespondenceSendResult> {
    this.logger.error("LiveCorrespondenceAdapter.send invoked but not yet implemented");
    throw new ServiceUnavailableException(
      "Live correspondence adapter is not implemented. Set CORRESPONDENCE_MODE=mock or complete the Graph follow-up."
    );
  }
}
