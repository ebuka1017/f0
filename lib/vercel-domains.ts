// Custom domains through the Vercel Domains API, attached to this project so
// Vercel issues their certificates and routes them here (proxy.ts then maps the
// host to its site).
export interface VercelDomainsConfig { token?: string; projectId?: string; teamId?: string }

export function vercelDomainsConfigFromEnv(env: Record<string, string | undefined> = process.env): VercelDomainsConfig {
  return { token: env.VERCEL_TOKEN, projectId: env.VERCEL_PROJECT_ID, teamId: env.VERCEL_TEAM_ID }
}

export interface DnsRecord { type: 'A' | 'CNAME' | 'TXT'; name: string; value: string; reason?: string }

export interface DomainStatus {
  domain: string
  // Ownership verified on Vercel (no other project or account claims it).
  verified: boolean
  // DNS points at Vercel.
  configured: boolean
  records: DnsRecord[]
}

export class VercelDomainError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const VERCEL_A_RECORD = '76.76.21.21'
export const VERCEL_CNAME = 'cname.vercel-dns.com'

// A domain with exactly two labels (example.com) is an apex; co.uk-style suffixes
// are treated as subdomains and get a CNAME, which their registrars accept.
export function isApex(domain: string): boolean {
  return domain.split('.').length === 2
}

export function routingRecord(domain: string): DnsRecord {
  return isApex(domain)
    ? { type: 'A', name: '@', value: VERCEL_A_RECORD }
    : { type: 'CNAME', name: domain.split('.').slice(0, -2).join('.'), value: VERCEL_CNAME }
}

interface ProjectDomain { name?: string; verified?: boolean; verification?: { type?: string; domain?: string; value?: string; reason?: string }[] }

export function domainStatus(domain: string, project: ProjectDomain, config: { misconfigured?: boolean } | null): DomainStatus {
  const verification = (project.verification ?? [])
    .filter((item) => item.type === 'TXT' && typeof item.domain === 'string' && typeof item.value === 'string')
    .map((item) => ({ type: 'TXT' as const, name: item.domain!, value: item.value!, ...(item.reason ? { reason: item.reason } : {}) }))
  return {
    domain,
    verified: project.verified === true,
    configured: config ? config.misconfigured === false : false,
    records: [routingRecord(domain), ...verification],
  }
}

export function createVercelDomains(boundary: { fetch: typeof fetch; config: VercelDomainsConfig }) {
  const { token, projectId, teamId } = boundary.config
  const configured = !!token && !!projectId
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!configured) throw new VercelDomainError(503, 'Custom domains are not configured on this deployment')
    const url = new URL(`https://api.vercel.com${path}`)
    if (teamId) url.searchParams.set('teamId', teamId)
    const response = await boundary.fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(10_000),
    })
    const data = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } }
    if (!response.ok) {
      const code = data.error?.code
      // Never echo Vercel's raw text, which can name other accounts' projects.
      const message = response.status === 409 || code === 'domain_already_in_use' ? 'That domain is already in use on Vercel'
        : response.status === 400 ? 'Vercel rejected that domain' : response.status === 404 ? 'Domain not found' : 'Vercel is unavailable; try again'
      throw new VercelDomainError(response.status === 404 ? 404 : response.status === 409 ? 409 : response.status === 400 ? 400 : 502, message)
    }
    return data
  }
  const project = encodeURIComponent(projectId ?? '')
  return {
    configured,
    async add(domain: string): Promise<DomainStatus> {
      const added = await call<ProjectDomain>('POST', `/v10/projects/${project}/domains`, { name: domain })
      return domainStatus(domain, added, null)
    },
    async status(domain: string, { verify = false } = {}): Promise<DomainStatus> {
      const name = encodeURIComponent(domain)
      const projectDomain = verify
        ? await call<ProjectDomain>('POST', `/v9/projects/${project}/domains/${name}/verify`).catch(async (error) => {
          // Not yet verifiable: report the pending records instead of failing.
          if (error instanceof VercelDomainError && error.status === 400) return call<ProjectDomain>('GET', `/v9/projects/${project}/domains/${name}`)
          throw error
        })
        : await call<ProjectDomain>('GET', `/v9/projects/${project}/domains/${name}`)
      const config = await call<{ misconfigured?: boolean }>('GET', `/v6/domains/${name}/config`).catch(() => null)
      return domainStatus(domain, projectDomain, config)
    },
    async remove(domain: string): Promise<void> {
      await call('DELETE', `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`).catch((error) => {
        if (!(error instanceof VercelDomainError && error.status === 404)) throw error
      })
    },
  }
}

export function vercelDomains() {
  return createVercelDomains({ fetch, config: vercelDomainsConfigFromEnv() })
}
