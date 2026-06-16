import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CorrespondenceAdapter,
  CorrespondenceSendInput,
  CorrespondenceSendResult
} from "../correspondence-adapter.interface";

/**
 * Mock correspondence adapter. Simulates an outbound mail send by returning a
 * synthetic external id; never touches a live mailbox. Inbound replies are
 * simulated by the service's `simulateInboundReply` test/dev entrypoint.
 */
@Injectable()
export class MockCorrespondenceAdapter implements CorrespondenceAdapter {
  readonly mode = "mock" as const;
  private readonly logger = new Logger(MockCorrespondenceAdapter.name);

  async send(input: CorrespondenceSendInput): Promise<CorrespondenceSendResult> {
    const externalId = `mock-${randomUUID()}`;
    this.logger.debug(`mock send ref=${input.referenceKey} to=${input.to.join(",")} id=${externalId}`);
    return { externalId, sentAt: new Date() };
  }
}
