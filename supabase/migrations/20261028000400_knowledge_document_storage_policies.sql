-- Storage objects are private. Keep object access aligned with the document
-- rows that authorize uploads and downloads.
drop policy if exists knowledge_documents_storage_insert on storage.objects;
create policy knowledge_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'knowledge-documents'
    and public.current_app_active()
    and (storage.foldername(name))[1] = 'private'
    and exists (
      select 1
      from public.employees employee
      where employee.id::text = (storage.foldername(name))[2]
        and (
          public.current_app_role() in ('administrator', 'hr')
          or employee.user_id = auth.uid()
        )
    )
  );

drop policy if exists knowledge_documents_storage_read on storage.objects;
create policy knowledge_documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and public.current_app_active()
    and exists (
      select 1
      from public.knowledge_documents document
      where document.storage_path = name
    )
  );

drop policy if exists knowledge_documents_storage_delete on storage.objects;
create policy knowledge_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and public.current_app_active()
    and (storage.foldername(name))[1] = 'private'
    and exists (
      select 1
      from public.employees employee
      where employee.id::text = (storage.foldername(name))[2]
        and (
          public.current_app_role() in ('administrator', 'hr')
          or employee.user_id = auth.uid()
        )
    )
  );
