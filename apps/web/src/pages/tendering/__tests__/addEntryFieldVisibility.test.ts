import { describe, expect, it } from "vitest";
import { requiresAssignee, requiresDueDate } from "../addEntryFieldVisibility";

describe("requiresDueDate", () => {
  it("returns false for 'note'", () => {
    expect(requiresDueDate("note")).toBe(false);
  });

  it("returns false for 'rfi'", () => {
    expect(requiresDueDate("rfi")).toBe(false);
  });

  it("returns false for 'email'", () => {
    expect(requiresDueDate("email")).toBe(false);
  });

  it("returns false for 'call'", () => {
    expect(requiresDueDate("call")).toBe(false);
  });

  it("returns false for 'meeting'", () => {
    expect(requiresDueDate("meeting")).toBe(false);
  });

  it("returns true for 'follow_up'", () => {
    expect(requiresDueDate("follow_up")).toBe(true);
  });

  it("returns true for 'self_reminder'", () => {
    expect(requiresDueDate("self_reminder")).toBe(true);
  });

  it("returns true for 'task'", () => {
    expect(requiresDueDate("task")).toBe(true);
  });

  it("returns false for an unknown type string (defensive default)", () => {
    expect(requiresDueDate("does_not_exist")).toBe(false);
  });

  it("returns false for null (defensive default)", () => {
    expect(requiresDueDate(null)).toBe(false);
  });

  it("returns false for undefined (defensive default)", () => {
    expect(requiresDueDate(undefined)).toBe(false);
  });
});

describe("requiresAssignee", () => {
  it("returns true for 'task'", () => {
    expect(requiresAssignee("task")).toBe(true);
  });

  it("returns false for 'follow_up' (a follow-up is not an assigned task)", () => {
    expect(requiresAssignee("follow_up")).toBe(false);
  });

  it("returns false for 'self_reminder'", () => {
    expect(requiresAssignee("self_reminder")).toBe(false);
  });

  it("returns false for 'note'", () => {
    expect(requiresAssignee("note")).toBe(false);
  });

  it("returns false for 'rfi'", () => {
    expect(requiresAssignee("rfi")).toBe(false);
  });

  it("returns false for 'email'", () => {
    expect(requiresAssignee("email")).toBe(false);
  });

  it("returns false for 'call'", () => {
    expect(requiresAssignee("call")).toBe(false);
  });

  it("returns false for 'meeting'", () => {
    expect(requiresAssignee("meeting")).toBe(false);
  });

  it("returns false for an unknown type string (defensive default)", () => {
    expect(requiresAssignee("does_not_exist")).toBe(false);
  });

  it("returns false for null (defensive default)", () => {
    expect(requiresAssignee(null)).toBe(false);
  });

  it("returns false for undefined (defensive default)", () => {
    expect(requiresAssignee(undefined)).toBe(false);
  });
});
