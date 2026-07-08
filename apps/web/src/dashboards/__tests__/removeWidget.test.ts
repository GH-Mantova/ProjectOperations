import { describe, expect, it } from "vitest";
import { removeWidgetById } from "../widgetGallery";
import type { WidgetConfigEntry } from "../types";

const make = (id: string, order: number): WidgetConfigEntry => ({
  id,
  type: "ops_active_jobs_kpi",
  visible: true,
  order,
  config: {}
});

describe("removeWidgetById", () => {
  it("drops the entry from the returned list", () => {
    const widgets = [make("a", 0), make("b", 1), make("c", 2)];
    const next = removeWidgetById(widgets, "b");
    expect(next.map((w) => w.id)).toEqual(["a", "c"]);
  });

  it("re-normalizes order so it stays contiguous after a middle removal", () => {
    const widgets = [make("a", 0), make("b", 1), make("c", 2)];
    const next = removeWidgetById(widgets, "b");
    expect(next.map((w) => w.order)).toEqual([0, 1]);
  });

  it("returns an empty list when the only widget is removed (canvas empty state)", () => {
    const next = removeWidgetById([make("solo", 0)], "solo");
    expect(next).toEqual([]);
  });

  it("is a no-op when the id doesn't exist — the config is unchanged", () => {
    const widgets = [make("a", 0), make("b", 1)];
    const next = removeWidgetById(widgets, "does-not-exist");
    expect(next.map((w) => w.id)).toEqual(["a", "b"]);
    expect(next.map((w) => w.order)).toEqual([0, 1]);
  });

  it("does not mutate the input list", () => {
    const widgets = [make("a", 0), make("b", 1)];
    const snapshot = widgets.map((w) => ({ ...w }));
    removeWidgetById(widgets, "a");
    expect(widgets).toEqual(snapshot);
  });

  it("normalizes when the input order values are sparse or unsorted", () => {
    const widgets = [make("c", 5), make("a", 0), make("b", 2)];
    const next = removeWidgetById(widgets, "b");
    expect(next.map((w) => w.id)).toEqual(["a", "c"]);
    expect(next.map((w) => w.order)).toEqual([0, 1]);
  });
});
