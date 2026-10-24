'use client'

import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { UPGRADE_EVENT } from './upgrade'

interface Billing { plan: 'free' | 'pro'; dailyPrompts: number; sites: number; customDomains: boolean; promptsUsedToday: number; appUserId: string }

const PRO_FEATURES = ['Many more prompts every day', 'Up to 20 websites', 'Connect your own domain', 'Pick any model']

// The paywall. RevenueCat Web Billing runs the checkout in its own overlay; the
// server learns of the purchase from /api/billing/refresh (and the webhook).
export default function UpgradeDialog() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_BILLING_API_KEY

  useEffect(() => {
    const onUpgrade = (event: Event) => {
      setReason((event as CustomEvent<{ reason?: string }>).detail?.reason ?? null)
      setError('')
      setStatus('idle')
      setOpen(true)
      void fetch('/api/billing').then((response) => response.ok ? response.json() : null).then(setBilling).catch(() => {})
    }
    window.addEventListener(UPGRADE_EVENT, onUpgrade)
    return () => window.removeEventListener(UPGRADE_EVENT, onUpgrade)
  }, [])

  async function upgrade() {
    if (!apiKey || !billing) return
    setStatus('loading')
    setError('')
    try {
      const { Purchases, ErrorCode, PurchasesError } = await import('@revenuecat/purchases-js')
      const purchases = Purchases.isConfigured() ? Purchases.getSharedInstance() : Purchases.configure({ apiKey, appUserId: billing.appUserId })
      const offerings = await purchases.getOfferings()
      const offeringId = process.env.NEXT_PUBLIC_REVENUECAT_OFFERING_ID
      const offering = (offeringId && offerings.all[offeringId]) || offerings.current
      const rcPackage = offering?.availablePackages[0]
      if (!rcPackage) throw new Error('No Pro plan is available right now.')
      try {
        await purchases.purchase({ rcPackage, customerEmail: undefined })
      } catch (failure) {
        if (failure instanceof PurchasesError && failure.errorCode === ErrorCode.UserCancelledError) { setStatus('idle'); return }
        throw failure
      }
      // Only claim Pro once the server agrees; until then protected routes still see free.
      const response = await fetch('/api/billing/refresh', { method: 'POST' })
      const refreshed = response.ok ? await response.json().catch(() => null) as Billing | null : null
      if (refreshed) setBilling((current) => current && { ...current, ...refreshed })
      if (refreshed?.plan !== 'pro') {
        setError('Your payment went through, but Pro isn’t active on your account yet. Give it a minute and refresh the page.')
        setStatus('idle')
        return
      }
      setStatus('done')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The purchase did not complete.')
      setStatus('idle')
    }
  }

  const pro = billing?.plan === 'pro' || status === 'done'
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="text-lg font-medium">{pro ? 'You’re on Pro' : 'Upgrade to f0 Pro'}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          {pro ? 'Thanks! Pro limits apply right away.' : reason ?? 'Go from idea to a live business website, without limits.'}
        </DialogDescription>
        {!pro && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {PRO_FEATURES.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true">✓</span>{feature}</li>)}
          </ul>
        )}
        {billing && (
          <p className="mt-4 text-xs text-muted-foreground">
            Today: {billing.promptsUsedToday}/{billing.dailyPrompts} prompts · {billing.sites} site{billing.sites === 1 ? '' : 's'} on your plan
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {pro ? <Button onClick={() => setOpen(false)}>Continue</Button> : apiKey ? (
            <Button disabled={!billing || status === 'loading'} onClick={() => void upgrade()}>
              {status === 'loading' ? 'Opening checkout…' : 'Upgrade to Pro'}
            </Button>
          ) : <p className="text-sm text-muted-foreground">Upgrades aren’t available on this deployment yet.</p>}
          <Button variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
