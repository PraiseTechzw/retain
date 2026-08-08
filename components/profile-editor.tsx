'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from '@/lib/supabase/actions'

export function ProfileEditor({ name, email }: { name: string; email: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  function submit(formData: FormData) {
    setMessage('')
    startTransition(async () => { try { await updateProfile(formData); setMessage('Profile saved.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save profile.') } })
  }
  return <form action={submit} className="mt-8 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Full name<input name="full_name" defaultValue={name} required className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="text-sm font-medium">Email<input value={email} readOnly className="mt-2 h-10 w-full rounded-xl border border-input bg-muted px-3 text-muted-foreground" /></label><div className="flex items-center gap-3 md:col-span-2"><button disabled={pending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? 'Saving…' : 'Save changes'}</button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</div></form>
}
