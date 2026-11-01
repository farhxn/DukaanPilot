# WhatsApp AI setup and no-spend testing

[Index](../README.md) · Checked 1 November 2026

The paired business owner can send AI instructions, add a customer, receive an exact financial preview and approve with its one-time command through WhatsApp. Customer messages remain requests for owner review; customers cannot approve financial actions or access business balances. The worker uses the same enabled Gemini adapter as the web assistant. No unofficial personal-WhatsApp automation is used.

## What is free?

[Meta's Developer Hub](https://whatsappbusiness.com/developers/developer-hub/) offers free testing. Start with Meta's test number and only the permitted recipients you add in its developer console. A test number is for testing, not unrestricted public onboarding.

[Meta's updated FAQ](https://whatsappbusiness.com/resources/faq/) says direct access has no additional platform-access fee. Effective 1 October 2026, the first 1,000 service messages per business phone number each month are free and service replies above that are charged. Templates have category/market-dependent pricing. Its older pricing page still describes unrestricted free service replies; this project follows the dated FAQ until the account's current rate card is verified. Production use cannot be promised permanently free. Google AI, a telephone number and hosting are separate services/costs.

**No-spend controls:** outbound stays off until setup; paid templates stay off. This app additionally stops after 900 service-send attempts per number over any rolling 33 UTC days, reserving before transport, including failed/uncertain attempts and retries. It leaves a buffer below the stated free allowance and avoids an early calendar reset across provider timezones. Old attempts must age out before another send is allowed. This counter cannot see other apps sending from the same number, account-specific restrictions or later price changes. Use a dedicated number, confirm the account's allowance/reset rules, and keep paid messaging disabled in Meta where available. It is not a provider-enforced spending guarantee. The ordinary 24-hour reply window, consent, daily/recipient caps, quiet hours and uncertain-send suppression still apply. Cap-blocked messages appear in the dashboard with MONTHLY_SERVICE_CAP.

## Get the free Meta test setup

1. Open [Meta for Developers](https://developers.facebook.com/) and register using your own account.
2. Create an app with the WhatsApp/business-messaging use case. In its WhatsApp setup area, open API Setup/Get Started and request/use the provided test phone number. Console labels may vary.
3. Add your own WhatsApp number as a permitted test recipient and finish Meta's verification step. Use Meta's test-message button to verify the connection, then reply from your phone to open the service window. Keep using the test number while validating this app; do not purchase a provider subscription.
4. Copy the test **phone-number ID**, **WhatsApp Business Account ID**, and the Graph API version shown in the console. Store the access token and app secret only in the local server settings. Temporary tokens expire; do not treat one as a permanent production credential.
5. Make the app reachable over a public HTTPS test URL. Localhost alone cannot receive Meta callbacks. A temporary tunnel can expose local port 3000 during testing; hosting selection remains pending. Update APP_URL and NEXT_PUBLIC_APP_URL to the same HTTPS origin, and authorize the domain in Firebase if you use browser sign-in there.
6. Configure the webhook callback as `https://YOUR-TEST-HOST/api/v1/webhooks/whatsapp`. Choose a long random verify token, store it as META_WEBHOOK_VERIFY_TOKEN, and use the same value in Meta. Subscribe the app to WhatsApp `messages` events for the account. App-secret HMAC checks remain mandatory.
7. Complete the settings below, then run `npm run whatsapp:check`. It reports presence only and never prints secrets or sends a message.

```dotenv
META_ACCESS_TOKEN=STORE_THE_TOKEN_LOCALLY
META_APP_SECRET=STORE_THE_APP_SECRET_LOCALLY
META_WEBHOOK_VERIFY_TOKEN=YOUR_RANDOM_VERIFY_TOKEN
META_GRAPH_API_VERSION=VERSION_SHOWN_IN_META_API_SETUP
META_REVIEW_REFERENCE=docs/WHATSAPP_SETUP.md
WHATSAPP_OUTBOUND_ENABLED=false
WHATSAPP_PAID_TEMPLATES_ENABLED=false
```

## Route and pair the owner

An operator maps one dedicated phone-number ID to one tenant using the existing audited provisioning command:

```powershell
# Set OPERATOR_ID and OPERATOR_REVIEW_REFERENCE locally first.
npm run operator -- channel TENANT_UUID PHONE_NUMBER_ID GRAPH_API_VERSION
```

The actual values come from your workspace and Meta console; placeholders are not runnable configuration. Open Messages in the signed-in dashboard, create an owner pairing command with explicit consent, and send that exact command from the permitted owner number to the test business number. Pairing expires and can be used only once. Phone-number ownership alone never grants owner authority.

After webhook/number/permission checks, enable WHATSAPP_OUTBOUND_ENABLED and run `npm run worker` under a supervised process. Restart after environment changes. No worker or outbound flag has been enabled by this document. For a real release use hosting, permanent scoped credentials, actual Meta/IAM/account review and the production runbook.

## End-to-end test sequence

1. Send `ADD CUSTOMER Sana` from the paired owner. Resend to check that the existing customer is detected.
2. Send `Sana ko 600 udhar mai add karo 1 December 2026 ko 3 pm wapis karega`.
3. Review customer, total, received amount, balance, receipt method and date in the response. No financial record is posted yet.
4. To accept, send the exact unexpired APPROVE command shown in the preview. A plain yes cannot approve it. Use the dashboard to edit or reject.
5. Repeat the original inbound delivery and approval to verify once-only behavior. An expired/stale command requires a fresh reviewed preview.
6. For duplicate names, use the offered customer ID as `USE CUSTOMER CUSTOMER_UUID | ORIGINAL_INSTRUCTION`, or specify the unique saved phone number. Archived customers require restoration in the dashboard.
7. Test a customer-sender impersonation, unsupported voice/image, STOP, expired reply window, token expiry and worker restart. No customer-sender message may post money or reveal owner totals.

If setup is missing or a send is blocked, use the dashboard. Without a Meta account/number, credentials and public HTTPS callback, real WhatsApp delivery is **NOT CONNECTED / NOT RUN**. Current repository tests use signed synthetic events and fake transport, not evidence of real Meta delivery.
