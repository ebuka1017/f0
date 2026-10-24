import assert from 'node:assert/strict'
import test from 'node:test'
import { createDomainHandlers } from '../lib/domain-routes.ts'
import { createVercelDomains, domainStatus, routingRecord } from '../lib/vercel-domains.ts'
import { normalizeDomain, suggestSlug } from '../lib/sites.ts'
import { createAccountStore } from '../lib/accounts.ts'

const siteId = '0f8c7a55-2c51-4b8e-9d3a-6f1b2a3c4d5e'
const pro = { plan: 'pro', dailyPrompts: 200, sites: 20, customDomains: true }
const free = { plan: 'free', dailyPrompts: 10, sites: 1, customDomains: false }

function harness({ limits = pro, vercel = {} } = {}) {
  const site = { id: siteId, slug: 'ada', customDomain: null, customDomainVerified: false }
  const calls = []
  const deps = {
    limits: async () => limits,
    readSite: async () => ({ ...site }),
    setCustomDomain: async (_user, _id, domain) => { calls.push(['set', domain]); site.customDomain = domain; site.customDomainVerified = false; return { ...site } },
    markDomainVerified: async (_user, _id, domain, verified) => { calls.push(['verified', domain, verified]); site.customDomainVerified = verified },
    vercel: {
      configured: true,
      add: async (domain) => { calls.push(['add', domain]); return { domain, verified: false, configured: false, records: [routingRecord(domain)] } },
      status: async (domain) => ({ domain, verified: true, configured: true, records: [] }),
      remove: async (domain) => { calls.push(['remove', domain]) },
      ...vercel,
    },
    reserved: ['f0.app', 'f0sites.app'],
  }
  return { site, calls, handlers: createDomainHandlers(deps) }
}

test('custom domains are a pro feature', async () => {
  const { handlers, calls } = harness({ limits: free })
  await assert.rejects(handlers.add('user_a', { siteId, domain: 'adasbakery.com' }), { status: 402, code: 'upgrade_required' })
  assert.equal(calls.length, 0)
})

