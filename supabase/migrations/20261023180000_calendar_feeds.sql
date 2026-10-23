create table public.calendar_feeds (
  user_id uuid primary key references auth.users on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

revoke all on public.calendar_feeds from anon;

grant select, insert, update, delete on public.calendar_feeds to authenticated, service_role;

create policy calendar_feeds_select_own on public.calendar_feeds
  for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_feeds_insert_own on public.calendar_feeds
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy calendar_feeds_update_own on public.calendar_feeds
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy calendar_feeds_delete_own on public.calendar_feeds
  for delete to authenticated using (user_id = (select auth.uid()));
