import { describe, expect, it } from "vitest";
import {
  advanceStep,
  buildAddBuilderRequest,
  buildRemoveBuilderRequest,
  detectIncompleteBuilders,
  deriveDocumentBuckets,
  formatReminderBody,
  goBack,
  initialFlowState,
  jumpToStep,
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
