/**
 * TFM-S1 — Graph paging test for listFolderChildren.
 *
 * A folder with 250 children returned as two pages (200 + 50) must enumerate
 * all 250. Asserts the count and that no page was skipped or duplicated.
 */

import { GraphSharePointAdapter } from "../graph-sharepoint.adapter";
import { ConfigService } from "@nestjs/config";

// Minimal ConfigService stub — resolves client-secret mode so the adapter
// constructs its credential without hitting Azure.
function buildConfig(): ConfigService {
  return {
    get: <T = string>(key: string, defaultValue?: T): T | undefined => {
      const env: Record<string, string> = {
        SHAREPOINT_AUTH_MODE: "client-secret",
        AZURE_TENANT_ID: "tenant-test",
        AZURE_CLIENT_ID: "client-test",
        AZURE_CLIENT_SECRET: "secret-test",
      };
      return (env[key] ?? defaultValue) as unknown as T | undefined;
    },
  } as ConfigService;
}

// Build a page of GraphDriveItem-shaped objects.
function buildPage(
  start: number,
  count: number,
  nextLink?: string
): { value: Array<{ id: string; name: string; size: number }>; "@odata.nextLink"?: string } {
  const value = Array.from({ length: count }, (_, idx) => ({
    id: `item-${start + idx}`,
    name: `file-${start + idx}.pdf`,
    size: 1000 + start + idx,
  }));
  return nextLink ? { value, "@odata.nextLink": nextLink } : { value };
}

describe("GraphSharePointAdapter.listFolderChildren — Graph paging", () => {
  let adapter: GraphSharePointAdapter;

  beforeEach(() => {
    adapter = new GraphSharePointAdapter(buildConfig());
  });

  it("enumerates all 250 children across two pages (200 + 50) without duplication", async () => {
    const page1NextLink =
      "https://graph.microsoft.com/v1.0/sites/s/drives/d/items/root-id/children?$top=200&$skip=200";

    const page1 = buildPage(0, 200, page1NextLink);
    const page2 = buildPage(200, 50);

    // Intercept client.api(...).get() calls
    let callCount = 0;
    const fakeGet = jest.fn().mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? page1 : page2;
    });

    // Patch the private getClient method to return a stub Graph client.
    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({ get: fakeGet }),
    });

    const children = await adapter.listFolderChildren("s", "d", "root-id");

    expect(children).toHaveLength(250);
    // Verify no duplicates by checking unique IDs
    const ids = children.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(250);
    // Verify first and last item
    expect(ids[0]).toBe("item-0");
    expect(ids[249]).toBe("item-249");
    // Two page fetches were made
    expect(callCount).toBe(2);
  });

  it("returns an empty array for a missing folder (404)", async () => {
    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({
        get: jest.fn().mockRejectedValue(new Error("itemNotFound: The resource could not be found.")),
      }),
    });

    const children = await adapter.listFolderChildren("s", "d", "nonexistent-id");
    expect(children).toEqual([]);
  });

  it("maps isFolder correctly — folder children have isFolder=true", async () => {
    const page = {
      value: [
        { id: "file-1", name: "report.pdf", size: 500 },
        { id: "folder-1", name: "Subfolder", folder: { childCount: 3 } },
      ],
    };

    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({
        get: jest.fn().mockResolvedValue(page),
      }),
    });

    const children = await adapter.listFolderChildren("s", "d", "parent-id");
    expect(children).toHaveLength(2);
    const file = children.find((c) => c.id === "file-1");
    const folder = children.find((c) => c.id === "folder-1");
    expect(file?.isFolder).toBe(false);
    expect(folder?.isFolder).toBe(true);
  });

  it("rethrows transient (non-404) errors", async () => {
    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({
        get: jest.fn().mockRejectedValue(new Error("503 Service Unavailable")),
      }),
    });

    await expect(adapter.listFolderChildren("s", "d", "item-id")).rejects.toThrow(
      /listFolderChildren failed/
    );
  });
});

describe("GraphSharePointAdapter.listFolderChildrenByPath — Graph paging", () => {
  let adapter: GraphSharePointAdapter;

  beforeEach(() => {
    adapter = new GraphSharePointAdapter(buildConfig());
  });

  it("enumerates all 250 children across two pages via path-based URL", async () => {
    const page1NextLink =
      "https://graph.microsoft.com/v1.0/sites/s/drives/d/root:/legacy/T1234:/children?$top=200&$skip=200";

    const page1 = buildPage(0, 200, page1NextLink);
    const page2 = buildPage(200, 50);

    let callCount = 0;
    const fakeGet = jest.fn().mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? page1 : page2;
    });

    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({ get: fakeGet }),
    });

    const children = await adapter.listFolderChildrenByPath("s", "d", "legacy/T1234");

    expect(children).toHaveLength(250);
    const uniqueIds = new Set(children.map((c) => c.id));
    expect(uniqueIds.size).toBe(250);
    expect(callCount).toBe(2);
  });

  it("returns empty array for a missing path (404)", async () => {
    (adapter as unknown as Record<string, unknown>)["getClient"] = () => ({
      api: (_url: string) => ({
        get: jest.fn().mockRejectedValue(new Error("404 Not Found: itemNotFound")),
      }),
    });

    const children = await adapter.listFolderChildrenByPath("s", "d", "missing/path");
    expect(children).toEqual([]);
  });
});
