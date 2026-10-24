# RankForge frontend (Angular)

The Angular frontend for the RankForge EAMCET 2027 preparation workspace.

## Requirements

- Node.js compatible with the Angular CLI version in `package.json`
- npm

## Install and run

```bash
npm ci
npm start
```

Angular CLI normally serves the app at `http://localhost:4200`.

## Build

```bash
npm run build
```

## Available screens

- `/` — responsive RankForge landing page
- `/auth/login` — email sign-in, Google OAuth entry point, mobile OTP entry point
- `/auth/register` — create account
- `/auth/forgot-password` — password recovery request
- `/auth/reset-password` — choose a new password
- `/auth/otp` — mobile OTP UI and validation
- `/auth/verify-email` — email verification preview
- `/home` — student dashboard and sign-out
- `/study-plan`, `/subjects`, `/practice`, `/mock-tests`, `/revision`, `/analytics`, `/notifications`, `/profile`, `/settings`, `/help`, `/feedback` — initial workspace screens

## Preview versus production

The supplied repository did not contain a backend API. Auth screens include validation and demo navigation only. The demo session uses `sessionStorage` so the dashboard/sign-out flow can be previewed; this is not production-grade authentication. Google OAuth, email delivery, SMS OTP delivery, verification tokens and password reset must be connected to trusted backend endpoints and providers before launch. See `../docs/IMPLEMENTATION_STATUS.md`.

## RankForge API integration

Authentication now uses the backend API at `http://localhost:4000/api/v1` by default. Configure the origin in `src/app/core/config/api.config.ts` when deploying elsewhere. Student routes use a session-restoration guard and the API client sends credentials with CSRF headers. For backend/database setup, OAuth and message-delivery configuration, see the repository root `README.md` and `backend/README.md`.
