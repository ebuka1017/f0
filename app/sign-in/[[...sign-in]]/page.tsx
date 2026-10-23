import { SignIn } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const metadata = { title: 'Sign in · f0' }

export default function SignInPage() {
  // Without Clerk keys the deployment uses the legacy sign-in at /login.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect('/login')
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-foreground">
      <a href="/" className="font-mono text-sm font-semibold">f0</a>
      {/* Clerk's form reads the URL, so it renders at request time. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <SignIn />
      </Suspense>
    </main>
  )
}
