// f0 signs people in with Clerk. The Vercel OAuth modules (auth.ts, the
// /api/auth/{signin,callback} flow, teams and credits) stay only as a legacy path
// for deployments without Clerk keys, and for their existing tests.
export function clerkEnabled(): boolean {
  return !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
}

// Every signed-in model turn is funded by the deployment's AI Gateway key.
export function serverFundingEnabled(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY
}

export const SIGN_IN_PATH = '/sign-in'
export const SIGN_UP_PATH = '/sign-up'
