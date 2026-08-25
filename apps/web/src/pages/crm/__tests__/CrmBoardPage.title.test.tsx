/**
 * Regression guard for the CrmBoardPage H1 title.
 *
 * History: the page heading read "CRM" through three separate fix passes
 * (PR #777, PR #1024, PR #1099) without any of them touching this string.
 * The canonical label is "Leads & opportunities" — matching ShellLayout.tsx
 * breadcrumb (line 483) and sidebar nav label (line 176-182).
 *
 * The web workspace has no jsdom / @testing-library set up (all existing
 * specs are pure-logic tests). We cover the exported PAGE_TITLE constant
 * which the component renders directly, so a future rename of that constant
 * or its value will break this test before it reaches production.
 */

import { describe, expect, it } from "vitest";
import { PAGE_TITLE } from "../CrmBoardPage";

describe("CrmBoardPage PAGE_TITLE", () => {
  it('equals "Leads & opportunities" exactly', () => {
    expect(PAGE_TITLE).toBe("Leads & opportunities");
  });

  it('does not contain the string "CRM" (heading must not regress to old value)', () => {
    expect(PAGE_TITLE).not.toBe("CRM");
    expect(PAGE_TITLE.includes("CRM")).toBe(false);
  });

  it("uses a literal ampersand character, not an HTML entity", () => {
    // The rendered DOM must show & not &amp; — React renders JSX string values
    // verbatim, so PAGE_TITLE must carry the literal character.
    expect(PAGE_TITLE).toContain("&");
    expect(PAGE_TITLE).not.toContain("&amp;");
  });
});
