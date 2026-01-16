# agave-inc-web — Security / Code Review (Prioritized)

Date: 2026-01-16  
Scope: `agave-inc-web` only (Next.js + Firebase + GoFormz)

## Executive summary

Top risks center on API route authorization:
- Several `pages/api/history/**` endpoints **check for an Authorization header but do not verify the token**, enabling unauthorized access to GoFormz-backed data.
- Some routes verify identity but do not fully enforce authorization (e.g., chat message notification triggers).

This document lists findings categorized as **Security/Critical**, **High**, **Medium**, and **Low/Hygiene**, with affected files and recommended remediations.

---

## Security / Critical

### 1) Auth bypass: token presence checked, token not verified
**Impact:** Any caller can send any `Authorization` header value and the endpoint proceeds, effectively bypassing authentication. Because these routes proxy to GoFormz using server-side Basic Auth, this can expose GoFormz data to unauthorized callers.

**Affected files:**
- `pages/api/history/index.ts`
- `pages/api/history/[formId].ts`
- `pages/api/history/image.ts`
- `pages/api/history/download/index.ts`

**Evidence (pattern):**
- Code checks `req.headers['authorization']` for existence, but does not call `verifyIdToken(...)` or `auth.verifyIdToken(...)`.

**Recommendation:**
- Create a shared helper (e.g., `requireAuth(req)`), verify the token server-side on every request, and use the verified `uid` for downstream authorization.
- Consider returning 401 on failed token verification (not only missing header).

---

