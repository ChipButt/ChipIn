# Chip In Works — Interactive Client Quotations

This is the **customer-facing extension** of the existing Chip In HQ Quotes feature. It does not replace HQ, its IndexedDB data, its encrypted private GitHub sync, or its invoice system.

## Production infrastructure

- Cloudflare Worker: `chipin-hq-quotes`
- Customer URL host: https://chipin-hq-quotes.goldplushighdefinition.workers.dev
- D1 database: `chipin-hq-interactive-quotes`, with Worker binding `DB`
- Required Worker secret: `ADMIN_KEY` (generated in Cloudflare; never commit or expose it)
- HQ integration: `hq/app27_interactive_quotes.js` and small hooks in `hq/app26_quotes.js`

## Workflow

1. Create a website quote as usual in HQ. Configure domain, one-off costs, payment arrangement, demo URL and optional add-ons.
2. Select **Publish interactive quote**. The resulting URL is specific to that client and quote, and the published snapshot cannot be changed.
3. Copy or email the customer link. Their page allows exactly one website care option (including none) and any optional extras, recalculating initial and recurring totals.
4. The Worker independently validates every selected service and price against the immutable D1 snapshot. The acceptance record contains the selected options, signed name, email, timestamp and server-calculated total. Repeat acceptance is rejected.
5. HQ securely checks for accepted quotes. It displays a dashboard/Quotes notification. The owner reviews and approves the choices, then HQ uses its existing job and **draft** invoice workflow. Payments are not processed in the portal.

## One-time connection

A Cloudflare account administrator creates a random 24-byte one-use pairing code. D1 stores only the SHA-256 hash in `pair_codes` plus a short expiry. In HQ, unlock private storage, open **Quotes → Connect quotations**, and paste the code. The Worker returns the administration credential **once** to the authorised browser. HQ encrypts it using its existing passphrase and saves it locally in browser storage. No credential is placed in the public repository. Each new HQ device requires separate secure pairing.

## Building

The Worker source deliberately keeps the customer HTML separate for editing. Run `node quote-portal/build.mjs` (Node 20+, no dependencies); it creates `quote-portal/dist/worker.js`, a single deployable module. The D1 schema is in `schema.sql`.

Deploy only to the designated Cloudflare account. Preserve both the `DB` binding and `ADMIN_KEY` secret when updating Worker code. Confirm the /api/health endpoint, test a synthetic quotation through to acceptance, and delete the test row.

## Security

- The public client link is a random, unguessable bearer URL. Treat it as confidential.
- The database contains **only** published quotation details and acceptance records, never the private HQ datastore or its GitHub credentials.
- All pricing and allowed selections are checked **server-side**.
- Admin requests require the secret bearer token, with CORS restricted to the two Chip In Works origins.
- One-time pairing codes are stored hashed and consumed atomically; client acceptance is also atomic, and cannot be repeated.
- Sensitive pages use `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and `noindex`.
- Customer pages never collect payments or store card information.
- A strong random client link is not identity verification. For higher-value contracts, consider email challenge/verification before accepting.

## Important limitations

## Email delivery from Gmail

- Confirmed sender: `jamesbutt.chipin@gmail.com`. The authenticated Gmail connector remains in ChatGPT; its OAuth token is **not** copied into Cloudflare or browser JavaScript.
- **Publish & email quotation** creates the private URL and atomically queues the customer email, using the subject and message edited in HQ before publication. It does not itself send an email.
- The authenticated Worker writes an immutable message into `quote_email_outbox` in D1 when publishing, using the recipient and the personalised wording stored in the published snapshot. For older published quotations without a queued email, the owner can still queue it separately.
- A separate hourly ChatGPT automation is configured to process the queue through the connected Gmail account and record the returned Gmail message ID. **This task may stop for required user approval.** As checked on 16 November 2026, it was paused with `requires_user_action: true`; unattended sending must not be represented as guaranteed.
- HQ automatically synchronises the delivery status from D1 while open and unlocked. **Queued** never means sent. **Sent by Gmail** means Gmail accepted a message, not that it reached the client's inbox.
- **Open Gmail draft** opens a prefilled browser Gmail compose window for manual sending, using the same editable subject and body template. HQ cannot automatically verify a manually sent draft. Take care not to send the same quotation manually and again through the queue.
- There is no direct unattended Gmail API integration in HQ. The ChatGPT automation's permission checks can pause it, even if the Gmail app's general permissions are set to allow all. Until a separately authorised direct sending integration is configured, queued messages may not be sent without further action.
- An hourly ChatGPT acceptance watcher separately checks for new accepted client quotations. HQ also checks for acceptances while open.

To run a safe local regression check, run `node quote-portal/queue.test.mjs`. It uses an in-memory fake database and never sends messages. GitHub Action `Verify Chip In quotation emails` runs this on updates.

## Important limitations

Gmail-backed dispatch can take up to an hour or longer if the automation runs late or needs retrying. This is not instant transactional email. Do not promise an email was delivered before `quote_email_outbox` has a confirmed Gmail message ID. Never send emails just because a quote has been published; a separate explicit queue action is required.
