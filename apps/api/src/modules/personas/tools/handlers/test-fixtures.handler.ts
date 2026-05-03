import { Injectable } from "@nestjs/common";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// Test fixture tools. Registered only when NODE_ENV !== "production"
// so they're available for end-to-end multi-turn loop verification in
// dev + CI without coupling tests to real domain tools. Underscore
// prefix on the name makes them obvious in any log line or audit.

@Injectable()
export class GetCurrentTimeHandler implements ToolHandler {
  name = "_test_get_current_time";
  description =
    "TEST FIXTURE — returns the current server time as an ISO 8601 string. Available only in non-production environments.";
  inputSchema = { type: "object" as const, properties: {}, required: [] };

  async execute(_input: unknown, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    void ctx; // toolUseId etc available; unused for this fixture
    return {
      result: {
        content: [{ type: "text", text: `Current server time: ${new Date().toISOString()}` }]
      }
    };
  }
}

// 1×1 transparent PNG — smallest valid PNG. Used to verify that
// image content makes it from a tool result back into the model's
// context via the multi-turn loop.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

@Injectable()
export class GetTestImageHandler implements ToolHandler {
  name = "_test_get_test_image";
  description =
    "TEST FIXTURE — returns a 1×1 transparent PNG. Available only in non-production environments. The model receives the image via the tool result so this exercises the image-content path through the dispatcher and provider adapters.";
  inputSchema = { type: "object" as const, properties: {}, required: [] };

  async execute(_input: unknown, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    void ctx;
    return {
      result: {
        content: [
          { type: "text", text: "Test image attached (1×1 transparent PNG)." },
          { type: "image", mediaType: "image/png", data: TINY_PNG_BASE64 }
        ]
      }
    };
  }
}
