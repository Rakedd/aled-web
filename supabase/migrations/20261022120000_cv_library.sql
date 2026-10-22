create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  current_version_id uuid,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  cv_id uuid,
  label text not null,
  storage_path text not null,
  file_name text not null,
  byte_size int not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, cv_id) references public.cvs (user_id, id) on delete set null (cv_id)
);

alter table public.cvs
  add foreign key (user_id, current_version_id) references public.cv_versions (user_id, id) on delete set null (current_version_id);

alter table public.job_applications
  add column sent_cv_version_id uuid,
  add foreign key (user_id, sent_cv_version_id) references public.cv_versions (user_id, id) on delete set null (sent_cv_version_id);

create index cv_versions_cv_id_index on public.cv_versions (cv_id);
create index cvs_current_version_id_index on public.cvs (current_version_id);
create index job_applications_sent_cv_version_id_index on public.job_applications (sent_cv_version_id);

create trigger cvs_set_updated_at before update on public.cvs
  for each row execute function public.set_updated_at();

create function public.enforce_cv_library_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('cvs:' || new.user_id::text, 0));

  if (select count(*) from public.cvs where user_id = new.user_id and id <> new.id) >= 10 then
    raise exception 'cv_library_full' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger cvs_enforce_library_limit before insert on public.cvs
  for each row execute function public.enforce_cv_library_limit();

create function public.delete_unreferenced_cv_versions(candidate_version_ids uuid[])
returns setof text
language sql
security invoker
set search_path = ''
as $$
  delete from public.cv_versions as version
  where version.id = any(candidate_version_ids)
    and not exists (select 1 from public.cvs as cv where cv.current_version_id = version.id)
    and not exists (select 1 from public.job_applications as job_application where job_application.sent_cv_version_id = version.id)
  returning version.storage_path;
$$;

alter table public.cvs enable row level security;
alter table public.cv_versions enable row level security;

create policy cvs_select_own on public.cvs
  for select to authenticated using (user_id = (select auth.uid()));
create policy cvs_insert_own on public.cvs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy cvs_update_own on public.cvs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cvs_delete_own on public.cvs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy cv_versions_select_own on public.cv_versions
  for select to authenticated using (user_id = (select auth.uid()));
create policy cv_versions_insert_own on public.cv_versions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy cv_versions_update_own on public.cv_versions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cv_versions_delete_own on public.cv_versions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.cvs, public.cv_versions from anon;
grant select, insert, update, delete on public.cvs, public.cv_versions to authenticated, service_role;

create view public.cvs_overview
with (security_invoker = true)
as
select
  cv.*,
  current_version.uploaded_at as current_version_uploaded_at,
  current_version.file_name as current_version_file_name,
  current_version.storage_path as current_version_storage_path,
  (
    select count(*)
    from public.job_applications as job_application
    join public.cv_versions as version on version.id = job_application.sent_cv_version_id
    where version.cv_id = cv.id
  ) as sent_count
from public.cvs as cv
left join public.cv_versions as current_version on current_version.id = cv.current_version_id;

create view public.cv_versions_overview
with (security_invoker = true)
as
select
  version.*,
  (
    select count(*)
    from public.job_applications as job_application
    where job_application.sent_cv_version_id = version.id
  ) as sent_count
from public.cv_versions as version;

drop view public.job_applications_overview;

create view public.job_applications_overview
with (security_invoker = true)
as
select
  job_application.*,
  (
    select max(activity_log_entry.occurred_at)
    from public.activity_log_entries as activity_log_entry
    where activity_log_entry.job_application_id = job_application.id
  ) as last_activity_at,
  exists (
    select 1
    from public.job_specs as job_spec
    where job_spec.job_application_id = job_application.id
  ) as has_job_spec,
  intermediary.name as intermediary_name,
  contact.full_name as contact_name,
  end_client.name as end_client_name,
  parent_end_client.name as end_client_parent_name,
  intermediary.kind as intermediary_kind,
  sent_cv_version.label as sent_cv_label,
  sent_cv_version.uploaded_at as sent_cv_uploaded_at
from public.job_applications as job_application
left join public.intermediaries as intermediary on intermediary.id = job_application.intermediary_id
left join public.contacts as contact on contact.id = job_application.contact_id
left join public.end_clients as end_client on end_client.id = job_application.end_client_id
left join public.end_clients as parent_end_client on parent_end_client.id = end_client.parent_end_client_id
left join public.cv_versions as sent_cv_version on sent_cv_version.id = job_application.sent_cv_version_id;

revoke all on public.cvs_overview, public.cv_versions_overview, public.job_applications_overview from anon;
grant select on public.cvs_overview, public.cv_versions_overview, public.job_applications_overview to authenticated, service_role;

revoke execute on function public.delete_unreferenced_cv_versions(uuid[]) from public, anon;
grant execute on function public.delete_unreferenced_cv_versions(uuid[]) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 4194304, array['application/pdf']);

create policy cvs_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cvs_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cvs_objects_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cvs_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