test('a domain is claimed before Vercel attaches it, and released if that fails', async () => {
  const ok = harness()
  const { status } = await ok.handlers.add('user_a', { siteId, domain: 'https://WWW.AdasBakery.com/' })
  assert.deepEqual(ok.calls, [['set', 'www.adasbakery.com'], ['add', 'www.adasbakery.com']])
  assert.deepEqual(status.records[0], { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' })

  const failing = harness({ vercel: { add: async () => { throw Object.assign(new Error('in use'), { status: 409 }) } } })
  await assert.rejects(failing.handlers.add('user_a', { siteId, domain: 'adasbakery.com' }), { status: 409 })
  assert.deepEqual(failing.calls, [['set', 'adasbakery.com'], ['set', null]])
})

test('our own hosts and Vercel hosts cannot be claimed', async () => {
  const { handlers } = harness()
  for (const domain of ['f0.app', 'ada.f0sites.app', 'x.vercel.app', 'localhost', 'not a domain']) {
    await assert.rejects(handlers.add('user_a', { siteId, domain }), { status: 400 }, domain)
  }
})

test('status marks a domain live only once it is verified and configured', async () => {
  const { handlers, calls, site } = harness()
  site.customDomain = 'adasbakery.com'
  const result = await handlers.status('user_a', siteId)
  assert.equal(result.site.customDomainVerified, true)
  assert.deepEqual(calls, [['verified', 'adasbakery.com', true]])
  const pending = harness({ vercel: { status: async (domain) => ({ domain, verified: true, configured: false, records: [] }) } })
  pending.site.customDomain = 'adasbakery.com'
  assert.equal((await pending.handlers.status('user_a', siteId)).site.customDomainVerified, false)
})

test('removing detaches from Vercel, then clears the site', async () => {
  const { handlers, calls, site } = harness()
  site.customDomain = 'adasbakery.com'
  await handlers.remove('user_a', siteId)
  assert.deepEqual(calls, [['remove', 'adasbakery.com'], ['set', null]])
})

test('the Vercel client sends the token, project and team, and maps DNS records', async () => {
  const requests = []
  const fetch = async (url, init) => {
    requests.push({ url: String(url), method: init.method, auth: init.headers.Authorization })
    if (String(url).includes('/config')) return new Response(JSON.stringify({ misconfigured: true }))
    return new Response(JSON.stringify({ name: 'adasbakery.com', verified: false, verification: [{ type: 'TXT', domain: '_vercel.adasbakery.com', value: 'vc-domain-verify=abc', reason: 'pending_domain_verification' }] }))
  }
  const vercel = createVercelDomains({ fetch, config: { token: 'tok', projectId: 'prj_1', teamId: 'team_1' } })
  const status = await vercel.status('adasbakery.com')
  assert.equal(requests[0].url, 'https://api.vercel.com/v9/projects/prj_1/domains/adasbakery.com?teamId=team_1')
  assert.equal(requests[0].auth, 'Bearer tok')
  assert.deepEqual(status.records, [
    { type: 'A', name: '@', value: '76.76.21.21' },
    { type: 'TXT', name: '_vercel.adasbakery.com', value: 'vc-domain-verify=abc', reason: 'pending_domain_verification' },
  ])
  assert.equal(status.configured, false)
  await vercel.add('adasbakery.com')
  assert.equal(requests.at(-1).method, 'POST')
  assert.match(requests.at(-1).url, /\/v10\/projects\/prj_1\/domains\?teamId=team_1$/)
  const unconfigured = createVercelDomains({ fetch, config: {} })
  await assert.rejects(unconfigured.add('adasbakery.com'), { status: 503 })
  assert.equal(domainStatus('a.com', {}, null).verified, false)
})

test('domains and slugs normalize safely', () => {
  assert.equal(normalizeDomain('Shop.Example.co.uk'), 'shop.example.co.uk')
  assert.equal(normalizeDomain('-bad.com'), null)
  assert.equal(suggestSlug("Ada's Bakery!"), 'adas-bakery')
  assert.equal(suggestSlug('ab'), 'site-ab')
  assert.match(suggestSlug('API'), /^site-/)
})

test('a Clerk user links to a legacy account with the same verified email once', async () => {
  const calls = []
  const answers = [[], [{ id: 'vercel-sub-1' }], [], [{ account_id: 'vercel-sub-1' }]]
  const store = createAccountStore(async (text, values) => { calls.push({ text, values }); return answers.shift() ?? [] })
  assert.equal(await store.linkClerkAccount({ clerkUserId: 'user_2abc', email: 'ada@example.com', emailVerified: true, name: 'Ada', picture: null }), 'vercel-sub-1')
  assert.match(calls[1].text, /NOT EXISTS \(SELECT 1 FROM fx0_account_links/)
  assert.deepEqual(calls[3].values, ['user_2abc', 'vercel-sub-1'])

  const unverified = []
  const fresh = createAccountStore(async (text, values) => { unverified.push({ text, values }); return text.startsWith('INSERT INTO fx0_account_links') ? [{ account_id: values[1] }] : [] })
  assert.equal(await fresh.linkClerkAccount({ clerkUserId: 'user_2xyz', email: 'ada@example.com', emailVerified: false, name: 'Ada', picture: null }), 'user_2xyz')
  assert.ok(!unverified.some(({ text }) => text.includes('lower(a.email)')))
  await assert.rejects(fresh.linkClerkAccount({ clerkUserId: 'guest:1', email: null, emailVerified: false, name: 'x', picture: null }), { status: 401 })
})

test('routing records follow Vercel apexName for multi-label public suffixes', () => {
  assert.deepEqual(routingRecord('shop.co.uk', 'shop.co.uk'), { type: 'A', name: '@', value: '76.76.21.21' })
  assert.deepEqual(routingRecord('www.shop.co.uk', 'shop.co.uk'), { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' })
  assert.deepEqual(routingRecord('example.com'), { type: 'A', name: '@', value: '76.76.21.21' })
  assert.equal(domainStatus('shop.co.uk', { apexName: 'shop.co.uk', verified: true }, { misconfigured: false }).records[0].type, 'A')
})
