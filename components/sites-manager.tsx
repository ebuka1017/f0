'use client'

import { useState, type FormEvent } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { openUpgrade } from './upgrade'
import UpgradeDialog from './upgrade-dialog'
import type { Site } from '../lib/sites'
import type { DomainStatus } from '../lib/vercel-domains'

interface ChatOption { id: string; title: string }

const inputClass = 'h-9 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

class UpgradeRequired extends Error {}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init.headers } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({})) as { error?: string; upgrade?: boolean }
  if (response.status === 402 && body.upgrade) {
    openUpgrade(body.error)
    throw new UpgradeRequired(body.error ?? 'Upgrade required')
  }
  if (!response.ok) throw new Error(body.error ?? 'Request failed')
  return body as T
}

function RenameDialog({ site, onClose, onSaved }: { site: Site | null; onClose: () => void; onSaved: (site: Site) => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!site) return
    const data = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const { site: saved } = await call<{ site: Site }>('/api/sites', {
        method: 'PATCH', body: JSON.stringify({ id: site.id, title: data.get('title'), slug: data.get('slug') }),
      })
      onSaved(saved)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={!!site} onOpenChange={(open) => { if (!open) { setError(''); onClose() } }}>
      <DialogContent>
        <DialogTitle className="text-lg font-medium">Edit site</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">Changing the address breaks links to the old one.</DialogDescription>
        {site && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Title</span>
              <input name="title" defaultValue={site.title} required maxLength={80} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Address</span>
              <input name="slug" defaultValue={site.slug} required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" className={inputClass} />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DomainPanel({ site, onChange }: { site: Site; onChange: (site: Site) => void }) {
  const [status, setStatus] = useState<DomainStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(work: () => Promise<{ site: Site; status?: DomainStatus | null }>) {
    setBusy(true)
    setError('')
    try {
      const result = await work()
      onChange(result.site)
      setStatus(result.status ?? null)
    } catch (failure) {
      if (!(failure instanceof UpgradeRequired)) setError(failure instanceof Error ? failure.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }
  const query = `siteId=${encodeURIComponent(site.id)}`
  if (!site.customDomain) {
    return (
      <form className="mt-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        const domain = new FormData(event.currentTarget).get('domain')
        void run(() => call('/api/domains', { method: 'POST', body: JSON.stringify({ siteId: site.id, domain }) }))
      }}>
        <input name="domain" required placeholder="www.yourbusiness.com" aria-label="Custom domain" className={inputClass} />
        <Button type="submit" size="sm" variant="outline" disabled={busy}>Connect domain</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    )
  }
  return (
    <div className="mt-3 space-y-2 border border-border p-3 text-sm">
      <p>
        <span className="font-medium">{site.customDomain}</span>{' · '}
        {site.customDomainVerified ? <span className="text-success">live</span> : <span className="text-muted-foreground">waiting for DNS</span>}
      </p>
      {status && !site.customDomainVerified && (
        <div>
          <p className="text-muted-foreground">Add these records at your domain provider:</p>
          <table className="mt-1 w-full table-fixed text-left font-mono text-xs">
            <thead><tr><th className="w-16">Type</th><th className="w-1/3">Name</th><th>Value</th></tr></thead>
            <tbody>
              {status.records.map((record) => (
                <tr key={`${record.type}:${record.name}:${record.value}`}><td>{record.type}</td><td className="truncate">{record.name}</td><td className="break-all">{record.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => call(`/api/domains?${query}`, { method: 'PATCH' }))}>
          {site.customDomainVerified ? 'Check again' : 'Verify'}
        </Button>
        {!status && !site.customDomainVerified && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => call(`/api/domains?${query}`))}>Show DNS records</Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => ({ ...(await call<{ site: Site }>(`/api/domains?${query}`, { method: 'DELETE' })), status: null }))}>
          Remove
        </Button>
      </div>
    </div>
  )
}

export default function SitesManager({ initialSites, chats }: { initialSites: Site[]; chats: ChatOption[] }) {
  const [sites, setSites] = useState(initialSites)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Site | null>(null)
  const [deleting, setDeleting] = useState<Site | null>(null)

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try { await work() } catch (failure) {
      if (!(failure instanceof UpgradeRequired)) setError(failure instanceof Error ? failure.message : 'Request failed')
    } finally { setBusy(null) }
  }
  const replace = (site: Site) => setSites((list) => list.map((item) => item.id === site.id ? site : item))

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void run('create', async () => {
      const { site } = await call<{ site: Site }>('/api/sites', {
        method: 'POST', body: JSON.stringify({ sessionId: data.get('chat'), slug: data.get('slug'), title: data.get('title') }),
      })
      setSites((list) => [site, ...list])
      form.reset()
    })
  }

  const publish = (site: Site) => run(site.id, async () => {
    replace((await call<{ site: Site }>('/api/publish', { method: 'POST', body: JSON.stringify({ siteId: site.id }) })).site)
  })
  const unpublish = (site: Site) => run(site.id, async () => {
    replace((await call<{ site: Site }>(`/api/publish?siteId=${encodeURIComponent(site.id)}`, { method: 'DELETE' })).site)
  })
  const remove = (site: Site) => run(site.id, async () => {
    await call<void>(`/api/sites?id=${encodeURIComponent(site.id)}`, { method: 'DELETE' })
    setSites((list) => list.filter((item) => item.id !== site.id))
    setDeleting(null)
  })

  return (
    <div className="mt-8 space-y-10">
      <UpgradeDialog />
      <RenameDialog site={editing} onClose={() => setEditing(null)} onSaved={replace} />
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogContent>
          <DialogTitle className="text-lg font-medium">Delete {deleting?.title}?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">Its address and any custom domain stop working. The chat is kept.</DialogDescription>
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" disabled={!!busy} onClick={() => deleting && void remove(deleting)}>Delete site</Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <section aria-labelledby="new-site">
        <h2 id="new-site" className="text-sm font-medium">New site</h2>
        {chats.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Design something in a chat first, then publish it here.</p>
        ) : (
          <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">Chat</span>
              <select name="chat" required className={inputClass}>
                {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Title</span>
              <input name="title" maxLength={80} placeholder="Ada’s Bakery" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Address</span>
              <input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" placeholder="adas-bakery" className={inputClass} />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy === 'create'}>Create site</Button>
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="your-sites">
        <h2 id="your-sites" className="text-sm font-medium">Your sites</h2>
        {sites.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No sites yet.</p> : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {sites.map((site) => (
              <li key={site.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{site.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {site.publishedVersionId
                        ? <a href={site.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">{site.url.replace(/^https?:\/\//, '')}</a>
                        : <>{site.slug} · not published</>}
                      {' · '}<a href={`/?s=${site.sessionId}`} className="underline underline-offset-4 hover:text-foreground">open chat</a>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy === site.id} onClick={() => void publish(site)}>
                      {site.publishedVersionId ? 'Republish latest' : 'Publish'}
                    </Button>
                    {site.publishedVersionId ? <Button size="sm" variant="outline" disabled={busy === site.id} onClick={() => void unpublish(site)}>Unpublish</Button> : null}
                    <Button size="sm" variant="outline" disabled={busy === site.id} onClick={() => setEditing(site)}>Rename</Button>
                    <Button size="sm" variant="ghost" disabled={busy === site.id} onClick={() => setDeleting(site)}>Delete</Button>
                  </div>
                </div>
                <DomainPanel site={site} onChange={replace} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
