import { AuthError } from '../../../lib/accounts'
import { validateDesignArtifactHtml } from '../../../lib/design-artifact'
import { embedDesignAssets } from '../../../lib/design-export'
import { readGeneration, recordGeneration } from '../../../lib/history'
import { readDesignArtifactAt } from '../../../lib/journal'
import { withUserRoute } from '../../../lib/route-auth'
import { publishSite, readSiteSession, unpublishSite } from '../../../lib/sites'

export const maxDuration = 60

// Publishes one version of a site's chat: a past revision from the history, or by
// default the live design, which is first recorded in the history (idempotently) so
// the site always points at a version the chat keeps.
export const POST = withUserRoute(async (request, { user }) => {
  const body = await request.json().catch(() => null) as { siteId?: unknown; revision?: unknown } | null
  if (!body || typeof body !== 'object') throw new AuthError(400, 'Invalid request body')
  const sessionId = await readSiteSession(user.id, body.siteId)
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
  const site = await publishSite(user.id, body.siteId, revision, await embedDesignAssets(sessionId, validation.html))
  return Response.json({ site, url: `/s/${site.slug}` })
})

export const DELETE = withUserRoute(async (request, { user }) => {
  const site = await unpublishSite(user.id, new URL(request.url).searchParams.get('siteId'))
  return Response.json({ site })
})
