#!/usr/bin/env bash
# vm-git-guard.sh - make DOCTRINE 9.2's device-bridge git ban mechanical instead of remembered.
#
# WHY. A git call made from the device-bridge Linux VM against the Windows dev tree can be cut
# short by the VM's ~45s per-call ceiling. It leaves a 0-byte .git/index.lock with NO owning
# Windows process, so every 'is a git process holding it?' check reads false forever, the lock
# never expires, and status-sweep.ps1 escalates to DO NOT ACT - freezing every station.
# Seven occurrences. Three documentation bullets did not prevent the eighth.
#
# WHAT THIS DOES. Installs a 'git' shim early on PATH that refuses when EITHER the call's
# arguments target a mounted folder OR the current working directory sits under one. Both
# checks matter: a bare `git status` from inside the mount would otherwise operate on the
# mounted repo via $PWD, so a run that reads only the first sentence of this comment will
# be surprised when its scratch clone is refused because it forgot to `cd` out of mnt/.
# To use git in this VM against something outside the mount, both conditions must hold -
# the arguments must not point at mnt/ AND you must be cd'd outside mnt/ (a scratch clone
# under $HOME or /tmp works only if you `cd` there first).
#
# INSTALL (idempotent, run it at the top of any VM-side session):
#   bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
# UNINSTALL:
#   rm -f "$HOME/.local/bin/git"
#   sed -i '/^export PATH="\$HOME\/.local\/bin:\$PATH"$/d' "$HOME/.bashrc"
#   [ -f "$HOME/.profile" ] && sed -i '/^export PATH="\$HOME\/.local\/bin:\$PATH"$/d' "$HOME/.profile"
set -euo pipefail

# Captured BEFORE ensure_on_path mutates THIS process's PATH. The reachability
# verdict at the foot of this file must probe the CALLER's environment, and a
# `bash -c` launched from inside this installer inherits the installer's own
# exported PATH - which ensure_on_path has by then put BIN on. Probing without
# this capture reports ACTIVE in every world, including one where the shim has
# been deleted (the installer recreates it), i.e. the same lie in a new coat.
# [MEASURED] 2026-09-21T22:3xZ: the first cut of this fix did exactly that -
# three worlds, one answer. DOCTRINE 7: prove the check can produce both.
CALLER_PATH="${PATH}"

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
  - git in this VM only outside mnt/ (a scratch clone under $HOME, /tmp), AND with $PWD
    outside mnt/ too - the shim refuses on $PWD as well as on arguments.

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

# positive control (mounted-argument) - the guard must REFUSE a call whose ARGUMENTS target
# a mounted folder, regardless of $PWD.
if PATH="${BIN}:${PATH}" git -C "${HOME}/mnt" status >/dev/null 2>&1; then
  echo "FAIL: guard did not refuse a mounted-path argument"; exit 1
fi

# positive control (mounted-cwd) - the guard must ALSO REFUSE a bare call whose arguments
# name nothing mounted but whose $PWD is under mnt/. Today this behaviour is real but
# untested, so without this control nothing would catch its removal.
if (cd "${HOME}/mnt" 2>/dev/null && PATH="${BIN}:${PATH}" git --version >/dev/null 2>&1); then
  echo "FAIL: guard did not refuse a bare call from a mounted cwd"; exit 1
fi

# negative control - a call whose arguments target nothing mounted, made from a cwd that
# is ALSO outside the mount, must be ALLOWED. The subshell `cd /tmp` neutralises $PWD so
# this measures what the message claims, not an accidental $PWD refusal.
if ! (cd /tmp && PATH="${BIN}:${PATH}" git --version >/dev/null 2>&1); then
  echo "FAIL: guard blocked a call that targets nothing mounted"; exit 1
fi

# idempotency control - re-running must not grow .bashrc, and must not recurse. The
# re-exec below sets VM_GIT_GUARD_NO_RECURSE=1 in the child's environment; when a run
# sees that variable already set on entry, it skips its own re-exec entirely and reports
# the control as skipped-because-nested. Without this marker each run would launch a
# child that launches a child (measured at 1017 nested invocations before a VM resource
# limit ended it, swallowed by `|| true`).
if [ -n "${VM_GIT_GUARD_NO_RECURSE:-}" ]; then
  echo "idempotency control: skipped (nested run, VM_GIT_GUARD_NO_RECURSE=${VM_GIT_GUARD_NO_RECURSE})"
