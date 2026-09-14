# Chip In HQ

A sole-trader admin website for Chip In, built around the workflow: find work → create job → do work → invoice → get paid → record expenses → track tax.

## What it does

- First-run business setup for legal name, address, bank details and invoice defaults.
- Client records.
- Job workflow: Booked → In progress → Complete → Invoiced → Paid.
- One-click invoice generation from a completed job.
- Branded PDF invoices with unique invoice numbers and payment details.
- Payment tracking, overdue status and outstanding totals.
- Expense records with optional receipt attachments.
- UK tax-year dashboard and tax / Class 4 NI estimate.
- PAYE income/tax fields so employed + self-employed work can be estimated together.
- Full backup / restore.
- CSV exports and a ZIP tax pack with receipts.
- Responsive mobile layout and installable PWA shell.
- Google Drive / Google Sheets cross-device sync.

## Google Drive data store

The private master data file is:

**Chip In HQ - Business Data**

It lives inside the private **Chip In HQ** folder in Google Drive. The app serialises the complete Chip In HQ backup into the `Sync` sheet in chunks, including client/job/invoice/expense records, settings and receipt attachments. This allows the same records to be restored and updated from a computer or phone.

The GitHub repository contains only the spreadsheet ID. It does **not** contain the spreadsheet contents, Google access tokens, bank details, client records or receipt files.

### One-time Google browser authorization

Because the website is hosted on GitHub Pages, Google requires a browser OAuth Client ID before JavaScript is allowed to access a private Google Sheet.

Create a **Web application OAuth 2.0 Client ID** in Google Cloud, add this authorised JavaScript origin:

`https://chipbutt.github.io`

Then open **Chip In HQ → Settings → Google Drive sync**, paste the Client ID and press **Connect Google Drive**. Use the same Google account that owns the Chip In HQ data sheet.

The Client ID is not a password or client secret. It may later be hard-coded into the app if desired so it does not need entering on each new device.

## Local resilience

Chip In HQ still keeps an IndexedDB copy on the current device, so the application remains local-first and can recover if the network is temporarily unavailable. When Google Drive is connected, changes are also synced to the private Google Sheet. The newest copy wins when another device connects.

Use **Documents → Download backup** periodically as an additional independent backup.

## GitHub Pages

Pushes to `main` deploy automatically through the included GitHub Pages workflow.

Live app:

`https://chipbutt.github.io/ChipIn/`

## Tax estimate

The tax screen is an administrative estimate, not tax advice or a submitted HMRC return. Always check the final position with HMRC / Self Assessment, especially if there are other income sources, benefits, student loans, capital gains, pensions or unusual reliefs.
