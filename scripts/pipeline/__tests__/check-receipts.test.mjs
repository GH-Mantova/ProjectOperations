// Tests for RECEIPT_SHAPE_GUARD_V1 (scripts/pipeline/check-receipts.mjs).
//
// The guard exists because a UTF-8 BOM silently defeats CP-26's front-matter regex.
// A test that only checked "good receipt passes" would have passed on 2026-09-14 too,
// with 26 unreadable receipts already committed. So each case here is one of the
// shapes actually found on main that day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GUARD = path.join(process.cwd(), "scripts", "pipeline", "check-receipts.mjs");

const GOOD = "---\npr: 1234\napproved_by: marco\napproved_at: 2026-09-15T07:00:00Z\n---\n\nApproved because the gates were open.\n";

function runOn(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rcpt-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, typeof content === "string" ? "utf8" : undefined);
  }
  const r = spawnSync(process.execPath, [GUARD, dir], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

test("a well-formed receipt passes", () => {
  const r = runOn({ "1234.md": GOOD });
  assert.equal(r.code, 0, r.out);
});

test("a UTF-8 BOM fails - this is the defect CP-26 could not see", () => {
  const r = runOn({ "1234.md": Buffer.from("﻿" + GOOD, "utf8") });
  assert.equal(r.code, 1);
  assert.match(r.out, /BOM/);
});

test("a doubled front-matter block fails", () => {
  const dup = GOOD.slice(0, GOOD.indexOf("---\n\n") + 4) + GOOD;
  const r = runOn({ "1234.md": dup });
  assert.equal(r.code, 1);
  assert.match(r.out, /front-matter blocks/);
});

test("the pr field must match the file name", () => {
  const r = runOn({ "1235.md": GOOD });
  assert.equal(r.code, 1);
  assert.match(r.out, /but the file is named/);
});

test("front matter with no body content fails", () => {
  const r = runOn({ "1234.md": "---\npr: 1234\napproved_by: marco\napproved_at: 2026-09-15T07:00:00Z\n---\n" });
  assert.equal(r.code, 1);
  assert.match(r.out, /no body content/);
});

test("an unparseable approved_at fails", () => {
  const r = runOn({ "1234.md": GOOD.replace("2026-09-15T07:00:00Z", "whenever") });
  assert.equal(r.code, 1);
  assert.match(r.out, /does not parse as a date/);
});

test("README.md is not treated as a receipt", () => {
  const r = runOn({ "1234.md": GOOD, "README.md": "# Template\n\nNo front matter here.\n" });
  assert.equal(r.code, 0, r.out);
});
