-- Remove legacy profiles policies that make a policy query profiles again.
-- PostgreSQL rejects that self-reference with "infinite recursion detected in
-- policy for relation profiles", blocking onboarding profile updates.
drop policy if exists "Profiles are editable by owner" on public.profiles;
drop policy if exists "Profiles are viewable by owner or admins" on public.profiles;

-- Keep the non-recursive self-service policy used by the application.
drop policy if exists employee_self_profile on public.profiles;
create policy employee_self_profile on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);
