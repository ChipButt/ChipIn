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

## Manual-only customer emails

**Owner requirement: every email is drafted, never automatically sent.** Email delivery happens only when the owner presses **Send** in Gmail.

- **Publish & open Gmail draft** publishes an immutable customer quote and immediately opens a pre-filled Gmail compose tab with the published link. The owner can amend the recipient, subject and body before sending.
- Email subject and body are editable in the draft quote editor. Placeholders `{clientName}`, `{quoteNumber}`, `{validUntil}` and `{quoteLink}` are expanded when the Gmail draft opens.
- Already-published quotations offer **Open Gmail draft** again; sending remains entirely manual. HQ can copy the customer link as before.
- Client contact details, Sales Assistant outreach and follow-ups use the central `hq/app28_email_drafts.js` composer to open editable Gmail drafts with saved business details, prior conversation context when recorded, and links where appropriate.
- Invoice emails open Gmail with the recipient, subject and body prefilled, and download the exact invoice PDF for manual attachment. Gmail browser compose links cannot pre-attach files; the owner must attach the downloaded PDF before sending.
- The old hourly Gmail sender is **disabled** and the Worker no longer creates outgoing email queue records. `/api/admin/send-email` returns HTTP 410. Previously confirmed sends remain in the historical email outbox; the outbox is not used for future delivery.
- HQ does **not** infer or mark successful email delivery from opening a draft. Its internal quotation workflow status may use `Sent` as an existing state but the user-facing status is `Published` until an acceptance is received or the owner records delivery.
- Hourly acceptance notifications remain available; these do not send customer emails.

## Regression checks

Run `node quote-portal/queue.test.mjs` to validate that no email is sent or queued, the legacy queue API is disabled, and first-contact/follow-up Gmail draft URLs are prefilled. No real email is sent by this test.

## Important limitation

A Gmail browser compose URL cannot attach a local PDF automatically. A draft with an invoice PDF already attached would require a separate, explicitly authorised Gmail **draft-creation-only** integration. No such integration has been enabled, and no email is ever sent without the owner's action.
