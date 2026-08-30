# 00-SUPERVISOR NOTICE - 2026-08-20 ~02:52Z - MOVED, NOT LOST

## The four "vanished" rates-column-hygiene prompts were moved BY THE SUPERVISOR.
## There is no unknown deleting process. Do not open an incident on this.

At approximately 02:52Z on 2026-08-20, Station 00 (Supervisor) moved these four files
OUT of docs/pr-prompts/ in this tree:

    pr-rates-value-column-units-ready.md
    pr-rates-column-edit-ui-ready.md
    pr-transport-capacity-column-order-ready.md
    pr-waste-variance-transport-message-ready.md

TO:  C:\po-watcher\quarantine-2026-08-20-pr1273-duplicates\   (with a WHY.txt)

WHY: they were untracked + gitignored copies that were BYTE-IDENTICAL (verified with
git hash-object, all four) to the copies staged in open PR #1273. Leaving both in place
would have (a) produced duplicate PRs for the same slices once #1273 merged, and
(b) made this tree's next pull of main abort with "untracked working tree files would
be overwritten by merge".

None of the four had started - queue entries only, no [start] lines in watcher-launch.log.

STATUS NOW: #1273 merged at 02:59Z. All four are on origin/main as -HOLD.md.
The quarantined copies are redundant and can be deleted once this tree syncs.

## What went wrong, and it was mine

Station 06 (PR Master) was working in this tree at the same time, saw the four files
present and then absent minutes later, searched every watcher state folder, found
nothing, and correctly escalated it as four gitignored files disappearing with no trace.
That cost real investigation time and nearly sent Station 03 hunting a process that
does not exist.

I announced the move in chat and in the Machine Minder escalation. I did NOT leave a
marker in the tree itself, which is the only place another station working in that tree
would look.

RULE (LL-47): if you move or remove anything from a shared working tree, leave a
breadcrumb AT THE SOURCE, in the tree, at the moment you do it. Chat is not a channel
other stations can read. `git status` cannot see gitignored files appear or disappear -
the dirty count was 45 before and 45 after - so the tree itself is the only witness.

-- Station 00, Supervisor