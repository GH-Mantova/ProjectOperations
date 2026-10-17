# Shared LOCAL-ONLY rule for .githooks/pre-commit and .githooks/pre-push
# (Phase 1 one-folder migration, 2026-10-17). Sourced, not run: no shebang needed.
# If this file is missing, sourcing it fails and the hook refuses (fail closed).
#
# localonly_filter reads one repo path per line on stdin and prints every path
# that must never be committed or pushed:
#   1. Anything under a .local/ folder. ALWAYS blocked, with no exceptions:
#      .local holds worktrees, backups, secrets and company data.
#   2. Secret-like files anywhere else: .env and .env.<name>, *.pem, *.key,
#      *.pfx, *.p12, *.token, *-login.json.
# The only exception is a permitted template OUTSIDE .local, named exactly
# .env.example or .env.<name>.example (the repo's .env.example is one).
# Matching ignores letter case (Windows file names are case-insensitive), and a
# path Git wrapped in quotes (unusual characters) is unwrapped before checking.

localonly_filter() {
  awk '
    {
      p = $0
      if (p ~ /^".*"$/) p = substr(p, 2, length(p) - 2)
      lp = tolower(p)
      base = lp
      sub(/.*\//, "", base)
    }
    lp ~ /(^|\/)\.local\// { print $0; next }
    base ~ /^\.env(\.[^\/]+)?\.example$/ { next }
    lp ~ /(^|\/)\.env(\.[^\/]*)?$/ || lp ~ /\.(pem|key|pfx|p12|token)$/ || lp ~ /-login\.json$/ { print $0 }
  '
}
