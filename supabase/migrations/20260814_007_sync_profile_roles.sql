-- The Auth metadata role is the assigned role used by the server-side
-- authorization checks. Synchronize its public profile copy so a user has one
-- consistent role throughout the application.
update public.profiles as profile
set role = nullif(trim(auth_user.raw_user_meta_data ->> 'role'), ''),
    updated_at = now()
from auth.users as auth_user
where auth_user.id = profile.id
  and nullif(trim(auth_user.raw_user_meta_data ->> 'role'), '') is not null
  and profile.role is distinct from nullif(trim(auth_user.raw_user_meta_data ->> 'role'), '');
