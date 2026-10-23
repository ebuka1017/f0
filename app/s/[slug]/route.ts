import { readPublishedSite } from '../../../lib/sites'
import { servePublishedSite } from '../../../lib/site-response'

export const maxDuration = 15

// A published site's HTML, public by slug. See PUBLISHED_SITE_CSP for why it can be
// served from the app's origin for now.
// proxy.ts rewrites <slug>.SITES_ROOT_DOMAIN here; /s/<slug> on the app domain
// stays as a fallback.
export async function GET(_request: Request, { params }: RouteContext<'/s/[slug]'>): Promise<Response> {
  const { slug } = await params
  return servePublishedSite(await readPublishedSite(slug).catch(() => undefined))
}
