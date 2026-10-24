import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server.js'
import { AuthError } from '@/lib/accounts'
import { requireUserSession } from '@/lib/auth'
import { listOwnedSessions } from '@/lib/route-auth'
import { listSites } from '@/lib/sites'
import SitesManager from '@/components/sites-manager'

export const metadata = { title: 'My sites · f0' }

async function Sites() {
  // Unsealing the session reads the clock, which must happen at request time.
  await connection()
  const session = await requireUserSession().catch((error) => {
    if (error instanceof AuthError && error.status === 401) return null
    throw error
  })
  if (!session) redirect('/login')
  const [sites, chats] = await Promise.all([listSites(session.userId), listOwnedSessions(session.userId)])
  return (
    <SitesManager
      initialSites={sites}
      chats={chats.sessions.map((chat) => ({ id: chat.id, title: chat.title ?? 'Untitled chat' }))}
    />
  )
}

export default function SitesPage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <a href="/" className="font-mono font-semibold text-foreground">f0</a>
          <a href="/" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">back to chats</a>
        </nav>
        <h1 className="text-xl font-medium tracking-tight">My sites</h1>
        <p className="mt-2 text-sm text-muted-foreground">Publish a chat&apos;s current design at its own address.</p>
        <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
          <Sites />
        </Suspense>
      </div>
    </main>
  )
}
