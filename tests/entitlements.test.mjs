import assert from 'node:assert/strict'
import test from 'node:test'
import { createEntitlements, createPromptQuota, planLimits, webhookAuthorized, webhookUserIds } from '../lib/entitlements.ts'
import { fundingModel } from '../lib/trial-policy.ts'

const config = { secretKey: 'sk_test', projectId: 'proj1', entitlementId: 'entl_pro' }

function memoryCache() {
  const values = new Map()
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value) },
    del: async (...keys) => { for (const key of keys) values.delete(key) },
  }
}

function revenueCat(responses) {
  const calls = []
  return { calls, fetch: async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization })
    const next = responses.shift()
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status ?? 200 })
  } }
}

test('an active pro entitlement makes the plan pro, and the answer is cached', async () => {
  const api = revenueCat([{ body: { items: [{ entitlement_id: 'entl_pro', expires_at: Date.now() + 60_000 }], next_page: null } }])
  const cache = memoryCache()
  const entitlements = createEntitlements({ fetch: api.fetch, cache, config, prefix: 't' })
  assert.equal(await entitlements.plan('user_abc'), 'pro')
  assert.equal(await entitlements.plan('user_abc'), 'pro')
  assert.equal(api.calls.length, 1)
  assert.match(api.calls[0].url, /\/v2\/projects\/proj1\/customers\/user_abc\/active_entitlements/)
  assert.equal(api.calls[0].auth, 'Bearer sk_test')
})

test('expired or other entitlements, unknown customers and guests are free', async () => {
  const expired = revenueCat([{ body: { items: [{ entitlement_id: 'entl_pro', expires_at: Date.now() - 1 }, { entitlement_id: 'entl_other', expires_at: null }] } }])
  assert.equal(await createEntitlements({ fetch: expired.fetch, cache: memoryCache(), config, prefix: 't' }).plan('user_a'), 'free')
  const unknown = revenueCat([{ status: 404 }])
  assert.equal(await createEntitlements({ fetch: unknown.fetch, cache: memoryCache(), config, prefix: 't' }).plan('user_a'), 'free')
  const guest = revenueCat([])
  assert.equal(await createEntitlements({ fetch: guest.fetch, cache: memoryCache(), config, prefix: 't' }).plan('guest:abc'), 'free')
  assert.equal(guest.calls.length, 0)
  const unconfigured = revenueCat([])
  assert.equal(await createEntitlements({ fetch: unconfigured.fetch, cache: memoryCache(), config: {}, prefix: 't' }).plan('user_a'), 'free')
})

test('a lifetime entitlement (no expiry) is pro', async () => {
  const api = revenueCat([{ body: { items: [{ entitlement_id: 'entl_pro', expires_at: null }] } }])
  assert.equal(await createEntitlements({ fetch: api.fetch, cache: memoryCache(), config, prefix: 't' }).plan('user_a'), 'pro')
})

test('an outage keeps the last known plan, and a webhook forgets it', async () => {
  const cache = memoryCache()
  const api = revenueCat([{ body: { items: [{ entitlement_id: 'entl_pro', expires_at: null }] } }, new Error('down'), { body: { items: [] } }])
  const entitlements = createEntitlements({ fetch: api.fetch, cache, config, prefix: 't' })
  assert.equal(await entitlements.plan('user_a'), 'pro')
  cache.values.delete('t:entitlement:user_a')
  assert.equal(await entitlements.plan('user_a'), 'pro')
  await entitlements.forget(['user_a'])
  assert.equal(cache.values.size, 0)
  assert.equal(await entitlements.plan('user_a'), 'free')
})

test('plans carry their limits; free has one site and no custom domains', () => {
  assert.deepEqual(planLimits('free', {}), { plan: 'free', dailyPrompts: 10, sites: 1, customDomains: false })
  assert.deepEqual(planLimits('pro', {}), { plan: 'pro', dailyPrompts: 200, sites: 20, customDomains: true })
  assert.equal(planLimits('free', { F0_FREE_DAILY_PROMPTS: '3' }).dailyPrompts, 3)
  assert.equal(planLimits('free', { F0_FREE_DAILY_PROMPTS: 'lots' }).dailyPrompts, 10)
})

test('free-plan turns are pinned to the free model; pro turns run the chat pick', () => {
  assert.equal(fundingModel({ kind: 'server', plan: 'pro', userId: 'u', loginId: 'l', expiresAt: 1 }), null)
  assert.ok(fundingModel({ kind: 'server', plan: 'free', userId: 'u', loginId: 'l', expiresAt: 1 }))
  assert.deepEqual(fundingModel({ kind: 'trial' }), { model: 'anthropic/claude-opus-5.5-fast', effort: 'low', fast: true })
  assert.equal(fundingModel({ accessToken: 'x', teamId: 'team_a' }), null)
})

test('the daily prompt quota stops at the limit and can give one back', async () => {
  const counts = new Map()
  const client = {
    eval: async (_script, [key], [limit]) => {
      const next = (counts.get(key) ?? 0) + 1
      if (next > limit) return -1
      counts.set(key, next)
      return next
    },
    get: async (key) => counts.get(key) ?? null,
    decr: async (key) => counts.set(key, counts.get(key) - 1),
  }
  const quota = createPromptQuota(client, 't', () => Date.parse('2026-10-21T12:00:00Z'))
  const first = await quota.reserve('user_a', 2)
  assert.equal(first.used, 1)
  assert.match(first.key, /:prompts:user_a:2026-10-21$/)
  assert.ok(await quota.reserve('user_a', 2))
  assert.equal(await quota.reserve('user_a', 2), null)
  await quota.release(first)
  assert.equal(await quota.used('user_a'), 1)
})

test('webhooks need the configured Authorization header and name their users', () => {
  assert.equal(webhookAuthorized('secret-value', 'secret-value'), true)
  assert.equal(webhookAuthorized('Bearer secret-value', 'secret-value'), true)
  assert.equal(webhookAuthorized('secret-valuX', 'secret-value'), false)
  assert.equal(webhookAuthorized(null, 'secret-value'), false)
  assert.equal(webhookAuthorized('anything', undefined), false)
  assert.deepEqual(webhookUserIds({ event: { type: 'TRANSFER', app_user_id: 'user_a', original_app_user_id: 'user_a', aliases: ['$RCAnonymousID:x', 'user_b'], transferred_to: ['user_c'] } }), ['user_a', 'user_b', 'user_c'])
  assert.deepEqual(webhookUserIds(null), [])
})
