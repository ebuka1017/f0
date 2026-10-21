'use client'

import { useState, type FormEvent } from 'react'
import { Button } from './ui/button'
import type { Site } from '../lib/sites'

interface ChatOption { id: string; title: string }

const inputClass = 'h-9 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init.headers } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Request failed')
  return body as T
}

export default function SitesManager({ initialSites, chats }: { initialSites: Site[]; chats: ChatOption[] }) {
  const [sites, setSites] = useState(initialSites)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try { await work() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Request failed') } finally { setBusy(null) }
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
  const rename = (site: Site) => {
    const title = window.prompt('Site title', site.title)
    if (title == null) return
    const slug = window.prompt('Address (lowercase letters, numbers and hyphens)', site.slug)
    if (slug == null) return
    void run(site.id, async () => {
      replace((await call<{ site: Site }>('/api/sites', { method: 'PATCH', body: JSON.stringify({ id: site.id, title, slug }) })).site)
    })
  }
  const remove = (site: Site) => {
    if (!window.confirm(`Delete ${site.title}? Its address stops working.`)) return
    void run(site.id, async () => {
      await call<void>(`/api/sites?id=${encodeURIComponent(site.id)}`, { method: 'DELETE' })
      setSites((list) => list.filter((item) => item.id !== site.id))
    })
  }

  return (
    <div className="mt-8 space-y-10">
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
              <input name="title" maxLength={80} placeholder="Ada Lovelace" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Address</span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">/s/</span>
                <input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" placeholder="ada" className={inputClass} />
              </span>
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
              <li key={site.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{site.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {site.publishedVersionId
                      ? <a href={`/s/${site.slug}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">/s/{site.slug}</a>
                      : <>/s/{site.slug} · not published</>}
                    {' · '}<a href={`/?s=${site.sessionId}`} className="underline underline-offset-4 hover:text-foreground">open chat</a>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === site.id} onClick={() => void publish(site)}>
                    {site.publishedVersionId ? 'Republish latest' : 'Publish'}
                  </Button>
                  {site.publishedVersionId ? <Button size="sm" variant="outline" disabled={busy === site.id} onClick={() => void unpublish(site)}>Unpublish</Button> : null}
                  <Button size="sm" variant="outline" disabled={busy === site.id} onClick={() => rename(site)}>Rename</Button>
                  <Button size="sm" variant="ghost" disabled={busy === site.id} onClick={() => remove(site)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
