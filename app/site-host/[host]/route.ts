import { readPublishedSiteByDomain } from '../../../lib/sites'
import { servePublishedSite } from '../../../lib/site-response'

export const maxDuration = 15

// A verified custom domain's site; proxy.ts rewrites customer hosts here.
export async function GET(_request: Request, { params }: RouteContext<'/site-host/[host]'>): Promise<Response> {
  const { host } = await params
  return servePublishedSite(await readPublishedSiteByDomain(decodeURIComponent(host)).catch(() => undefined))
}
