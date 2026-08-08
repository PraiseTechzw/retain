import { createClient } from '@/lib/supabase/server'

export async function getEmployees() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_number, full_name, email, job_title, employment_status, joined_on, exit_date, departments(name)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExitRequests() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exit_requests')
    .select('id, status, reason, submitted_on, last_day, employees(full_name, employee_number)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAssets() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assets')
    .select('id, asset_tag, asset_type, description, status, returned_at, employees(full_name, employee_number)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getKnowledgeDocuments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, title, category, storage_path, created_at, employees(full_name, employee_number)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getClearanceSteps() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clearance_steps')
    .select('id, department, status, step_order, comments, exit_requests(id, employees(full_name, employee_number))')
    .order('step_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load Supabase records.'
}
