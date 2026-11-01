# Authentication and local development

[Documentation index](../README.md) · S2 implementation · 1 November 2026

## What is implemented

Firebase web sign-in exchanges an ID token with `/api/v1/auth/session`. The server verifies the token with Firebase Admin's public certificate verification (project audience, issuer, signature, expiry and recent authentication). Outside the emulator, only verified-email Google sign-in is accepted. The application then issues a random 256-bit opaque cookie; PostgreSQL stores only its SHA-256 hash, owner identity, expiry and revocation status. Firebase SDK persistence is in-memory and is cleared after the exchange. No Analytics or Google AI SDK is initialized by sign-in.

Sessions expire at the earlier of the Firebase ID token expiry or one hour. Cookies use HttpOnly, SameSite=Lax, Path=/ and Secure for production-built/production-mode servers. Logout revokes the database session before clearing the cookie; a replayed old cookie stops working. Membership and tenant status are rechecked for every private read/mutation. Session creation is limited to ten per verified identity per minute.

All web mutations require matching `Origin` plus `X-DukaanPilot-Request: 1`; cross-site fetch metadata is rejected. Contact/business mutations also require an idempotency key. The API never accepts an owner/tenant from request data. Customer/supplier records are protected by server-bound tenant queries, compound constraints, versions, unique normalized phones, transactions, and append-only audit events.

**Current revocation boundary:** app logout and membership/tenant revocation are immediate. Firebase account-disable/global token revocation is not rechecked through privileged Admin APIs on each S2 request; existing application sessions last at most one hour. Production hardening in S7 must address this boundary with deployment identity/revocation checks before financial pilot launch. The current local flow needs no private service-account key.

## Your Firebase project

The public web configuration supplied by the owner is stored in ignored `.env.local`; private credentials are not checked in. Real Google sign-in also requires Google to be enabled in Firebase Authentication and this application's hostnames to be authorized (local review uses `127.0.0.1`; add `localhost` if you use it). A support email/provider configuration may be required by Firebase. These account-console settings and a real Google sign-in have not been independently verified yet; they remain in the final external-input checklist.

No remote user accounts were created during automated testing. Tests use `demo-dukaanpilot` in the official local Auth emulator.

## Start local services

From the project root, use separate terminals:

```powershell
npm ci
npm run local:db
```

`local:db` starts portable PostgreSQL 18.6 on `127.0.0.1:55432`, with a random local password and persistent state in ignored `.local/`. It creates `dukaanpilot` and isolated `dukaanpilot_test` databases, and fills a missing DATABASE_URL in `.env.local`. It does not overwrite an already configured external database, install a system service, or create a Windows user. Keep it running; Ctrl+C stops the cluster. This is a development convenience, not the production database architecture.

In another terminal:

```powershell
npm run db:migrate
npm run dev
```

Set `AUTH_ENABLED=true` and supply the public Firebase fields in `.env.local` for real Google sign-in. Leave emulator host blank on that development app. The locally supplied project settings are already present in this workspace.

## Automated local verification

```powershell
npm run check
npm run test:integration
```

Integration tests apply versioned migrations only to the loopback `dukaanpilot_test` database and reject other targets. Synthetic records remain isolated there; no live/business database reset or truncation is performed.

For browser tests, keep PostgreSQL running, then start two additional terminals:

```powershell
npm run local:auth
```

```powershell
npm run local:test-server
```

The test server binds port 3100, uses `demo-dukaanpilot`, overrides public Firebase values to synthetic settings and connects only to the local Auth emulator/test database. Then run:

```powershell
$env:E2E_EXTERNAL_SERVER='true'
npm run test:e2e
Remove-Item Env:E2E_EXTERNAL_SERVER
```

The explicit external-server mode avoids restricted-Windows process teardown issues. Emulator authentication is forbidden when APP_ENV or NODE_ENV is production. No debug identity/token-bypass endpoint exists. Pairing challenge/owner-channel tables exist with constraints; channel verification and pairing consumption remain S5.

## Build output and secrets

Development uses `.next/`, production build/start use `.next-build/`, and the isolated browser-test server uses `.next-s2-tests/`. They cannot delete one another's build output. All are ignored. Prisma generation precedes build and runs after install. Set production URLs and deployment configuration before hosting; a successful build is not a live-pilot authorization.

The `.env.example` defaults remain a provider-disabled preview. Keep real database URLs, opaque cookies, Gemini keys, Meta secrets and private credentials out of public variables and logs. Firebase web configuration is intentionally public; it does not grant database or tenant authority.

References: [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [official Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Prisma generated client](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client), [portable PostgreSQL wrapper](https://github.com/leinelissen/embedded-postgres).
