import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeHost, resolveSiteHost, siteRewritePath } from '../lib/site-host.ts'

const config = { appUrl: 'https://f0.app', sitesRootDomain: 'f0sites.app', extraAppHosts: ['f0-git-main.vercel.app'] }

test('the app host, localhost and Vercel deployment hosts serve the app', () => {
  for (const host of ['f0.app', 'F0.APP:443', 'localhost:3000', '127.0.0.1', 'f0-git-main.vercel.app', 'f0-abc123.vercel.app', '', null]) {
    assert.deepEqual(resolveSiteHost(host, config), { kind: 'app' }, String(host))
  }
})

test('one label under the sites root is a site; the root itself redirects', () => {
  assert.deepEqual(resolveSiteHost('ada.f0sites.app', config), { kind: 'subdomain', slug: 'ada' })
  assert.deepEqual(resolveSiteHost('Ada-Bakery.F0Sites.app.', config), { kind: 'subdomain', slug: 'ada-bakery' })
  assert.deepEqual(resolveSiteHost('f0sites.app', config), { kind: 'sites-root' })
  assert.deepEqual(resolveSiteHost('www.f0sites.app', config), { kind: 'sites-root' })
  assert.deepEqual(resolveSiteHost('a.b.f0sites.app', config), { kind: 'sites-root' })
})

test('any other host is a custom domain, rewritten to its lookup route', () => {
  assert.deepEqual(resolveSiteHost('www.adasbakery.com', config), { kind: 'custom', host: 'www.adasbakery.com' })
  assert.equal(siteRewritePath({ kind: 'custom', host: 'www.adasbakery.com' }, '/'), '/site-host/www.adasbakery.com')
  assert.equal(siteRewritePath({ kind: 'subdomain', slug: 'ada' }, '/anything'), '/s/ada')
  assert.equal(siteRewritePath({ kind: 'app' }, '/'), null)
})

test('without SITES_ROOT_DOMAIN there are no subdomain sites', () => {
  assert.deepEqual(resolveSiteHost('ada.f0sites.app', { appUrl: 'https://f0.app' }), { kind: 'custom', host: 'ada.f0sites.app' })
})

test('malformed hosts are never routed as sites', () => {
  for (const host of ['ev il.com', 'a..b.com', '.f0sites.app', 'x/y.com']) assert.equal(normalizeHost(host), null, host)
  assert.deepEqual(resolveSiteHost('a..b.com', config), { kind: 'app' })
})
