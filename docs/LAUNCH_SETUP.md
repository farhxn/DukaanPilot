# Real-customer launch setup

[Index](../README.md) · Owner-directed business mode, 1 November 2026

The sample-only interface and server restriction have been removed. Normal authenticated business instructions create owner-review proposals. The local app is configured to use Gemini 3.5 Flash-Lite. This is implementation preparation, not evidence of a deployed or accepted live pilot.

## Manual setup before inviting customers

1. **Gemini:** complete the account/data-processing setup you intend to use for customer information, confirm the model and quotas, and verify current billing. The application cannot determine your account's billing tier. Keep the server key in secret settings. Complete the full language evaluation recorded in [AI setup](AI_SETUP_AND_EVALUATION.md); current live evidence covers only three synthetic sale examples.
2. **Firebase:** verify a real Google owner login, configure the production domain and production server identity. Remove all emulator settings from deployment.
3. **Hosting/database:** the requested $0 profile uses [Netlify Free + Neon Free](FREE_DEPLOYMENT.md), with Firebase Auth retained. Neon is created with 18 applied migrations and verified direct/pooled TLS; no local records were copied. It has no persistent worker: automatic follow-up enablement and WhatsApp stay disabled. The public site, Firebase server credential, hosted smoke tests and backup/retention operations still need setup.
4. **WhatsApp:** provision the official Meta app/number, token, signed webhook and permitted recipients. Outbound stays disabled until configured. An ordinary WhatsApp account does not supply the Cloud API integration. Web operations work independently.
5. **Business:** finalize support contact, privacy/retention notice, subscription plans and pilot merchants; complete the remaining [release acceptance](RELEASE_READINESS.md).

## AI server settings

The following is a deployment reference, with no credentials. Use your hosting secret settings rather than committing a filled environment file.

```dotenv
AI_ENABLED=true
AI_LIVE_DATA_ENABLED=true
AI_REVIEW_REFERENCE=docs/AI_SETUP_AND_EVALUATION.md#owner-directed-business-mode--1-november-2026
GEMINI_MODEL_ID=gemini-3.5-flash-lite
GEMINI_API_KEY=SET_IN_SERVER_SECRET_SETTINGS
AI_INPUT_PRICE_USD_PER_MILLION=0.30
AI_OUTPUT_PRICE_USD_PER_MILLION=2.50
```

These positive reference rates support conservative internal usage limits; they do not prove provider invoice amounts or prevent charges if account billing is changed. Authentication and all required Firebase/database settings must also be configured; `.env.example` and the operations guide are authoritative for the full environment. Production requires `APP_ENV=production`, matching HTTPS app origins and `sslmode=verify-full` database TLS. Restart processes after changing environment settings.

## Owner flow

Sign in, create the business workspace and add customers. Open Assistant and describe one order, sale or confirmed receipt with explicit amounts. Review/edit the proposed customer, amount, date and payment details in Approvals, then approve the exact version. Confirm the ledger result. Orders and fulfillment never post a sale automatically. Missing or ambiguous information returns clarification; manual forms remain available during provider failure.

No deployment, remote repository push or customer messages are performed by this setup change.
