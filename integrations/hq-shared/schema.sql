CREATE TABLE IF NOT EXISTS hq_members (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  uid TEXT UNIQUE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hq_workspace (
  id INTEGER PRIMARY KEY CHECK(id=1),
  migration_verified INTEGER NOT NULL DEFAULT 0 CHECK(migration_verified IN (0,1))
);
INSERT OR IGNORE INTO hq_workspace(id) VALUES(1);
CREATE TABLE IF NOT EXISTS hq_records (
  collection TEXT NOT NULL, id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  data TEXT, updated_by TEXT NOT NULL REFERENCES hq_members(email),
  PRIMARY KEY(collection,id)
);
-- A batch rolls back in full if any expected revision is stale.
CREATE TRIGGER IF NOT EXISTS hq_record_revision_insert BEFORE INSERT ON hq_records
WHEN NEW.revision != COALESCE((SELECT revision FROM hq_records WHERE collection=NEW.collection AND id=NEW.id),0)+1
BEGIN SELECT RAISE(ABORT,'hq_revision_conflict'); END;
