/**
 * TFM-S11 — Bridge test: SharePointCopySeamBridge.ensureCopyFolderPath
 *
 * Verifies that ensureCopyFolderPath delegates to svc.ensureFolder with the
 * correct arguments and — critically — does NOT set linkedEntityType or
 * linkedEntityId, so the resulting row can never win the
 * `linkedEntityType: "Tender"` destination lookup.
 */

import { SharePointCopySeamBridge } from "./admin-imports.module";
import type { SharePointService } from "../platform/sharepoint.service";

describe("TFM-S11 — SharePointCopySeamBridge.ensureCopyFolderPath", () => {
  it("calls ensureFolder with correct module, no linkedEntityType, no linkedEntityId, and returns itemId", async () => {
    const mockEnsureFolder = jest.fn().mockResolvedValue({ itemId: "returned-id" });

    // Construct the bridge with a minimal mock of SharePointService
    const mockSvc = {
      ensureFolder: mockEnsureFolder,
    } as unknown as SharePointService;

    const bridge = new SharePointCopySeamBridge(mockSvc);
    const result = await bridge.ensureCopyFolderPath("some/path", "leaf");

    // Return value is the itemId from the record
    expect(result).toBe("returned-id");

    // ensureFolder must have been called once
    expect(mockEnsureFolder).toHaveBeenCalledTimes(1);

    const callArg = mockEnsureFolder.mock.calls[0][0] as Record<string, unknown>;

    // Required fields present with correct values
    expect(callArg).toMatchObject({
      name: "leaf",
      relativePath: "some/path",
      module: "tendering-legacy-copy",
    });

    // CRITICAL: linkedEntityType and linkedEntityId must NOT be present
    // so this row can never win the `linkedEntityType: "Tender"` lookup.
    expect(callArg).not.toHaveProperty("linkedEntityType");
    expect(callArg).not.toHaveProperty("linkedEntityId");
  });
});