### 2) IDOR / authorization gap in forms query (propertyName-controlled)
**Impact:** A user can query GoFormz forms for properties they should not access (and currently, due to #1, potentially even without valid auth). This is an Insecure Direct Object Reference (IDOR) / broken access control risk.

**Affected file:**
- `pages/api/history/index.ts`

**Evidence:**
- `propertyName` is accepted from query params and passed to GoFormz.
- Intended restriction logic (admin vs user property list) appears commented out.

**Recommendation:**
- Enforce: 
  - Admin can query any property.
  - Non-admin can query only properties present in their Firestore `users/{uid}.properties`.
- Prefer server-driven filters (derived from the authenticated user) over user-supplied property identifiers.

---

### 3) Possible sensitive error leakage from API error handler
**Impact:** Internal error objects can contain sensitive details (request config, stack traces, etc.). If an Axios error bubbles up, it can include headers/config and could indirectly expose secrets or internals.

**Affected file:**
- `src/utils/api/apiHandler.ts`

**Evidence:**
- For unhandled errors, response includes `{ err: err }`.

**Recommendation:**
- Do not return raw `err` objects to clients.
- Return a generic message for 500s and log details server-side only.

---

## High priority

### 1) Chat notification endpoint doesn’t verify caller is a chat member
**Impact:** An authenticated user may be able to trigger push notifications for chats they are not part of (spam/harassment / abuse). 

**Affected file:**
- `pages/api/chat/messageSent.ts`

**Evidence:**
- Token is verified.
- `chatId` is provided by the caller.
- Code fetches `chats/{chatId}` and uses its members, but does not validate that the authenticated user is among `members`.

**Recommendation:**
- Confirm `authUser.id` is in `chatDoc.data()?.members` before proceeding.
- Consider rate limiting.

---

### 2) GoFormz datasource endpoint may need stronger authorization (admin-only?)
**Impact:** If the datasource returns broad property data, non-admin access may be inappropriate depending on business rules.

**Affected file:**
- `pages/api/properties/go-formz.ts`

**Evidence:**
- Token is verified.
- No admin role check is performed.

**Recommendation:**
- Decide the intended access model and enforce it:
  - Admin-only, or
  - Filter rows to properties assigned to the authenticated user.

---

### 3) No rate limiting / abuse controls on account endpoints
**Impact:** Signup/login endpoints are common targets for abuse (account spam, resource exhaustion, brute force attempts).

**Affected files:**
- `pages/api/sign-up.ts`
- `pages/api/log-in.ts`

**Recommendation:**
- Add rate limiting (per IP / per uid / per route).
- Consider CAPTCHA for sign-up.
- Consider logging and alerting for spikes.

---

### 4) Timeout logic risks double responses / unstable behavior
**Impact:** The timeout handler may fire after an error response has already been sent, causing "headers already sent" problems and unpredictable behavior under load.

**Affected files:**
- `pages/api/log-in.ts`
- `pages/api/log-out.ts`

**Evidence:**
- `setTimeout(() => res.json(...), duration)` is created.
- On error paths, the timeout is not cleared.

**Recommendation:**
- Use a request-level abort/timeout mechanism (or always clear the timeout in `finally`).
- Ensure only one response is ever sent.

---

## Medium priority

### 1) Missing baseline security headers
**Impact:** Lack of headers like CSP/Referrer-Policy/Permissions-Policy makes the app more vulnerable to common web threats (clickjacking, data leakage via referrer, etc.).

**Affected file:**
- `next.config.js`

**Recommendation:**
- Add `headers()` with baseline protections, then tune CSP carefully for Next.js.

---

### 2) Cookie `secure` depends on a `NEXT_PUBLIC_*` env var
**Impact:** Increased risk of misconfiguration. Public env vars are easy to treat as client-side knobs; secure-cookie configuration should generally fail-closed in production.

**Affected file:**
- `src/utils/firebase/initAuth.ts`

**Evidence:**
- `secure: process.env.NEXT_PUBLIC_COOKIE_SECURE === "true"`

**Recommendation:**
- Prefer a server-only env var (non-`NEXT_PUBLIC`) or default to `true` in production.

---

### 3) Firestore `in` query limit can break property authorization
**Impact:** Firestore `in` queries have limits (commonly 10). If a user has many properties, requests may fail or behave unexpectedly.

**Affected file:**
- `pages/api/properties/index.ts`

**Recommendation:**
- Chunk queries or redesign schema to support scalable access checks.

---

## Low priority / Hygiene

### 1) Multiple Firebase Admin initialization approaches increase complexity
**Impact:** More complexity increases the likelihood of future auth bugs.

**Affected files (examples):**
- `src/utils/firebase/firebaseAdmin.ts`
- `src/utils/firebase/adminSDK.ts`

**Recommendation:**
- Consolidate to one server-side Firebase admin init pattern.

---

### 2) Some response naming is misleading
**Example:** `sign-up` returns `{ uid: customToken }` where `uid` is actually a token.

**Recommendation:**
- Rename to `token` or adjust payload shape for clarity.

---

## Good news / repo hygiene checks

- `.gitignore` correctly ignores `/.next/`, `node_modules/`, `*.pem`, and `certificates/`.
- Confirmed via git that `certificates/localhost-key.pem` and `.next/*` are **not tracked**.

---

## Suggested fix order (fastest risk reduction)

1) Fix `pages/api/history/**` to verify tokens and enforce authorization.
2) Stop returning raw error objects in `src/utils/api/apiHandler.ts`.
3) Reinstate/enforce property scoping in `pages/api/history/index.ts`.
4) Add chat membership check in `pages/api/chat/messageSent.ts`.
5) Add rate limiting on auth endpoints.

---

## Appendix: Files inspected

- Auth / Firebase
  - `src/utils/firebase/initAuth.ts`
  - `src/utils/firebase/firebaseAdmin.ts`
  - `src/utils/firebase/adminSDK.ts`
  - `src/utils/firebase/getPrivateKey.ts`

- API handler / validation
  - `src/utils/api/apiHandler.ts`
  - `src/utils/api/yup.ts`

- API routes
  - `pages/api/log-in.ts`
  - `pages/api/log-out.ts`
  - `pages/api/sign-up.ts`
  - `pages/api/announcements.ts`
  - `pages/api/users/index.ts`
  - `pages/api/users/[uid].ts`
  - `pages/api/properties/index.ts`
  - `pages/api/properties/[propertyId].ts`
  - `pages/api/properties/go-formz.ts`
  - `pages/api/chat/messageSent.ts`
  - `pages/api/history/index.ts`
  - `pages/api/history/[formId].ts`
  - `pages/api/history/image.ts`
  - `pages/api/history/download/index.ts`
