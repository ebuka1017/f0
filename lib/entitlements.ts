// Plans and their limits, and whether an account holds RevenueCat's `pro`
// entitlement. RevenueCat Web Billing sells the subscription; the server checks it
// with the REST API v2 and caches the answer until a webhook says it changed.
import { timingSafeEqual } from 'node:crypto'

export type Plan = 'free' | 'pro'

export interface PlanLimits {
  plan: Plan
  dailyPrompts: number
  sites: number
  customDomains: boolean
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function planLimits(plan: Plan, env: Record<string, string | undefined> = process.env): PlanLimits {
  return plan === 'pro'
    ? { plan, dailyPrompts: positive(env.F0_PRO_DAILY_PROMPTS, 200), sites: positive(env.F0_PRO_SITES, 20), customDomains: true }
    : { plan, dailyPrompts: positive(env.F0_FREE_DAILY_PROMPTS, 10), sites: positive(env.F0_FREE_SITES, 1), customDomains: false }
}

export interface EntitlementCache {
  get(key: string): Promise<unknown>
  set(key: string, value: string, options: { ex: number }): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
}

export interface RevenueCatConfig {
  secretKey?: string
  projectId?: string
  // The entitlement's id in RevenueCat (entl…), or its lookup key when that is what
  // the API returns for the project.
  entitlementId?: string
}

export function revenueCatConfigFromEnv(env: Record<string, string | undefined> = process.env): RevenueCatConfig {
  return { secretKey: env.REVENUECAT_SECRET_API_KEY, projectId: env.REVENUECAT_PROJECT_ID, entitlementId: env.REVENUECAT_PRO_ENTITLEMENT_ID }
}

export function revenueCatConfigured(config: RevenueCatConfig): config is Required<RevenueCatConfig> {
  return !!config.secretKey && !!config.projectId && !!config.entitlementId
}

const FRESH_SECONDS = 5 * 60
// A last known answer, used only when RevenueCat cannot be reached: a paying
// customer keeps pro through an outage, and a lapsed one loses it within a week.
const STALE_SECONDS = 7 * 24 * 60 * 60

export function createEntitlements(boundary: { fetch: typeof fetch; cache: EntitlementCache; config: RevenueCatConfig; prefix: string; now?: () => number }) {
  const now = boundary.now ?? Date.now
  const freshKey = (userId: string) => `${boundary.prefix}:entitlement:${userId}`
  const staleKey = (userId: string) => `${boundary.prefix}:entitlement-stale:${userId}`

  async function fetchPro(userId: string): Promise<boolean> {
    const { secretKey, projectId, entitlementId } = boundary.config as Required<RevenueCatConfig>
    let url: string | null = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}/active_entitlements?limit=100`
    for (let page = 0; url && page < 5; page++) {
      const response = await boundary.fetch(url, {
        headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
        cache: 'no-store', signal: AbortSignal.timeout(5_000),
      })
      // A customer RevenueCat has never seen has bought nothing.
      if (response.status === 404) return false
      if (!response.ok) throw new Error(`RevenueCat responded ${response.status}`)
      const body = await response.json() as { items?: { entitlement_id?: unknown; expires_at?: unknown }[]; next_page?: unknown }
      for (const item of body.items ?? []) {
        if (item.entitlement_id !== entitlementId) continue
        if (item.expires_at == null || (typeof item.expires_at === 'number' && item.expires_at > now())) return true
      }
      url = typeof body.next_page === 'string' && body.next_page.startsWith('/v2/') ? `https://api.revenuecat.com${body.next_page}` : null
    }
    return false
  }

  return {
    async plan(userId: string): Promise<Plan> {
      if (!userId || userId.startsWith('guest:')) return 'free'
      if (process.env.F0_ALL_PRO === '1') return 'pro'
      if (!revenueCatConfigured(boundary.config)) return 'free'
      const cached = await boundary.cache.get(freshKey(userId)).catch(() => null)
      if (cached === 'pro' || cached === 'free') return cached
      try {
        const plan: Plan = await fetchPro(userId) ? 'pro' : 'free'
        await Promise.all([
          boundary.cache.set(freshKey(userId), plan, { ex: FRESH_SECONDS }),
          boundary.cache.set(staleKey(userId), plan, { ex: STALE_SECONDS }),
        ]).catch(() => {})
        return plan
      } catch {
        const stale = await boundary.cache.get(staleKey(userId)).catch(() => null)
        return stale === 'pro' ? 'pro' : 'free'
      }
    },
    async forget(userIds: string[]): Promise<void> {
      const keys = userIds.filter(Boolean).flatMap((id) => [freshKey(id), staleKey(id)])
      if (keys.length) await boundary.cache.del(...keys)
    },
  }
}

// RevenueCat sends the Authorization header value set in its webhook settings.
export function webhookAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false
  const given = Buffer.from(header)
  const wanted = Buffer.from(expected)
  const alt = Buffer.from(`Bearer ${expected}`)
  return (given.length === wanted.length && timingSafeEqual(given, wanted)) ||
    (given.length === alt.length && timingSafeEqual(given, alt))
}

// The app user ids a webhook event is about: the purchaser and every alias.
export function webhookUserIds(body: unknown): string[] {
  const event = (body as { event?: Record<string, unknown> } | null)?.event
  if (!event || typeof event !== 'object') return []
  const ids = [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []), ...(Array.isArray(event.transferred_from) ? event.transferred_from : [])]
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256 && !id.startsWith('$RCAnonymousID')))]
}

// Prompts per account per UTC day. reserve() counts the prompt before it runs;
// release() gives it back when the prompt is refused later.
const RESERVE = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return -1 end
return count
`

export interface QuotaRedis {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>
  get(key: string): Promise<unknown>
  decr(key: string): Promise<unknown>
}

export function createPromptQuota(client: QuotaRedis, prefix: string, now: () => number = Date.now) {
  const key = (userId: string) => `${prefix}:prompts:${userId}:${new Date(now()).toISOString().slice(0, 10)}`
  return {
    async used(userId: string): Promise<number> {
      return Number(await client.get(key(userId)) ?? 0) || 0
    },
    // The count after this prompt, or null when the day's limit is reached.
    async reserve(userId: string, limit: number): Promise<{ key: string; used: number } | null> {
      const reservedKey = key(userId)
      const count = Number(await client.eval(RESERVE, [reservedKey], [limit, 26 * 60 * 60]))
      return count > 0 ? { key: reservedKey, used: count } : null
    },
    async release(reservation: { key: string }): Promise<void> {
      await client.decr(reservation.key)
    },
  }
}
