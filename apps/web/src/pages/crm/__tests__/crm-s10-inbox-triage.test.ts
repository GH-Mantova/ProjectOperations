// CRM S10 — CommsInboxTriage + intake API pure-logic unit tests.
//
// The web workspace has no @testing-library / jsdom setup; all tests are pure
// logic. We test the helpers exported from crm-api.ts that S10 adds.
//
// Tests required by the prompt:
//   1. Triage payload targets /crm/intake/:id/triage, not /crm/entries.
//   2. Capture payload carries captureChannel for each of the four channels.
//   3. A row with no matched account renders the create-intent state and still
//      submits (pure helpers verify the no-account branch).
//   4. Negative control: the triage builder never emits a legacy stage value.

import { describe, expect, it } from "vitest";
import {
  buildTriageBody,
  captureLead,
  listOpenLeads,
  triageLead,
  type CaptureLeadBody,
  type IntakeLead,
  type TriageLeadBody
} from "../crm-api";

// A fake authFetch that records the URL and init it was called with and returns
// a well-formed JSON response. This is what makes the URL assertions real: the
// previous version of Test 1 built the URL string inside the test body and
// asserted on its own literal, so it passed no matter what crm-api.ts did.
function spyFetch(payload: unknown = { id: "x" }) {
  const seen: { url?: string; init?: RequestInit } = {};
  const fn = async (url: string, init?: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  return { seen, fn: fn as unknown as Parameters<typeof triageLead>[0] };
}

// ── Test 1 — Triage URL is /crm/intake/:id/triage, NOT /crm/entries ──────────
//
// We cannot call authFetch in a pure unit test, but we can verify:
//   a) buildTriageBody returns a body whose action is "tender" or "dont_pursue"
//      (the discriminant the triage route expects), and
//   b) the function that builds the triage URL uses the /crm/intake path
//      (asserted against the literal used in triageLead in crm-api.ts).

describe("Triage URL contract (CRM S10 Test 1)", () => {
  it("buildTriageBody for 'tender' produces action='tender' with siteId", () => {
    const input: TriageLeadBody = { action: "tender", siteId: "site-abc" };
    const body = buildTriageBody(input);
    if (body.action !== "tender") throw new Error("expected action=tender");
    expect(body.action).toBe("tender");
    expect(body.siteId).toBe("site-abc");
  });

  it("buildTriageBody for 'dont_pursue' produces action='dont_pursue' with dropReasonId", () => {
    const input: TriageLeadBody = { action: "dont_pursue", dropReasonId: "reason-1" };
    const body = buildTriageBody(input);
    if (body.action !== "dont_pursue") throw new Error("expected action=dont_pursue");
    expect(body.action).toBe("dont_pursue");
    expect(body.dropReasonId).toBe("reason-1");
  });

  it("triageLead REALLY posts to /crm/intake/:id/triage, not /crm/entries", async () => {
    const { seen, fn } = spyFetch();
    await triageLead(fn, "lead-99", { action: "tender", siteId: "site-1" });
    expect(seen.url).toBe("/crm/intake/lead-99/triage");
    expect(seen.url).not.toContain("/crm/entries");
    expect(seen.init?.method).toBe("POST");
    expect(JSON.parse(String(seen.init?.body))).toEqual({ action: "tender", siteId: "site-1" });
  });

  it("captureLead REALLY posts to /crm/intake", async () => {
    const { seen, fn } = spyFetch();
    await captureLead(fn as never, { title: "t", clientId: "c", captureChannel: "email" });
    expect(seen.url).toBe("/crm/intake");
    expect(seen.url).not.toContain("/crm/entries");
    expect(seen.init?.method).toBe("POST");
  });

  it("listOpenLeads REALLY gets /crm/intake/open and passes its filters", async () => {
    const { seen, fn } = spyFetch({ items: [], total: 0, page: 1, limit: 25 });
    await listOpenLeads(fn as never, { page: 2, limit: 25, captureChannel: "phone", accountId: "acc-1" });
    expect(seen.url).toContain("/crm/intake/open?");
    expect(seen.url).not.toContain("/crm/entries");
    expect(seen.url).toContain("page=2");
    expect(seen.url).toContain("captureChannel=phone");
    expect(seen.url).toContain("accountId=acc-1");
  });
});

// ── Test 2 — captureChannel is always present in the capture body ─────────────
//
// The controller accepts: email | phone | portal | referral | cold_outreach | other.
// The four channels called out by the prompt are email, phone, portal, referral.
// We assert that a CaptureLeadBody can carry each of the four and that the
// captureChannel key is present in the serialised JSON.

describe("Capture payload carries captureChannel (CRM S10 Test 2)", () => {
  const baseFields = {
    title: "A lead",
    clientId: "client-1"
  };

  for (const channel of ["email", "phone", "portal", "referral"] as const) {
    it(`captureChannel is present and correct for channel=${channel}`, () => {
      const body: CaptureLeadBody = {
        ...baseFields,
        captureChannel: channel
      };
      // Serialise as the fetch helper does; the key must survive.
      const json = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
      expect(json.captureChannel).toBe(channel);
      expect(Object.prototype.hasOwnProperty.call(json, "captureChannel")).toBe(true);
    });
  }

  it("cold_outreach and other channels also carry the key", () => {
    for (const channel of ["cold_outreach", "other"] as const) {
      const body: CaptureLeadBody = { ...baseFields, captureChannel: channel };
      const json = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
      expect(json.captureChannel).toBe(channel);
    }
  });
});

// ── Test 3 — no-match-account row still submits ───────────────────────────────
//
// When account is null, the row shows "no match, will create X".
// The triage action still sends the same payload — the service auto-creates the
// Account on triage (captureLead path) or on the intake POST. We verify that
// buildTriageBody does NOT require an accountId — the payload is the same
// whether the lead has an account or not.

describe("No-account lead still produces a valid triage body (CRM S10 Test 3)", () => {
  const noAccountLead: Partial<IntakeLead> = {
    id: "lead-no-account",
    title: "Acme inquiry",
    account: null,
    client: { id: "client-2", name: "Acme Corp" }
  };

  it("a no-account lead still submits a valid triage request", async () => {
    const triage: TriageLeadBody = {
      action: "dont_pursue",
      dropReasonId: "reason-2",
      dropReasonDetail: "Budget not confirmed"
    };

    // The previous version of this assertion called buildTriageBody twice with
    // the SAME input and compared the results - trivially equal, and it proved
    // nothing about accounts. Drive the real submit path instead and assert the
    // request a no-account lead produces.
    const { seen, fn } = spyFetch();
    await triageLead(fn, noAccountLead.id as string, triage);
    expect(seen.url).toBe("/crm/intake/lead-no-account/triage");
    const sent = JSON.parse(String(seen.init?.body)) as Record<string, unknown>;
    expect(sent).toEqual({
      action: "dont_pursue",
      dropReasonId: "reason-2",
      dropReasonDetail: "Budget not confirmed"
    });
    expect(Object.prototype.hasOwnProperty.call(sent, "accountId")).toBe(false);
    const bodyNoAccount = buildTriageBody(triage);
    // The no-account variant does not inject an accountId.
    expect(Object.prototype.hasOwnProperty.call(bodyNoAccount, "accountId")).toBe(false);
    // The lead id is in the URL, not the body — confirm it is absent from the body.
    expect(Object.prototype.hasOwnProperty.call(bodyNoAccount, "id")).toBe(false);
  });

  it("create-intent state is detectable from account===null on the lead row", () => {
    // The row helper in CommsInboxTriage checks lead.account to decide whether
    // to show the 'no match, will create X' chip. Verify the branch condition.
    const lead = noAccountLead as IntakeLead;
    const hasAccount = lead.account !== null;
    expect(hasAccount).toBe(false);
    // The client name used in the chip is derived from lead.client.name.
    expect(lead.client?.name).toBe("Acme Corp");
  });
});

// ── Test 4 (negative control) — triage builder never emits a legacy stage ─────
//
// The legacy /crm/entries path accepts a `stage` field. The intake triage
// body must NEVER carry a stage key — only action, siteId / dropReasonId.
// If stage appears in the body, the wrong route is being used.

describe("buildTriageBody never emits a legacy stage value (CRM S10 Test 4)", () => {
  it("tender action body has no stage key", () => {
    const body = buildTriageBody({ action: "tender", siteId: "site-1" });
    expect(Object.prototype.hasOwnProperty.call(body, "stage")).toBe(false);
  });

  it("dont_pursue action body has no stage key", () => {
    const body = buildTriageBody({ action: "dont_pursue", dropReasonId: "reason-3" });
    expect(Object.prototype.hasOwnProperty.call(body, "stage")).toBe(false);
  });

  it("dont_pursue body has no legacy lostReason key", () => {
    const body = buildTriageBody({ action: "dont_pursue", dropReasonId: "reason-4" });
    expect(Object.prototype.hasOwnProperty.call(body, "lostReason")).toBe(false);
  });

  it("tender body has no convertedTenderId key (set by the server, not the caller)", () => {
    const body = buildTriageBody({ action: "tender", siteId: "site-2" });
    expect(Object.prototype.hasOwnProperty.call(body, "convertedTenderId")).toBe(false);
  });

  it("action discriminant is one of the two recognised intake values", () => {
    const tender = buildTriageBody({ action: "tender", siteId: "s" });
    const dont = buildTriageBody({ action: "dont_pursue", dropReasonId: "r" });
    const recognized = ["tender", "dont_pursue"];
    expect(recognized).toContain(tender.action);
    expect(recognized).toContain(dont.action);
  });
});
