-- Run AFTER secure_messaging and repair_profiles_and_media_limits.
-- Additive migration for the v2 Android client. Old clients cannot send after this migration.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.chat_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key text not null check (length(public_key) = 44), created_at timestamptz not null default now()
);
alter table public.chat_keys enable row level security;
create table if not exists public.blocked_contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid not null references auth.users(id) on delete cascade,
  primary key(owner_id, peer_id), check(owner_id <> peer_id)
);
alter table public.blocked_contacts enable row level security;
drop policy if exists "Own blocks" on public.blocked_contacts;
create policy "Own blocks" on public.blocked_contacts for all to authenticated
  using(owner_id = (select auth.uid())) with check(owner_id = (select auth.uid()));

alter table public.messages add column if not exists encrypted_body jsonb;
alter table public.messages add column if not exists media_parts integer;
alter table public.messages alter column expires_at drop not null;
alter table public.messages alter column expires_at drop default;
alter table public.messages drop constraint if exists messages_media_kind_check;
alter table public.messages add constraint messages_media_kind_check check(media_kind in ('image','video','audio'));
alter table public.messages drop constraint if exists valid_content;
alter table public.messages add constraint valid_content check(
  (media_kind is null and media_path is null and (body is not null or encrypted_body is not null)) or
  (body is null and media_kind is not null and media_path is not null)
);
alter table public.messages drop constraint if exists valid_media_parts;
alter table public.messages add constraint valid_media_parts check(media_parts is null or media_parts between 1 and 200);
-- Preserve surviving text messages. Previously deleted messages cannot be recovered.
update public.messages set expires_at = null where media_kind is null;
create table if not exists public.media_secrets (
  message_id uuid primary key references public.messages(id) on delete cascade,
  envelopes jsonb not null, pin_hash text
);
alter table public.media_secrets enable row level security;
create table if not exists public.media_unlock_attempts (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  failures integer not null default 0, blocked_until timestamptz,
  primary key(message_id, user_id)
);
alter table public.media_unlock_attempts enable row level security;
revoke all on public.media_secrets, public.media_unlock_attempts, public.chat_keys from anon, authenticated;
-- RPCs own message mutations. Clients cannot alter participants, dates, key envelopes or status directly.
revoke insert, update, delete on public.messages from anon, authenticated;
revoke update(status) on public.messages from authenticated;

drop policy if exists "Participants read active ready messages" on public.messages;
create policy "Participants read active ready messages" on public.messages for select to authenticated
  using ((expires_at is null or expires_at > now()) and
    (sender_id = (select auth.uid()) or (recipient_id = (select auth.uid()) and status = 'ready')));

create or replace function public.register_chat_key(p_key text) returns text
language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if auth.uid() is null or p_key !~ '^[A-Za-z0-9+/]{43}=$' then raise exception 'Invalid key'; end if;
  insert into public.chat_keys(user_id, public_key) values(auth.uid(), p_key) on conflict do nothing;
  select public_key into result from public.chat_keys where user_id = auth.uid();
  return result;
