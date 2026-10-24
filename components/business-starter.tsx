'use client'

import { useState, type FormEvent } from 'react'
import { Button } from './ui/button'

// Turns three answers into a complete first prompt, so a new user gets a real
// business site on the first try instead of a blank-page conversation.
export function businessPrompt(input: { name: string; about: string; links: string }): string {
  const links = input.links.split(/[\s,]+/).map((link) => link.trim()).filter(Boolean)
  return [
    `Build a one-page website for my business, ${input.name.trim()}.`,
    `What we do: ${input.about.trim()}`,
    links.length ? `Links to include: ${links.join(', ')}` : 'I have no links yet; leave a clearly marked spot for contact details.',
    'Make it mobile-first with a clear headline, what we offer, why choose us, and a contact section. Use only these facts and ask me for anything important that is missing.',
  ].join('\n')
}

const field = 'h-9 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function BusinessStarter({ onSend }: { onSend: (text: string) => void }) {
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [links, setLinks] = useState('')
  const ready = name.trim().length > 0 && about.trim().length > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ready) onSend(businessPrompt({ name, about, links }))
  }

  return (
    <form onSubmit={submit} aria-labelledby="starter-title" className="space-y-3 border border-border p-4">
      <h2 id="starter-title" className="text-sm font-medium text-foreground">Describe your business</h2>
      <label className="block text-xs text-muted-foreground">
        Business name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Ada’s Bakery" className={`${field} mt-1`} />
      </label>
      <label className="block text-xs text-muted-foreground">
        What you do
        <textarea value={about} onChange={(event) => setAbout(event.target.value)} maxLength={600} required rows={2}
          placeholder="Sourdough and pastries baked daily in Lagos; we cater events too."
          className="mt-1 w-full border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Links (optional)
        <input value={links} onChange={(event) => setLinks(event.target.value)} maxLength={500} placeholder="instagram.com/adasbakery, wa.me/234…" className={`${field} mt-1`} />
      </label>
      <Button type="submit" size="sm" disabled={!ready}>Build my website</Button>
    </form>
  )
}
