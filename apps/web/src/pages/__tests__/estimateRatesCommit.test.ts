// Logic specs for the inline rate-edit save race fix
// (PR fix/estimate-rates-save-race).
//
// The web workspace has no jsdom, so we exercise the two helpers the row's
// commit handler is now built on:
//
//   - `buildPatchBody`: PATCH only the dirty fields. Guards against a stale
//     draft for a sibling column overwriting a concurrent edit, which was
//     the failure mode noted in pr-164a (the spinbutton value persisted into
//     the role/description column on a fast inline edit).
//
//   - `createSaveSerializer`: serialize commits per row so a second commit
//     queued mid-flight runs *after* the first finishes — and reads the
//     latest draft via refs at execution time, so the last edit wins.

import { describe, expect, it } from "vitest";
import { buildPatchBody, createSaveSerializer } from "../estimateRatesCommit";

describe("buildPatchBody (PR fix/estimate-rates-save-race)", () => {
  const labourRow = {
    id: "labour-1",
    role: "Machine operator",
    dayRate: "600",
    nightRate: "750",
    weekendRate: "900"
  };
  const labourColumns = ["role", "dayRate", "nightRate", "weekendRate"] as const;

  it("returns an empty plan when no field has changed", () => {
    const draft = {
      role: "Machine operator",
      dayRate: "600",
      nightRate: "750",
      weekendRate: "900"
    };
    const plan = buildPatchBody(draft, labourRow, labourColumns);
    expect(plan.dirtyKeys).toEqual([]);
    expect(plan.body).toEqual({});
  });

  it("PATCHes only the field the user edited, not the whole row", () => {
    const draft = {
      role: "Machine operator",
      dayRate: "601",
      nightRate: "750",
      weekendRate: "900"
    };
    const plan = buildPatchBody(draft, labourRow, labourColumns);
    expect(plan.dirtyKeys).toEqual(["dayRate"]);
    expect(plan.body).toEqual({ dayRate: "601", isActive: true });
    expect(plan.body.role).toBeUndefined();
  });

  it("only PATCHes the edited cell when sibling columns match the current row", () => {
    // The dirty-only PATCH is the structural guard against the wrong-field
    // class of bug: even if some other code path (focus race, future
    // regression of LL-27, autofill) parked the spinbutton value in the role
    // input, this body wouldn't carry the role field at all unless the
    // current draft diverges from the current row for that key.
    const draft = {
      role: "Machine operator",
      dayRate: "601",
      nightRate: "750",
      weekendRate: "900"
    };
    const plan = buildPatchBody(draft, labourRow, labourColumns);
    expect(Object.keys(plan.body).sort()).toEqual(["dayRate", "isActive"]);
    expect(plan.body.role).toBeUndefined();
    expect(plan.body.nightRate).toBeUndefined();
    expect(plan.body.weekendRate).toBeUndefined();
  });
});

describe("createSaveSerializer (PR fix/estimate-rates-save-race)", () => {
  const flushMicrotasks = () => Promise.resolve();

  it("runs a single commit immediately and resolves once it completes", async () => {
    const calls: string[] = [];
    const q = createSaveSerializer();
    let release: (() => void) | null = null;
    const blocked = new Promise<void>((r) => (release = r));

    const p = q.enqueue(async () => {
      calls.push("start");
      await blocked;
      calls.push("end");
    });
    await flushMicrotasks();
    expect(calls).toEqual(["start"]);
    expect(q.isRunning()).toBe(true);
    release!();
    await p;
    expect(calls).toEqual(["start", "end"]);
    expect(q.isRunning()).toBe(false);
  });

  it("serializes a second commit behind an in-flight one (no overlap)", async () => {
    const events: string[] = [];
    const q = createSaveSerializer();
    let releaseFirst: (() => void) | null = null;
    let releaseSecond: (() => void) | null = null;

    const first = q.enqueue(async () => {
      events.push("first:start");
      await new Promise<void>((r) => (releaseFirst = r));
      events.push("first:end");
    });
    await flushMicrotasks();
    expect(events).toEqual(["first:start"]);

    const second = q.enqueue(async () => {
      events.push("second:start");
      await new Promise<void>((r) => (releaseSecond = r));
      events.push("second:end");
    });
    // Second has not started — the first is still mid-flight.
    await flushMicrotasks();
    expect(events).toEqual(["first:start"]);

    releaseFirst!();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
    releaseSecond!();
    await Promise.all([first, second]);
    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end"
    ]);
  });

  it("coalesces multiple follow-ups: only the latest queued commit runs after the in-flight one", async () => {
    // This is the core race fix. Three rapid commits (Enter pressed three
    // times during a single inflight save) must collapse to one follow-up
    // that reads the freshest snapshot via the ref the runner closes over.
    const seenSnapshots: string[] = [];
    let currentSnapshot = "v1";
    const readLatest = () => currentSnapshot;
    const q = createSaveSerializer();

    let releaseFirst: (() => void) | null = null;
    const first = q.enqueue(async () => {
      seenSnapshots.push(readLatest());
      await new Promise<void>((r) => (releaseFirst = r));
    });
    await flushMicrotasks();

    // While the first is in flight, user types more and triggers two more
    // commits. The serializer must collapse them and run only the latest
    // — and that run must observe the updated snapshot.
    currentSnapshot = "v2";
    const second = q.enqueue(async () => {
      seenSnapshots.push(readLatest());
    });
    currentSnapshot = "v3";
    const third = q.enqueue(async () => {
      seenSnapshots.push(readLatest());
    });

    releaseFirst!();
    await Promise.all([first, second, third]);

    // First ran on v1; only one follow-up ran, and it observed v3 — not v2.
    expect(seenSnapshots).toEqual(["v1", "v3"]);
  });

  it("re-allows new commits after the queue has drained", async () => {
    const calls: number[] = [];
    const q = createSaveSerializer();
    await q.enqueue(async () => {
      calls.push(1);
    });
    expect(q.isRunning()).toBe(false);
    await q.enqueue(async () => {
      calls.push(2);
    });
    expect(calls).toEqual([1, 2]);
  });
});
