import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initialUpdatePromptState,
  isPromptVisible,
  updatePromptReducer,
  updatePromptStore
} from "../updatePromptStore";

describe("updatePromptReducer", () => {
  it("marks needRefresh on the needRefresh action", () => {
    const next = updatePromptReducer(initialUpdatePromptState, { type: "needRefresh" });
    expect(next).toEqual({ needRefresh: true, dismissed: false });
  });

  it("dismiss hides the toast but keeps needRefresh so activation still happens", () => {
    const shown = updatePromptReducer(initialUpdatePromptState, { type: "needRefresh" });
    const dismissed = updatePromptReducer(shown, { type: "dismiss" });
    expect(dismissed).toEqual({ needRefresh: true, dismissed: true });
    expect(isPromptVisible(dismissed)).toBe(false);
  });

  it("dismiss is a no-op when there is no pending refresh", () => {
    const next = updatePromptReducer(initialUpdatePromptState, { type: "dismiss" });
    expect(next).toBe(initialUpdatePromptState);
  });

  it("a second needRefresh reopens after a dismiss", () => {
    let s = updatePromptReducer(initialUpdatePromptState, { type: "needRefresh" });
    s = updatePromptReducer(s, { type: "dismiss" });
    s = updatePromptReducer(s, { type: "needRefresh" });
    expect(isPromptVisible(s)).toBe(true);
  });

  it("applyUpdate clears state", () => {
    const shown = updatePromptReducer(initialUpdatePromptState, { type: "needRefresh" });
    expect(updatePromptReducer(shown, { type: "applyUpdate" })).toEqual(initialUpdatePromptState);
  });
});

describe("updatePromptStore", () => {
  afterEach(() => updatePromptStore._reset());

  it("notifies subscribers when the visible state changes", () => {
    const listener = vi.fn();
    updatePromptStore.subscribe(listener);
    updatePromptStore.signalNeedRefresh();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(updatePromptStore.getSnapshot().needRefresh).toBe(true);
  });

  it("applyUpdate invokes the registered updater and resets state", () => {
    const updater = vi.fn().mockResolvedValue(undefined);
    updatePromptStore.setUpdater(updater);
    updatePromptStore.signalNeedRefresh();
    updatePromptStore.applyUpdate();
    expect(updater).toHaveBeenCalledTimes(1);
    expect(updatePromptStore.getSnapshot()).toEqual(initialUpdatePromptState);
  });

  it("applyUpdate is safe when no updater is registered (e.g. dev/no-SW)", () => {
    updatePromptStore.signalNeedRefresh();
    expect(() => updatePromptStore.applyUpdate()).not.toThrow();
    expect(updatePromptStore.getSnapshot()).toEqual(initialUpdatePromptState);
  });
});
