## PR #803 FIX-FORWARD: Merge commit cleanup required

The fix is correct and well-tested, but the PR head is a merge commit (52ba93a8) that pulls in PR #801. The repo house rule requires single commits. Before merging, squash: `git rebase -i main` to collapse 52ba93a8 onto caae2ee1, leaving one clean commit. Also wait for tendering-e2e (still running) to confirm the fix unblocks the regression.
