import { createHash } from 'node:crypto'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAccountStore, withAccountDatabase } from './accounts'
import { prefixed, redis } from './journal'
import type { SessionData } from './secure-session'

// The account and profile behind a Clerk user, cached so a request costs no Clerk
// Backend API call and no SQL. Profile edits show up within the hour.
interface ClerkAccount { accountId: string; email: string; name: string; picture: string | null }
const ACCOUNT_TTL_SECONDS = 60 * 60
const accountKey = (clerkUserId: string) => prefixed(`clerk-account:${clerkUserId}`)

async function clerkAccount(clerkUserId: string): Promise<ClerkAccount> {
  const cached = await redis().get<ClerkAccount>(accountKey(clerkUserId)).catch(() => null)
  if (cached?.accountId) return cached
  const user = await (await clerkClient()).users.getUser(clerkUserId)
  const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0]
  const email = primary?.emailAddress ?? null
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || email || 'f0 user'
  const accountId = await withAccountDatabase((query) => createAccountStore(query).linkClerkAccount({
    clerkUserId, email, emailVerified: primary?.verification?.status === 'verified', name, picture: user.imageUrl || null,
  }))
  const account = { accountId, email: email ?? clerkUserId, name, picture: user.imageUrl || null }
  await redis().set(accountKey(clerkUserId), account, { ex: ACCOUNT_TTL_SECONDS }).catch(() => {})
  return account
}

// A Clerk session in the shape the rest of the app reads. The access token is a
// placeholder: with Clerk every model turn runs on the server's AI Gateway key, so
// no user credential ever reaches Gateway. The login id is derived from Clerk's
// session id, so revocation and credential indexes stay per browser session.
export async function clerkSessionData(): Promise<SessionData | null> {
  const { userId, sessionId, sessionClaims } = await auth()
  if (!userId || !sessionId) return null
  const account = await clerkAccount(userId)
  const issuedAt = typeof sessionClaims?.iat === 'number' ? sessionClaims.iat * 1000 : Date.now()
  return {
    loginId: createHash('sha256').update(sessionId).digest('hex').slice(0, 32),
    loginAt: issuedAt,
    userId: account.accountId,
    email: account.email,
    name: account.name,
    ...(account.picture ? { picture: account.picture } : {}),
    accessToken: 'clerk-session',
    expiresAt: Date.now() + 24 * 60 * 60_000,
    isLoggedIn: true,
  }
}

export async function clerkUserIdForSession(): Promise<string | null> {
  return (await auth()).userId ?? null
}

export async function revokeClerkSession(): Promise<void> {
  const { sessionId } = await auth()
  if (sessionId) await (await clerkClient()).sessions.revokeSession(sessionId)
}
