import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'
import { hostConfigFromEnv, resolveSiteHost, siteRewritePath } from './lib/site-host'

// Site hosts never reach the app: {slug}.SITES_ROOT_DOMAIN and verified custom
// domains are rewritten to the published-site routes, which set the strict CSP.
// Everything else is the app, behind Clerk when it is configured.
const clerk = process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware(async (auth, request) => {
    const { userId } = await auth()
    const response = NextResponse.next()
    // The first-paint script reads this hint to pick the guest or signed-in layout.
    const hinted = request.cookies.get('fx0-signed-in')?.value === '1'
    if (!!userId !== hinted) {
      response.cookies.set('fx0-signed-in', userId ? '1' : '', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: userId ? 60 * 60 * 24 * 30 : 0 })
    }
    return response
  })
  : null

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const site = resolveSiteHost(request.headers.get('host'), hostConfigFromEnv())
  if (site.kind === 'sites-root') {
    return NextResponse.redirect(process.env.APP_URL || new URL('/', request.url), 307)
  }
  const rewrite = siteRewritePath(site, request.nextUrl.pathname)
  if (rewrite) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new NextResponse(null, { status: 405 })
    return NextResponse.rewrite(new URL(rewrite, request.url))
  }
  // Published sites on the app domain are public; they skip Clerk entirely.
  if (request.nextUrl.pathname.startsWith('/s/') || request.nextUrl.pathname.startsWith('/site-host/')) return NextResponse.next()
  return clerk ? clerk(request, event) : NextResponse.next()
}

export const config = {
  matcher: [
    // Everything but Next internals and static files, plus API routes always.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
