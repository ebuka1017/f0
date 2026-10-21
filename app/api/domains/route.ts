import { AuthError } from '../../../lib/accounts'
import { accountPlan } from '../../../lib/billing'
import { createDomainHandlers } from '../../../lib/domain-routes'
import { withUserRoute } from '../../../lib/route-auth'
import { markDomainVerified, readSite, setCustomDomain } from '../../../lib/sites'
import { VercelDomainError, vercelDomains } from '../../../lib/vercel-domains'

export const maxDuration = 30

function handlers() {
  const appHost = (() => { try { return new URL(process.env.APP_URL ?? '').host } catch { return '' } })()
  return createDomainHandlers({
    limits: accountPlan, readSite, setCustomDomain, markDomainVerified,
    vercel: vercelDomains(),
    reserved: [appHost, process.env.SITES_ROOT_DOMAIN ?? ''],
  })
}

async function respond(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await work())
  } catch (error) {
    if (error instanceof VercelDomainError) return Response.json({ error: error.message }, { status: error.status })
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code
      return Response.json({ error: error.message, ...(code ? { code, upgrade: true } : {}) }, { status: error.status })
    }
    throw error
  }
}

// GET ?siteId= reports the domain's DNS records and status; POST { siteId, domain }
// connects one; PATCH ?siteId= asks Vercel to verify again; DELETE ?siteId= removes it.
export const GET = withUserRoute(async (request, { user }) =>
  respond(() => handlers().status(user.id, new URL(request.url).searchParams.get('siteId'))))

export const POST = withUserRoute(async (request, { user }) => {
  const body = await request.json().catch(() => null) as { siteId?: unknown; domain?: unknown } | null
  if (!body || typeof body !== 'object') throw new AuthError(400, 'Invalid request body')
  return respond(() => handlers().add(user.id, body))
})

export const PATCH = withUserRoute(async (request, { user }) =>
  respond(() => handlers().status(user.id, new URL(request.url).searchParams.get('siteId'), { verify: true })))

export const DELETE = withUserRoute(async (request, { user }) =>
  respond(async () => ({ site: await handlers().remove(user.id, new URL(request.url).searchParams.get('siteId')) })))
