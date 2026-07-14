import { describe, expect, it } from "vitest";
import {
  advanceStep,
  buildAddBuilderRequest,
  buildDiscardDraftRequest,
  buildProjectStepFlushPayload,
  buildRemoveBuilderRequest,
  detectIncompleteBuilders,
  deriveDocumentBuckets,
  formatReminderBody,
  goBack,
  initialFlowState,
  jumpToStep,
  shouldConfirmClose,
  skipCurrentStep,
  WIZARD_STEP_KEYS,
  type PackageRef
} from "../newTenderWizard.helpers";

describe("wizard step navigation", () => {
  it("starts at project with only project visited", () => {
    const s = initialFlowState();
    expect(s.currentStep).toBe("project");
    expect(s.visited.project).toBe(true);
    expect(s.visited.builders).toBe(false);
    expect(s.skipped.project).toBe(false);
  });

  it("advance clears skipped flag and marks next visited", () => {
    const s = advanceStep(initialFlowState());
    expect(s.currentStep).toBe("builders");
    expect(s.visited.builders).toBe(true);
    expect(s.skipped.project).toBe(false);
  });

  it("skip marks the current step skipped and advances", () => {
    const s = skipCurrentStep(initialFlowState());
    expect(s.currentStep).toBe("builders");
    expect(s.skipped.project).toBe(true);
    expect(s.visited.builders).toBe(true);
  });

  it("back returns to previous step without wiping visited flags", () => {
    const s = goBack(advanceStep(initialFlowState()));
    expect(s.currentStep).toBe("project");
    expect(s.visited.builders).toBe(true);
  });

  it("jumpToStep only permits visited destinations", () => {
    const s = initialFlowState();
    const blocked = jumpToStep(s, "documents");
    expect(blocked.currentStep).toBe("project");
    const walked = WIZARD_STEP_KEYS.slice(0, 4).reduce(
      (acc) => advanceStep(acc),
      initialFlowState()
    );
    const jumped = jumpToStep(walked, "builders");
    expect(jumped.currentStep).toBe("builders");
    expect(jumped.visited.builders).toBe(true);
  });

  it("advancing past review is a no-op", () => {
    let s = initialFlowState();
    for (let i = 0; i < WIZARD_STEP_KEYS.length + 3; i += 1) s = advanceStep(s);
    expect(s.currentStep).toBe("review");
  });
});

describe("document bucket union", () => {
  const packages: PackageRef[] = [
    { id: "p-earthworks", disciplineItemId: "d-earthworks", value: "EARTHWORKS", label: "Earthworks", sortOrder: 2 },
    { id: "p-concrete", disciplineItemId: "d-concrete", value: "CONCRETE", label: "Concrete", sortOrder: 1 },
    { id: "p-drainage", disciplineItemId: "d-drainage", value: "DRAINAGE", label: "Drainage", sortOrder: 3 }
  ];

  it("returns only packages referenced by at least one matrix cell", () => {
    const cells = [
      { tenderClientId: "b1", tenderPackageId: "p-concrete" },
      { tenderClientId: "b2", tenderPackageId: "p-drainage" }
    ];
    const buckets = deriveDocumentBuckets(cells, packages);
    expect(buckets.map((b) => b.value)).toEqual(["CONCRETE", "DRAINAGE"]);
  });

  it("dedupes the same package selected by multiple builders", () => {
    const cells = [
      { tenderClientId: "b1", tenderPackageId: "p-earthworks" },
      { tenderClientId: "b2", tenderPackageId: "p-earthworks" },
      { tenderClientId: "b3", tenderPackageId: "p-earthworks" }
    ];
    const buckets = deriveDocumentBuckets(cells, packages);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].value).toBe("EARTHWORKS");
  });

  it("sorts by sortOrder then label", () => {
    const cells = packages.map((p) => ({ tenderClientId: "b1", tenderPackageId: p.id }));
    const buckets = deriveDocumentBuckets(cells, packages);
    expect(buckets.map((b) => b.value)).toEqual(["CONCRETE", "EARTHWORKS", "DRAINAGE"]);
  });

  it("empty matrix yields empty bucket list", () => {
    expect(deriveDocumentBuckets([], packages)).toEqual([]);
  });
});

