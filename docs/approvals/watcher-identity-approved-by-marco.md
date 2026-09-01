# Watcher identity — approved

App ID:          4798698
Installation ID: 158348768
Key path:        C:\po-secrets\projectops-watcher.2026-09-01.private-key.pem

Approved by Marco, 2026-09-01.

Evidence: the GitHub App `projectops-watcher` exists under GH-Mantova, is
installed on GH-Mantova/ProjectOperations only, and successfully minted an
installation token with a one-hour expiry.

Must be true at merge time: the watcher fails CLOSED if token minting fails —
it must never fall back to ambient keyring auth.

The private key is NOT in this repo and must never be.
