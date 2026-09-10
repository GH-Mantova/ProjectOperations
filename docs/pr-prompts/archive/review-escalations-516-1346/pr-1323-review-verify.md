# PR #1323 — Marco Verification Steps

**PR:** feat(pipeline): arm-prompt.ps1 serializer — exclusive lock + index guards  
**Status:** NEEDS-MARCO-VERIFY  
**Reason:** Originating prompt not found in docs/pr-prompts/ (house rule compliance check), plus two CI jobs still pending.

## Steps for Marco

### 1. Locate originating prompt (if it exists)
Search the codebase for the prompt that fired this PR:
- Check `docs/pr-prompts/` for any `-HOLD.md` or `-ready.md` files mentioning "arm-lock" or "serializer".
- Check git log for when `scripts/pipeline/arm-prompt.ps1` or similar was first added to a prompt.
- If the prompt was deleted or moved, recover it or confirm this was a manual creation.

If this PR was manually created outside house rules (Cowork CLI), document that decision.

### 2. Wait for pending CI to complete
Two jobs still in progress as of 2026-08-25 12:30:
- "API — lint, test, compliance smoke" (started 12:27:44)
- "tendering-e2e" (started 12:27:46)

Refresh the PR status and confirm both are green before proceeding.

### 3. Verify the lock/index-guard logic against the three 2026-08-24 incidents

**Incident 1:** Commit `488f138a` swept HOLD→ready renames of `pr-nopr-s1-dismissed-means-proceed` and `pr-nopr-s2-hard-failure-bounded-restage` into an unrelated docs commit.
- **With arm-prompt.ps1:** The docs commit would only be possible if a chat:
  a. Called `arm-prompt.ps1` (acquiring lock).
  b. Renamed both HOLD files (staged).
  c. Another chat then committed while the lock was still held.
  - **Protection:** Impossible. The renaming chat holds the lock until `finally` releases it. Other chats cannot commit the renames because they will be staged in the holder's index, not theirs.

**Incident 2:** `pr-lessons-folder-s1-restore` HOLD→ready was staged by another chat.
- **With arm-prompt.ps1:** Each chat that arms must call the script. The script holds the lock exclusively, preventing concurrent renames.
- **Protection:** Guaranteed. Only one chat can hold the lock at a time. Once released, the lock file is deleted. Next caller starts fresh.

**Incident 3:** Four CRM arming renames sat staged across three unrelated commits.
- **With arm-prompt.ps1:** If a chat calls the script, the index-guard **after** rename (line ~300) checks `git diff --cached --name-status` for exactly two expected paths. If extras are staged, the script:
  1. Restores the extras to unstaged state (undoes index pollution).
  2. Undoes the rename (exit 3).
  3. Releases the lock.
- **Protection:** Index pollution is detected and rolled back. The rename is not staged if extras sneaked in during the rename window.

Confirm by reading the script logic:
- `Assert-CleanIndex` (line ~155): blocks if index non-empty on entry.
- `Assert-IndexExactlyTwoPaths` (line ~295): fails if extras detected after rename.
- `finally` block (line ~320): always releases lock.

### 4. Review test coverage

The test suite passes 7 cases. Spot-check one: the "lock held" test (around line 366 in arm-prompt.test.mjs).
- It spawns a concurrent PowerShell process that acquires the lock.
- It waits for the "LOCK_ACQUIRED" signal.
- It tries to arm with a 3-second timeout.
- It expects non-zero exit (timeout).
- It kills the lock-holder.

This confirms the lock mechanism works end-to-end with real Windows file locking.

### 5. Decision

If all of the above check out:
- Remove the `do-not-merge` label from the PR.
- Approve the PR (or directly merge if you prefer).
- Document in commit message or follow-up comment why this was manually created (if applicable).

If the originating prompt cannot be found and this violates house rules:
- Ask the subagent to re-fire a formal prompt so it's tracked.
- Or document an exception in `/sot/05-decisions-and-lessons.md`.

---

**Next action:** Marco to verify steps 1 and 2 above, confirm CI green, then decide merge readiness.
