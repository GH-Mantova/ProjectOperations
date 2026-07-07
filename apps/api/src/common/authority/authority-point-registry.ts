// Authority-point registry — the typed catalogue of dotted-key actions that
// AuthorityService.check consults. Mirrors permission-registry (code as
// truth). Consumers reference these keys when calling check(); the future
// compliance pass walks this list to author configurable AuthorityRule rows.
//
// This PR ships the seam only — no feature calls check() yet, and the
// AuthorityRule store is empty by default, so absence of rules = open
// ceiling for every key here.

export const authorityPointRegistry = [
  {
    key: "procurement.purchase.approve",
    module: "procurement",
    description: "Approve a purchase order or committed spend"
  },
  {
    key: "comms.approval.decide",
    module: "correspondence",
    description: "Decide (approve or reject) an outbound correspondence approval request"
  },
  {
    key: "comms.approval.overrule",
    module: "correspondence",
    description: "Overrule a prior correspondence approval decision"
  }
] as const;

export type AuthorityPointKey = (typeof authorityPointRegistry)[number]["key"];
