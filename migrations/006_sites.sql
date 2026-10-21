-- A site is a chat's design published at a public slug. It belongs to the chat's
-- owner, and deleting the chat (or its account) takes the site down with it.
-- published_version_id is the fx0_generations revision that is live; published_html
-- is that revision with attached images embedded, served as is from /s/<slug>.
CREATE TABLE IF NOT EXISTS fx0_sites (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f-]{36}$'),
  user_id text NOT NULL REFERENCES fx0_accounts(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES fx0_chat_ownership(session_id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  published_version_id integer CHECK (published_version_id > 0),
  published_html text,
  published_at timestamptz,
  custom_domain text UNIQUE CHECK (custom_domain IS NULL OR length(custom_domain) BETWEEN 4 AND 253),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fx0_sites_user_idx ON fx0_sites(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS fx0_sites_session_idx ON fx0_sites(session_id);
