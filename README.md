# Chip In HQ

A local-first admin website for Chip In, built for a UK sole trader workflow.

## What it does

- First-run business setup for legal name, address, bank details and invoice defaults.
- Client records.
- Job workflow: Booked → In progress → Complete → Invoiced → Paid.
- One-click invoice generation from a completed job.
- Branded PDF invoices with unique invoice numbers and payment details.
- Payment tracking, overdue status and outstanding totals.
- Expense records with optional receipt attachments.
- UK tax-year dashboard and 2026/27 Income Tax + Class 4 NI estimate.
- PAYE income/tax fields so employed + self-employed work can be estimated together.
- Full backup / restore.
- CSV exports and a ZIP tax pack with receipts.
- Responsive mobile layout and installable PWA shell.

## Data and privacy

The repository is public, so **no private business data is hard-coded or committed**. Business details, clients, invoices, payments, expenses and receipt files are stored in the browser's IndexedDB on the device where you use Chip In HQ.

Use **Documents → Download backup** regularly. The backup includes the admin database and receipt files and can be restored on another device.

## GitHub Pages

The included Pages workflow publishes the static site. In the repository, open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Once enabled, pushes to `main` deploy automatically.

## Tax estimate

The tax screen is an administrative estimate, not tax advice or a submitted HMRC return. It currently models 2026/27 Personal Allowance and non-savings Income Tax bands, plus self-employed Class 4 National Insurance. Always check the final position with HMRC / Self Assessment, especially if there are other income sources, benefits, student loans, capital gains, pensions or unusual reliefs.
