'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function actor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to continue.')
  return { supabase, user }
}

async function audit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await supabase.from('audit_events').insert({ actor_id: userId, action, entity_type: entityType, entity_id: entityId ?? null, metadata })
}

export async function createEmployee(formData: FormData) {
  const { supabase, user } = await actor()
  const employee = { employee_number: String(formData.get('employee_number') ?? '').trim(), full_name: String(formData.get('full_name') ?? '').trim(), email: String(formData.get('email') ?? '').trim() || null, job_title: String(formData.get('job_title') ?? '').trim() || null, employment_status: 'active' }
  if (!employee.employee_number || !employee.full_name) throw new Error('Employee number and full name are required.')
  const { data, error } = await supabase.from('employees').insert(employee).select('id').single()
  if (error) throw new Error('Unable to create employee record.')
  await audit(supabase, user.id, 'created', 'employee', data.id, { employee_number: employee.employee_number })
  revalidatePath('/dashboard/employees'); revalidatePath('/dashboard')
}

export async function createExitRequest(formData: FormData) {
  const { supabase, user } = await actor()
  const employeeId = String(formData.get('employee_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  const lastDay = String(formData.get('last_day') ?? '') || null
  if (!employeeId || !reason) throw new Error('Employee and reason are required.')
  const { data, error } = await supabase.from('exit_requests').insert({ employee_id: employeeId, reason, last_day: lastDay }).select('id').single()
  if (error) throw new Error('Unable to submit exit request.')
  await audit(supabase, user.id, 'created', 'exit_request', data.id)
  revalidatePath('/dashboard/exit-requests'); revalidatePath('/dashboard')
}

export async function updateAssetStatus(formData: FormData) {
  const { supabase, user } = await actor()
  const id = String(formData.get('asset_id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !['assigned', 'available', 'returned', 'retired'].includes(status)) throw new Error('Invalid asset update.')
  const { error } = await supabase.from('assets').update({ status, returned_at: status === 'returned' ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw new Error('Unable to update asset status.')
  await supabase.from('asset_history').insert({ asset_id: id, action: status, actor_id: user.id, notes: 'Status updated from operations workspace.' })
  await audit(supabase, user.id, 'updated', 'asset', id, { status })
  revalidatePath('/dashboard/assets'); revalidatePath('/dashboard/assets/returns')
}

export async function approveClearance(formData: FormData) {
  const { supabase, user } = await actor()
  const id = String(formData.get('clearance_id') ?? '')
  if (!id) throw new Error('Clearance step is required.')
  const { data, error } = await supabase.from('clearance_steps').update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', id).select('id').single()
  if (error) throw new Error('Unable to approve clearance step.')
  await audit(supabase, user.id, 'approved', 'clearance_step', data.id)
  revalidatePath('/dashboard/clearances')
}

export async function uploadKnowledgeDocument(formData: FormData) {
  const { supabase, user } = await actor()
  const file = formData.get('file')
  const title = String(formData.get('title') ?? '').trim()
  const employeeId = String(formData.get('employee_id') ?? '')
  if (!(file instanceof File) || file.size === 0 || !title || !employeeId) throw new Error('Title, employee, and a file are required.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Files must be smaller than 10 MB.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `private/${employeeId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('knowledge-documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) throw new Error('Unable to upload document.')
  const { data, error } = await supabase.from('knowledge_documents').insert({ employee_id: employeeId, title, storage_path: path, category: String(formData.get('category') ?? '').trim() || null, created_by: user.id }).select('id').single()
  if (error) { await supabase.storage.from('knowledge-documents').remove([path]); throw new Error('Unable to save document record.') }
  await audit(supabase, user.id, 'uploaded', 'knowledge_document', data.id, { title })
  revalidatePath('/dashboard/knowledge-hub')
} 

export async function getKnowledgeDownloadUrl(id: string) {
  const { supabase } = await actor()
  const { data: document, error } = await supabase.from('knowledge_documents').select('storage_path').eq('id', id).single()
  if (error || !document) throw new Error('Document not found.')
  const { data, error: urlError } = await supabase.storage.from('knowledge-documents').createSignedUrl(document.storage_path, 300)
  if (urlError || !data?.signedUrl) throw new Error('Unable to prepare document download.')
  return data.signedUrl
}

export async function getEmployeeOptions() {
  const { supabase } = await actor()
  const { data, error } = await supabase.from('employees').select('id, employee_number, full_name').eq('employment_status', 'active').order('full_name')
  if (error) throw new Error('Unable to load employees.')
  return data ?? []
} 

export async function getCurrentUser() {
  const { user } = await actor()
  return { id: user.id, email: user.email ?? '' }
}

export async function signOut() {
  const { supabase } = await actor(); await supabase.auth.signOut(); revalidatePath('/', 'layout')
}

export async function createClearanceSteps(exitRequestId: string, departments: string[]) {
  const { supabase, user } = await actor()
  const rows = departments.map((department, index) => ({ exit_request_id: exitRequestId, department, step_order: index + 1 }))
  const { error } = await supabase.from('clearance_steps').upsert(rows, { onConflict: 'exit_request_id,department' })
  if (error) throw new Error('Unable to create clearance steps.')
  await audit(supabase, user.id, 'created', 'clearance_steps', exitRequestId, { departments })
  revalidatePath('/dashboard/clearances')
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await actor()
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) throw new Error('Full name is required.')
  const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: fullName })
  if (error) throw new Error('Unable to update profile.')
  await audit(supabase, user.id, 'updated', 'profile', user.id)
  revalidatePath('/profile')
}

export async function createInterview(formData: FormData) {
  const { supabase, user } = await actor()
  const exitRequestId = String(formData.get('exit_request_id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  const scheduledFor = String(formData.get('scheduled_for') ?? '') || null
  if (!exitRequestId) throw new Error('Exit request is required.')
  const { data, error } = await supabase.from('exit_interviews').insert({ exit_request_id: exitRequestId, interviewer_id: user.id, scheduled_for: scheduledFor, notes }).select('id').single()
  if (error) throw new Error('Unable to schedule interview.')
  await audit(supabase, user.id, 'scheduled', 'exit_interview', data.id)
  revalidatePath(`/dashboard/exit-requests/${exitRequestId}`)
}

export async function createAsset(formData: FormData) {
  const { supabase, user } = await actor()
  const asset = { asset_tag: String(formData.get('asset_tag') ?? '').trim(), asset_type: String(formData.get('asset_type') ?? '').trim(), description: String(formData.get('description') ?? '').trim() || null, status: 'available' }
  if (!asset.asset_tag || !asset.asset_type) throw new Error('Asset tag and type are required.')
  const { data, error } = await supabase.from('assets').insert(asset).select('id').single()
  if (error) throw new Error('Unable to create asset.')
  await audit(supabase, user.id, 'created', 'asset', data.id, { asset_tag: asset.asset_tag })
  revalidatePath('/dashboard/assets')
}

export async function createHandover(formData: FormData) {
  const { supabase, user } = await actor()
  const employeeId = String(formData.get('employee_id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  if (!employeeId || !notes) throw new Error('Employee and handover notes are required.')
  const { data: assets } = await supabase.from('assets').select('id').eq('assigned_to', employeeId)
  await supabase.from('employees').update({ employment_status: 'exiting' }).eq('id', employeeId)
  await audit(supabase, user.id, 'handover_started', 'employee', employeeId, { notes, asset_count: assets?.length ?? 0 })
  revalidatePath('/dashboard/employees'); revalidatePath('/dashboard/assets')
}
