# Chip In

The `ChipButt/ChipIn` repository now contains two separate public-path experiences:

- **Public Chip In website:** `https://chipbutt.github.io/ChipIn/`
- **Chip In HQ admin app:** `https://chipbutt.github.io/ChipIn/hq/`

The customer-facing website is the root of the GitHub Pages site. Chip In HQ remains the business admin application and is kept under `/hq/`.

## Chip In HQ

Chip In HQ covers the workflow: find work → create job → do work → invoice → get paid → record expenses → track tax.

It includes clients, jobs, quotes, invoices, expenses, receipts, tax-pot reporting, calendar/prep planning, PDF invoices, backups and encrypted cross-device sync.

## Private data architecture

The public `ChipButt/ChipIn` repository contains application code and public website assets only.

Private business data is written to `ChipButt/ChipIn-Data`, which remains a **private** repository. Before sensitive information is uploaded, Chip In HQ encrypts it in the browser with AES-GCM. The encryption key is derived from the user's Chip In HQ passphrase using PBKDF2-SHA256.

The private repository stores encrypted state, invoice archives, receipts and conflict safety copies. The GitHub fine-grained token is encrypted locally in the browser; the plaintext token and passphrase are never committed to either repository.

Moving the admin app to `/hq/` does not change the `ChipIn-Data` repository, token permissions, passphrase or GitHub API connection. IndexedDB and localStorage remain on the same `chipbutt.github.io` origin.

## GitHub Pages

Pushes to `main` deploy automatically using `.github/workflows/pages.yml`.

The root service worker is intentionally a one-time migration worker that clears the old root-scoped Chip In HQ cache and unregisters itself. Chip In HQ has its own service worker inside `/hq/`, scoped to that folder.
