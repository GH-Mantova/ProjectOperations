# PR #547 — Add GATE-ALLOW marker for env vars

PR body is missing `GATE-ALLOW: env-vars` marker. The pr-gates check (CP-12) requires this declaration when `.env.example` gains new variables. The two new vars (SHAREPOINT_AUTH_MODE, AZURE_MANAGED_IDENTITY_CLIENT_ID) are intentional, well-documented, and correctly scoped. Add the marker at column 0 as a standalone line in the PR body, then re-run CI. No code changes needed.
