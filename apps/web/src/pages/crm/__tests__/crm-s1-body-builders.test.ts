// CRM S1 — body-builder pure-logic unit tests.
//
// The web workspace has no @testing-library / jsdom setup (all existing
// web tests are pure logic). We test the request-body builders exported
// from CommsHubPage and RelationshipsPage — the two functions that were
// silently broken before this fix.
//
// Why assigneeId matters in buildCreateTaskBody:
//   The inbox "My to-dos" tab queries GET /crm/comms/tasks?assigneeId=<userId>.
//   If createTask omits assigneeId the task is stored with assigneeId=null,
//   and the inbox query never matches — "My to-dos" is always empty.
//
// Why accountId matters in buildCreateNoteBody:
//   relationships.service.ts:58-62 throws BadRequestException when both
//   accountId and contactId are null. Every "Add note" click returned 400,
//   which also means Contact.lastContactedAt is never written, so "Going cold"
//   and "Last contact" surfaces are permanently empty.

import { describe, expect, it } from "vitest";
import { buildCreateTaskBody } from "../CommsHubPage";
import { buildCreateNoteBody } from "../RelationshipsPage";

// ── buildCreateTaskBody ───────────────────────────────────────────────────────

describe("buildCreateTaskBody (CRM S1 CommsHubPage)", () => {
  const base = {
    entityType: "ACCOUNT",
    entityId: "acc-123",
    title: "Follow up call",
    dueAt: "2026-09-01",
    userId: "user-abc"
  };

  it("returns assigneeId equal to userId", () => {
    const body = buildCreateTaskBody(base);
    expect(body.assigneeId).toBe("user-abc");
  });

  it("assigneeId key is present in the returned object", () => {
    const body = buildCreateTaskBody(base);
    expect(Object.prototype.hasOwnProperty.call(body, "assigneeId")).toBe(true);
  });

  it("assigneeId is never undefined", () => {
    const body = buildCreateTaskBody(base);
    expect(body.assigneeId).not.toBeUndefined();
  });

  it("assigneeId is not null", () => {
    const body = buildCreateTaskBody(base);
    expect(body.assigneeId).not.toBeNull();
  });

  it("carries through entityType, entityId, title, dueAt unchanged", () => {
    const body = buildCreateTaskBody(base);
    expect(body.entityType).toBe("ACCOUNT");
    expect(body.entityId).toBe("acc-123");
    expect(body.title).toBe("Follow up call");
    expect(body.dueAt).toBe("2026-09-01");
  });

  it("passes dueAt as null when caller supplies null", () => {
    const body = buildCreateTaskBody({ ...base, dueAt: null });
    expect(body.dueAt).toBeNull();
  });

  it("uses a different userId correctly", () => {
    const body = buildCreateTaskBody({ ...base, userId: "user-xyz" });
    expect(body.assigneeId).toBe("user-xyz");
  });
});

// ── buildCreateNoteBody ───────────────────────────────────────────────────────

describe("buildCreateNoteBody (CRM S1 RelationshipsPage)", () => {
  it("includes accountId in the returned body", () => {
    const body = buildCreateNoteBody({ body: "Met with client", accountId: "acc-1" });
    expect(body.accountId).toBe("acc-1");
  });

  it("accountId is not null", () => {
    const body = buildCreateNoteBody({ body: "Met with client", accountId: "acc-1" });
    expect(body.accountId).not.toBeNull();
  });

  it("cannot produce both accountId and contactId as null through the exported path", () => {
    // accountId is a required non-nullable string in the signature.
    // TypeScript enforces this; this runtime check pins the contract.
    const body = buildCreateNoteBody({ body: "Test note", accountId: "acc-1" });
    const bothNull = body.accountId === null && body.contactId === null;
    expect(bothNull).toBe(false);
  });

  it("contactId defaults to null when omitted", () => {
    const body = buildCreateNoteBody({ body: "Test note", accountId: "acc-1" });
    expect(body.contactId).toBeNull();
  });

  it("carries an explicit contactId through", () => {
    const body = buildCreateNoteBody({
      body: "Test note",
      accountId: "acc-1",
      contactId: "con-2"
    });
    expect(body.contactId).toBe("con-2");
  });

  it("treats contactId: null the same as omitted", () => {
    const body = buildCreateNoteBody({
      body: "Test note",
      accountId: "acc-1",
      contactId: null
    });
    expect(body.contactId).toBeNull();
  });

  it("carries the note body through unchanged", () => {
    const text = "Discussed renewal with procurement lead.";
    const body = buildCreateNoteBody({ body: text, accountId: "acc-1" });
    expect(body.body).toBe(text);
  });
});
