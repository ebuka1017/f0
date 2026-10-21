import { PUBLISHED_SITE_CSP, readPublishedSite } from '../../../lib/sites'

export const maxDuration = 15

// A published site's HTML, public by slug. See PUBLISHED_SITE_CSP for why it can be
// served from the app's origin for now.
// TODO(subdomains): route <slug>.<SITES_DOMAIN> and verified custom domains here
// from proxy.ts, then stop serving sites under /s on the app domain.
export async function GET(_request: Request, { params }: RouteContext<'/s/[slug]'>): Promise<Response> {
  const { slug } = await params
  const site = await readPublishedSite(slug).catch(() => undefined)
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
