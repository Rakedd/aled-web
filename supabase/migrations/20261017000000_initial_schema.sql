create type public.job_application_status as enum (
  'applied',
  'intermediary_contact',
  'cv_submitted',
  'interview_scheduled',
  'interview_done',
  'contract_received',
  'signed',
  'ko_after_contact',
  'ko_cv',
  'ko_interview',
  'no_news_abandoned'
);

create type public.activity_kind as enum ('call', 'message', 'email', 'status_change', 'other');

create type public.interview_kind as enum ('client', 'mock', 'other');

create type public.interview_format as enum ('video', 'onsite', 'phone');

create type public.intermediary_kind as enum ('agency', 'esn', 'platform', 'direct', 'other');

create type public.alert_kind as enum (
  'follow_up_due',
  'job_spec_missing',
  'end_client_unknown',
  'upcoming_interview',
  'no_news_suggestion'
);

create type public.job_spec_source_kind as enum ('pdf', 'text');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text,
  last_name text,
  email text,
  links jsonb not null default '[]',
  follow_up_delay_days int not null default 7 check (follow_up_delay_days between 1 and 60),
  encrypted_anthropic_api_key text,
  anthropic_api_key_last_four text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intermediaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  normalized_name text not null,
  kind public.intermediary_kind,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  unique (user_id, id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  full_name text not null,
  normalized_name text not null,
  phone text,
  email text,
  linkedin_url text,
  intermediary_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, normalized_name, intermediary_id),
  unique (user_id, id),
  foreign key (user_id, intermediary_id) references public.intermediaries (user_id, id) on delete set null (intermediary_id)
);

create table public.end_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  normalized_name text not null,
  parent_end_client_id uuid,
  notes text,
  brief_markdown text,
  brief_sources jsonb,
  brief_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  unique (user_id, id),
  check (parent_end_client_id <> id),
  foreign key (user_id, parent_end_client_id) references public.end_clients (user_id, id) on delete set null (parent_end_client_id)
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  source text,
  posting_url text,
  posting_raw_text text,
  status public.job_application_status not null default 'applied',
  intermediary_id uuid,
  contact_id uuid,
  end_client_id uuid,
  posted_daily_rate int,
  requested_daily_rate int,
  location text,
  remote_policy text,
  desired_start text,
  duration text,
  applied_on date not null default current_date,
  notes text,
  actual_start_date date,
  stack jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, intermediary_id) references public.intermediaries (user_id, id) on delete set null (intermediary_id),
  foreign key (user_id, contact_id) references public.contacts (user_id, id) on delete set null (contact_id),
  foreign key (user_id, end_client_id) references public.end_clients (user_id, id) on delete set null (end_client_id)
);

create table public.activity_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null,
  occurred_at timestamptz not null default now(),
  kind public.activity_kind not null,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null,
  starts_at timestamptz not null,
  kind public.interview_kind not null,
  format public.interview_format not null,
  participants text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade
);

create table public.job_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null unique,
  source_kind public.job_spec_source_kind not null,
  storage_path text,
  raw_text text,
  pending_stack jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade
);

create table public.alert_snoozes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_application_id uuid not null,
  alert_kind public.alert_kind not null,
  snoozed_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_application_id, alert_kind),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete cascade
);

create index contacts_intermediary_id_index on public.contacts (intermediary_id);
create index end_clients_parent_end_client_id_index on public.end_clients (parent_end_client_id);
create index job_applications_intermediary_id_index on public.job_applications (intermediary_id);
create index job_applications_contact_id_index on public.job_applications (contact_id);
create index job_applications_end_client_id_index on public.job_applications (end_client_id);
create index activity_log_entries_job_application_id_index on public.activity_log_entries (job_application_id, occurred_at desc);
create index activity_log_entries_user_id_index on public.activity_log_entries (user_id);
create index interviews_job_application_id_index on public.interviews (job_application_id);
create index interviews_user_id_starts_at_index on public.interviews (user_id, starts_at);
create index job_specs_user_id_index on public.job_specs (user_id);
create index alert_snoozes_user_id_index on public.alert_snoozes (user_id);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger intermediaries_set_updated_at before update on public.intermediaries
  for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger end_clients_set_updated_at before update on public.end_clients
  for each row execute function public.set_updated_at();