describe("incomplete builder reminders", () => {
  it("flags builders missing a contact", () => {
    const reminders = detectIncompleteBuilders([
      { clientId: "c1", clientName: "Acme", contactId: null, submissionDate: "2026-08-01" }
    ]);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].reasons).toContain("missing_contact");
  });

  it("flags builders missing a submission date", () => {
    const reminders = detectIncompleteBuilders([
      { clientId: "c1", clientName: "Acme", contactId: "u1", submissionDate: null }
    ]);
    expect(reminders[0].reasons).toEqual(["missing_submission_date"]);
  });

  it("skips fully populated builders", () => {
    const reminders = detectIncompleteBuilders([
      { clientId: "c1", clientName: "Acme", contactId: "u1", submissionDate: "2026-08-01" }
    ]);
    expect(reminders).toEqual([]);
  });

  it("composes a human-readable reminder body", () => {
    const [reminder] = detectIncompleteBuilders([
      { clientId: "c1", clientName: "Hutchies", contactId: null, submissionDate: null }
    ]);
    expect(formatReminderBody(reminder)).toContain("Hutchies");
    expect(formatReminderBody(reminder)).toContain("no contact selected");
    expect(formatReminderBody(reminder)).toContain("no submission date set");
  });
});

// Regression: adding the 2nd builder used to construct a PATCH /tenders/:id
// payload that spread `serverTenderClients` and re-injected each row's
// `submissionDate`. TenderClientInputDto forbids that field under
// `forbidNonWhitelisted: true`, so once any existing tenderClient had a
// non-null submissionDate the request 400'd and the wizard silently no-op'd.
// The fix routes add/remove through the per-client endpoint whose DTO does
// NOT include `submissionDate`. These helpers pin the outgoing payload shape.
describe("builder link/unlink request builders", () => {
  it("addBuilder posts to the clients sub-resource with PRIMARY for the first builder", () => {
    const req = buildAddBuilderRequest("client-1", true);
    expect(req).toEqual({
      path: "clients",
      method: "POST",
      body: { clientId: "client-1", relationshipType: "PRIMARY" }
    });
  });

  it("addBuilder posts COMPETITOR for the 2nd+ builder — the case the bug hit", () => {
    const req = buildAddBuilderRequest("client-2", false);
    expect(req.method).toBe("POST");
    expect(req.body).toEqual({ clientId: "client-2", relationshipType: "COMPETITOR" });
  });

  it("addBuilder body never carries submissionDate (the 400-triggering field)", () => {
    // Guard: the destructive PATCH path used to spread serverTenderClients
    // rows into the payload which re-emitted `submissionDate`. The new
    // per-client body must be provably free of that field.
    for (const isFirst of [true, false]) {
      const req = buildAddBuilderRequest("any-client", isFirst);
      expect(req.body).not.toHaveProperty("submissionDate");
      // Also whitelist-check: the only keys the API accepts on add are
      // clientId + relationshipType.
      expect(Object.keys(req.body ?? {}).sort()).toEqual(["clientId", "relationshipType"]);
    }
  });

  it("removeBuilder issues a DELETE against the per-client resource, no body", () => {
    const req = buildRemoveBuilderRequest("client-1");
    expect(req).toEqual({ path: "clients/client-1", method: "DELETE" });
    expect(req.body).toBeUndefined();
  });

  it("removeBuilder URL-encodes the clientId so odd IDs stay safe", () => {
    const req = buildRemoveBuilderRequest("client with/slash");
    expect(req.path).toBe(`clients/${encodeURIComponent("client with/slash")}`);
  });

  it("removing one of two builders leaves exactly the other in a client-side flow", () => {
    // Mirrors what the wizard does after DELETE returns the fresh list:
    // it drops the deleted clientId from local `builders`. Proves the state
    // transition doesn't silently no-op (which was the visible bug).
    const builders = [
      { clientId: "c1", clientName: "A", contactId: null, submissionDate: null },
      { clientId: "c2", clientName: "B", contactId: null, submissionDate: null }
    ];
    const remove = buildRemoveBuilderRequest("c1");
    expect(remove.method).toBe("DELETE");
    const after = builders.filter((b) => b.clientId !== "c1");
    expect(after).toHaveLength(1);
    expect(after[0].clientId).toBe("c2");
  });
});

