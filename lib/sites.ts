// Published personal sites. A site points at one of its chat's generations; the
// rows are owner-scoped in SQL, so a caller that skipped a route check still
// touches nothing it does not own.
// @ts-expect-error Node strip-types tests require the source extension.
import { AuthError, validSessionId, withAccountDatabase, type AccountQuery } from './accounts.ts'

export interface Site {
  id: string
  sessionId: string
  slug: string
  title: string
  publishedVersionId: number | null
  publishedAt: string | null
  customDomain: string | null
  createdAt: string
  updatedAt: string
}

export const MAX_SITES_PER_USER = 20
const TITLE_LENGTH = 80

// Paths and names the app or a future subdomain scheme needs for itself.
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'blog', 'dashboard', 'docs', 'f0', 'fx0', 'help', 'login', 'logout',
  'mail', 'new', 'root', 'settings', 'signin', 'signup', 'sites', 'static', 'status', 'support', 'www',
])

export function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) || slug.includes('--') || RESERVED_SLUGS.has(slug)) return null
  return slug
}

export function normalizeTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Code points, not UTF-16 units: a cut emoji half is not valid text.
  const title = [...value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()].slice(0, TITLE_LENGTH).join('')
  return title || null
}

export function validSiteId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
}

const COLUMNS = `id, session_id, slug, title, published_version_id, published_at::text AS published_at,
  custom_domain, created_at::text AS created_at, updated_at::text AS updated_at`

function toSite(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    slug: String(row.slug),
    title: String(row.title),
    publishedVersionId: row.published_version_id == null ? null : Number(row.published_version_id),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    customDomain: row.custom_domain == null ? null : String(row.custom_domain),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
}

function ownerId(userId: string): string {
  if (typeof userId !== 'string' || !userId || userId.startsWith('guest:')) throw new AuthError(401, 'Sign in to manage sites')
  return userId
}

