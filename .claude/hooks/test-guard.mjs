#!/usr/bin/env node
/**
 * Test the guard. TWO halves, and the SECOND is the one that matters:
 *
 *   A. It BLOCKS what must never happen.
 *   B. It ALLOWS every command the watcher and the stations actually run.
 *
 * (B) is why the previous version of this hook was thrown away without ever running: it denied git
 * inside C:\po-watcher, where the watcher's own agents WORK. It would have bricked the queue on the
 * first run. A guard that stops the pipeline is not a safety feature, it is an outage.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "guard.mjs");

function run(command) {
  const payload = JSON.stringify({ tool_name: "Bash", tool_input: { command } });
  try {
    execFileSync("node", [HOOK], { input: payload, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return { blocked: false, msg: "" };
  } catch (e) {
    return { blocked: e.status === 2, msg: String(e.stderr || "").split("\n")[0] };
  }
}

let pass = 0, fail = 0;
function expect(command, shouldBlock, why) {
  const r = run(command);
  const ok = r.blocked === shouldBlock;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}  ${shouldBlock ? "BLOCK " : "ALLOW "} ${why}`);
  if (!ok) console.log(`        cmd: ${command}`);
  ok ? pass++ : fail++;
}

console.log("=== MUST BLOCK — Azure / Entra / SharePoint (absolute hard stop)");
expect('az webapp config appsettings set --name proj --settings X=1', true, "az webapp config");
expect('az login', true, "az login");
expect('Connect-MgGraph -Scopes "Mail.Send"', true, "Connect-MgGraph");
expect('New-MgApplicationPassword -ApplicationId x', true, "Graph write cmdlet");
expect('Restart-AzWebApp -Name proj', true, "Az write cmdlet");
expect('curl https://graph.microsoft.com/v1.0/users', true, "direct Graph REST");
expect('Connect-PnPOnline -Url https://x.sharepoint.com', true, "SharePoint PnP");

// The REAL list is empty right now (#538 and #552 were both discharged on 2026-07-14). So point the
// hook at a FIXTURE to prove the never-merge arm actually bites. A guard never observed to fire is
// not a guard, it is a comment — DOCTRINE §7. Testing "it blocks 552" would have quietly rotted into
// a passing test that guards nothing the moment 552 merged. Which it did, at 03:51 today.
console.log("\n=== MUST BLOCK — NEVER-MERGE (tested against a fixture: the real list is empty)");
{
  const fixture = join(tmpdir(), "never-merge-fixture.ps1");
  writeFileSync(fixture, '$script:NEVER_MERGE = @(777, 888)\n', "utf8");
  process.env.GUARD_LIB_PATH = fixture;

  expect('gh pr merge 777 --squash', true, "gh pr merge 777 (on the fixture list)");
  expect('gh pr merge --squash --auto 888', true, "888 in any arg position");
  expect('gh pr merge 561 --squash', false, "561 is NOT on the list — allowed");
  expect('gh pr view 777 --json state', false, "READING a listed PR is fine — only merging is blocked");

  delete process.env.GUARD_LIB_PATH;
}

console.log("\n=== the REAL list is empty, so nothing is currently refused (this is CORRECT)");
expect('gh pr merge 552 --squash', false, "#552 discharged 03:51Z — merged, rates reviewed");

console.log("\n=== MUST BLOCK — irreversible against main");
expect('git push --force origin main', true, "force-push main");
expect('git push origin :main', true, "delete main");
expect('git branch -D main', true, "delete local main");

console.log("\n=== MUST ALLOW — what the watcher and stations actually run every single day");
expect('git checkout -b fix/foo origin/main', false, "create a branch");
expect('git commit -m "fix: thing"', false, "commit");
expect('git push -u origin fix/foo', false, "push a feature branch");
expect('git push --force-with-lease origin fix/foo', false, "force-push a FEATURE branch (rebases!)");
expect('git rebase origin/main', false, "rebase");
expect('git merge origin/main', false, "merge main INTO a branch");
expect('git checkout main', false, "checkout main (the watcher does this constantly)");
expect('git reset --hard origin/fix/foo', false, "reset a feature branch");
expect('gh pr create --base main --head fix/foo --title t --body b', false, "open a PR");
expect('gh pr merge 561 --squash --auto', false, "merge a NORMAL pr");
expect('gh pr checks 561', false, "read checks");
expect('gh run view 123 --job 456 --log', false, "read the CI job log");
expect('pnpm build && pnpm lint', false, "build + lint");
expect('pnpm exec playwright test tests/e2e/pr-acceptance', false, "run the acceptance suite");
expect('node scripts/data-model/build-relationship-map.mjs --check', false, "regenerate the map");
expect('docker exec -i project-operations-postgres psql -U project_ops -c "SELECT 1"', false, "query the dev DB");
expect('pnpm prisma:migrate', false, "run migrations on dev");

console.log("\n=== MUST ALLOW — false-positive traps (these merely MENTION the forbidden words)");
expect('grep -r "az" apps/api/src', false, 'grep for the literal "az"');
expect('echo "do not touch azure"', false, "the word azure in a string");
expect('git log --oneline | grep 552', false, "552 in a NON-merge command");
expect('gh pr view 552 --json state', false, "READING #552 is fine — only merging is blocked");
expect('cat docs/pipeline/DOCTRINE.md', false, "reading the doctrine that mentions all of this");

console.log(`\n=== ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
