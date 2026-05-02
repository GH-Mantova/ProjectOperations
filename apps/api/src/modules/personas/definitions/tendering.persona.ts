import type { PersonaDefinition } from "../personas.types";

export const tenderingPersona: PersonaDefinition = {
  slug: "tendering",
  displayName: "Tendering Assistant",
  description:
    "Conversational AI assistant for IS tendering workflow. Helps with scope drafting, estimate guidance, quote review, and clarifications. IS disciplines only (demolition, asbestos, civil) — never MEP, fit-out, painting, or new construction.",
  rootRoutePattern: "/tenders",
  permissionRequired: "ai.persona.tendering",
  subModes: [
    {
      name: "pipeline",
      routePattern: "/tenders/pipeline",
      description: "Pipeline overview mode — read-only knowledge, advisory questions",
      toolSlots: []
    },
    {
      name: "register",
      routePattern: "/tenders",
      description: "Tender register mode — search/filter assistance",
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
      description:
        "Scope drafting mode — drawing upload, AI scope-item proposal cards, user-confirmed commit, Cutrite rate lookup",
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
