import { PUBLISHED_SITE_CSP } from './sites'

// A published site's response: its HTML under the strict policy, or a plain
// 404/503. `undefined` means the lookup failed.
export function servePublishedSite(site: { html: string } | null | undefined): Response {
  const headers = {
    'content-security-policy': PUBLISHED_SITE_CSP,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  }
  if (site === undefined) {
    return new Response('This site is temporarily unavailable.', { status: 503, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  }
  if (!site) {
    return new Response('Site not found.', { status: 404, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=30' } })
  }
  return new Response(site.html, {
    headers: {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      // Short edge cache so a republish shows up within a minute.
      'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
