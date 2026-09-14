/**
 * DraftPanel S2 -- deriveDraftCompleteness pure-function tests.
 * No jsdom required: these are pure logic specs.
 */
import { describe, expect, it } from "vitest";
import {
  deriveDraftCompleteness,
  type BuilderDraft,
  type MatrixCell,
  type PackageRef,
  type RateSetForCompleteness,
  type TenderForCompleteness
} from "../newTenderWizard.helpers";

// Helpers to build minimal fixtures.
const fullTender: TenderForCompleteness = {
  title: "Site civil works",
  siteId: "site-1",
  estimatorUserId: "user-1"
};

const fullBuilder: BuilderDraft = {
  clientId: "c1",
  clientName: "Acme",
  contactId: "contact-1",
  submissionDate: "2026-10-01"
};

const pkg: PackageRef = {
  id: "p1",
  disciplineItemId: "d1",
  value: "EARTHWORKS",
  label: "Earthworks",
  sortOrder: 1
};

const cell: MatrixCell = { tenderClientId: "tc1", tenderPackageId: "p1" };

const rateSet: RateSetForCompleteness = { id: "rs-1" };

// -------------------------------------------------------------------------
// State 4a: barely-started draft -- 1 of 5
// -------------------------------------------------------------------------
describe("barely-started draft (state 4a) -- 1 of 5", () => {
  it("gives readyCount = 1 when only project is done", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [], // no builders
      [], // no packages
      [], // no cells
      [], // no docs
      null // no rates
    );
    expect(result.readyCount).toBe(1);
    expect(result.checkableCount).toBe(5);
  });

  it("project step is ready", () => {
    const result = deriveDraftCompleteness(fullTender, [], [], [], [], null);
    const project = result.steps.find((s) => s.step === "project");
    expect(project?.state).toBe("ready");
  });

  it("builders, packages, documents, rates are outstanding", () => {
    const result = deriveDraftCompleteness(fullTender, [], [], [], [], null);
    const outstanding = result.steps
      .filter((s) => s.state === "outstanding")
      .map((s) => s.step);
    expect(outstanding).toContain("builders");
    expect(outstanding).toContain("packages");
    expect(outstanding).toContain("documents");
    expect(outstanding).toContain("rates");
  });

  it("ai and review are not-checkable", () => {
    const result = deriveDraftCompleteness(fullTender, [], [], [], [], null);
    const nc = result.steps.filter((s) => s.state === "not-checkable").map((s) => s.step);
    expect(nc).toContain("ai");
    expect(nc).toContain("review");
  });
});

// -------------------------------------------------------------------------
// State 4b: "as finished as possible" -- max natural readyCount
// Documents degrades to partial (bucket-coverage mapping not available),
// so the max natural readyCount is 4 of 5. The panel's "5/5" heading is
// tested in draft-progress-panel.test.tsx by patching the completeness.
// -------------------------------------------------------------------------
describe("finished draft (state 4b) -- max natural completeness", () => {
  it("gives readyCount = 4 (documents always partial, see PR body for why)", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [fullBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet
    );
    // project, builders, packages, rates = 4 ready; documents = partial
    expect(result.readyCount).toBe(4);
  });

  it("project, builders, packages, and rates are all ready", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [fullBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet
    );
    const checkableReadySteps = result.steps
      .filter((s) => s.step !== "ai" && s.step !== "review" && s.step !== "documents")
      .map((s) => s.state);
    for (const state of checkableReadySteps) {
      expect(state).toBe("ready");
    }
  });

  it("documents step is partial when files present (no bucket mapping)", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [fullBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet
    );
    expect(result.steps.find((s) => s.step === "documents")?.state).toBe("partial");
  });
});

// -------------------------------------------------------------------------
// Locked rates + missing submission date -> builders partial + rates ready
// -------------------------------------------------------------------------
describe("locked rates + builder missing submission date", () => {
  it("builders step is partial, rates step is ready", () => {
    const incompleteBuilder: BuilderDraft = {
      clientId: "c2",
      clientName: "Beta Builders",
      contactId: "contact-2",
      submissionDate: null // missing submission date
    };
    const result = deriveDraftCompleteness(
      fullTender,
      [incompleteBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet // rates locked
    );
    const buildersStep = result.steps.find((s) => s.step === "builders");
    const ratesStep = result.steps.find((s) => s.step === "rates");
    expect(buildersStep?.state).toBe("partial");
    expect(ratesStep?.state).toBe("ready");
  });

  it("readyCount excludes the partial builders step", () => {
    const incompleteBuilder: BuilderDraft = {
      clientId: "c2",
      clientName: "Beta Builders",
      contactId: null, // missing contact
      submissionDate: null
    };
    const result = deriveDraftCompleteness(
      fullTender,
      [incompleteBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet
    );
    // project ready, builders partial (not ready), packages ready, docs partial, rates ready
    // ready = project + packages + rates = 3
    expect(result.readyCount).toBeLessThan(5);
    const ratesStep = result.steps.find((s) => s.step === "rates");
    expect(ratesStep?.state).toBe("ready");
  });
});

// -------------------------------------------------------------------------
// Edge: project step outstanding when any required field missing
// -------------------------------------------------------------------------
describe("project step outstanding cases", () => {
  it("outstanding when title missing", () => {
    const result = deriveDraftCompleteness(
      { title: "", siteId: "s1", estimatorUserId: "u1" },
      [], [], [], [], null
    );
    expect(result.steps.find((s) => s.step === "project")?.state).toBe("outstanding");
  });

  it("outstanding when siteId missing", () => {
    const result = deriveDraftCompleteness(
      { title: "My tender", siteId: null, estimatorUserId: "u1" },
      [], [], [], [], null
    );
    expect(result.steps.find((s) => s.step === "project")?.state).toBe("outstanding");
  });

  it("outstanding when estimatorUserId missing", () => {
    const result = deriveDraftCompleteness(
      { title: "My tender", siteId: "s1", estimatorUserId: null },
      [], [], [], [], null
    );
    expect(result.steps.find((s) => s.step === "project")?.state).toBe("outstanding");
  });
});

// -------------------------------------------------------------------------
// Documents step always partial (not ready) because mapping is not available
// -------------------------------------------------------------------------
describe("documents step degraded to file count", () => {
  it("is outstanding when 0 files", () => {
    const result = deriveDraftCompleteness(fullTender, [fullBuilder], [pkg], [cell], [], rateSet);
    expect(result.steps.find((s) => s.step === "documents")?.state).toBe("outstanding");
  });

  it("is partial when files present (bucket coverage unknown)", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [fullBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }, { id: "doc-2" }],
      rateSet
    );
    expect(result.steps.find((s) => s.step === "documents")?.state).toBe("partial");
  });

  it("readyCount is 4 of 5 when files present but docs step is partial", () => {
    const result = deriveDraftCompleteness(
      fullTender,
      [fullBuilder],
      [pkg],
      [cell],
      [{ id: "doc-1" }],
      rateSet
    );
    // project, builders, packages, rates = 4 ready; documents = partial
    expect(result.readyCount).toBe(4);
  });
});
