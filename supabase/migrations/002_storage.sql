-- Private Storage bucket for boarding passes, attachments, header photos
-- Path pattern: {org_id}/{show_id}/{uuid}-{filename}

insert into storage.buckets (id, name, public)
values ('operate-documents', 'operate-documents', false)
on conflict (id) do update set public = false;

create policy storage_read on storage.objects for select
  using (
    bucket_id = 'operate-documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_org_ids())
  );

create policy storage_insert on storage.objects for insert
  with check (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );

create policy storage_update on storage.objects for update
  using (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );

create policy storage_delete on storage.objects for delete
  using (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );
