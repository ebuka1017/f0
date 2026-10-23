// The app's entitlement and quota instances, over its Redis.
import { createEntitlements, createPromptQuota, planLimits, revenueCatConfigFromEnv, type Plan, type PlanLimits } from './entitlements'

// Imported lazily: route tests stub the journal module without these exports.
async function store() {
  const { prefixed, redis } = await import('./journal')
  return { client: redis(), prefix: prefixed('billing') }
}

export async function entitlements() {
  const { client, prefix } = await store()
  return createEntitlements({
    fetch,
    config: revenueCatConfigFromEnv(),
    prefix,
    cache: {
      get: (key) => client.get(key),
      set: (key, value, options) => client.set(key, value, options),
      del: (...keys) => client.del(...keys),
    },
  })
}

export async function promptQuota() {
  const { client, prefix } = await store()
  return createPromptQuota(client, prefix)
}

export async function accountPlan(userId: string): Promise<PlanLimits> {
  return planLimits(await (await entitlements()).plan(userId))
}

export class PlanLimitError extends Error {
  status = 402
  code: string
  plan: Plan
  constructor(code: string, message: string, plan: Plan) {
    super(message)
    this.code = code
    this.plan = plan
  }
}

export function planLimitResponse(error: PlanLimitError): Response {
  return Response.json({ code: error.code, error: error.message, plan: error.plan, upgrade: true }, { status: 402, headers: { 'cache-control': 'private, no-store' } })
}
