begin;

-- Earlier migrations copied role labels from Auth user metadata. Normalize
-- those labels to the supported role vocabulary so substring-like legacy values
-- cannot be treated as an Administrator/HR role by application code.
update public.profiles
set role = case lower(btrim(coalesce(role, '')))
  when 'admin' then 'Administrator'
  when 'administrator' then 'Administrator'
  when 'hr' then 'HR'
  when 'ict' then 'ICT'
  when 'library' then 'Library'
  when 'management' then 'Management'
  when 'academic attaché' then 'Academic Attaché'
  when 'academic attache' then 'Academic Attaché'
  when 'support staff' then 'Support Staff'
  when 'employee' then 'Employee'
  else 'Employee'
end,
updated_at = now()
where role is distinct from case lower(btrim(coalesce(role, '')))
  when 'admin' then 'Administrator'
  when 'administrator' then 'Administrator'
  when 'hr' then 'HR'
  when 'ict' then 'ICT'
  when 'library' then 'Library'
  when 'management' then 'Management'
  when 'academic attaché' then 'Academic Attaché'
  when 'academic attache' then 'Academic Attaché'
  when 'support staff' then 'Support Staff'
  when 'employee' then 'Employee'
  else 'Employee'
end;

commit;
