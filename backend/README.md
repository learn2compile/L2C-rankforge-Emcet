# RankForge API — authentication and database foundation

This backend is new because the supplied project ZIP contained an Angular frontend but no existing API implementation. It uses Node.js 20.11+, Express 5, and PostgreSQL. Authentication is API-backed; the Angular app does not store session credentials in local/session storage.

## Included capabilities

- Email/password registration and login; email verification is required before password login.
- One-use, expiring email-verification and password-reset tokens (only SHA-256 token hashes are stored).
- Phone OTP sign-in with expiry, attempt limits, and one-time consumption; a successfully verified new phone can create a phone-only account.
- Google OAuth/OIDC authorization-code flow with state validation, token exchange, audience/issuer/email verification checks, and server-side client secret.
- Opaque server sessions in PostgreSQL; only a hash is stored and the raw token is sent in an HttpOnly cookie.
- CSRF double-submit cookie/header validation, origin allow-list, security headers, body-size limit, and in-memory authentication rate limits.
- Health/live and health/ready endpoints, request IDs, centralized API errors, database migration, and unit tests for security helpers.

## Local setup

Requirements: Node.js 20.11+, npm, and Docker Desktop (or PostgreSQL 14+).

1. From the repository root, start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

2. Configure backend environment:

   ```bash
   cd backend
   cp .env.example .env
   ```

   The example file is for local development only. Do not deploy its database password or OAuth state secret. `AUTH_EXPOSE_DEV_CODES=true` intentionally returns verification/reset tokens and OTPs in development API responses so you can test flows before providers are connected. It is forbidden in production.

3. Install backend dependencies and apply the migration:

   ```bash
   npm install
   npm run db:migrate
   npm test
   npm run dev
   ```

   API base URL: `http://localhost:4000/api/v1`.

4. In a second terminal:

   ```bash
   cd frontend
   npm ci
   npm start
   ```

   Frontend default API URL is in `frontend/src/app/core/config/api.config.ts`. If you change the backend URL, update that file and the backend's `ALLOWED_ORIGINS` / `FRONTEND_URL` values.

5. Confirm readiness:

   - `GET http://localhost:4000/api/v1/health/live`
   - `GET http://localhost:4000/api/v1/health/ready`

## Email and SMS delivery adapter

`EMAIL_DELIVERY_URL` and `SMS_DELIVERY_URL` are optional HTTP webhook adapters. When configured, the backend sends JSON payloads with `to`, `subject`/`text`/`html` for email or `to`/`message` for SMS, and adds `Authorization: Bearer <TOKEN>` when a token is set. Adapt the payload shape to your chosen provider or add a provider-specific adapter. Never return a code/token from production responses. Without a provider, local development can use the development-only token/code response.

## Google OAuth setup

Create a Google OAuth client in Google Cloud Console. Set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (backend only)
- `GOOGLE_CALLBACK_URL` to the exact registered redirect URI, default `http://localhost:4000/api/v1/auth/google/callback`
- the matching frontend URL and allowed origin

The app exposes provider status through `GET /api/v1/auth/providers`; the frontend only redirects to Google when Google credentials are configured. No Google password is collected by RankForge.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | PostgreSQL readiness |
| GET | `/auth/csrf` | Issue CSRF token cookie |
| GET | `/auth/providers` | Report configured provider availability |
| GET | `/auth/session` | Restore current session (or `user: null`) |
| POST | `/auth/register` | Create account and start email verification |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/verify-email` | Consume verification token and create session |
| POST | `/auth/resend-verification` | Resend verification link, non-enumerating response |
| POST | `/auth/forgot-password` | Start password reset, non-enumerating response |
| POST | `/auth/reset-password` | Consume reset token and revoke all sessions |
| POST | `/auth/otp/start` | Send phone OTP |
| POST | `/auth/otp/verify` | Verify OTP and create session |
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | Validate OAuth response and create session |
| GET | `/auth/me` | Current authenticated user |

## Production hardening still required

- Set a strong `OAUTH_STATE_SECRET`, disable `AUTH_EXPOSE_DEV_CODES`, use HTTPS, set `DATABASE_SSL=true`, configure `DATABASE_URL` and `EMAIL_DELIVERY_URL`, and use managed PostgreSQL with backups.
- Configure real email/SMS delivery, Google OAuth credentials, correct callback URLs and deployment origin allow-lists.
- Use a durable/distributed rate limiter (e.g. Redis) instead of the included in-memory limiter when running multiple API instances.
- Prefer a same-origin reverse proxy for frontend/API so secure cookie and CSRF behavior remains straightforward.
- Add operational monitoring, alerting, secret rotation, dependency scanning, and a tested backup/restore procedure.
- The backend does not yet implement student study data APIs; those belong to the next milestone.
