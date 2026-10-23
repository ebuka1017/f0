-- Clerk identities map onto fx0_accounts. A new Clerk user gets an account whose
-- id is its Clerk user id; a Clerk user whose verified email matches a legacy
-- (Sign in with Vercel) account is linked to that account once, so its chats and
-- sites carry over. account_id is unique: one legacy account links at most once.
CREATE TABLE IF NOT EXISTS fx0_account_links (
  clerk_user_id text PRIMARY KEY CHECK (clerk_user_id ~ '^user_[A-Za-z0-9]{1,64}$'),
  account_id text NOT NULL UNIQUE REFERENCES fx0_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fx0_accounts ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'vercel';
CREATE INDEX IF NOT EXISTS fx0_accounts_email_idx ON fx0_accounts(lower(email));

-- Custom domains are attached through the Vercel Domains API; only a verified
-- domain is routed to its site.
ALTER TABLE fx0_sites ADD COLUMN IF NOT EXISTS custom_domain_verified boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS fx0_sites_custom_domain_idx ON fx0_sites(lower(custom_domain)) WHERE custom_domain IS NOT NULL;
