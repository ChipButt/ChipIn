# Chip In Sales Assistant — Firebase Spark architecture

This is the no-Blaze version.

## Architecture

Chip In HQ -> Firebase Authentication REST -> Firestore REST

ChatGPT -> Google OAuth -> Firestore REST

There is no Cloud Function, Cloud Run service, Worker or paid Firebase backend in this path.

## What HQ stores

HQ writes one document:

`chipinSalesAssistant/current`

Fields:
- `version`
- `syncedAt`
- `ownerUid`
- `actionCount`
- `todayJson`
- `pipelineJson`

Only Sales Assistant data is exported. Invoices, bank details, tax, receipts, GitHub token and HQ passphrase are excluded.

## HQ authentication

HQ signs in through the Firebase Authentication REST API with an Email/Password Firebase user.
The password is never stored. Firebase returns a refresh token; HQ encrypts that refresh token locally using the existing Chip In HQ encryption passphrase.

Firestore requests from HQ carry a Firebase ID token, so Firestore Security Rules apply.

## Firestore rules

After the first Firebase sign-in, HQ displays the authenticated Firebase UID and provides a **Copy Firestore Security Rules** button.

Paste those rules into Firebase Console -> Firestore Database -> Rules -> Publish.

The rules allow only that Firebase UID to read/write the `chipinSalesAssistant` collection and deny every other Firebase client request.

## ChatGPT read access

ChatGPT should authenticate to Google with OAuth 2.0 and call Firestore's REST API directly.

Use a dedicated Google identity with the project-level role:
`Cloud Datastore Viewer (roles/datastore.viewer)`

Do not give the ChatGPT reader Owner, Editor, Firebase Admin or Datastore User.

OAuth:
- Authorization URL: https://accounts.google.com/o/oauth2/v2/auth
- Token URL: https://oauth2.googleapis.com/token
- Scope: https://www.googleapis.com/auth/datastore

The IAM Viewer role makes that identity read-only even though the OAuth datastore scope itself supports Firestore data access.

Import `chatgpt-firestore-openapi.json` after replacing `REPLACE_PROJECT_ID`.

## Suggested assistant instruction

You are Chip In's Sales Assistant. Before answering questions about current prospects, tasks, follow-ups or pipeline, call getChipInSalesAssistantFeed.

Parse:
- fields.todayJson.stringValue as JSON for the due action list and targets.
- fields.pipelineJson.stringValue as JSON for prospect records.

For each due action present it as:

ACTION: EMAIL / CALL / VISIT
CLIENT: business name
CONTACT: exact email / phone / address from Firestore
WHY: concise factual reason from Firestore
YOU SHOULD SAY: natural wording based only on verified fields

Never invent a contact detail, previous conversation, promise, date, problem or outcome. If a field is absent, state that it is missing. Chip performs the actual email, call or visit.
