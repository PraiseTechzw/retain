'use client'

import { useState, useTransition } from 'react'
import { getKnowledgeDownloadUrl } from '@/lib/supabase/actions'

export function DocumentActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  function download() {
    setMessage('')
    startTransition(async () => {
      try {
        const url = await getKnowledgeDownloadUrl(id)
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to prepare document.')
      }
    })
  }
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={download} disabled={pending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60">{pending ? 'Preparing…' : 'View document'}</button>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </div>
}
