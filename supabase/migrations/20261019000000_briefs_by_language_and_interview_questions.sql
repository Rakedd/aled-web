create table public.end_client_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  end_client_id uuid not null,
  language text not null check (language in ('fr', 'en')),
  markdown text not null,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  generated_at timestamptz not null,
  unique (user_id, end_client_id, language),
  foreign key (user_id, end_client_id) references public.end_clients (user_id, id) on delete cascade
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null,
  language text not null check (language in ('fr', 'en')),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  generated_at timestamptz not null,
  unique (user_id, job_application_id, language),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade
);

insert into public.end_client_briefs (user_id, end_client_id, language, markdown, sources, generated_at)
select
  end_client.user_id,
  end_client.id,
  'fr',
  end_client.brief_markdown,
  case when jsonb_typeof(end_client.brief_sources) = 'array' then end_client.brief_sources else '[]'::jsonb end,
  coalesce(end_client.brief_generated_at, end_client.updated_at)
from public.end_clients as end_client
where end_client.brief_markdown is not null
on conflict (user_id, end_client_id, language) do nothing;

alter table public.end_client_briefs enable row level security;
alter table public.interview_questions enable row level security;

revoke all on
  public.end_client_briefs,
  public.interview_questions
from anon;

grant select, insert, update, delete on
  public.end_client_briefs,
  public.interview_questions
to authenticated, service_role;

create policy end_client_briefs_select_own on public.end_client_briefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy end_client_briefs_insert_own on public.end_client_briefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy end_client_briefs_update_own on public.end_client_briefs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy end_client_briefs_delete_own on public.end_client_briefs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy interview_questions_select_own on public.interview_questions
  for select to authenticated using (user_id = (select auth.uid()));
create policy interview_questions_insert_own on public.interview_questions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy interview_questions_update_own on public.interview_questions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy interview_questions_delete_own on public.interview_questions
  for delete to authenticated using (user_id = (select auth.uid()));
