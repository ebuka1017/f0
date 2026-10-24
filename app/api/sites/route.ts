import { AuthError } from '../../../lib/accounts'
import { withUserRoute } from '../../../lib/route-auth'
import { accountPlan, PlanLimitError, planLimitResponse } from '../../../lib/billing'
import { createSite, deleteSite, listSites, readSite, updateSite } from '../../../lib/sites'
import { VercelDomainError, vercelDomains } from '../../../lib/vercel-domains'

export const maxDuration = 30

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthError(400, 'Invalid request body')
  return body as Record<string, unknown>
}

// Sites are for signed-in accounts only; a guest chat must sign in before it publishes.
export const GET = withUserRoute(async (_request, { user }) => {
  return Response.json({ sites: await listSites(user.id) })
})

export const POST = withUserRoute(async (request, { user }) => {
  const body = await jsonBody(request)
  const limits = await accountPlan(user.id)
  const sites = await listSites(user.id)
  if (sites.length >= limits.sites) {
    return planLimitResponse(new PlanLimitError('upgrade_required', limits.plan === 'free'
      ? 'The free plan includes 1 site. Upgrade to Pro for more sites and custom domains.'
      : `Your plan includes ${limits.sites} sites.`, limits.plan))
  }
  const site = await createSite(user.id, { sessionId: body.sessionId ?? body.chatId, slug: body.slug, title: body.title }, limits.sites)
  return Response.json({ site }, { status: 201 })
})

// Renames a site (title) or moves it to a new address (slug).
export const PATCH = withUserRoute(async (request, { user }) => {
  const body = await jsonBody(request)
  const site = await updateSite(user.id, body.id, { slug: body.slug, title: body.title })
  return Response.json({ site })
})

export const DELETE = withUserRoute(async (request, { user }) => {
  const id = new URL(request.url).searchParams.get('id')
  // Detach a connected custom domain from the Vercel project first, so it can be
  // reconnected later; if Vercel fails, keep the site so the user can retry.
  const site = await readSite(user.id, id)
  if (site.customDomain) {
    const vercel = vercelDomains()
    if (vercel.configured) {
      await vercel.remove(site.customDomain).catch((error) => {
        if (error instanceof VercelDomainError) throw new AuthError(error.status, `Couldn't disconnect ${site.customDomain}: ${error.message}`)
        throw error
      })
    }
  }
  await deleteSite(user.id, id)
  return new Response(null, { status: 204 })
})
