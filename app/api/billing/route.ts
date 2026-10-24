import { accountPlan, promptQuota } from '../../../lib/billing'
import { withUserRoute } from '../../../lib/route-auth'

export const maxDuration = 15

// The account's plan, its limits and today's usage, for the paywall and My sites.
export const GET = withUserRoute(async (_request, { user }) => {
  const [limits, used] = await Promise.all([accountPlan(user.id), promptQuota().then((quota) => quota.used(user.id)).catch(() => 0)])
  return Response.json({ ...limits, promptsUsedToday: used, appUserId: user.id })
})
