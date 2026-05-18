# B01.1 — JobDetailPage blank-page diagnosis

**Date:** 2026-05-18
**Scope:** Read-only investigation. No code changes proposed.
**Files examined:**
- `apps/web/src/auth/AuthContext.tsx` (authFetch lives here, not in a standalone module)
- `apps/web/src/pages/jobs/JobDetailPage.tsx`

`git grep` for `authFetch` definitions returned:

```
apps/web/src/auth/AuthContext.tsx:128:  const authFetch = async (input: string, init: RequestInit = {}) => {
apps/web/src/offline/syncManager.ts:26:export async function flushQueue(authFetch: AuthFetch): Promise<SyncResult> {
apps/web/src/offline/syncManager.ts:85:export function buildOfflineFetch(authFetch: AuthFetch): OfflineCapableFetch {
apps/web/src/portal/PortalAuthContext.tsx:108:  const authFetch = useCallback(
```

The two definitions are `AuthContext.tsx` (internal app) and `PortalAuthContext.tsx` (subcontractor portal). `JobDetailPage` consumes the internal one via `useAuth()`, so only the `AuthContext.tsx` definition is relevant to this bug.

---

## Section 1 — authFetch source

Verbatim from `apps/web/src/auth/AuthContext.tsx`, lines 128–165:

```ts
  const authFetch = async (input: string, init: RequestInit = {}) => {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    const request = async (token: string | null) =>
      fetch(`${API_BASE_URL}${input}`, {
        ...init,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

    let response = await request(accessToken);

    if (response.status === 401 && refreshToken) {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!refreshResponse.ok) {
        logout();
        throw new Error("Session expired.");
      }

      const refreshed = await refreshResponse.json();
      setAccessToken(refreshed.accessToken);
      setRefreshToken(refreshed.refreshToken);
      setUser(refreshed.user);

      response = await request(refreshed.accessToken);
    }

    return response;
  };
```

**How it builds the request**
- Prepends `API_BASE_URL` to the caller's `input` path.
- Sets `Content-Type: application/json` unless the body is `FormData`.
- Merges any caller-supplied headers on top.
- Appends `Authorization: Bearer <accessToken>` when a token is present.
- Spreads `...init` first, so caller-supplied `method`, `body`, etc. flow through.

**How it handles the response**
- It does NOT consume the body. It returns the raw `Response` object to the caller.
- The only response inspection it performs is `response.status === 401`, which triggers a single refresh attempt against `/auth/refresh`. On successful refresh it re-issues the original request once with the new access token.
- If the refresh call itself is not `ok`, it calls `logout()` and throws `"Session expired."`.

**Does it check `response.status` before calling `.json()`?**
It never calls `.json()` on the primary response at all — that responsibility is pushed to every caller. The only `.json()` call inside `authFetch` is on the `/auth/refresh` reply, and that is gated by `refreshResponse.ok`.

**Does it handle 304 Not Modified specifically?**
No. There is no special handling for 304, 204, or any other no-body status code. A 304 would simply be returned to the caller as a `Response` whose `body` is empty — and `response.ok` is `true` for 304, so caller-side `if (!response.ok)` guards will not catch it.

**What it returns on each code path**
| Path | Returned/Thrown |
|---|---|
| First request returns anything other than 401 | The original `Response` (any status, including 2xx, 3xx, 4xx, 5xx) |
| 401 + no `refreshToken` in state | The 401 `Response` is returned as-is |
| 401 + refresh succeeds | The replayed `Response` from the second request |
| 401 + refresh returns non-ok | Throws `Error("Session expired.")` after calling `logout()` |

---

## Section 2 — JobDetailPage fetch logic

Verbatim from `apps/web/src/pages/jobs/JobDetailPage.tsx`, lines 149–183 (component declaration, state, `reload`, and the triggering `useEffect`):

```tsx
export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/jobs/${id}`);
      if (!response.ok) throw new Error("Job not found.");
      const data = (await response.json()) as JobDetail;
      setJob(data);
      if (expandedStages.size === 0) {
        setExpandedStages(new Set(data.stages.map((stage) => stage.id)));
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[JobDetailPage] fetch failed:", err);
      }
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch, id]);
```

Render-time guards, verbatim from lines 240–262:

```tsx
  if (loading && !job) {
    return (
      <div className="job-detail">
        <Skeleton width="30%" height={14} />
        <Skeleton width="70%" height={24} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={200} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="job-detail">
        <EmptyState
          heading="Job not found"
          subtext={error}
          action={<Link to="/jobs" className="s7-btn s7-btn--primary">← Back to jobs</Link>}
        />
      </div>
    );
  }

  if (!job) return null;
