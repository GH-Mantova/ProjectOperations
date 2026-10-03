/**
 * Tests for PR_TITLE_MODULE_V1: the watcher appends a title-scope footer to the
 * stdin of a build prompt so the agent uses the correct conventional-commit scope.
 *
 * Covers:
 *   1. titleFooter() produces the right text.
 *   2. resolvePromptModule() on a declared-module fixture returns the declared value.
 *   3. resolvePromptModule() on a derivable fixture returns the derived value.
 *   4. resolvePromptModule() on an ambiguous fixture returns null.
 *   5. resolvePromptModule() on an unparseable file returns null without throwing.
 *
 * Runs with: node --test scripts/pr-watcher/__tests__/*.mjs
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { titleFooter } from "../index.mjs";
import { resolvePromptModule } from "../../pipeline/lint-prompt.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOOD_BODY =
  "---\n" +
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\n" +
  "scope:\n  - apps/api/src/modules/rates/**\n" +
  "done_when: pnpm build\n" +
  "size: 3\n" +
  "gate_allow: none\n" +
  "---\n\n" +
  "## STANDING AUTHORITY\n\n" +
  "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

// ---------------------------------------------------------------------------
// titleFooter
// ---------------------------------------------------------------------------

describe("titleFooter", () => {
  test("contains the module value in backticks", () => {
    const f = titleFooter("tendering");
    assert.ok(f.includes("`tendering`"), "expected `tendering` in footer; got: " + f);
  });

  test("contains the PR_TITLE_MODULE_V1 tag", () => {
    const f = titleFooter("tendering");
    assert.ok(f.includes("PR_TITLE_MODULE_V1"), "expected PR_TITLE_MODULE_V1 in footer; got: " + f);
  });

  test("starts with a blank line and a --- separator", () => {
    const f = titleFooter("crm");
    assert.ok(f.startsWith("\n\n---\n"), "expected footer to start with \\n\\n---\\n; got: " + JSON.stringify(f.slice(0, 10)));
  });

  test("different modules produce different footers", () => {
    assert.notEqual(titleFooter("rates"), titleFooter("crm"));
  });
});

// ---------------------------------------------------------------------------
// resolvePromptModule
// ---------------------------------------------------------------------------

describe("resolvePromptModule — declared module", () => {
  test("a fixture with module: crm returns crm / declared", () => {
    const text =
      "---\n" +
      "premise: 'true'\n" +
      "premise_means: test\n" +
      "scope:\n  - apps/api/src/modules/crm/**\n" +
      "done_when: pnpm build\n" +
      "size: 3\n" +
      "gate_allow: none\n" +
      "module: crm\n" +
      "---\n\n" +
      "## STANDING AUTHORITY\n\n" +
      "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";
    const r = resolvePromptModule(text);
    assert.strictEqual(r.module, "crm", "expected module=crm; got: " + r.module);
    assert.strictEqual(r.source, "declared", "expected source=declared; got: " + r.source);
  });
});

describe("resolvePromptModule — derived module", () => {
  test("a fixture with apps/api/src/modules/rates/** in scope returns rates / derived", () => {
    const text =
      "---\n" +
      "premise: 'true'\n" +
      "premise_means: test\n" +
      "scope:\n  - apps/api/src/modules/rates/**\n" +
      "done_when: pnpm build\n" +
      "size: 3\n" +
      "gate_allow: none\n" +
      "---\n\n" +
      "## STANDING AUTHORITY\n\n" +
      "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";
    const r = resolvePromptModule(text);
    assert.strictEqual(r.module, "rates", "expected module=rates; got: " + r.module);
    assert.strictEqual(r.source, "derived", "expected source=derived; got: " + r.source);
  });
});

describe("resolvePromptModule — ambiguous module", () => {
  test("a fixture with two product modules in scope returns null", () => {
    const text =
      "---\n" +
      "premise: 'true'\n" +
      "premise_means: test\n" +
      "scope:\n  - apps/api/src/modules/rates/**\n  - apps/api/src/modules/procurement/**\n" +
      "done_when: pnpm build\n" +
      "size: 3\n" +
      "gate_allow: none\n" +
      "---\n\n" +
      "## STANDING AUTHORITY\n\n" +
      "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";
    const r = resolvePromptModule(text);
    assert.strictEqual(r.module, null, "expected module=null for ambiguous; got: " + r.module);
  });
});

describe("resolvePromptModule — unparseable file", () => {
  test("garbage input returns null without throwing", () => {
    let r;
    assert.doesNotThrow(() => {
      r = resolvePromptModule("this is not yaml front matter at all");
    });
    assert.strictEqual(r.module, null, "expected module=null for unparseable; got: " + r.module);
  });

  test("empty string returns null without throwing", () => {
    let r;
    assert.doesNotThrow(() => {
      r = resolvePromptModule("");
    });
    assert.strictEqual(r.module, null);
  });
});
