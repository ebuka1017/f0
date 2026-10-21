import { AuthError } from '../../../lib/accounts'
import { withUserRoute } from '../../../lib/route-auth'
import { createSite, deleteSite, listSites, updateSite } from '../../../lib/sites'

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
  const site = await createSite(user.id, { sessionId: body.sessionId ?? body.chatId, slug: body.slug, title: body.title })
  return Response.json({ site }, { status: 201 })
})

// Renames a site (title) or moves it to a new address (slug).
export const PATCH = withUserRoute(async (request, { user }) => {
  const body = await jsonBody(request)
  const site = await updateSite(user.id, body.id, { slug: body.slug, title: body.title })
  return Response.json({ site })
})

export const DELETE = withUserRoute(async (request, { user }) => {
  await deleteSite(user.id, new URL(request.url).searchParams.get('id'))
  return new Response(null, { status: 204 })
})
