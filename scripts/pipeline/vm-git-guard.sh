#!/usr/bin/env bash
# vm-git-guard.sh - make DOCTRINE 9.2's device-bridge git ban mechanical instead of remembered.
#
# WHY. A git call made from the device-bridge Linux VM against the Windows dev tree can be cut
# short by the VM's ~45s per-call ceiling. It leaves a 0-byte .git/index.lock with NO owning
# Windows process, so every 'is a git process holding it?' check reads false forever, the lock
# never expires, and status-sweep.ps1 escalates to DO NOT ACT - freezing every station.
# Seven occurrences. Three documentation bullets did not prevent the eighth.
#
# WHAT THIS DOES. Installs a 'git' shim early on PATH that refuses only when the call targets a
# mounted folder. Git anywhere else in the VM (a scratch clone under $HOME, /tmp) is untouched.
#
# INSTALL (idempotent, run it at the top of any VM-side session):
#   bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
# UNINSTALL:
#   rm -f "$HOME/.local/bin/git"
set -euo pipefail

BIN="${HOME}/.local/bin"
mkdir -p "$BIN"

cat > "${BIN}/git" <<'SHIM'
#!/usr/bin/env bash
# Installed by scripts/pipeline/vm-git-guard.sh - see DOCTRINE 9.2.
REAL=/usr/bin/git
[ -x "$REAL" ] || REAL="$(command -v -p git 2>/dev/null || true)"

targets_mount=0
case "$PWD/" in "$HOME"/mnt/*) targets_mount=1 ;; esac
for a in "$@"; do
  case "$a" in
    "$HOME"/mnt/*|*/mnt/ProjectOperations2*|mnt/*|/sessions/*/mnt/*) targets_mount=1 ;;
  esac
done

if [ "$targets_mount" -eq 1 ]; then
  cat >&2 <<'MSG'
REFUSED: git against a mounted folder from the device-bridge VM.

A cut-short call here leaves a 0-byte .git/index.lock with no owning Windows
process. The lock never expires and freezes every station (DOCTRINE 9.2,
seven occurrences).

Use instead:
  - the GitHub API (gh api / the github MCP tools) for anything readable from the remote;
  - a shell ON the Windows host for anything that must touch C:\ProjectOperations2\.git;
  - git in this VM only outside mnt/ (a scratch clone under $HOME, /tmp).

To read one file at a revision without git: gh api repos/OWNER/REPO/contents/PATH?ref=REF
MSG
  exit 99
fi

exec "$REAL" "$@"
SHIM

chmod +x "${BIN}/git"

case ":${PATH}:" in
  *":${BIN}:"*) ;;
  *) echo "NOTE: ${BIN} is not on PATH. Add it first:  export PATH=\"${BIN}:\$PATH\"" ;;
esac

# positive control - the guard must REFUSE a mounted path and ALLOW one outside it
if PATH="${BIN}:${PATH}" git -C "${HOME}/mnt" status >/dev/null 2>&1; then
  echo "FAIL: guard did not refuse a mounted path"; exit 1
fi
if ! PATH="${BIN}:${PATH}" git --version >/dev/null 2>&1; then
  echo "FAIL: guard blocked a call that targets nothing mounted"; exit 1
fi
echo "vm-git-guard installed at ${BIN}/git - refuses mounted paths, allows everything else (both controls passed)"
