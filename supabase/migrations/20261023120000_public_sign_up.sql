alter table public.profiles
  add column professional_status text check (professional_status in ('freelance', 'employee')),
  add column terms_accepted_at timestamptz;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  signup_professional_status text := signup_metadata->>'professional_status';
begin
  insert into public.profiles (id, email, first_name, professional_status, terms_accepted_at)
  values (
    new.id,
    new.email,
    left(
      nullif(
        btrim(
          coalesce(
            signup_metadata->>'first_name',
            signup_metadata->>'given_name',
            split_part(coalesce(signup_metadata->>'full_name', signup_metadata->>'name', ''), ' ', 1)
          )
        ),
        ''
      ),
      100
    ),
    case when signup_professional_status in ('freelance', 'employee') then signup_professional_status else null end,
    case when (signup_metadata->>'terms_accepted') = 'true' then now() else null end
  );
  return new;
end;
$$;
