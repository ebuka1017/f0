import { entitlements } from '../../../../lib/billing'
import { webhookAuthorized, webhookUserIds } from '../../../../lib/entitlements'

export const maxDuration = 15

// RevenueCat → f0. Every event (purchase, renewal, cancellation, expiration,
// transfer…) only invalidates the cached plan of the users it names; the next
// check reads entitlements from the REST API, so a forged body could at most
// cause a re-check. The Authorization header must still match.
export async function POST(request: Request): Promise<Response> {
  if (!webhookAuthorized(request.headers.get('authorization'), process.env.REVENUECAT_WEBHOOK_AUTH)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const ids = webhookUserIds(body)
  try {
    await (await entitlements()).forget(ids)
  } catch {
    // A non-2xx makes RevenueCat retry later.
    return Response.json({ error: 'Temporarily unavailable' }, { status: 503 })
  }
  return Response.json({ ok: true, users: ids.length })
}
