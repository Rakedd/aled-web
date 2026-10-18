create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  url text not null,
  title text not null,
  title_normalized text not null,
  company text,
  description text,
  rate_min int,
  rate_max int,
  rate_label text,
  currency text,
  remote_mode text check (remote_mode in ('full', 'partial', 'none')),
  location_label text,
  region text,
  country text,
  duration_months int,
  published_at timestamptz not null,
  skills jsonb not null default '[]',
  received_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (source, external_id)
);

create table public.opportunity_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  opportunity_id uuid not null references public.opportunities on delete cascade,
  decision text not null check (decision in ('applied', 'dismissed')),
  job_application_id uuid,
  decided_at timestamptz not null default now(),
  unique (user_id, opportunity_id),
  foreign key (user_id, job_application_id) references public.job_applications (user_id, id) on delete set null (job_application_id)
);

create table public.opportunity_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source text not null,
  include_keywords text[] not null default '{}',
  always_exclude_keywords text[] not null default '{}',
  rescuable_exclude_keywords text[] not null default '{}',
  rescue_keywords text[] not null default '{}',
  rate_floor_full_remote int check (rate_floor_full_remote >= 0),
  rate_floor_hybrid int check (rate_floor_hybrid >= 0),
  rate_floor_onsite int check (rate_floor_onsite >= 0),
  regions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.profiles add column opportunities_last_viewed_at timestamptz;

create index opportunities_published_at_index on public.opportunities (published_at);
create index opportunities_received_at_index on public.opportunities (received_at);
create index opportunity_decisions_opportunity_id_index on public.opportunity_decisions (opportunity_id);
create index opportunity_decisions_job_application_id_index on public.opportunity_decisions (job_application_id);

create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger opportunity_filters_set_updated_at before update on public.opportunity_filters
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;
alter table public.opportunity_decisions enable row level security;
alter table public.opportunity_filters enable row level security;

revoke all on
  public.opportunities,
  public.opportunity_decisions,
  public.opportunity_filters
from anon;

revoke all on public.opportunities from authenticated;

grant select on public.opportunities to authenticated;

grant select, insert, update, delete on public.opportunities to service_role;

grant select, insert, update, delete on
  public.opportunity_decisions,
  public.opportunity_filters
to authenticated, service_role;

create policy opportunities_select_authenticated on public.opportunities
  for select to authenticated using (true);

create policy opportunity_decisions_select_own on public.opportunity_decisions
  for select to authenticated using (user_id = (select auth.uid()));
create policy opportunity_decisions_insert_own on public.opportunity_decisions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy opportunity_decisions_update_own on public.opportunity_decisions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy opportunity_decisions_delete_own on public.opportunity_decisions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy opportunity_filters_select_own on public.opportunity_filters
  for select to authenticated using (user_id = (select auth.uid()));
create policy opportunity_filters_insert_own on public.opportunity_filters
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy opportunity_filters_update_own on public.opportunity_filters
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy opportunity_filters_delete_own on public.opportunity_filters
  for delete to authenticated using (user_id = (select auth.uid()));
