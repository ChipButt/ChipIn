# Chip In HQ

A sole-trader admin website for Chip In, built around the workflow: find work → create job → do work → invoice → get paid → record expenses → track tax.

## What it does

- Business setup for legal name, address, bank details and invoice defaults.
- Client records.
- Job workflow: Booked → In progress → Complete → Invoiced → Paid.
- Branded PDF invoices with unique invoice numbers and payment details.
- Payment tracking, overdue status and outstanding totals.
- Expense records with receipt attachments.
- UK tax-year dashboard and tax / Class 4 NI estimate.
- PAYE income/tax fields so employed + self-employed work can be estimated together.
- Full backup / restore, CSV exports and year-end tax packs.
- Responsive mobile layout and installable PWA shell.
- Encrypted cross-device sync through the private `ChipButt/ChipIn-Data` repository.

## Private data architecture

The public `ChipButt/ChipIn` repository contains only the application code and public artwork.

Private business data is written to `ChipButt/ChipIn-Data`, which must remain a **private** repository. Before anything sensitive is uploaded, Chip In HQ encrypts it in the browser with AES-GCM. The encryption key is derived from the user's Chip In HQ passphrase using PBKDF2-SHA256.

The private repository stores:

- `data/chipin.enc` — encrypted business database.
- `invoices/<tax-year>/<invoice>.pdf.enc` — encrypted issued invoice PDFs.
- `receipts/<tax-year>/...enc` — encrypted receipt files.
- `conflicts/...enc` — encrypted safety copies if two devices change the data at the same time.

The GitHub fine-grained token is encrypted locally in the browser with the same passphrase. The plaintext token and passphrase are never committed to either repository.

## Device setup

Each device needs the fine-grained GitHub token once. The token should be restricted to **only `ChipIn-Data`** with **Contents: Read and write** permission. The user then enters the same Chip In HQ encryption passphrase to unlock the private records.

Chip In HQ still keeps a local IndexedDB copy so it can continue to work if the connection is temporarily unavailable. Once unlocked and online, changes sync to the encrypted private repository.

## GitHub Pages

Pushes to `main` deploy automatically through the included GitHub Pages workflow.

Live app:

`https://chipbutt.github.io/ChipIn/`

## Tax estimate

The tax screen is an administrative estimate, not tax advice or a submitted HMRC return. Always check the final position with HMRC / Self Assessment, especially if there are other income sources, benefits, student loans, capital gains, pensions or unusual reliefs.
