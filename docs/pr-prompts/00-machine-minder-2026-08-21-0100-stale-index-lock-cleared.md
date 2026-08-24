# Machine Minder notice - stale git index.lock cleared

**When:** 2026-08-21 ~01:09 UTC
**Station:** 03 - Machine Minder, dispatched by Station 00 (Supervisor)
**Authorised by:** Marco, explicitly, via Station 00, 2026-08-21

## What was removed

Exactly one file: `C:\ProjectOperations2\.git\index.lock`

Nothing else was deleted, moved, renamed or modified. No board mutation was
performed: no prompt was armed, disarmed, renamed, moved, stashed or deleted.
No `git pull` / `merge` / `rebase` / `commit` / `push`, no `checkout .`,
no `reset --hard`, no `stash pop`, no `clean`. No processes were killed.

## Measurements that justified the removal

Taken immediately before deletion (re-measured on the spot, not inherited
from the earlier Supervisor reading):

    NOW_UTC=2026-08-21T01:09:00Z
    LOCK_EXISTS=True
    LOCK_BYTES=0
    LOCK_MTIME_UTC=2026-08-20T10:14:17Z
    LOCK_AGE_MIN=894.7          (14.9 hours)
    GIT_PROCS=0

No mid-operation HEAD state existed in either tree - MERGE_HEAD, REBASE_HEAD,
CHERRY_PICK_HEAD and BISECT_LOG all absent, and rebase-merge / rebase-apply /
sequencer directories all absent, in BOTH `C:\ProjectOperations2\.git\` and
`C:\po-watcher\ProjectOperations\.git\`.

Abort thresholds (any one would have stopped the deletion) were all clear:
lock non-zero bytes - no; age under 30 minutes - no; any git process running -
no; any mid-op HEAD present - no. The lock was a stale leftover, not a live
git write.

## Read-back proof

    PRE_DELETE_EXISTS=True
    POST_DELETE_TESTPATH=False
    git -C C:\ProjectOperations2 status --porcelain=v1 --untracked-files=no
      -> GIT_EXIT_CODE=0
    LOCK_RECREATED=False

Git in that tree is healthy. The working tree still shows the 7 uncommitted
`*-ready.md` deletions and the one HOLD->ready rename exactly as before; they
were deliberately left untouched.

## Why it mattered

While the lock existed, `scripts\pipeline\status-sweep.ps1` §7 returned
`DO NOT ACT: a board mutation is in progress` permanently, which procedurally
froze every station.

## Note

This is the SECOND stale-lock occurrence in two days.
