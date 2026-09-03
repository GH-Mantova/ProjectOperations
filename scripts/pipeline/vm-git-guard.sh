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
#   sed -i '/^export PATH="\$HOME\/.local\/bin:\$PATH"$/d' "$HOME/.bashrc"
#   [ -f "$HOME/.profile" ] && sed -i '/^export PATH="\$HOME\/.local\/bin:\$PATH"$/d' "$HOME/.profile"
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

ensure_on_path() {
  local export_line='export PATH="$HOME/.local/bin:$PATH"'
  local touched=""

  if ! grep -Fxq "$export_line" "${HOME}/.bashrc" 2>/dev/null; then
    echo "$export_line" >> "${HOME}/.bashrc"
    touched="${touched} ~/.bashrc"
  fi

  if [ -f "${HOME}/.profile" ]; then
    if ! grep -Fxq "$export_line" "${HOME}/.profile" 2>/dev/null; then
      echo "$export_line" >> "${HOME}/.profile"
      touched="${touched} ~/.profile"
    fi
  fi

  if [ -n "$touched" ]; then
    echo "ensure_on_path: appended PATH export to:${touched}"
  else
    echo "ensure_on_path: both ~/.bashrc and ~/.profile (if present) were already correct"
  fi

  export PATH="${BIN}:${PATH}"
}

ensure_on_path

# positive control - the guard must REFUSE a mounted path and ALLOW one outside it
if PATH="${BIN}:${PATH}" git -C "${HOME}/mnt" status >/dev/null 2>&1; then
  echo "FAIL: guard did not refuse a mounted path"; exit 1
fi
if ! PATH="${BIN}:${PATH}" git --version >/dev/null 2>&1; then
  echo "FAIL: guard blocked a call that targets nothing mounted"; exit 1
fi

# persistence controls - re-running must not grow .bashrc; login shell must resolve shim
HASH_BEFORE="$(md5sum "${HOME}/.bashrc" | awk '{print $1}')"
bash "${BASH_SOURCE[0]}" 2>/dev/null || true
HASH_AFTER="$(md5sum "${HOME}/.bashrc" | awk '{print $1}')"
if [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
  echo "FAIL: re-running the installer grew ~/.bashrc (not idempotent)"; exit 1
fi

RESOLVED="$(bash -lc 'command -v git' 2>/dev/null || true)"
if [ "$RESOLVED" != "${BIN}/git" ]; then
  echo "FAIL: bash -lc 'command -v git' resolved to '${RESOLVED}', expected '${BIN}/git'"; exit 1
fi

echo "vm-git-guard installed at ${BIN}/git - refuses mounted paths, allows everything else (both controls passed)"
echo "persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim"
