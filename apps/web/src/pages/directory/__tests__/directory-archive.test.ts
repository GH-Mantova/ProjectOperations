import { describe, expect, it, vi } from "vitest";
import {
  ARCHIVED_STATUS,
  ACTIVE_STATUS,
  DEFAULT_VISIBLE_STATUSES,
  DEFAULT_SUB_STATUS_FILTER,
  isArchived,
  setArchived
} from "../directory-archive";

describe("isArchived", () => {
  it("returns true for the ARCHIVED status value", () => {
    expect(isArchived("ARCHIVED")).toBe(true);
  });

  it("returns false for ACTIVE", () => {
    expect(isArchived("ACTIVE")).toBe(false);
  });

  it("returns false for INACTIVE", () => {
    expect(isArchived("INACTIVE")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isArchived("")).toBe(false);
  });

  it("ARCHIVED_STATUS and ACTIVE_STATUS are distinct constants", () => {
    expect(ARCHIVED_STATUS).toBe("ARCHIVED");
    expect(ACTIVE_STATUS).toBe("ACTIVE");
    expect(ARCHIVED_STATUS).not.toBe(ACTIVE_STATUS);
  });
});

describe("DEFAULT_VISIBLE_STATUSES", () => {
  it("includes ACTIVE", () => {
    expect(DEFAULT_VISIBLE_STATUSES.has("ACTIVE")).toBe(true);
  });

  it("includes INACTIVE", () => {
    expect(DEFAULT_VISIBLE_STATUSES.has("INACTIVE")).toBe(true);
  });

  it("excludes ARCHIVED so archived records are hidden by default", () => {
    expect(DEFAULT_VISIBLE_STATUSES.has("ARCHIVED")).toBe(false);
  });

  it("contains exactly two statuses", () => {
    expect(DEFAULT_VISIBLE_STATUSES.size).toBe(2);
  });
});

describe("DEFAULT_SUB_STATUS_FILTER", () => {
  it("is the active-only filter string (mirrors SubcontractorsPage default)", () => {
    expect(DEFAULT_SUB_STATUS_FILTER).toBe("active");
  });
});

describe("setArchived — client kind", () => {
  it("calls PATCH /master-data/clients/:id with status=ARCHIVED when archiving", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    await setArchived(authFetch, "client", "abc-123", true);
    expect(authFetch).toHaveBeenCalledOnce();
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/master-data/clients/abc-123");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "ARCHIVED" });
  });

  it("calls PATCH /master-data/clients/:id with status=ACTIVE when unarchiving", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    await setArchived(authFetch, "client", "abc-123", false);
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/master-data/clients/abc-123");
    expect(JSON.parse(init.body as string)).toEqual({ status: "ACTIVE" });
  });

  it("throws when the response is not ok", async () => {
    const authFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Forbidden" })
    });
    await expect(setArchived(authFetch, "client", "x", true)).rejects.toThrow("Forbidden");
  });
});

describe("setArchived — subcontractor kind", () => {
  it("calls PATCH /directory/:id with isActive=false when archiving", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    await setArchived(authFetch, "subcontractor", "sub-456", true);
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/directory/sub-456");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
  });

  it("calls PATCH /directory/:id with isActive=true when unarchiving", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    await setArchived(authFetch, "subcontractor", "sub-456", false);
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/directory/sub-456");
    expect(JSON.parse(init.body as string)).toEqual({ isActive: true });
  });

  it("throws when the response is not ok", async () => {
    const authFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Not found" })
    });
    await expect(setArchived(authFetch, "subcontractor", "y", false)).rejects.toThrow("Not found");
  });
});
