// The custom-domain actions behind /api/domains, over injected stores so they are
// testable without Neon or Vercel. Pro only; a domain is claimed in SQL before it
// is attached on Vercel, and released if attaching fails.
// @ts-expect-error Node strip-types tests require the source extension.
import { AuthError } from './accounts.ts'
// @ts-expect-error Node strip-types tests require the source extension.
import { normalizeDomain, type Site } from './sites.ts'
import type { PlanLimits } from './entitlements'
import type { DomainStatus } from './vercel-domains'

export interface DomainDeps {
  limits(userId: string): Promise<PlanLimits>
  readSite(userId: string, siteId: unknown): Promise<Site>
  setCustomDomain(userId: string, siteId: unknown, domain: string | null): Promise<Site>
  markDomainVerified(userId: string, siteId: unknown, domain: string, verified: boolean): Promise<void>
  vercel: {
    configured: boolean
    add(domain: string): Promise<DomainStatus>
    status(domain: string, options?: { verify?: boolean }): Promise<DomainStatus>
    remove(domain: string): Promise<void>
  }
  // Hosts a customer may never claim: the app's and the sites root.
  reserved: string[]
}

export function createDomainHandlers(deps: DomainDeps) {
  async function requirePro(userId: string) {
    const limits = await deps.limits(userId)
    if (!limits.customDomains) {
      throw Object.assign(new AuthError(402, 'Custom domains are a Pro feature. Upgrade to connect your own domain.'), { code: 'upgrade_required' })
    }
  }
  return {
    async add(userId: string, input: { siteId?: unknown; domain?: unknown }): Promise<{ site: Site; status: DomainStatus }> {
      await requirePro(userId)
      if (!deps.vercel.configured) throw new AuthError(503, 'Custom domains are not configured on this deployment')
      const domain = normalizeDomain(input.domain, deps.reserved)
      if (!domain) throw new AuthError(400, 'Enter a domain you own, like example.com or www.example.com')
      const current = await deps.readSite(userId, input.siteId)
      if (current.customDomain && current.customDomain !== domain) throw new AuthError(409, 'Remove the current domain first')
      const site = await deps.setCustomDomain(userId, input.siteId, domain)
      try {
        const status = await deps.vercel.add(domain)
        return { site, status }
      } catch (error) {
        await deps.setCustomDomain(userId, input.siteId, null).catch(() => {})
        throw error
      }
    },
    async status(userId: string, siteId: unknown, { verify = false } = {}): Promise<{ site: Site; status: DomainStatus | null }> {
      const site = await deps.readSite(userId, siteId)
      if (!site.customDomain) return { site, status: null }
      const status = await deps.vercel.status(site.customDomain, { verify })
      const live = status.verified && status.configured
      if (live !== site.customDomainVerified) await deps.markDomainVerified(userId, siteId, site.customDomain, live)
      return { site: { ...site, customDomainVerified: live }, status }
    },
    async remove(userId: string, siteId: unknown): Promise<Site> {
      const site = await deps.readSite(userId, siteId)
      if (!site.customDomain) return site
      await deps.vercel.remove(site.customDomain)
      return deps.setCustomDomain(userId, siteId, null)
    },
  }
}
