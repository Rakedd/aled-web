create table public.technical_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null,
  language text not null check (language in ('fr', 'en')),
  cv_version_id uuid,
  cv_label text not null,
  cv_uploaded_at timestamptz not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  generated_at timestamptz not null,
  unique (user_id, job_application_id, language),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade,
  foreign key (user_id, cv_version_id) references public.cv_versions (user_id, id) on delete set null (cv_version_id)
);

create index technical_briefs_cv_version_id_index on public.technical_briefs (cv_version_id);

alter table public.technical_briefs enable row level security;

revoke all on public.technical_briefs from anon;

grant select, insert, update, delete on public.technical_briefs to authenticated, service_role;

create policy technical_briefs_select_own on public.technical_briefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy technical_briefs_insert_own on public.technical_briefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy technical_briefs_update_own on public.technical_briefs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy technical_briefs_delete_own on public.technical_briefs
  for delete to authenticated using (user_id = (select auth.uid()));