end $$;
create or replace function public.get_chat_key(p_peer uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public_key from public.chat_keys where user_id = p_peer and auth.uid() is not null;
$$;
create or replace function public.assert_chat_envelopes(p_peer uuid, p_envelopes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_peer = auth.uid() or p_envelopes is null or octet_length(p_envelopes::text) > 60000
    or not (p_envelopes ?& array['sender_key','recipient_key','sender','recipient'])
    or jsonb_typeof(p_envelopes->'sender') <> 'object' or jsonb_typeof(p_envelopes->'recipient') <> 'object'
    or not exists(select 1 from public.chat_keys where user_id = auth.uid() and public_key = p_envelopes->>'sender_key')
    or not exists(select 1 from public.chat_keys where user_id = p_peer and public_key = p_envelopes->>'recipient_key')
    then raise exception 'Invalid encrypted exchange'; end if;
  if exists(select 1 from public.blocked_contacts where
    (owner_id = auth.uid() and peer_id = p_peer) or (owner_id = p_peer and peer_id = auth.uid()))
    then raise exception 'Contact unavailable'; end if;
end $$;
create or replace function public.send_encrypted_text(p_id uuid, p_peer uuid, p_envelopes jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_chat_envelopes(p_peer, p_envelopes);
  insert into public.messages(id,sender_id,recipient_id,encrypted_body,expires_at)
    values(p_id,auth.uid(),p_peer,p_envelopes,null);
  return p_id;
end $$;
create or replace function public.stage_encrypted_media(p_id uuid,p_peer uuid,p_kind text,p_parts integer,p_envelopes jsonb,p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare object_path text;
begin
  perform public.assert_chat_envelopes(p_peer,p_envelopes);
  if p_kind is null or p_kind not in ('image','video','audio') or p_parts is null or p_parts not between 1 and 200 then raise exception 'Invalid media'; end if;
  if p_kind in ('image','video') and (p_pin is null or p_pin !~ '^[0-9]{6}$') then raise exception 'Six-digit code required'; end if;
  object_path := auth.uid()::text || '/' || p_id::text;
  insert into public.messages(id,sender_id,recipient_id,media_path,media_kind,media_parts,status,expires_at)
    values(p_id,auth.uid(),p_peer,object_path,p_kind,p_parts,'uploading',now()+interval '24 hours');
  insert into public.media_secrets(message_id,envelopes,pin_hash)
    values(p_id,p_envelopes,case when p_kind = 'audio' then null else extensions.crypt(p_pin,extensions.gen_salt('bf',10)) end);
  return object_path;
end $$;
create or replace function public.finish_encrypted_media(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.messages; actual_parts integer;
begin
  select * into m from public.messages where id=p_id and sender_id=auth.uid() and status='uploading' and expires_at>now() for update;
  if not found then raise exception 'Upload unavailable'; end if;
  perform public.assert_chat_envelopes(m.recipient_id,(select envelopes from public.media_secrets where message_id=p_id));
  select count(*) into actual_parts from storage.objects where bucket_id='chat-media'
    and name like m.media_path || '/%' and name ~ '/[0-9]+\.bin$';
  if actual_parts <> m.media_parts then raise exception 'Incomplete upload'; end if;
  update public.messages set status='ready',created_at=now(),
    expires_at=case when media_kind='audio' then null else now()+interval '24 hours' end where id=p_id;
end $$;
create or replace function public.cancel_encrypted_media(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.messages where id=p_id and sender_id=auth.uid() and status='uploading'
    and not exists(select 1 from storage.objects where bucket_id='chat-media' and name like media_path || '/%');
$$;
create or replace function public.authorize_media(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.messages;
begin
  select * into m from public.messages where id=p_id and auth.uid() in(sender_id,recipient_id)
    and status='ready' and media_parts is not null and (expires_at is null or expires_at>now());
  if not found then return jsonb_build_object('error','expired'); end if;
  if exists(select 1 from public.blocked_contacts where
    (owner_id=m.sender_id and peer_id=m.recipient_id) or (owner_id=m.recipient_id and peer_id=m.sender_id))
    then return jsonb_build_object('error','blocked'); end if;
  return jsonb_build_object('server_now',now(),'expires_at',m.expires_at,'parts',m.media_parts,'path',m.media_path);
end $$;
create or replace function public.unlock_media(p_id uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare media_grant jsonb; secret public.media_secrets; budget public.media_unlock_attempts;
begin
  media_grant := public.authorize_media(p_id);
  if media_grant ? 'error' then return media_grant; end if;
  select * into secret from public.media_secrets where message_id=p_id;
  if not found then return jsonb_build_object('error','unsupported'); end if;
  if secret.pin_hash is not null then
    insert into public.media_unlock_attempts(message_id,user_id) values(p_id,auth.uid()) on conflict do nothing;
    select * into budget from public.media_unlock_attempts where message_id=p_id and user_id=auth.uid() for update;
    if budget.blocked_until>now() then return jsonb_build_object('error','locked','retry_at',budget.blocked_until); end if;
    if budget.blocked_until is not null and budget.blocked_until<=now() then
      update public.media_unlock_attempts set failures=0,blocked_until=null where message_id=p_id and user_id=auth.uid();
    end if;
    if p_pin is null or p_pin !~ '^[0-9]{6}$' or extensions.crypt(p_pin,secret.pin_hash) <> secret.pin_hash then
      update public.media_unlock_attempts set failures=case when failures>=5 then 1 else failures+1 end,
        blocked_until=case when failures>=4 then now()+interval '5 minutes' else null end
        where message_id=p_id and user_id=auth.uid();
      -- Return (do not raise): failed attempts must commit to prevent unlimited guesses.
      return jsonb_build_object('error','wrong_code');
    end if;
    update public.media_unlock_attempts set failures=0,blocked_until=null where message_id=p_id and user_id=auth.uid();
  end if;
  return media_grant || jsonb_build_object('envelopes',secret.envelopes);
end $$;

create or replace function public.message_peers()
returns table(id uuid,first_name text,last_name text)
language sql stable security definer set search_path = '' as $$
 select p.id,p.first_name,p.last_name from public.profiles p where auth.uid() is not null and p.id in(
 select case when m.sender_id=auth.uid() then m.recipient_id else m.sender_id end from public.messages m
 where auth.uid() in(m.sender_id,m.recipient_id) and (m.expires_at is null or m.expires_at>now()) and m.status='ready');
$$;
-- No plaintext media is accepted from the v2 client; objects are encrypted 1 MiB chunks.
update storage.buckets set public=false,file_size_limit=2097152,allowed_mime_types=array['application/octet-stream'] where id='chat-media';
drop policy if exists "Participants read unexpired chat media" on storage.objects;
drop policy if exists "Sender uploads own pending chat media" on storage.objects;
drop policy if exists "Sender inspects pending upload" on storage.objects;
drop policy if exists "Sender cancels pending upload" on storage.objects;
create policy "Participants read unexpired chat media" on storage.objects for select to authenticated using(
 bucket_id='chat-media' and exists(select 1 from public.messages m where
 (name=m.media_path or name like m.media_path || '/%') and (m.expires_at is null or m.expires_at>now())
 and ((m.status='ready' and auth.uid() in(m.sender_id,m.recipient_id)) or (m.status='uploading' and m.sender_id=auth.uid()))));
create policy "Sender uploads own pending chat media" on storage.objects for insert to authenticated with check(
 bucket_id='chat-media' and exists(select 1 from public.messages m where m.sender_id=auth.uid() and m.status='uploading'
 and m.expires_at>now() and name like m.media_path || '/%' and
 substring(name from length(m.media_path)+2) ~ '^[0-9]+\.bin$' and
 length(substring(name from length(m.media_path)+2)) <= 7 and
 case when substring(name from length(m.media_path)+2) ~ '^(0|[1-9][0-9]{0,2})\.bin$'
 then split_part(substring(name from length(m.media_path)+2),'.',1)::integer < m.media_parts else false end));
create policy "Sender cancels pending upload" on storage.objects for delete to authenticated using(
 bucket_id='chat-media' and exists(select 1 from public.messages m where m.sender_id=auth.uid() and m.status='uploading' and name like m.media_path || '/%'));

revoke all on function public.assert_chat_envelopes(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.register_chat_key(text),public.get_chat_key(uuid),public.send_encrypted_text(uuid,uuid,jsonb),
 public.stage_encrypted_media(uuid,uuid,text,integer,jsonb,text),public.finish_encrypted_media(uuid),public.cancel_encrypted_media(uuid),
 public.authorize_media(uuid),public.unlock_media(uuid,text) from public,anon;
grant execute on function public.register_chat_key(text),public.get_chat_key(uuid),public.send_encrypted_text(uuid,uuid,jsonb),
 public.stage_encrypted_media(uuid,uuid,text,integer,jsonb,text),public.finish_encrypted_media(uuid),public.cancel_encrypted_media(uuid),
 public.authorize_media(uuid),public.unlock_media(uuid,text) to authenticated;
commit;