export function createSiteStore(query: AccountQuery) {
  return {
    async listSites(userId: string): Promise<Site[]> {
      const rows = await query(`SELECT ${COLUMNS} FROM fx0_sites WHERE user_id = $1 ORDER BY updated_at DESC, id`, [ownerId(userId)])
      return rows.map(toSite)
    },
    // The chat must be the caller's own: the insert selects it through ownership.
    async createSite(userId: string, input: { sessionId: unknown; slug: unknown; title: unknown }): Promise<Site> {
      ownerId(userId)
      if (!validSessionId(input.sessionId)) throw new AuthError(400, 'Choose a chat to publish')
      const slug = normalizeSlug(input.slug)
      if (!slug) throw new AuthError(400, 'Use 3-40 lowercase letters, numbers or single hyphens for the address')
      const title = normalizeTitle(input.title) ?? slug
      try {
        const rows = await query(`INSERT INTO fx0_sites (id, user_id, session_id, slug, title)
          SELECT $1, c.user_id, c.session_id, $4, $5 FROM fx0_chat_ownership c
          WHERE c.session_id = $3 AND c.user_id = $2
            AND (SELECT count(*) FROM fx0_sites WHERE user_id = $2) < $6
          RETURNING ${COLUMNS}`, [crypto.randomUUID(), userId, input.sessionId, slug, title, MAX_SITES_PER_USER])
        if (!rows.length) throw new AuthError(404, 'Chat not found, or you have reached the site limit')
        return toSite(rows[0])
      } catch (error) {
        if (isUniqueViolation(error)) throw new AuthError(409, 'That address is taken')
        throw error
      }
    },
    async updateSite(userId: string, siteId: unknown, input: { slug?: unknown; title?: unknown }): Promise<Site> {
      ownerId(userId)
      if (!validSiteId(siteId)) throw new AuthError(404, 'Site not found')
      const slug = input.slug === undefined ? null : normalizeSlug(input.slug)
      if (input.slug !== undefined && !slug) throw new AuthError(400, 'Use 3-40 lowercase letters, numbers or single hyphens for the address')
      const title = input.title === undefined ? null : normalizeTitle(input.title)
      if (input.title !== undefined && !title) throw new AuthError(400, 'A site needs a title')
      try {
        const rows = await query(`UPDATE fx0_sites SET slug = COALESCE($3, slug), title = COALESCE($4, title), updated_at = now()
          WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`, [siteId, userId, slug, title])
        if (!rows.length) throw new AuthError(404, 'Site not found')
        return toSite(rows[0])
      } catch (error) {
        if (isUniqueViolation(error)) throw new AuthError(409, 'That address is taken')
        throw error
      }
    },
    async deleteSite(userId: string, siteId: unknown): Promise<void> {
      ownerId(userId)
      if (!validSiteId(siteId)) throw new AuthError(404, 'Site not found')
      const rows = await query('DELETE FROM fx0_sites WHERE id = $1 AND user_id = $2 RETURNING id', [siteId, userId])
      if (!rows.length) throw new AuthError(404, 'Site not found')
    },
    // Only a revision the chat's history holds can go live; the join proves both
    // ownership and that the version exists.
    async publishSite(userId: string, siteId: unknown, revision: number, html: string): Promise<Site> {
      ownerId(userId)
      if (!validSiteId(siteId)) throw new AuthError(404, 'Site not found')
      if (!Number.isSafeInteger(revision) || revision <= 0) throw new AuthError(400, 'Nothing to publish yet')
      const rows = await query(`UPDATE fx0_sites s SET published_version_id = $3, published_html = $4,
          published_at = now(), updated_at = now()
        FROM fx0_generations g
        WHERE s.id = $1 AND s.user_id = $2 AND g.session_id = s.session_id AND g.revision = $3
        RETURNING s.id, s.session_id, s.slug, s.title, s.published_version_id, s.published_at::text AS published_at,
          s.custom_domain, s.created_at::text AS created_at, s.updated_at::text AS updated_at`, [siteId, userId, revision, html])
      if (!rows.length) throw new AuthError(404, 'Site or version not found')
      return toSite(rows[0])
    },
    async unpublishSite(userId: string, siteId: unknown): Promise<Site> {
      ownerId(userId)
      if (!validSiteId(siteId)) throw new AuthError(404, 'Site not found')
      const rows = await query(`UPDATE fx0_sites SET published_version_id = NULL, published_html = NULL, published_at = NULL,
          updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`, [siteId, userId])
      if (!rows.length) throw new AuthError(404, 'Site not found')
      return toSite(rows[0])
    },
    async readSiteSession(userId: string, siteId: unknown): Promise<string> {
      ownerId(userId)
      if (!validSiteId(siteId)) throw new AuthError(404, 'Site not found')
      const [row] = await query('SELECT session_id FROM fx0_sites WHERE id = $1 AND user_id = $2', [siteId, userId])
      if (!row) throw new AuthError(404, 'Site not found')
      return String(row.session_id)
    },
    // Public: anyone may read a published site by its slug.
    async readPublishedSite(slug: unknown): Promise<{ html: string; title: string } | null> {
      const normalized = normalizeSlug(slug)
      if (!normalized) return null
      const [row] = await query(`SELECT published_html, title FROM fx0_sites
        WHERE slug = $1 AND published_html IS NOT NULL`, [normalized])
      return typeof row?.published_html === 'string' ? { html: row.published_html, title: String(row.title) } : null
    },
  }
}

type SiteStore = ReturnType<typeof createSiteStore>

function withSites<T>(work: (store: SiteStore) => Promise<T>): Promise<T> {
  return withAccountDatabase((query) => work(createSiteStore(query)), { timeoutMs: 10_000 })
}

export const listSites = (userId: string) => withSites((store) => store.listSites(userId))
export const createSite = (userId: string, input: { sessionId: unknown; slug: unknown; title: unknown }) =>
  withSites((store) => store.createSite(userId, input))
export const updateSite = (userId: string, siteId: unknown, input: { slug?: unknown; title?: unknown }) =>
  withSites((store) => store.updateSite(userId, siteId, input))
export const deleteSite = (userId: string, siteId: unknown) => withSites((store) => store.deleteSite(userId, siteId))
export const publishSite = (userId: string, siteId: unknown, revision: number, html: string) =>
  withSites((store) => store.publishSite(userId, siteId, revision, html))
export const unpublishSite = (userId: string, siteId: unknown) => withSites((store) => store.unpublishSite(userId, siteId))
export const readSiteSession = (userId: string, siteId: unknown) => withSites((store) => store.readSiteSession(userId, siteId))
export const readPublishedSite = (slug: unknown) => withSites((store) => store.readPublishedSite(slug))

// A published site runs model-written HTML on the app's origin, so the policy is
// stricter than the preview's: an opaque origin (sandbox without same-origin) so its
// scripts never see the app's cookies or storage, no network beyond https images,
// and no framing. TODO(subdomains): serve sites from <slug>.<SITES_DOMAIN> (and
// custom domains) on a separate registrable domain, routed in proxy.ts.
export const PUBLISHED_SITE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: https:',
  'font-src data:',
  'media-src data:',
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
].join('; ')
