// Which kind of host a request came in on. Published sites live on their own
// registrable domain (SITES_ROOT_DOMAIN, e.g. f0sites.app), never the app's, so a
// site's scripts can never share cookies or storage with the app.
export type SiteHost =
  | { kind: 'app' }
  | { kind: 'sites-root' }
  | { kind: 'subdomain'; slug: string }
  | { kind: 'custom'; host: string }

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null
  const host = value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return /^[a-z0-9.-]{1,253}$/.test(host) && !host.startsWith('.') && !host.includes('..') ? host : null
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try { return normalizeHost(new URL(url).host) } catch { return null }
}

export interface HostConfig {
  appUrl?: string
  sitesRootDomain?: string
  // Hosts that always serve the app: localhost, Vercel preview URLs.
  extraAppHosts?: string[]
}

export function hostConfigFromEnv(env: Record<string, string | undefined> = process.env): HostConfig {
  return {
    appUrl: env.APP_URL,
    sitesRootDomain: env.SITES_ROOT_DOMAIN,
    extraAppHosts: [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter((host): host is string => !!host),
  }
}

export function resolveSiteHost(rawHost: string | null | undefined, config: HostConfig): SiteHost {
  const host = normalizeHost(rawHost)
  if (!host) return { kind: 'app' }
  const appHost = hostOf(config.appUrl)
  const appHosts = new Set([appHost, ...(config.extraAppHosts ?? []).map(normalizeHost)].filter(Boolean))
  if (appHosts.has(host) || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') && !config.sitesRootDomain?.endsWith('localhost')) {
    return { kind: 'app' }
  }
  const root = normalizeHost(config.sitesRootDomain)
  if (root) {
    if (host === root || host === `www.${root}`) return { kind: 'sites-root' }
    if (host.endsWith(`.${root}`)) {
      const label = host.slice(0, -root.length - 1)
      // One label only: a.b.<root> is no site.
      return /^[a-z0-9-]+$/.test(label) ? { kind: 'subdomain', slug: label } : { kind: 'sites-root' }
    }
  }
  // Vercel deployment hosts are the app; anything else reaching this project was
  // attached as a customer's custom domain.
  if (host.endsWith('.vercel.app')) return { kind: 'app' }
  return { kind: 'custom', host }
}

// The internal path a site host is rewritten to.
export function siteRewritePath(site: SiteHost, pathname: string): string | null {
  // A single-file site has one page; any path serves it (fragments stay client-side).
  void pathname
  if (site.kind === 'subdomain') return `/s/${encodeURIComponent(site.slug)}`
  if (site.kind === 'custom') return `/site-host/${encodeURIComponent(site.host)}`
  return null
}
