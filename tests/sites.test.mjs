import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createSiteStore, normalizeSlug, normalizeTitle, PUBLISHED_SITE_CSP } from '../lib/sites.ts'

const userId = 'user_a'
const sessionId = 'a4b0d934-8e2a-4c19-924e-18a491b16767'
const siteId = '0f8c7a55-2c51-4b8e-9d3a-6f1b2a3c4d5e'
const row = {
  id: siteId, session_id: sessionId, slug: 'ada', title: 'Ada', published_version_id: null, published_at: null,
  custom_domain: null, created_at: '2026-10-21 10:00:00+00', updated_at: '2026-10-21 10:00:00+00',
}

function recorder(rows = [row], failure = null) {
  const calls = []
  return { calls, store: createSiteStore(async (text, values = []) => {
    calls.push({ text, values })
    if (failure) throw failure
    return rows
  }) }
}

test('slugs are lowercase, bounded, hyphenated once and never reserved', () => {
  assert.equal(normalizeSlug(' Ada-Lovelace '), 'ada-lovelace')
  for (const bad of ['ab', '-ada', 'ada-', 'a--b', 'ada lovelace', 'api', 'sites', 'x'.repeat(41), 'ädä', 42]) {
    assert.equal(normalizeSlug(bad), null, String(bad))
  }
  assert.equal(normalizeTitle('  Ada\u0000 '), 'Ada')
  assert.equal(normalizeTitle('   '), null)
})

test('a site is created only through a chat the caller owns', async () => {
  const { calls, store } = recorder()
  const site = await store.createSite(userId, { sessionId, slug: 'Ada', title: 'Ada' })
  assert.equal(site.slug, 'ada')
  const [{ text, values }] = calls
  assert.match(text, /FROM fx0_chat_ownership c\s+WHERE c\.session_id = \$3 AND c\.user_id = \$2/)
  assert.equal(values[1], userId)
  assert.equal(values[2], sessionId)
})

test('creating for an unowned chat is not found, and a taken slug is a conflict', async () => {
  await assert.rejects(recorder([]).store.createSite(userId, { sessionId, slug: 'ada', title: 'Ada' }), { status: 404 })
  await assert.rejects(recorder([], Object.assign(new Error('dup'), { code: '23505' })).store.createSite(userId, { sessionId, slug: 'ada', title: 'Ada' }), { status: 409 })
  await assert.rejects(recorder().store.createSite(userId, { sessionId, slug: 'no', title: 'Ada' }), { status: 400 })
})

test('guests cannot manage sites', async () => {
  const { calls, store } = recorder()
  await assert.rejects(store.listSites('guest:0123456789abcdef0123456789abcdef'), { status: 401 })
  assert.equal(calls.length, 0)
})

test('every write is scoped to the owner', async () => {
  const { calls, store } = recorder()
  await store.updateSite(userId, siteId, { title: 'Ada L.' })
  await store.deleteSite(userId, siteId)
  await store.unpublishSite(userId, siteId)
  await store.publishSite(userId, siteId, 3, '<!doctype html>')
  for (const { text, values } of calls) {
    assert.match(text, /user_id = \$2/)
    assert.deepEqual(values.slice(0, 2), [siteId, userId])
  }
  assert.match(calls[3].text, /FROM fx0_generations g[\s\S]*g\.revision = \$3/)
  await assert.rejects(store.deleteSite(userId, '../x'), { status: 404 })
})

test('published sites are served by slug with an opaque-origin policy', async () => {
  const { calls, store } = recorder([{ published_html: '<!doctype html>', title: 'Ada' }])
  assert.deepEqual(await store.readPublishedSite('ada'), { html: '<!doctype html>', title: 'Ada' })
  assert.equal(await store.readPublishedSite('../etc'), null)
  assert.equal(calls.length, 1)
  assert.match(PUBLISHED_SITE_CSP, /sandbox allow-scripts/)
  assert.doesNotMatch(PUBLISHED_SITE_CSP, /allow-same-origin/)
  assert.match(PUBLISHED_SITE_CSP, /frame-ancestors 'none'/)
  assert.match(PUBLISHED_SITE_CSP, /connect-src 'none'/)
})

test('the sites migration keys slugs uniquely and cascades from chats', async () => {
  const sql = await readFile(new URL('../migrations/006_sites.sql', import.meta.url), 'utf8')
  assert.match(sql, /slug text NOT NULL UNIQUE/)
  assert.match(sql, /REFERENCES fx0_chat_ownership\(session_id\) ON DELETE CASCADE/)
  assert.match(sql, /published_version_id integer/)
})
