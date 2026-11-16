-- Chip In Works interactive quote portal (Cloudflare D1).
-- The public Worker is the only service with access to this database.
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  view_token TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  proposal_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  first_opened_at TEXT,
  accepted_at TEXT,
  acceptance_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at);

CREATE TABLE IF NOT EXISTS pair_codes (
  code_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Client quote email dispatch via the connected Gmail account.
CREATE TABLE IF NOT EXISTS quote_email_outbox (
 quote_id TEXT PRIMARY KEY,
 recipient TEXT NOT NULL,
 sender TEXT NOT NULL,
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','cancelled')),
 created_at TEXT NOT NULL,
 sent_at TEXT,
 gmail_message_id TEXT,
 last_error TEXT,
 last_attempt_at TEXT,
 FOREIGN KEY(quote_id) REFERENCES quotes(id)
);
CREATE INDEX IF NOT EXISTS idx_quote_email_outbox_status ON quote_email_outbox(status,created_at);