create trigger job_applications_set_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();
create trigger activity_log_entries_set_updated_at before update on public.activity_log_entries
  for each row execute function public.set_updated_at();
create trigger interviews_set_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();
create trigger job_specs_set_updated_at before update on public.job_specs
  for each row execute function public.set_updated_at();
create trigger alert_snoozes_set_updated_at before update on public.alert_snoozes
  for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

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
  parent_end_client.name as end_client_parent_name
from public.job_applications as job_application
left join public.intermediaries as intermediary on intermediary.id = job_application.intermediary_id
left join public.contacts as contact on contact.id = job_application.contact_id
left join public.end_clients as end_client on end_client.id = job_application.end_client_id
left join public.end_clients as parent_end_client on parent_end_client.id = end_client.parent_end_client_id;

alter table public.profiles enable row level security;
alter table public.intermediaries enable row level security;
alter table public.contacts enable row level security;
alter table public.end_clients enable row level security;
alter table public.job_applications enable row level security;
alter table public.activity_log_entries enable row level security;
alter table public.interviews enable row level security;
alter table public.job_specs enable row level security;
alter table public.alert_snoozes enable row level security;

revoke all on
  public.profiles,
  public.intermediaries,
  public.contacts,
  public.end_clients,
  public.job_applications,
  public.activity_log_entries,
  public.interviews,
  public.job_specs,
  public.alert_snoozes,
  public.job_applications_overview
from anon;

grant select, insert, update, delete on
  public.profiles,
  public.intermediaries,
  public.contacts,
  public.end_clients,
  public.job_applications,
  public.activity_log_entries,
  public.interviews,
  public.job_specs,
  public.alert_snoozes
to authenticated, service_role;

grant select on public.job_applications_overview to authenticated, service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

create policy intermediaries_select_own on public.intermediaries
  for select to authenticated using (user_id = (select auth.uid()));
create policy intermediaries_insert_own on public.intermediaries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy intermediaries_update_own on public.intermediaries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy intermediaries_delete_own on public.intermediaries
  for delete to authenticated using (user_id = (select auth.uid()));

create policy contacts_select_own on public.contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy contacts_insert_own on public.contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy contacts_update_own on public.contacts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contacts_delete_own on public.contacts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy end_clients_select_own on public.end_clients
  for select to authenticated using (user_id = (select auth.uid()));
create policy end_clients_insert_own on public.end_clients
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy end_clients_update_own on public.end_clients
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy end_clients_delete_own on public.end_clients
  for delete to authenticated using (user_id = (select auth.uid()));

create policy job_applications_select_own on public.job_applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy job_applications_insert_own on public.job_applications
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy job_applications_update_own on public.job_applications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy job_applications_delete_own on public.job_applications
  for delete to authenticated using (user_id = (select auth.uid()));

create policy activity_log_entries_select_own on public.activity_log_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy activity_log_entries_insert_own on public.activity_log_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy activity_log_entries_update_own on public.activity_log_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy activity_log_entries_delete_own on public.activity_log_entries
  for delete to authenticated using (user_id = (select auth.uid()));

create policy interviews_select_own on public.interviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy interviews_insert_own on public.interviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy interviews_update_own on public.interviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy interviews_delete_own on public.interviews
  for delete to authenticated using (user_id = (select auth.uid()));

create policy job_specs_select_own on public.job_specs
  for select to authenticated using (user_id = (select auth.uid()));
create policy job_specs_insert_own on public.job_specs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy job_specs_update_own on public.job_specs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy job_specs_delete_own on public.job_specs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy alert_snoozes_select_own on public.alert_snoozes
  for select to authenticated using (user_id = (select auth.uid()));
create policy alert_snoozes_insert_own on public.alert_snoozes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy alert_snoozes_update_own on public.alert_snoozes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy alert_snoozes_delete_own on public.alert_snoozes
  for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-specs', 'job-specs', false, 10485760, array['application/pdf']);

create policy job_specs_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'job-specs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy job_specs_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-specs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy job_specs_objects_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'job-specs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'job-specs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy job_specs_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-specs' and (storage.foldername(name))[1] = (select auth.uid())::text);
