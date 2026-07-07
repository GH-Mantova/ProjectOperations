import { describe, expect, it } from "vitest";
import {
  advanceStep,
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
