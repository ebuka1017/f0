import { listOwnedSessions, reserveNewServerSession, reserveNewSession, withUserRoute, withChatRoute } from '../../../lib/route-auth'
import { clerkEnabled } from '../../../lib/auth-mode'
import { resolveGrantedTeam } from '../../../lib/auth'

export const maxDuration = 60

export const GET = withChatRoute(async (request, { user }) => {
  return Response.json(await listOwnedSessions(user.id, new URL(request.url).searchParams.get('cursor')))
})

export const POST = withUserRoute(async (_request, { user, session }) => {
  if (clerkEnabled()) {
    const id = await reserveNewServerSession(user)
    return Response.json({ id, sessionId: id }, { status: 201 })
  }
  const { teamId } = await resolveGrantedTeam(session)
  const id = await reserveNewSession(user, teamId)
  return Response.json({ id, sessionId: id }, { status: 201 })
})
