create or replace view public.job_applications_overview
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
  intermediary.kind as intermediary_kind
from public.job_applications as job_application
left join public.intermediaries as intermediary on intermediary.id = job_application.intermediary_id
left join public.contacts as contact on contact.id = job_application.contact_id
left join public.end_clients as end_client on end_client.id = job_application.end_client_id
left join public.end_clients as parent_end_client on parent_end_client.id = end_client.parent_end_client_id;