else
  HASH_BEFORE="$(md5sum "${HOME}/.bashrc" | awk '{print $1}')"
  VM_GIT_GUARD_NO_RECURSE=1 bash "${BASH_SOURCE[0]}" >/dev/null 2>&1 || true
  HASH_AFTER="$(md5sum "${HOME}/.bashrc" | awk '{print $1}')"
  if [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
    echo "FAIL: re-running the installer grew ~/.bashrc (not idempotent)"; exit 1
  fi
fi

# --------------------------------------------------------------------------
# REACHABILITY VERDICT - GUARD_REACHABILITY_VERDICT_V1
#
# Every control above forces PATH="${BIN}:${PATH}" on the call it tests. So
# each one proves the shim's LOGIC and NONE of them proves the shim is
# REACHABLE from the shell a station is actually given.
#
# Stations run through `bash -c "<command>"`: non-interactive AND non-login.
# Such a shell sources NEITHER ~/.bashrc (skipped when non-interactive) NOR
# ~/.profile (login shells only), so the export ensure_on_path wrote is never
# read - and its own `export PATH` dies with this installer process.
#
# The control that stood here was `bash -lc 'command -v git'` - a LOGIN shell,
# the one shape no station ever gets. It PASSES while the guard is inert. That
# is DOCTRINE 7 sitting in the first step of every station's preflight: a
# confident, coherent, WRONG reading that converts "I must be careful with git
# here" into "the guard has this".
#
# [MEASURED] 2026-09-21T22:2xZ, two independent sessions on one day (Station 04
# at 22:10Z, Station 00 at 22:2xZ): this installer printed its pass line, and
# seconds later `bash -c` resolved /usr/bin/git and `git rev-parse` against the
# mount SUCCEEDED at exit 0. Station 00 reproduced it and quoted the pass line
# in its own GROUND block before noticing - which is the cost, exactly.
#
# Making the protection AUTOMATIC is not available here, and that was measured
# rather than assumed: /usr/local/bin and /usr/local/sbin are both NON-WRITABLE
# in this VM, so the shim cannot be placed on the default PATH; and BASH_ENV
# cannot help because this installer is a child process and cannot export into
# its caller's environment. So the honest move is not to claim a protection
# that is absent - MEASURE which of the two states holds, and say so.
# --------------------------------------------------------------------------

RESOLVED_LOGIN="$(bash -lc 'command -v git' 2>/dev/null || true)"
# env PATH="${CALLER_PATH}" - probe the CALLER's shell, never this installer's.
# See the CALLER_PATH capture at the top of this file for why a bare `bash -c`
# here answers ACTIVE unconditionally.
RESOLVED_STATION="$(env PATH="${CALLER_PATH}" bash -c 'command -v git' 2>/dev/null || true)"

# Install integrity: if even a LOGIN shell cannot resolve the shim, the install
# itself failed - a different fault from the PATH gap reported below.
if [ "$RESOLVED_LOGIN" != "${BIN}/git" ]; then
  echo "FAIL: install is broken - bash -lc 'command -v git' resolved to '${RESOLVED_LOGIN}', expected '${BIN}/git'"
  exit 1
fi

if [ "$RESOLVED_STATION" = "${BIN}/git" ]; then
  echo "vm-git-guard ACTIVE at ${BIN}/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)"
  echo "reachability control passed: a non-interactive 'bash -c' - the shell a station is given - resolves the shim"
  exit 0
fi

cat <<MSG
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.

  bash -lc 'command -v git' -> ${RESOLVED_LOGIN}
      (a LOGIN shell: resolves the shim - this is what the old control tested)
  bash -c  'command -v git' -> ${RESOLVED_STATION}
      (the shell a STATION IS GIVEN: resolves the real git - no protection)

The three logic controls above passed because each forces PATH="${BIN}:\$PATH"
on the call it tests. Your shell does not, and a non-interactive non-login bash
reads neither ~/.bashrc nor ~/.profile, so the PATH export written by this
installer is never sourced.

=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL. It is back to
   being remembered - which DOCTRINE 9.2 records as having failed seven times.
   Do NOT run git against a mounted folder. Use a shell on the Windows host, or
   the GitHub API, exactly as the refusal message would have told you.

To get the protection for one call, put the shim on PATH yourself:
   PATH="${BIN}:\$PATH" git <args>
MSG
exit 2
