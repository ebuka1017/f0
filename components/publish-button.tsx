'use client'

import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { openUpgrade, upgradeReason } from './upgrade'

interface PublishedSite { id: string; slug: string; url: string; publishedVersionId: number | null }

// One click from design to live site: creates the chat's site on first use (the
// server suggests the address from the title), publishes the current version, and
// then offers the live URL, copy, open and republish.
export default function PublishButton({ sessionId, title, revision, signedIn, onSignIn }: {
  sessionId: string
  title: string | null | undefined
  revision: number
  signedIn: boolean
  onSignIn: () => void
}) {
  const [site, setSite] = useState<PublishedSite | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSite(null)
    if (!signedIn) return
    let live = true
    void fetch(`/api/publish?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((body: { site?: PublishedSite | null } | null) => { if (live) setSite(body?.site ?? null) })
      .catch(() => {})
    return () => { live = false }
  }, [sessionId, signedIn])

  async function publish() {
    if (!signedIn) { onSignIn(); return }
    setBusy(true)
    setError('')
    setOpen(true)
    try {
      const response = await fetch('/api/publish', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(site ? { siteId: site.id } : { sessionId, title: title ?? undefined }),
      })
      const reason = await upgradeReason(response)
      if (reason) { setOpen(false); openUpgrade(reason); return }
      const body = await response.json().catch(() => ({})) as { site?: PublishedSite; error?: string }
      if (!response.ok || !body.site) throw new Error(body.error ?? 'Publishing failed')
      setSite(body.site)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Publishing failed')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!site) return
    await navigator.clipboard.writeText(site.url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const published = !!site?.publishedVersionId
  const stale = published && site!.publishedVersionId! < revision
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="h-7 px-2.5 text-xs" disabled={busy}
          onClick={(event) => { if (!published) { event.preventDefault(); void publish() } }}>
          {busy ? 'Publishing…' : published ? (stale ? 'Update site' : 'Live') : 'Publish website'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 text-sm">
        {error ? <p role="alert" className="text-error">{error}</p> : site && published ? (
          <>
            <p className="font-medium">Your site is live</p>
            <a href={site.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-muted-foreground underline underline-offset-4 hover:text-foreground">{site.url}</a>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(site.url, '_blank', 'noopener,noreferrer')}>Open</Button>
              <Button size="sm" disabled={busy} onClick={() => void publish()}>{stale ? 'Republish latest' : 'Republish'}</Button>
            </div>
            <a href="/sites" className="mt-3 block text-xs text-muted-foreground underline underline-offset-4">Manage address and domain</a>
          </>
        ) : <p className="text-muted-foreground">Publishing…</p>}
      </PopoverContent>
    </Popover>
  )
}
