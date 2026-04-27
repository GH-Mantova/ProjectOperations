import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { FormDraftStore, SensitiveFieldError, __PURGE_AFTER_MS } from "../FormDraftStore";

// Per-test fresh IndexedDB. fake-indexeddb/auto wires globalThis.indexedDB,
// then we replace with a new IDBFactory between tests so the cached
// dbPromise inside FormDraftStore can rebuild against an empty store.

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  FormDraftStore.__resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

// Date.now spy that does NOT use vi.useFakeTimers — fake timers stall
// fake-indexeddb's microtask-driven request/transaction completion.
function withClock(ms: number, fn: () => Promise<void>): Promise<void> {
  const spy = vi.spyOn(Date, "now").mockReturnValue(ms);
  return fn().finally(() => spy.mockRestore());
}

describe("FormDraftStore — round-trip", () => {
  it("save then get returns the record", async () => {
    await FormDraftStore.save("user-1", "safety_incident_create", null, { title: "test" }, 1);
    const row = await FormDraftStore.get("user-1", "safety_incident_create");
    expect(row).not.toBeNull();
    expect(row!.userId).toBe("user-1");
    expect(row!.formType).toBe("safety_incident_create");
    expect(row!.contextKey).toBeNull();
    expect(row!.data).toEqual({ title: "test" });
    expect(row!.schemaVersion).toBe(1);
    expect(row!.createdAt).toBeGreaterThan(0);
    expect(row!.updatedAt).toBeGreaterThan(0);
  });

  it("save twice updates updatedAt but preserves createdAt", async () => {
    const t1 = new Date("2026-04-01T00:00:00Z").getTime();
    const t2 = new Date("2026-04-02T00:00:00Z").getTime();
    await withClock(t1, () => FormDraftStore.save("user-1", "f", null, { v: 1 }, 1));
    const first = await FormDraftStore.get("user-1", "f");
    await withClock(t2, () => FormDraftStore.save("user-1", "f", null, { v: 2 }, 1));
    const second = await FormDraftStore.get("user-1", "f");

    expect(second!.createdAt).toBe(first!.createdAt);
    expect(second!.updatedAt).toBeGreaterThan(first!.updatedAt);
    expect(second!.data).toEqual({ v: 2 });
  });

  it("delete removes the record", async () => {
    await FormDraftStore.save("user-1", "f", null, { v: 1 }, 1);
    expect(await FormDraftStore.get("user-1", "f")).not.toBeNull();
    await FormDraftStore.delete("user-1", "f");
    expect(await FormDraftStore.get("user-1", "f")).toBeNull();
  });

  it("get with missing user or form returns null without error", async () => {
    expect(await FormDraftStore.get("", "f")).toBeNull();
    expect(await FormDraftStore.get("user-1", "")).toBeNull();
    expect(await FormDraftStore.get("never", "never")).toBeNull();
  });
});

describe("FormDraftStore — list scoping", () => {
  it("list filters by userId — user A cannot see user B drafts", async () => {
    await FormDraftStore.save("alice", "form_a", null, { v: 1 }, 1);
    await FormDraftStore.save("alice", "form_b", null, { v: 2 }, 1);
    await FormDraftStore.save("bob", "form_a", null, { v: 99 }, 1);

    const aliceDrafts = await FormDraftStore.list("alice");
    expect(aliceDrafts).toHaveLength(2);
    expect(aliceDrafts.every((d) => d.userId === "alice")).toBe(true);

    const bobDrafts = await FormDraftStore.list("bob");
    expect(bobDrafts).toHaveLength(1);
    expect(bobDrafts[0].userId).toBe("bob");
    expect(bobDrafts[0].data).toEqual({ v: 99 });
  });

  it("list with empty userId returns empty array", async () => {
    expect(await FormDraftStore.list("")).toEqual([]);
  });
});

describe("FormDraftStore — denylist guard", () => {
  it("rejects field named 'password' at top level", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { email: "x", password: "secret" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects field named 'creditCardNumber' (case-insensitive)", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { creditCardNumber: "4111" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects field named 'card_number'", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { card_number: "4111" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects field named 'otp'", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { otp: "123456" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects field named 'secretKey'", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { secretKey: "x" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects field named 'apiToken'", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { apiToken: "x" }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects nested sensitive field", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { auth: { password: "x" } }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("rejects sensitive field inside an array of objects", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { logins: [{ user: "a", password: "p" }] }, 1)
    ).rejects.toBeInstanceOf(SensitiveFieldError);
  });

  it("does NOT reject benign field 'cardholder' (no number/cvv match)", async () => {
    await expect(
      FormDraftStore.save("u", "f", null, { cardholder: "Jane Doe" }, 1)
    ).resolves.toBeUndefined();
  });
});

describe("FormDraftStore — purgeExpired", () => {
  it("removes records older than 30 days, keeps 29-day-old", async () => {
    const now = new Date("2026-04-27T12:00:00Z").getTime();
    await withClock(now - 31 * 24 * 60 * 60 * 1000, () =>
      FormDraftStore.save("u", "old_form", null, { v: 1 }, 1)
    );
    await withClock(now - 29 * 24 * 60 * 60 * 1000, () =>
      FormDraftStore.save("u", "fresh_form", null, { v: 2 }, 1)
    );

    const purged = await FormDraftStore.purgeExpired(now);
    expect(purged).toBe(1);

    expect(await FormDraftStore.get("u", "old_form")).toBeNull();
    expect(await FormDraftStore.get("u", "fresh_form")).not.toBeNull();
  });

  it("returns 0 when no records are expired", async () => {
    await FormDraftStore.save("u", "f", null, { v: 1 }, 1);
    const purged = await FormDraftStore.purgeExpired();
    expect(purged).toBe(0);
  });

  it("PURGE_AFTER_MS is exactly 30 days", () => {
    expect(__PURGE_AFTER_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("FormDraftStore — meta", () => {
  it("setMeta + getMeta round-trip", async () => {
    await FormDraftStore.setMeta("test-key", { foo: "bar" });
    const v = await FormDraftStore.getMeta<{ foo: string }>("test-key");
    expect(v).toEqual({ foo: "bar" });
  });

  it("getMeta returns undefined for missing key", async () => {
    expect(await FormDraftStore.getMeta("nope")).toBeUndefined();
  });
});
