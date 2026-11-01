# Free web deployment

[Index](../README.md) · Prepared 1 November 2026 · Public deployment NOT RUN

## Your connected Neon project and immediate next steps

The owner subsequently authorized Neon setup and completed browser authentication. **Neon is now ready:** [dukaanpilot project](https://console.neon.tech/app/projects/floral-voice-84861315/) in organization org-green-base-09820069, Ohio, PostgreSQL 18, fixed 0.25 CU. Organization Free status was verified again after creation. The plan enforces its default five-minute idle sleep; an explicit interval edit was refused by the Free account and no upgrade was attempted. All 18 migrations applied; certificate-verified direct and pooled transaction/advisory-lock checks passed. The new database has **0 tenants and 0 sales**; local business data was not copied.

Private settings are saved in **.local/neon-production.env** (database URLs) and **.local/netlify-production.env** (Netlify import file with database, existing public Firebase settings and Gemini key). These contain secrets, are ignored by Git and must never be uploaded to a repository or sent in chat. Existing .env.local still points at the existing local database. The official Neon CLI 8.16.0 and its authenticated profile are stored under .local; no global CLI, agent plugin/MCP configuration, Neon Auth or new application dependency was installed.

To finish the Netlify side:

1. Connect the private GitHub repository to a **Free** Netlify project. Keep its first build paused until settings are complete; use the root netlify.toml settings.
2. In Netlify environment settings, import the **private .local/netlify-production.env file** with Builds and Functions scopes (or all scopes). Importing through the environment UI is different from uploading it as source.
3. Replace both APP_URL and NEXT_PUBLIC_APP_URL with the actual HTTPS netlify.app address. Leave no YOUR-SITE placeholder.
4. Add the matching **FIREBASE_SERVICE_ACCOUNT_JSON** server secret using the Firebase service-account instructions below. Its blank value is intentional; no private Firebase credential was provided or invented.
5. Add the final hostname to Firebase Authentication's Authorized domains; keep Google sign-in enabled. Disable Netlify previews/branch deployments with production settings.
6. Publish the production build, verify /health/ready and complete the hosted smoke cases below. Share only the site address and setup status for further assistance.

No Netlify site exists or has been deployed by this setup. The Netlify adapter package, hosted owner login and end-to-end hosted finance/AI remain NOT RUN. Both local financial browser profiles, local production build, 37 unit/contract tests and 42 PostgreSQL cases passed during preparation. The protected restore rehearsal also passed with 26,668 synthetic rows across 37 tables. These do not replace hosted acceptance.

Use **Netlify Free + Neon Free + existing Firebase Auth + Gemini Free Tier**. This is a limited web pilot, not unlimited hosting. No paid plan, trial upgrade, payment method, purchased domain or Meta setup is needed for this preparation. Keep each account on its free plan; the application cannot inspect or enforce external account billing settings.

## Why this combination

| Service | Choice and current limit |
|---|---|
| Web/API | Netlify Free: commercial projects permitted; 300 shared monthly credits and a hard stop, no automatic recharge. Traffic, compute and deployments share the allowance; each production deployment consumes 15 credits. Use the included HTTPS netlify.app address. |
| Database | Neon Free: 1 GB storage and 100 CU-hours per project/month; scales to zero after five idle minutes. Cold starts and quota exhaustion can interrupt availability. Keep Free selected, with no upgrade. |
| Owner sign-in | Existing Firebase project, Google sign-in on Spark; authorize the final hostname. No phone/SMS authentication. |
| AI | Existing server key from a confirmed Gemini Free Tier project with billing disabled. Free model availability/rate limits can change; manual recording remains available when AI is blocked. Internal cost estimates are not a payment mechanism or provider spending control. |
| WhatsApp / scheduled loop | Disabled. No Meta setup, paid templates, external cron or persistent worker is provisioned. Orders and manual updates remain usable. Automatic follow-up enablement is hidden and rejected by the API. |

Firebase App Hosting requires **Blaze**, so it does not meet the requested billing-disabled approach. Firebase static Hosting alone cannot run this application's authenticated Next.js server/API and PostgreSQL operations. Vercel Hobby restricts commercial use. Do not convert this app to a static export to bypass its backend.

Official references checked for this decision: [Netlify pricing](https://www.netlify.com/pricing/), [credit rules](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [commercial free projects](https://www.netlify.com/blog/introducing-netlify-free-plan/), [Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Neon pricing](https://neon.com/pricing), [Firebase App Hosting costs](https://firebase.google.com/docs/app-hosting/costs), [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## 1. Create the free accounts and site

1. Create/sign into Netlify and Neon. Select **Free**, decline upgrades/add-ons, and do not enable billing or auto recharge. Check the plan shown in each dashboard, rather than assuming a signup trial is Free.
2. Create a Neon PostgreSQL project. Choose a region reasonably near the Netlify function region available to your account; record both. Use the ordinary Neon Postgres role supplied for this project, not a superuser or a provider API key.
3. Create an empty Netlify project/site using its dashboard or CLI, choose its final `YOUR-SITE.netlify.app` name, and keep automatic publishing/builds stopped until settings and migrations are ready. Do not buy a domain.
4. Use a **private Git repository** for this source and connect it to Netlify when ready. This workspace has no configured repository/remote. Review the files before committing: exclude .env files, .local, work, caches, generated Prisma clients, dependencies, database backups and optional large brag-output media. Never upload a Firebase service-account file. Do not drag/drop the project as a static site.

## 2. Configure secrets and authentication

Use [the deployment environment template](../deploy/.env.example). Enter its values in Netlify **Project configuration → Environment variables**, available to **Builds and Functions** (or all scopes if that is the Free-plan interface). TOML environment values are build-only, so all application settings belong in the dashboard. Set matching HTTPS APP_URL and NEXT_PUBLIC_APP_URL to the final site address. Do not include a trailing path.

- Copy your existing Firebase public web configuration. In Firebase Authentication, enable Google and add the exact Netlify hostname to Authorized domains. This app uses Google popup sign-in; retain the Firebase authDomain from the web configuration.
- For this non-Google host, set server-only **FIREBASE_SERVICE_ACCOUNT_JSON** to compact service-account JSON from the same Firebase project. Firebase Console → Project settings → Service accounts → Generate new private key, if your organization's policy permits. Prefer a dedicated account limited to the Authentication permissions needed to verify token revocation/read users; do not grant Owner/Editor. Never weaken revocation checks to avoid supplying credentials. ADC remains supported for other hosts.
- Paste JSON into the secret field without shell quotes; do not paste it in chat or commit it. For an ignored local dotenv file, use single quotes around the compact JSON so its escaped newlines survive. The account project must match FIREBASE_PROJECT_ID. Rotate/revoke the key if it is exposed. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).
- Set DATABASE_URL to Neon's **pooled** connection string, with sslmode=verify-full. Keep hostname/certificate verification enabled; do not use rejectUnauthorized=false. The app limits each instance to two PostgreSQL connections. Neon pooling uses transaction mode; existing locks are transaction-scoped. See [Neon pooling](https://neon.com/docs/connect/connection-pooling).
- Set your existing Gemini key as a server secret. Confirm Free Tier and billing disabled in the actual Google project. Keep AI_ENABLED=true and its existing owner activation reference. Free-tier data terms and the remaining customer-data review still apply; this deployment does not mark those reviews complete.
- Explicitly set FOLLOW_UP_ENABLED=false, WHATSAPP_OUTBOUND_ENABLED=false and WHATSAPP_PAID_TEMPLATES_ENABLED=false. Omit emulator, test-output, Meta and worker settings. No provider keys use NEXT_PUBLIC_ names.

Do not give production credentials to previews, branches from others, or untrusted build code. Disable Netlify Deploy Previews and branch deploys in its build settings. The build preflight also refuses non-production CONTEXT values. Private pages are dynamic and private APIs use session/tenant checks; test those properties on the deployed host before inviting merchants.

## 3. Prepare the database, then build

Start with an **empty hosted database**. Do not seed samples or transfer the local development database automatically. Existing local real records require a separately reviewed encrypted backup/restore process; this setup preserves them locally.

Create an ignored **.env.production.local** on the operator computer from deploy/.env.example. Set its secrets locally and add **DIRECT_DATABASE_URL** using Neon's non-pooler hostname with sslmode=verify-full. Do not place URLs/passwords in commands or command history. No emulator values belong in this file. Existing exported environment values take precedence over dotenv files: use a fresh terminal without old app settings.

Run from the project root:

```powershell
npm ci
node --env-file=.env.production.local --experimental-strip-types scripts/deployment-check.mjs
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate status
```

Review migration results privately: Prisma can print database identifiers. Never post full connection output. Migration commands prefer DIRECT_DATABASE_URL; the web app always uses DATABASE_URL. Only forward migrations are deployed; never use db push/reset or rewrite applied migrations. Before updating a populated hosted database, take an encrypted backup using the existing backup procedure.

Netlify reads **netlify.toml**: Node 22.20.0, command **npm run deployment:check && npm run build**, publish directory **.next-build**. It automatically provides its maintained Next.js adapter for SSR, API routes and server components; no adapter dependency or static redirect rule is needed. Do not set NEXT_DIST_DIR. This application needs standard Node functions, not Edge functions. The synchronous host allowance is 60 seconds; individual Gemini calls remain bounded at 15 seconds. Keep builds stopped until all production settings are present, then publish one production build. Migrations deliberately do not run automatically from every build or preview.

Source references: [Netlify environment scopes](https://docs.netlify.com/build/functions/environment-variables/), [function limits](https://docs.netlify.com/build/functions/configuration/). Platform adapter packaging and hosted connectivity remain unverified until this first build succeeds.

## 4. Verify the hosted application

Record PASS/FAIL and actual time for each case; all are currently **NOT RUN on hosting**:

1. /health/ready returns 200 over HTTPS after migrations. An unconfigured app fails closed. Do not use continuous keep-awake polling: it consumes compute/credits and prevents database sleep.
2. Google sign-in, workspace creation, logout and revoked/disabled Firebase user denial work on the final hostname. Emulator tokens fail.
3. With a clearly named synthetic customer, prepare a credit-sale draft with an explicit date and one with no date; the latter defaults to next month's first at 09:00 Pakistan time. Draft creation alone posts no money.
4. The signed-in owner approves a synthetic draft exactly once, verifies the sale/receipt and uses the normal owner-approved reversal if needed. Replayed approval cannot double post; a second test tenant cannot see or change it. Do not use an actual customer for this smoke test.
5. Gemini returns a usable draft, while a blocked/quota-exhausted model still allows manual recording. Check usage without exposing prompts or keys.
6. No WhatsApp approval/enable-follow-up button appears. A direct authenticated follow-up enable request receives FOLLOW_UP_UNAVAILABLE and creates no jobs.
7. Inspect browser assets/network and host logs for secrets; cookies are Secure/HttpOnly/SameSite, writes enforce the final origin, and private responses are not shared between owners.
8. Run an encrypted backup and rehearse restoration into an isolated database before relying on hosted records. Choose backup key custody/storage and a support contact. Do not assume the short free database restore window satisfies the pilot recovery target.

## Operating within zero spend

Stay on Free/Spark and billing-disabled Gemini. Use the provider dashboards to monitor usage weekly and before sharing the site widely. Avoid automated redeploys for every small edit and public uptime polling that keeps PostgreSQL awake. If free resources are exhausted, accept downtime or wait for reset; never silently upgrade. A large customer base, guaranteed uptime and unattended reminder delivery are outside this free profile.

There is no durable worker or hosted backup/retention schedule in this deployment. Use the existing reviewed operator maintenance and encrypted backup commands from a trusted computer according to [operations](OPERATIONS_AND_RECOVERY.md), loading the production env explicitly. Do not expose an unauthenticated cron endpoint. Existing workflows migrated from another environment must be reviewed/stopped, not left falsely active.

For a bad release, stop publishing and restore the previous Netlify deploy after checking database compatibility. Do not roll back financial history or migrations by resetting the database. Disable AI with both AI_ENABLED=false and AI_LIVE_DATA_ENABLED=false if necessary; manual tools remain available. Free plan limits are availability limits, not an SLA. Launch also depends on the remaining support/privacy/provider checks in [release readiness](RELEASE_READINESS.md).

## Current evidence and next step

Configuration, non-Google-host authentication support, pooled connections and worker/WhatsApp disablement are prepared. Neon creation, migrations and verified direct/pooled connectivity are complete as recorded above. The remaining external step is creating/connecting the Netlify site, supplying its actual origin and Firebase server identity, and passing the hosted checks. Share only the site hostname and setup status in chat.
