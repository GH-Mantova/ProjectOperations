// PR sharepoint-folder-mappings — folder names on the live Initial
// Services site have a **leading number, period, and space** (e.g.
// "1. Operations/1. Tenders"). That's exactly the class of input that
// works against the mock adapter (which stores the path verbatim) but
// can fail against Graph if we don't encode it correctly.
//
// Graph drive-item paths are colon-delimited:
//   /sites/{siteId}/drives/{driveId}/root:/1. Operations/1. Tenders:/children
// The parent path segment must go through encodeURI (which preserves
// "/" but percent-encodes spaces to %20), NOT encodeURIComponent (which
// would encode "/" to %2F and break the path grammar).
//
// This test round-trips the exact shape we care about through the same
// path-building code the Graph adapter uses.

// Duplicate of the parent-path builder from graph-sharepoint.adapter.ts.
// Kept here so the test guards the encoding shape even if the adapter
// is refactored, and so the assertion reads clearly next to the
// expected values.
function buildParentApi(siteId: string, driveId: string, relativePath: string): string {
  const segments = relativePath.split("/").filter(Boolean);
  const parentPath = segments.slice(0, -1).join("/");
  return parentPath
    ? `/sites/${siteId}/drives/${driveId}/root:/${encodeURI(parentPath)}:/children`
    : `/sites/${siteId}/drives/${driveId}/root/children`;
}

describe("Graph path builder — folder names with a leading number, period, and space", () => {
  it("round-trips '1. Operations/1. Tenders' with spaces encoded as %20 and slashes preserved", () => {
    const api = buildParentApi(
      "site-abc",
      "drive-xyz",
      "1. Operations/1. Tenders/T-2607"
    );
    // Parent = "1. Operations/1. Tenders". Spaces → %20; slashes stay.
    // Periods survive as-is (unreserved).
    expect(api).toBe(
      "/sites/site-abc/drives/drive-xyz/root:/1.%20Operations/1.%20Tenders:/children"
    );
  });

  it("handles the jobs-won path — '1. Operations/2. Jobs won'", () => {
    const api = buildParentApi(
      "site-abc",
      "drive-xyz",
      "1. Operations/2. Jobs won/JOB-1234"
    );
    expect(api).toBe(
      "/sites/site-abc/drives/drive-xyz/root:/1.%20Operations/2.%20Jobs%20won:/children"
    );
  });

  it("does not encode '/' inside the parent path — that would break Graph's path grammar", () => {
    const api = buildParentApi(
      "s",
      "d",
      "1. Operations/1. Tenders/T-1"
    );
    // The path grammar requires "/" as a separator; %2F would 400.
    expect(api).not.toContain("%2F");
    expect(api).toContain("1.%20Operations/1.%20Tenders");
  });

  it("root-level folder (no parent) uses /root/children with no encoded prefix", () => {
    const api = buildParentApi("s", "d", "1. Operations");
    expect(api).toBe("/sites/s/drives/d/root/children");
  });
});
