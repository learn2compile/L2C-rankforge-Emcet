# RankForge implementation status

Status meanings: **Implemented** = code exists; **Verified** = relevant automated checks passed; **Blocked** = external configuration/infrastructure is required or validation could not run in this environment.

## Current milestone — authentication and backend foundation

| Area | Status | Notes |
|---|---|---|
| Existing backend inspection | Verified | Both the original uploaded project and the latest screens ZIP contained no API implementation. Added a separate backend rather than replacing an existing one. |
| PostgreSQL schema and migration | Implemented / Blocked | Migration includes users, sessions, one-use auth tokens, phone OTPs, OAuth state and migration tracking. Requires a running PostgreSQL instance to apply. |
| Email/password registration and login | Implemented | Passwords use Node `scrypt`; email must be verified before password login. |
| Secure session management | Implemented | Opaque session token in HttpOnly cookie; only its SHA-256 hash is stored in PostgreSQL; logout revokes session. |
| CSRF, CORS/origin allow-list, security headers, request IDs, JSON body limit | Implemented | CSRF double-submit cookie/header is checked on API mutations. Production deployment should use HTTPS and preferably a same-origin reverse proxy. |
| Email verification and resend | Implemented / Blocked | One-use, expiring token hashes and endpoint flow are implemented. Real delivery requires an email provider webhook configured in backend `.env`. Local dev may expose a token only when `AUTH_EXPOSE_DEV_CODES=true`. |
| Forgot/reset password | Implemented / Blocked | Reset token expires after one hour, is one-use, and password reset revokes all sessions. Real email delivery requires provider configuration. |
| Phone OTP | Implemented / Blocked | Six-digit OTP, five-minute expiry, attempt limit and one-time consumption are implemented. Real SMS requires provider configuration; local dev code is exposed only when explicitly enabled. |
| Google OAuth/OIDC | Implemented / Blocked | Authorization-code flow, state validation, token exchange and ID-token audience/issuer/email verification are implemented. Needs Google client ID/secret and registered callback URL. |
| Angular HttpClient API service | Implemented | Auth service now calls API endpoints; session credentials are not stored in local/session storage. |
| Angular CSRF interceptor and route guard | Implemented | Mutating API requests add CSRF header from cookie; student/workspace routes restore and require a server session in the browser. |
| Backend unit tests | Verified | `node --test`: 5/5 tests passed for password hashing, phone/email normalization, token hashing and constant-time comparison. |
| Backend JS syntax | Verified | `node --check` passed for all backend source and test `.mjs` files. |
| Backend API integration tests | Blocked | Dependencies, PostgreSQL and provider services are not available in this environment. |
| Angular production build | Blocked | `npm ci --offline` failed because required packages were not cached; online install timed out. Run `npm ci && npm run build` on a network-enabled machine. |
| GitHub push | Not performed | No connected repository action was available; this deliverable is a ZIP only. |

## Run the milestone locally

1. From the repository root, run `docker compose up -d postgres`.
2. In `backend/`, copy `.env.example` to `.env`, then run `npm install`, `npm run db:migrate`, `npm test`, and `npm run dev`.
3. In `frontend/`, run `npm ci` and `npm start`.
4. Open `http://localhost:4200`. The API listens at `http://localhost:4000/api/v1`.

**Development-only warning:** the example `.env` exposes verification/reset tokens and OTP codes in API responses to support local testing without an email/SMS provider. Keep `AUTH_EXPOSE_DEV_CODES=false` in production. The Google and message-delivery flows remain unavailable until real credentials/providers are configured.

## Next milestone

Implement persistent student data APIs and wire dashboard/study-plan/subjects screens to PostgreSQL: profile management, subjects/topics, questions and explanations, practice sessions, answer persistence, bookmarks, mistakes and progress analytics. Then build the end-to-end practice and mock-test engines.
