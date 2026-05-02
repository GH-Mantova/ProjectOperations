import { findPersonaForRoute, getAllPersonas, getPersonaBySlug } from "../persona-registry";

describe("persona-registry", () => {
  describe("getAllPersonas", () => {
    it("returns the tendering persona", () => {
      const personas = getAllPersonas();
      expect(personas.length).toBeGreaterThanOrEqual(1);
      expect(personas.find((p) => p.slug === "tendering")).toBeDefined();
    });
  });

  describe("getPersonaBySlug", () => {
    it("returns the tendering persona by slug", () => {
      const persona = getPersonaBySlug("tendering");
      expect(persona).toBeDefined();
      expect(persona?.displayName).toBe("Tendering Assistant");
      expect(persona?.permissionRequired).toBe("ai.persona.tendering");
    });

    it("returns undefined for an unknown slug", () => {
      expect(getPersonaBySlug("nonexistent")).toBeUndefined();
    });
  });

  describe("findPersonaForRoute", () => {
    it("returns tendering + scope sub-mode for /tenders/123/scope", () => {
      const match = findPersonaForRoute("/tenders/123/scope");
      expect(match).not.toBeNull();
      expect(match?.persona.slug).toBe("tendering");
      expect(match?.subMode.name).toBe("scope");
    });

    it("returns tendering + estimate sub-mode for /tenders/abc-001/estimate", () => {
      const match = findPersonaForRoute("/tenders/abc-001/estimate");
      expect(match?.subMode.name).toBe("estimate");
    });

    it("returns tendering + quote sub-mode for /tenders/123/quote", () => {
      const match = findPersonaForRoute("/tenders/123/quote");
      expect(match?.subMode.name).toBe("quote");
    });

    it("returns tendering + clarifications sub-mode for /tenders/123/clarifications", () => {
      const match = findPersonaForRoute("/tenders/123/clarifications");
      expect(match?.subMode.name).toBe("clarifications");
    });

    it("returns null for /tenders/pipeline — defunct redirect, persona shouldn't briefly attach as tender-detail", () => {
      // /tenders/pipeline is a Codex-era redirect to /tenders (App.tsx). The
      // persona definition excludes it explicitly so the matcher doesn't
      // resolve the URL as /tenders/:id with id="pipeline" before the
      // redirect lands. Same for /tenders/create and /tenders/workspace.
      expect(findPersonaForRoute("/tenders/pipeline")).toBeNull();
    });

    it("returns null for /tenders/create — defunct redirect", () => {
      expect(findPersonaForRoute("/tenders/create")).toBeNull();
    });

    it("returns null for /tenders/workspace — defunct redirect", () => {
      expect(findPersonaForRoute("/tenders/workspace")).toBeNull();
    });

    it("returns tendering + tender-detail sub-mode for /tenders/:id (no inner segment)", () => {
      const match = findPersonaForRoute("/tenders/abc123");
      expect(match?.subMode.name).toBe("tender-detail");
    });

    it("returns tendering + register sub-mode for exact /tenders", () => {
      const match = findPersonaForRoute("/tenders");
      expect(match?.subMode.name).toBe("register");
    });

    it("register sub-mode description acknowledges both register and pipeline views (post-collapse)", () => {
      // Regression for the visual-smoke bug fixed in this PR: TenderingPage
      // at /tenders defaults to the pipeline (kanban) view, but the persona
      // sub-mode used to read "Tender register mode — search/filter
      // assistance" only. Now the description must mention pipeline too so
      // users on the default view don't see a misleading subtitle.
      const match = findPersonaForRoute("/tenders");
      expect(match?.subMode.description.toLowerCase()).toContain("pipeline");
    });

    it("returns null for unrelated routes", () => {
      expect(findPersonaForRoute("/dashboards")).toBeNull();
      expect(findPersonaForRoute("/jobs/123")).toBeNull();
      expect(findPersonaForRoute("/")).toBeNull();
    });

    it("does not match routes that merely share a prefix string (/tenderdocuments)", () => {
      expect(findPersonaForRoute("/tenderdocuments")).toBeNull();
    });

    it("ignores trailing slashes", () => {
      expect(findPersonaForRoute("/tenders/")?.subMode.name).toBe("register");
      expect(findPersonaForRoute("/tenders/123/scope/")?.subMode.name).toBe("scope");
    });

    it("ignores unrelated query strings and hash fragments", () => {
      expect(findPersonaForRoute("/tenders/123/scope?foo=bar")?.subMode.name).toBe("scope");
      expect(findPersonaForRoute("/tenders/123/estimate#section")?.subMode.name).toBe("estimate");
    });

    describe("?detail= query param (Tendering tab-based sub-modes)", () => {
      it("treats /tenders/:id?detail=scope as equivalent to /tenders/:id/scope", () => {
        expect(findPersonaForRoute("/tenders/123?detail=scope")?.subMode.name).toBe("scope");
      });

      it("treats ?detail=quote as equivalent to /quote", () => {
        expect(findPersonaForRoute("/tenders/abc-001?detail=quote")?.subMode.name).toBe("quote");
      });

      it("treats ?detail=estimate as equivalent to /estimate", () => {
        expect(findPersonaForRoute("/tenders/123?detail=estimate")?.subMode.name).toBe("estimate");
      });

      it("treats ?detail=clarifications as equivalent to /clarifications", () => {
        expect(findPersonaForRoute("/tenders/123?detail=clarifications")?.subMode.name).toBe(
          "clarifications"
        );
      });

      it("falls back to tender-detail when ?detail= names an unknown sub-mode", () => {
        expect(findPersonaForRoute("/tenders/123?detail=unknown")?.subMode.name).toBe("tender-detail");
      });

      it("ignores unrelated query params and matches base sub-mode", () => {
        // Use /tenders/123?someOther=foo — matches tender-detail. Original
        // assertion used /tenders/pipeline which is now an excluded route.
        expect(findPersonaForRoute("/tenders/123?someOther=foo")?.subMode.name).toBe(
          "tender-detail"
        );
      });

      it("returns null for unrelated routes regardless of detail param", () => {
        expect(findPersonaForRoute("/dashboards?detail=scope")).toBeNull();
      });

      it("matches /tenders/:id with no detail to tender-detail sub-mode", () => {
        expect(findPersonaForRoute("/tenders/123")?.subMode.name).toBe("tender-detail");
      });
    });

    describe("excludedRoutes", () => {
      it("/tenders/dashboard is excluded — operations dashboard, not a tender", () => {
        expect(findPersonaForRoute("/tenders/dashboard")).toBeNull();
      });

      it("/tenders/dashboard/ (trailing slash) is excluded too", () => {
        expect(findPersonaForRoute("/tenders/dashboard/")).toBeNull();
      });

      it("/tenders/dashboard?detail=anything stays excluded — query string can't bypass", () => {
        expect(findPersonaForRoute("/tenders/dashboard?detail=anything")).toBeNull();
      });

      it("real tender IDs that look like the excluded value still match", () => {
        // Sanity: exclusion is exact-match, not substring.
        expect(findPersonaForRoute("/tenders/IS-T020")?.subMode.name).toBe("tender-detail");
        expect(findPersonaForRoute("/tenders/dashboardx")?.subMode.name).toBe("tender-detail");
        expect(findPersonaForRoute("/tenders/dashboard-2026")?.subMode.name).toBe("tender-detail");
      });
    });
  });
});
