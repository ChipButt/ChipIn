# Chip In Sales Assistant — GPT Action bridge

This folder contains the optional zero-subscription bridge between Chip In HQ and ChatGPT.

## What it does

Chip In HQ remains the source of truth. When the bridge is connected, HQ sends only Sales Assistant data to a small authenticated Cloudflare Worker. The Worker stores the latest sales feed in KV. A ChatGPT GPT Action can then call:

- GET /assistant/today
- GET /assistant/pipeline
- GET /assistant/lead/{id}

The GPT should use those records to produce the final human wording, while Chip remains the person who actually emails, calls or visits.

## Security boundary

The bridge receives Sales Assistant prospect/contact data only. It does not receive invoices, expenses, bank details, tax records, receipts, the GitHub token or the Chip In HQ passphrase.

Both HQ -> Worker and GPT -> Worker require the same Bearer API key. Use a long random key and store it as the Worker secret `API_KEY`.

## Deployment

1. Create a free Cloudflare account if needed.
2. Create a Workers KV namespace and bind it as `SALES_DATA`.
3. Replace the KV namespace ID in wrangler.toml.
4. Deploy worker.js.
5. Add a Worker secret called `API_KEY` with a long random value.
6. In Chip In HQ > Sales Assistant > ChatGPT connection, enter the Worker HTTPS URL and the same API key, then choose Save & sync.
7. In a GPT Action, import openapi.json, replace the server URL with the deployed Worker URL, and configure API-key authentication as Bearer using the same key.

## Suggested GPT instruction

You are Chip In's Sales Assistant. Treat the Chip In Sales Assistant API as the sole source of truth for prospect facts. When asked what Chip needs to do, call getTodaysSalesActions. For each action return:

ACTION: EMAIL / CALL / VISIT
CLIENT: business name
CONTACT: email / phone / address returned by the API
WHY: concise factual reason from the API
YOU SHOULD SAY: short natural wording based only on returned facts

Never invent a previous conversation, contact detail, business problem, deadline or promise. If a fact is missing, say it is missing instead of guessing. Chip performs the contact himself; do not claim to have sent an email, made a call or visited anyone.
