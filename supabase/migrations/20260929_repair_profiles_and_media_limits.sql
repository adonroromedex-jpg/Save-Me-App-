-- Run after 20260929_secure_messaging.sql. Safe to rerun.
-- Restore discoverability for verified legacy accounts whose phone is in Auth metadata.
-- No phone is invented for accounts that never provided one; those users use Settings.
with raw as (
  select id, created_at,
    coalesce(raw_user_meta_data->>'firstName', '') as first_name,
    coalesce(raw_user_meta_data->>'name', '') as last_name,
    regexp_replace(coalesce(nullif(raw_user_meta_data->>'phoneNumber', ''), raw_user_meta_data->>'phone', ''), '[[:space:]().-]', '', 'g') as phone,
    regexp_replace(coalesce(raw_user_meta_data->>'countryCode', ''), '[[:space:]().-]', '', 'g') as calling_code
  from auth.users where email_confirmed_at is not null
), formatted as (
  select *, case
    when phone like '+%' then phone
    when phone like '00%' then '+' || substr(phone, 3)
    else calling_code || regexp_replace(phone, '^0+', '') end as phone_e164
  from raw
), candidates as (
  select distinct on (f.phone_e164) f.* from formatted f
  where f.phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
    and not exists (select 1 from public.profiles p where p.phone_e164 = f.phone_e164 and p.id <> f.id)
  order by f.phone_e164, f.created_at, f.id
)
insert into public.profiles (id, first_name, last_name, phone_e164)
select id, first_name, last_name, phone_e164 from candidates
on conflict (id) do update set
  first_name = coalesce(nullif(profiles.first_name, ''), excluded.first_name),
  last_name = coalesce(nullif(profiles.last_name, ''), excluded.last_name),
  phone_e164 = coalesce(profiles.phone_e164, excluded.phone_e164),
  updated_at = now();

update storage.buckets set file_size_limit = 52428800 where id = 'chat-media';
