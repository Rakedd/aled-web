delete from public.opportunity_filters
where source <> 'free-work';

alter table public.opportunity_filters drop column source;

alter table public.opportunity_filters add constraint opportunity_filters_user_id_key unique (user_id);

alter table public.opportunity_filters add column disabled_sources text[] not null default '{}';
