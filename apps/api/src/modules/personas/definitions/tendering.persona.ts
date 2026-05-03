import type { PersonaDefinition } from "../personas.types";

export const tenderingPersona: PersonaDefinition = {
  slug: "tendering",
  displayName: "Tendering Assistant",
  description:
    "Conversational AI assistant for IS tendering workflow. Helps with scope drafting, estimate guidance, quote review, and clarifications. IS disciplines only (demolition, asbestos, civil) — never MEP, fit-out, painting, or new construction.",
  rootRoutePattern: "/tenders",
  permissionRequired: "ai.persona.tendering",
  // Routes excluded from Tendering Assistant matching:
  // - /tenders/dashboard → operations Tendering KPI dashboard, belongs to the
  //   future Dashboard Master persona (not Tendering Assistant).
  // - /tenders/pipeline | /tenders/create | /tenders/workspace → defunct
  //   Codex-era routes that App.tsx redirects to /tenders. Excluded so the
  //   matcher doesn't briefly resolve them as /tenders/:id (treating
  //   "pipeline"/"create"/"workspace" as tender IDs) before the redirect lands.
  excludedRoutes: [
    "/tenders/dashboard",
    "/tenders/pipeline",
    "/tenders/create",
    "/tenders/workspace"
  ],
  subModes: [
    // The previous definition split "register" (/tenders) and "pipeline"
    // (/tenders/pipeline) as separate sub-modes. That doesn't reflect the
    // actual UI: TenderingPage at /tenders renders BOTH views (kanban
    // pipeline + list register) toggleable via component state — there's no
    // URL difference. The /tenders/pipeline URL just redirects to /tenders
    // (PR #78 retired it). Splitting them caused the panel header to read
    // "Tender register mode" when the user was looking at the pipeline tab
    // (the default view). Collapsed into a single "register" sub-mode that
    // owns /tenders and acknowledges both views in its description.
    // A future PR can re-split if TenderingPage starts syncing the view
    // toggle to a ?view= query param.
    {
      name: "register",
      routePattern: "/tenders",
      description:
        "Tender overview mode — register list (search/filter/sort) and pipeline kanban share this URL; pipeline is the default view",
      toolSlots: []
    },
    {
      name: "tender-detail",
      routePattern: "/tenders/:id",
      description: "Tender detail mode — answer questions about the tender",
      toolSlots: []
    },
    {
      name: "scope",
      routePattern: "/tenders/:id/scope",
      description: [
        "Scope drafting mode for the current tender. Initial Services works",
        "in three disciplines only: demolition, asbestos removal, and civil",
        "works. Do not propose scope items outside these disciplines —",
        "never MEP, fit-out, painting, or new construction.",
        "",
        "When you have enough context (project type, location, scale, key",
        "features, materials), use the propose_scope_items tool to suggest",
        "concrete scope items. Each proposal must include discipline,",
        "title, description, quantity, unit, and any relevant notes.",
        "",
        "If the user has not given you enough information, ask clarifying",
        "questions BEFORE proposing — never guess at quantities or",
        "fabricate items to fill the response. Quality over quantity.",
        "",
        "Proposals you make are reviewed by the user before being committed",
        "to the tender's scope of works. The user can accept, edit, or",
        "reject each proposal individually, or accept/reject all pending",
        "proposals in bulk."
      ].join("\n"),
      toolSlots: []
    },
    {
      name: "estimate",
      routePattern: "/tenders/:id/estimate",
      description: "Estimate mode — rate lookup, value suggestions, advisory only",
      toolSlots: []
    },
    {
      name: "quote",
      routePattern: "/tenders/:id/quote",
      description:
        "Quote mode — cost line structure suggestions, exclusion/assumption suggestions, advisory only",
      toolSlots: []
    },
    {
      name: "clarifications",
      routePattern: "/tenders/:id/clarifications",
      description: "Clarifications mode — summarisation, response suggestions",
      toolSlots: []
    }
  ]
};
