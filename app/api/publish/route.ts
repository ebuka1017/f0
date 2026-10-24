import { AuthError } from '../../../lib/accounts'
import { accountPlan, PlanLimitError, planLimitResponse } from '../../../lib/billing'
import { validateDesignArtifactHtml } from '../../../lib/design-artifact'
import { embedDesignAssets } from '../../../lib/design-export'
import { readGeneration, recordGeneration } from '../../../lib/history'
import { readDesignArtifactAt } from '../../../lib/journal'
import { withUserRoute } from '../../../lib/route-auth'
import { createSite, listSites, normalizeTitle, publishSite, readSiteSession, siteForChat, slugTaken, suggestSlug, unpublishSite } from '../../../lib/sites'

export const maxDuration = 60

// The chat's site, created on its first publish with an address suggested from
// the title (ada-bakery, then ada-bakery-2…). The plan's site limit applies here.
async function chatSite(userId: string, sessionId: unknown, title: unknown, slug: unknown) {
  const existing = await siteForChat(userId, sessionId)
  if (existing) return existing
  const limits = await accountPlan(userId)
  if ((await listSites(userId)).length >= limits.sites) {
    throw new PlanLimitError('upgrade_required', limits.plan === 'free'
      ? 'The free plan includes 1 site. Upgrade to Pro to publish more.'
      : `Your plan includes ${limits.sites} sites.`, limits.plan)
  }
  const base = typeof slug === 'string' && slug ? suggestSlug(slug) : suggestSlug(typeof title === 'string' ? title : '')
  let candidate = base
  for (let attempt = 2; attempt < 8 && await slugTaken(candidate); attempt++) candidate = `${base.slice(0, 34)}-${attempt}`
  if (await slugTaken(candidate)) candidate = `${base.slice(0, 30)}-${crypto.randomUUID().slice(0, 6)}`
  return createSite(userId, { sessionId, slug: candidate, title: normalizeTitle(title) ?? candidate }, limits.sites)
}

// Publishes one version of a site's chat: a past revision from the history, or by
// default the live design, which is first recorded in the history (idempotently) so
// the site always points at a version the chat keeps. `{ sessionId }` alone is the
// chat view's one-click Publish: it finds or creates the chat's site first.
export const POST = withUserRoute(async (request, { user }) => {
  const body = await request.json().catch(() => null) as { siteId?: unknown; sessionId?: unknown; title?: unknown; slug?: unknown; revision?: unknown } | null
  if (!body || typeof body !== 'object') throw new AuthError(400, 'Invalid request body')
  let siteId = body.siteId
  if (siteId === undefined && body.sessionId !== undefined) {
    try {
      siteId = (await chatSite(user.id, body.sessionId, body.title, body.slug)).id
    } catch (error) {
      if (error instanceof PlanLimitError) return planLimitResponse(error)
      throw error
    }
  }
  const sessionId = await readSiteSession(user.id, siteId)
  let revision: number
  let html: string | null
  if (body.revision === undefined || body.revision === null) {
    const live = await readDesignArtifactAt(sessionId)
    revision = live.revision
    html = live.html
    if (html == null || revision <= 0) throw new AuthError(404, 'This chat has no design to publish yet')
    await recordGeneration(sessionId, revision, null, html)
  } else {
    revision = Number(body.revision)
    if (!Number.isSafeInteger(revision) || revision <= 0) throw new AuthError(400, 'Invalid revision')
    html = await readGeneration(user.id, sessionId, revision)
    if (html == null) throw new AuthError(404, 'This version is not in the history')
  }
  const validation = validateDesignArtifactHtml(html)
  if (!validation.ok) return Response.json({ error: `This design cannot be published: ${validation.error}` }, { status: 422 })
  const site = await publishSite(user.id, siteId, revision, await embedDesignAssets(sessionId, validation.html))
  return Response.json({ site, url: site.url })
})

// GET ?sessionId= is the chat's site, if it has one, for the Publish button.
export const GET = withUserRoute(async (request, { user }) => {
  return Response.json({ site: await siteForChat(user.id, new URL(request.url).searchParams.get('sessionId')) })
})

export const DELETE = withUserRoute(async (request, { user }) => {
  const site = await unpublishSite(user.id, new URL(request.url).searchParams.get('siteId'))
  return Response.json({ site })
})