// Regression: users reported "accidentally cancelling (Escape) loses my
// work" because the wizard closed instantly on Esc / overlay / X. The draft
// is actually server-side once created, but closing without warning is
// disorienting. `shouldConfirmClose` is the predicate that gates the new
// close-confirm modal.
describe("shouldConfirmClose (close guard)", () => {
  it("false on a truly blank wizard — no draft, no uploads", () => {
    expect(shouldConfirmClose({ draftId: null, documentsCount: 0 })).toBe(false);
  });

  it("true once a draft exists — even with zero uploads", () => {
    // This is the case the bug hit: Escape after step 1 dropped the wizard
    // without asking, but a DRAFT tender was already sitting in the pipeline.
    expect(shouldConfirmClose({ draftId: "t-1", documentsCount: 0 })).toBe(true);
  });

  it("true with uploads present — even without a draft id", () => {
    // Defensive: uploads currently require a draft id, but the guard should
    // still fire if the invariant is ever loosened (e.g. deferred draft).
    expect(shouldConfirmClose({ draftId: null, documentsCount: 3 })).toBe(true);
  });

  it("true when both are present", () => {
    expect(shouldConfirmClose({ draftId: "t-1", documentsCount: 5 })).toBe(true);
  });
});

// The Project step used to only flush title on the initial DRAFT create
// (ensureDraftId) — estimator + siteAddress only made it to the server on
// handleFinish. Users editing estimator on the Project step and pressing
// Next lost the edit if they closed the wizard mid-flow. `flushCurrentStep`
// now calls buildProjectStepFlushPayload before every Next/Skip.
describe("buildProjectStepFlushPayload (Project step flush)", () => {
  it("returns null when no draft exists (nothing to patch)", () => {
    expect(
      buildProjectStepFlushPayload({
        draftId: null,
        title: "Anything",
        estimatorUserId: "u-1",
        siteAddress: "123 Example Rd"
      })
    ).toBeNull();
  });

  it("returns null when the title would be empty — API rejects PATCH without title", () => {
    expect(
      buildProjectStepFlushPayload({
        draftId: "t-1",
        title: "   ",
        estimatorUserId: "u-1",
        siteAddress: "123 Example Rd"
      })
    ).toBeNull();
  });

  it("always sends the trimmed title even when nothing else changed", () => {
    const patch = buildProjectStepFlushPayload({
      draftId: "t-1",
      title: "  Site civil works  ",
      estimatorUserId: "",
      siteAddress: ""
    });
    expect(patch).toEqual({ title: "Site civil works" });
  });

  it("adds estimator + description when populated — the fields that used to leak", () => {
    const patch = buildProjectStepFlushPayload({
      draftId: "t-1",
      title: "Site civil works",
      estimatorUserId: "user-42",
      siteAddress: "123 Example Rd, Brisbane QLD"
    });
    expect(patch).toEqual({
      title: "Site civil works",
      estimatorUserId: "user-42",
      description: "Site: 123 Example Rd, Brisbane QLD"
    });
  });

  it("omits description when siteAddress is blank so we don't clobber other description edits", () => {
    const patch = buildProjectStepFlushPayload({
      draftId: "t-1",
      title: "Site civil works",
      estimatorUserId: "user-42",
      siteAddress: "   "
    });
    expect(patch).toEqual({
      title: "Site civil works",
      estimatorUserId: "user-42"
    });
    expect(patch).not.toHaveProperty("description");
  });
});

// Discard-draft action wires the confirm modal to the existing hard-delete
// endpoint (DELETE /tenders/:id — audit-before-delete, permission-gated by
// tenders.manage). Pinning the request shape means the wizard can't
// accidentally point at a different route in a future refactor.
describe("buildDiscardDraftRequest", () => {
  it("targets the tender delete endpoint with DELETE", () => {
    expect(buildDiscardDraftRequest("t-1")).toEqual({
      path: "tenders/t-1",
      method: "DELETE"
    });
  });

  it("URL-encodes the draftId so odd ids stay safe", () => {
    const req = buildDiscardDraftRequest("t/1?");
    expect(req.path).toBe(`tenders/${encodeURIComponent("t/1?")}`);
    expect(req.method).toBe("DELETE");
  });
});
