# Runbook — Smart Wizard catalog post-deploy verification (SLICE 3)

**Scope:** production App Service after a deploy that includes SLICE 1 + SLICE 2 of
`docs/plans/smart-wizard-catalog-deploy-plan.md`.
**Trigger:** deploy job health gate passes (`deploy.yml` line 173 health check green).

---

## Step 1 — Allow the warm-up window

Azure App Service can take 1–3 minutes to initialize after a fresh deploy. Do not
declare failure before this window has elapsed.

See `sot/05-decisions-and-lessons.md` deploy-lag entry for the established warm-up
guidance. If the health check only just turned green, wait two minutes before
proceeding to step 2.

---

## Step 2 — Manual wizard smoke

1. Open the deployed site and log in as an admin (e.g. `admin@projectops.local`).
2. Navigate to **Dashboard → Smart Wizard**.
3. Assert the model list populates — no 503 banner, no "Metadata catalog unavailable" message.

If step 3 passes: verification done. No further action required.

---

## Step 3 — If the wizard 503s: diagnose via curl

Obtain a valid auth cookie from your browser session (DevTools → Application →
Cookies → copy the session cookie value), then run:

```bash
curl -s -H "Cookie: <your-auth-cookie>" \
  https://<deployed-host>/api/v1/meta/catalog | jq .
```

The SLICE 2 enumerating error message names exactly which of the three resolution
sources failed:

| Message fragment | Meaning | Fix |
|---|---|---|
| `env METADATA_CATALOG_PATH not set` | No env override — expected in production | Proceed to next source |
| `env METADATA_CATALOG_PATH set but file not found at: ...` | Env override points at a missing file | Unset or correct `METADATA_CATALOG_PATH` in App Service config |
| `bundle not found at: ...` | The compiled artifact is missing the bundled catalog | The `nest build` prebuild step did not run; re-trigger the deploy |
| `walker: repo root not found` | Dev-only fallback — always absent in App Service | Expected; not the fix |

In a correctly deployed SLICE 1 + SLICE 2 build, the bundle source wins and the
200 response is the parsed catalog JSON. A 503 after deploy means either:

- The deploy artifact was built without the `prebuild` copy step (bundle missing).
- `METADATA_CATALOG_PATH` is set in App Service config and points at a non-existent path
  (source 1 fails and blocks source 2 from being tried first — check App Service
  Configuration and clear the env var if it is stale).

---

## Step 4 — Confirm resolution source in logs

The API logs one line on the first successful `getCatalog()` call (added in SLICE 3):

```
Metadata catalog resolved via bundle
```

(or `env` / `walker` for the other sources). Check the App Service **Log Stream** or
**Diagnose and solve problems → Application logs** for this line. Its presence confirms
which source the running process is using.

---

## Failure modes

- **503 with no enumerated sources in the message.** The deployed code is pre-SLICE 2.
  Confirm the correct commit is deployed (`git rev-parse HEAD` in the Kudu console).
- **503 + `bundle not found`.** The `prebuild` copy step did not run or the asset
  was excluded from the deploy package. Re-run the deploy from the correct branch.
- **200 but wrong schema shape.** The bundled snapshot is from an older commit. This is
  expected between deploys — the wizard will reflect the schema as of the last deploy.
  Redeploy from `main` HEAD to pick up any schema additions.
- **Warm-up timeout (site unreachable > 5 min post-deploy).** Azure App Service crash
  loop; check the Log Stream for startup exceptions unrelated to the catalog.
