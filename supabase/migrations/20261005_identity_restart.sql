-- Run after 20261004_chat_experience.sql. Additive and safe to rerun.
-- Restart permits NEW encrypted exchanges; it cannot recover lost private keys.
begin;
alter table public.chat_keys add column if not exists key_version integer not null default 1;
alter table public.chat_keys add column if not exists rotated_at timestamptz;
create table if not exists public.chat_key_changes (
  user_id uuid not null references auth.users(id) on delete cascade,
  key_version integer not null,
  previous_key text not null,
  public_key text not null,
  changed_at timestamptz not null default now(),
  primary key(user_id,key_version)
);
alter table public.chat_key_changes enable row level security;
revoke all on public.chat_key_changes from public,anon,authenticated;

create or replace function public.get_chat_identity(p_peer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('public_key',public_key,'version',key_version)
  from public.chat_keys where user_id=p_peer and auth.uid() is not null;
$$;

create or replace function public.restart_chat_identity(p_expected text,p_key text) returns text
language plpgsql security definer set search_path = '' as $$
declare previous public.chat_keys%rowtype;
begin
  if auth.uid() is null or p_expected is null or p_key is null
    or p_key !~ '^[A-Za-z0-9+/]{43}=$' then raise exception 'Invalid identity restart'; end if;
  -- Server-enforced recent OTP for an email-confirmed account; refresh is not reauthentication.
  if not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) as methods(method)
    where method->>'method'='otp' and
      case when method->>'timestamp' ~ '^[0-9]{1,12}$'
        then (method->>'timestamp')::bigint between extract(epoch from now())-300 and extract(epoch from now())+30
        else false end
  ) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
  then raise exception 'Fresh email verification required'; end if;
  select * into previous from public.chat_keys where user_id=auth.uid() for update;
  if not found then raise exception 'Identity not registered'; end if;
  -- Idempotent completion after a lost network response.
  if previous.public_key=p_key then return p_key; end if;
  if previous.public_key<>p_expected then raise exception 'Identity changed; review again'; end if;
  if previous.rotated_at>now()-interval '1 minute' then raise exception 'Wait one minute before another restart'; end if;
  update public.chat_keys set public_key=p_key,key_version=previous.key_version+1,rotated_at=now() where user_id=auth.uid();
  insert into public.chat_key_changes(user_id,key_version,previous_key,public_key)
    values(auth.uid(),previous.key_version+1,previous.public_key,p_key);
  -- Existing ciphertext and personal Vault data are deliberately retained.
  return p_key;
end $$;
revoke all on function public.get_chat_identity(uuid),public.restart_chat_identity(text,text) from public,anon;
grant execute on function public.get_chat_identity(uuid),public.restart_chat_identity(text,text) to authenticated;
-- Old ciphertext for a lost recipient key is retained, but is not a new readable inbox item.
create or replace function public.count_unread_messages(p_sender uuid default null,p_message uuid default null) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.messages m
  left join public.media_secrets ms on ms.message_id=m.id
  left join public.chat_keys k on k.user_id=auth.uid()
  left join public.chat_keys sender_key on sender_key.user_id=m.sender_id
  where m.recipient_id=auth.uid() and m.status='ready' and m.read_at is null
    and (m.expires_at is null or m.expires_at>now())
    and (p_sender is null or m.sender_id=p_sender) and (p_message is null or m.id=p_message)
    and ((m.media_kind is null and m.body is not null)
      or (coalesce(m.encrypted_body,ms.envelopes)->>'recipient_key'=k.public_key
        and coalesce(m.encrypted_body,ms.envelopes)->>'sender_key'=sender_key.public_key));
$$;
revoke all on function public.count_unread_messages(uuid,uuid) from public,anon;
grant execute on function public.count_unread_messages(uuid,uuid) to authenticated;
commit;
