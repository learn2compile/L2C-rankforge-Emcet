# RankForge — EAMCET 2027 preparation

RankForge is an Angular 21 student-preparation frontend for AP & Telangana EAMCET 2027, with a new Express/PostgreSQL authentication foundation.

## Repository structure

- `frontend/` — Angular standalone components, routing, responsive UI, HttpClient API services, CSRF interceptor and auth guard.
- `backend/` — Express API, password hashing, secure cookie sessions, email/phone verification flows, Google OAuth, API middleware and tests.
- `backend/migrations/` — PostgreSQL schema migrations.
- `docs/IMPLEMENTATION_STATUS.md` — milestone status and verification notes.
- `docker-compose.yml` — local PostgreSQL service.

## Quick start

1. Start PostgreSQL from the repo root: `docker compose up -d postgres`.
2. Configure backend: `cd backend`, copy `.env.example` to `.env`, then run `npm install`, `npm run db:migrate`, and `npm run dev`.
3. In another terminal, run `cd frontend`, `npm ci`, and `npm start`.
4. Visit `http://localhost:4200`. API health endpoints are at `http://localhost:4000/api/v1/health/live` and `/health/ready`.

See `backend/README.md` for provider configuration, endpoint contracts, and production security requirements. Local development codes are only exposed when explicitly enabled by the backend environment; never enable that option in production.