```

**Async function definition**
`reload` is a plain arrow function declared inside the component body. It is invoked from a `useEffect` that depends on `[authFetch, id]`. There is no `AbortController` and no cancelled-flag — if `authFetch` identity changes mid-flight (it will, because `AuthContext` does not memoise it — see Section 3 footnote), a second `reload` can race the first.

**try/catch**
- `try`: `setLoading(true)` → `setError(null)` → await `authFetch(\`/jobs/${id}\`)` → if `!response.ok` throw `"Job not found."` → `await response.json()` → cast to `JobDetail` → `setJob(data)` → optionally seed `expandedStages` from `data.stages`.
- `catch`: dev-only `console.error`, then `setError((err as Error).message)`.
- `finally`: `setLoading(false)`.

**What is passed to each setter**
- `setJob(data)` — the parsed JSON body cast to `JobDetail`, **with no unwrapping** (no `data.data`, no `data.job`).
- `setError((err as Error).message)` — the message of whatever was thrown. The only thrown message from the happy path is `"Job not found."`; a `response.json()` failure would surface as a `SyntaxError` from the JSON parser, with a message like `"Unexpected end of JSON input"`.
- `setLoading(false)` — always, in `finally`.

**Early returns**
- `if (!id) return;` at the top of `reload` — guards the missing route param. Notably, when `id` is missing the function exits **before** `setLoading(false)` runs, so `loading` would remain `true` from its initial `useState(true)` and the skeleton would render forever. (This is not the suspected B01 cause — `id` is supplied by the route — but worth flagging.)

**Render guards**
- `if (loading && !job)` → skeleton.
- `if (error && !job)` → "Job not found" EmptyState with the error message as subtext.
- `if (!job) return null;` → blank page.

The third guard is the blank-page surface area: it fires whenever the component is past the loading/error states but still has `job === null`. With `setLoading(false)` always running in `finally`, the only way to reach this `return null` is if the fetch resolved successfully (no throw, no `setError`) yet `setJob` was never called with a usable object, or was called with `null`.

---

## Section 3 — Two specific checks

**(a) Does `authFetch` call `response.json()` unconditionally (without checking `status === 304` or `content-length` first)?**

**No** — `authFetch` itself never calls `.json()` on the primary response (only on the `/auth/refresh` reply, which is guarded by `refreshResponse.ok`). The `.json()` call that matters here lives in the caller: `JobDetailPage.tsx` line 166:

```ts
const data = (await response.json()) as JobDetail;
```

That call is preceded only by `if (!response.ok) throw new Error("Job not found.")` on line 165. `response.ok` is `true` for any 2xx **and for 304**, so a 304 Not Modified would skip the guard and fall straight into `response.json()`. A 304 carries no body, so `response.json()` rejects with a `SyntaxError`. The `catch` block then runs `setError("Unexpected end of JSON input")` (or similar) and `setLoading(false)`. The render path becomes `error && !job` → "Job not found" EmptyState — **not** a blank page.

That means **304 alone does not explain a blank page**; it explains an EmptyState. A genuinely blank page (the `if (!job) return null` branch) requires:
- `response.ok === true`, AND
- `response.json()` returning a value that is falsy or has no `stages`/etc., AND
- no error thrown (i.e., the cast to `JobDetail` is structurally satisfied at runtime but the object is `null`/empty).

The most plausible source of that pattern is a successful response whose body is `null` (literal JSON `null`), `{}`, or wrapped in an envelope (`{ data: {...} }` or `{ job: {...} }`) the page never unwraps — see check (b).

**(b) Does JobDetailPage assign the fetch result directly to `setJob()`, or does it unwrap something like `data.data` or `data.job` first?**

**Directly.** Line 167:

```ts
setJob(data);
```

`data` is exactly `await response.json()` cast to `JobDetail`. There is no `data.data`, `data.job`, `data.result`, or any other unwrapping. If the API returns an envelope, the cast lies and `job` becomes the envelope object, which lacks `stages`/`activities`/`issues` — and the immediate `data.stages.map(...)` call on line 169 would throw a `TypeError: Cannot read properties of undefined (reading 'map')`, which falls into `catch` and produces the EmptyState, not a blank page.

> Side observation, not asked for but flagged for the fix discussion: `authFetch` is rebuilt on every `AuthProvider` render (it is not wrapped in `useCallback`), and the `useMemo` that constructs the context value depends only on `[accessToken, refreshToken, user]` — so the `authFetch` reference still flips on every render of the provider's parent chain when those three values are stable but the provider re-renders for any other reason. `JobDetailPage`'s effect lists `authFetch` in its deps, so any unrelated re-render of `AuthProvider` re-runs the fetch. Not a blank-page cause, but a likely double-fetch / flicker source.

---

## Section 4 — DB probe

The probe command in the task brief was:

```
docker exec project-operations-postgres psql -U project_ops \
  -d project_operations -c \
  "SELECT id, name, status FROM jobs WHERE id='job-001';"
```

**Result: could not run from this environment.**

This investigation is running inside a sandboxed Linux workspace that does not have a Docker client, a Docker socket, or `psql` installed:

```
$ which psql pg_isready
(no output)
$ which docker
(no output)
$ ls /var/run/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
```

The command needs to be run on the host that owns the `project-operations-postgres` container (i.e., your local machine, in PowerShell or a host shell). Please paste the output back and I'll fold it into Section 4. The expected row, per the seed (`packages/.../seed` with stable IDs `job-001`, etc., per `CLAUDE.md`), is a single row with `id = 'job-001'`.

If the row is missing or `status` is unexpected, that is independent of the front-end blank-page issue — `JobDetailPage` would render the "Job not found" EmptyState (via the `!response.ok` branch) for a missing row, not a blank page.

**Round 2 status (2026-05-18):** PENDING — Marco to paste `docker exec` output. The sandbox still has no Docker client / socket / `psql` binary in round 2, so this remains a host-side task.

---

## Section 5 — Live endpoint hit

**Status: cannot run from sandbox — Marco to run on host.**

The sandbox has `curl` installed (`/usr/bin/curl`) but no route to the Vite/Nest dev servers running on the host:

```
$ curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" --max-time 5 http://localhost:3000/api/v1/health
HTTP 000 in 0.001528s      (exit 7 — Couldn't connect)
$ curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" --max-time 5 http://127.0.0.1:3000/api/v1/health
HTTP 000 in 0.000084s      (exit 7 — Couldn't connect)
http://host.docker.internal:3000/api/v1/health
HTTP 000                   (exit 7 — host.docker.internal not resolvable)
```

I also did not find any recent admin JWT in tracked files, `.env`, or `apps/api/.env`:

```
$ git grep -lE "Bearer [A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}"
(no matches)
```

So I can neither hit the endpoint nor borrow your token. Please run the following on your host (the token is the same `user-admin` super-user JWT from the MAIN chat exports):

```powershell
curl.exe -s -i `
  -H "Authorization: Bearer <TOKEN>" `
  -H "Accept: application/json" `
  http://localhost:3000/api/v1/jobs/job-001
```

Paste the output into this section. I need three things verbatim:
- **(a)** Status line + every response header, no truncation.
- **(b)** Response body, raw. Pretty-print if JSON. Write `EMPTY BODY (0 bytes)` if empty.
- **(c)** The exact `curl` invocation you used.

While waiting on the live capture, §6 reads the controller + service to predict the response shape from code — and that prediction surfaces what looks like the smoking gun.

---

## Section 6 — Cross-check vs JobDetailPage's expectations

### (a) The `JobDetail` type the component expects

Verbatim from `apps/web/src/pages/jobs/JobDetailPage.tsx`, lines 68–92 (the supporting `JobStage`, `JobActivity`, `JobIssue`, `JobVariation`, `JobProgress`, `JobStatusEntry` definitions live at lines 7–66 above it):

```ts
type JobDetail = {
  id: string;
  jobNumber: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  site?: { id: string; name: string } | null;
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  supervisor?: { id: string; firstName: string; lastName: string } | null;
  stages: JobStage[];
  activities: JobActivity[];
  issues: JobIssue[];
  variations: JobVariation[];
  progressEntries: JobProgress[];
  statusHistory: JobStatusEntry[];
  closeout?: {
    id: string;
    status: string;
    archivedAt?: string | null;
    summary?: string | null;
  } | null;
};
```

Key shape demand: a **top-level `activities: JobActivity[]`** array on the job, alongside a separate top-level `stages: JobStage[]`. `JobActivity` itself carries a `jobStageId` foreign key (line 9):

```ts
type JobActivity = {
  id: string;
  jobStageId: string;
  ...
};
```

So the front-end's mental model is: stages and activities are two flat arrays, joined via `jobStageId`.

### (b) The useEffect that calls authFetch through setJob

Verbatim from `apps/web/src/pages/jobs/JobDetailPage.tsx`, lines 159–183:

```ts
const reload = async () => {
  if (!id) return;
  setLoading(true);
  setError(null);
  try {
    const response = await authFetch(`/jobs/${id}`);
    if (!response.ok) throw new Error("Job not found.");
    const data = (await response.json()) as JobDetail;
    setJob(data);
    if (expandedStages.size === 0) {
      setExpandedStages(new Set(data.stages.map((stage) => stage.id)));
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[JobDetailPage] fetch failed:", err);
    }
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  void reload();
}, [authFetch, id]);
```

`data` is cast straight to `JobDetail` and handed to `setJob`. No envelope unwrapping, no normalization.

### (c) What the API actually returns — predicted from the controller + service

`apps/api/src/modules/jobs/jobs.controller.ts` lines 56–60:

```ts
@Get(":id")
getById(@Param("id") id: string) {
  return this.service.getById(id);
}
```

No interceptor, no envelope. The service return value is sent back as-is.

`apps/api/src/modules/jobs/jobs.service.ts` lines 333–352:

```ts
async getById(id: string) {
  const job = await this.requireJob(id);

  const documents = await this.prisma.documentLink.findMany({
    where: {
      linkedEntityType: "Job",
      linkedEntityId: id
    },
    include: {
      folderLink: true,
      fileLink: true
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    ...job,
    documents
  };
}
```

`requireJob` (line 1326) does `findUnique({ where: { id }, include: jobInclude })`.

The relevant slice of `jobInclude` (lines 93–248 — full block in source), reduced to the keys the front-end cares about:

```ts
const jobInclude = {
  client: true,
  site: true,
  projectManager: { select: { id, firstName, lastName, email } },
  supervisor:     { select: { id, firstName, lastName, email } },
  stages: {
    orderBy: { stageOrder: "asc" },
    include: {
      activities: {                   //  <-- activities NESTED under each stage
        orderBy: { activityOrder: "asc" },
        include: { owner: {...}, shifts: {...} }
      }
    }
  },
  issues:          { include: { reportedBy: {...} }, orderBy: {...} },
  variations:      { include: { approvedBy: {...} }, orderBy: {...} },
  progressEntries: { include: { author: {...} },     orderBy: {...} },
  statusHistory:   { include: { changedBy: {...} },  orderBy: {...} },
  closeout:        { include: { archivedBy: {...} } }
  // NO top-level `activities` key.
};
```

### (d) The mismatch

| Field | FE `JobDetail` expects | API `getById` returns |
|---|---|---|
| `stages` | `JobStage[]` (no nested activities) | `JobStage[]` **with each stage carrying its own `activities` array** |
| `activities` | `JobActivity[]` at top level | **MISSING — activities only exist nested inside `stages[].activities`** |
| `issues`, `variations`, `progressEntries`, `statusHistory`, `closeout`, `client`, `site`, `projectManager`, `supervisor` | present | present |
| `documents` | not declared in type | present (returned by `getById` but unused by the type — harmless) |

The wrapping shape is fine — flat, no envelope. The bug is structural: **the API never sends a top-level `activities` array**, so on the front-end `job.activities` is `undefined`.

### (e) Why this produces a blank page, not a JS error in the catch

`reload`'s `try` block touches `data.stages.map(...)` on line 169, which succeeds because `stages` is present. The `catch` never runs. `setJob(data)` commits successfully and the component re-renders with `job` populated but `job.activities === undefined`.

Then, during render, line 207 evaluates:

```ts
const totalActivities = job?.activities.length ?? 0;
```

Operator precedence: `job?.activities` returns `undefined` (the optional chain only short-circuits when `job` itself is nullish — here `job` is truthy), then `.length` is read on `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'length')`.

The very next line (208) uses the safe pattern `(job?.activities ?? [])`, which would have worked. The asymmetry is the bug surface.

The throw happens during render, **above** every section-level `<ErrorBoundary>` in the page (those wrap children of the page's JSX — lines 320, 361, 425, etc. — they cannot catch a throw that occurs before their parent returns its element tree). If no top-level boundary exists above `<JobDetailPage>` in the app shell, React 18 unmounts the entire route subtree on the uncaught render error, leaving a blank page.

This is consistent with:
- "Blank page" rather than "Job not found" EmptyState (the `catch` never fires because the throw is in render, not in the async path).
- `setLoading(false)` having already run (so the skeleton is gone too).
- No friendly fallback (section ErrorBoundaries are mounted below the crash point).

The live curl in §5 will confirm the API shape one way or the other. If the response really does omit a top-level `activities` array, this is the bug.

---

## Section 7 — Bonus check on the side-note bug (correcting Round 1)

### (a) `authFetch` definition site

Verbatim — `apps/web/src/auth/AuthContext.tsx` imports (lines 1–8) and the definition (lines 128–138, leading lines only — full body in §1):

```ts
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
...
  const authFetch = async (input: string, init: RequestInit = {}) => {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    const request = async (token: string | null) =>
      fetch(`${API_BASE_URL}${input}`, {
        ...init,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
    ...
  };
```

**No `useCallback`** wraps `authFetch`. `useCallback` is not even imported from `react`.

But the context value IS memoised — lines 167–180:

```ts
const value = useMemo<AuthContextValue>(
  () => ({
    accessToken,
    refreshToken,
    user,
    isAuthenticated: Boolean(accessToken && user),
    login,
    resetPassword,
    loginWithSso,
    logout,
    authFetch
  }),
  [accessToken, refreshToken, user]
);

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

`useMemo` caches the whole object. While the deps `[accessToken, refreshToken, user]` are unchanged, the cached object — including the `authFetch` reference it captured the last time the memo ran — is returned as-is. Consumers receive the **same** `authFetch` reference across renders. The reference only flips when `accessToken`, `refreshToken`, or `user` changes (login, refresh, logout, profile update).

### (b) JobDetailPage's effect deps array

Verbatim — line 183:

```ts
useEffect(() => {
  void reload();
}, [authFetch, id]);
```

### (c) `reload` and the effect that calls it

Verbatim — lines 159–183 (also reproduced in §6(b) and §2):

```ts
const reload = async () => {
  if (!id) return;
  setLoading(true);
  setError(null);
  try {
    const response = await authFetch(`/jobs/${id}`);
    if (!response.ok) throw new Error("Job not found.");
    const data = (await response.json()) as JobDetail;
    setJob(data);
    if (expandedStages.size === 0) {
      setExpandedStages(new Set(data.stages.map((stage) => stage.id)));
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[JobDetailPage] fetch failed:", err);
    }
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  void reload();
}, [authFetch, id]);
```

`reload` is NOT wrapped in `useCallback`. It is a fresh closure on every render. The effect's deps array does **not** list `reload` (only `authFetch` and `id`), so the lack of memoisation on `reload` does not retrigger the effect on its own — only changes to `authFetch` (the context value's `authFetch` field) or `id` do.

### (d) Verdict on the round 1 claim — partial retraction

Round 1 said: *"`authFetch` isn't memoised and is in JobDetailPage's effect deps, causing re-fetches on every AuthProvider re-render."*

That overstates it. The correct statement is:

> `authFetch` is rebuilt on every `AuthProvider` render, but the surrounding `useMemo` keeps the context value (and therefore the `authFetch` reference handed to consumers) stable as long as `[accessToken, refreshToken, user]` are unchanged. So `JobDetailPage`'s effect does **not** re-fire on every unrelated `AuthProvider` re-render — only on auth-state changes (login / token refresh / user update) or on `id` changes. That's acceptable behaviour.

So this is **not** a defect contributing to the blank page and not a "fix this in the same PR" item. The actual ref-stability is fine. Apologies for the round 1 overreach.

(There is still a small latent fragility: any future addition to the memo deps, or any consumer that recreates the value object outside `useMemo`, would resurface the issue. But as it stands today, it's safe.)

---

## Summary (updated, replaces round 1 summary)

- The blank page is the `if (!job) return null` branch — reached not because `job` is null after a successful fetch, but because **an uncaught render-phase `TypeError` on line 207 unmounts the route subtree**.
- Predicted root cause (pending §5 confirmation): the API's `GET /jobs/:id` response **omits a top-level `activities` array**. `jobInclude` nests activities inside `stages[].activities`, but the front-end's `JobDetail` type expects a flat top-level `activities: JobActivity[]`. With `job.activities === undefined`, line 207's `job?.activities.length ?? 0` throws (the `?.` only protects against `job` being nullish, not `job.activities`).
- The section-level `<ErrorBoundary>`s in the page cannot catch this because the throw happens before the page's JSX is constructed.
- Two clean fix shapes (for your decision, not implemented):
  1. **Front-end**: change line 207 to `(job?.activities ?? []).length`, and derive a flat activities list from `stages.flatMap(s => s.activities)` if the screen really needs one. Aligns with the API shape.
  2. **API**: add `activities` to the response either via a top-level `include` (it would duplicate the nested copies) or via a derived field assembled in `getById`. Aligns with the FE type.
- The round 1 side note about `authFetch` causing re-fetches is **retracted** — `useMemo` on the context value keeps the reference stable across unrelated renders.
- DB probe and live curl are still pending Marco's host execution.
