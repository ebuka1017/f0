import { accountPlan, entitlements } from '../../../../lib/billing'
import { withUserRoute } from '../../../../lib/route-auth'

export const maxDuration = 15

// Called by the paywall right after a purchase: drop the cached plan and ask
// RevenueCat again, so Pro applies without waiting for the webhook.
export const POST = withUserRoute(async (_request, { user }) => {
  await (await entitlements()).forget([user.id])
  return Response.json(await accountPlan(user.id))
})
