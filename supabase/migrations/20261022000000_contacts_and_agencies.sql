alter table public.contacts
  add column notes text,
  add column referred_by text;

alter table public.activity_log_entries
  alter column job_application_id drop not null,
  add column contact_id uuid,
  add constraint activity_log_entries_target_check check (job_application_id is not null or contact_id is not null),
  add foreign key (user_id, contact_id) references public.contacts (user_id, id) on delete set null (contact_id);

create index activity_log_entries_contact_id_occurred_at_index on public.activity_log_entries (contact_id, occurred_at desc);

create function public.detach_contact_exchanges_from_job_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.activity_log_entries
  set job_application_id = null
  where job_application_id = old.id and contact_id is not null;
  return old;
end;
$$;

create trigger job_applications_detach_contact_exchanges before delete on public.job_applications
  for each row execute function public.detach_contact_exchanges_from_job_application();

create function public.delete_standalone_exchanges_of_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.activity_log_entries
  where contact_id = old.id and job_application_id is null;
  return old;
end;
$$;

create trigger contacts_delete_standalone_exchanges before delete on public.contacts
  for each row execute function public.delete_standalone_exchanges_of_contact();

create function public.delete_contact(target_contact_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_contact_count int;
begin
  delete from public.contacts where id = target_contact_id;
  get diagnostics deleted_contact_count = row_count;

  return deleted_contact_count > 0;
end;
$$;

create function public.assign_missing_contact_intermediaries()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.contacts as contact
  set intermediary_id = latest_job_application.intermediary_id
  from (
    select distinct on (job_application.contact_id)
      job_application.contact_id,
      job_application.intermediary_id
    from public.job_applications as job_application
    where job_application.contact_id is not null and job_application.intermediary_id is not null
    order by job_application.contact_id, job_application.applied_on desc, job_application.created_at desc
  ) as latest_job_application
  where contact.id = latest_job_application.contact_id and contact.intermediary_id is null;
$$;

create view public.exchanges_overview
with (security_invoker = true)
as
select
  activity_log_entry.id,
  activity_log_entry.user_id,
  activity_log_entry.occurred_at,
  activity_log_entry.created_at,
  activity_log_entry.kind,
  activity_log_entry.summary,
  activity_log_entry.job_application_id,
  job_application.title as job_application_title,
  contact.id as effective_contact_id,
  contact.full_name as contact_name,
  contact.intermediary_id as contact_intermediary_id,
  job_application.intermediary_id as job_application_intermediary_id
from public.activity_log_entries as activity_log_entry
left join public.job_applications as job_application on job_application.id = activity_log_entry.job_application_id
left join public.contacts as contact on contact.id = coalesce(activity_log_entry.contact_id, job_application.contact_id)
where activity_log_entry.kind <> 'status_change';

create view public.contacts_overview
with (security_invoker = true)
as
select
  contact.*,
  intermediary.name as intermediary_name,
  (
    select max(exchange.occurred_at)
    from public.exchanges_overview as exchange
    where exchange.effective_contact_id = contact.id
  ) as last_exchange_at,
  (
    select count(*)
    from public.job_applications as job_application
    where job_application.contact_id = contact.id
  ) as proposed_mission_count
from public.contacts as contact
left join public.intermediaries as intermediary on intermediary.id = contact.intermediary_id;

create view public.intermediaries_overview
with (security_invoker = true)
as
select
  intermediary.id,
  intermediary.user_id,
  intermediary.name,
  intermediary.kind,
  intermediary.created_at,
  (
    select count(*)
    from public.contacts as contact
    where contact.intermediary_id = intermediary.id
  ) as contact_count,
  (
    select count(*)
    from public.job_applications as job_application
    where job_application.intermediary_id = intermediary.id
  ) as proposed_mission_count,
  (
    select max(exchange.occurred_at)
    from public.exchanges_overview as exchange
    where exchange.contact_intermediary_id = intermediary.id
      or exchange.job_application_intermediary_id = intermediary.id
  ) as last_exchange_at
from public.intermediaries as intermediary;

revoke all on
  public.exchanges_overview,
  public.contacts_overview,
  public.intermediaries_overview
from anon;

grant select on
  public.exchanges_overview,
  public.contacts_overview,
  public.intermediaries_overview
to authenticated, service_role;

revoke execute on function public.delete_contact(uuid) from public, anon;
revoke execute on function public.assign_missing_contact_intermediaries() from public, anon;
grant execute on function public.delete_contact(uuid) to authenticated, service_role;
grant execute on function public.assign_missing_contact_intermediaries() to authenticated, service_role;

select public.assign_missing_contact_intermediaries();
