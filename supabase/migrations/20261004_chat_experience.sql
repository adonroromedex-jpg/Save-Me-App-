-- Apply AFTER the three 20260929 migrations. Idempotent.
alter table public.messages add column if not exists delivered_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;
create table if not exists public.chat_threads (
 owner_id uuid references auth.users(id) on delete cascade,
 peer_id uuid references auth.users(id) on delete cascade,
 last_activity timestamptz not null default now(), primary key(owner_id,peer_id), check(owner_id<>peer_id)
);
alter table public.chat_threads enable row level security;
drop policy if exists "Own threads" on public.chat_threads;
create policy "Own threads" on public.chat_threads for select to authenticated using(owner_id=auth.uid());
revoke insert,update,delete on public.chat_threads from authenticated,anon;
create or replace function public.track_chat_thread() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='ready' then
  insert into public.chat_threads(owner_id,peer_id,last_activity) values(new.sender_id,new.recipient_id,new.created_at),(new.recipient_id,new.sender_id,new.created_at)
  on conflict(owner_id,peer_id) do update set last_activity=greatest(chat_threads.last_activity,excluded.last_activity);
 end if;
 return new;
end $$;
drop trigger if exists track_chat_thread on public.messages;
create trigger track_chat_thread after insert or update of status on public.messages for each row execute function public.track_chat_thread();
insert into public.chat_threads(owner_id,peer_id,last_activity)
select owner_id,peer_id,max(created_at) from (
 select sender_id owner_id,recipient_id peer_id,created_at from public.messages where status='ready'
 union all select recipient_id,sender_id,created_at from public.messages where status='ready'
) q group by owner_id,peer_id on conflict(owner_id,peer_id) do update set last_activity=greatest(chat_threads.last_activity,excluded.last_activity);

create or replace function public.chat_threads_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q) order by last_activity desc),'[]'::jsonb) from (
 select t.peer_id as id,
 coalesce(nullif(p.first_name,''),u.raw_user_meta_data->>'firstName',u.raw_user_meta_data->>'first_name','') first_name,
 coalesce(nullif(p.last_name,''),u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'last_name','') last_name,
 t.last_activity,
 (select jsonb_build_object('id',m.id,'media_kind',m.media_kind,'created_at',m.created_at,'sender_id',m.sender_id) from public.messages m
  where m.status='ready' and (m.expires_at is null or m.expires_at>now()) and ((m.sender_id=t.owner_id and m.recipient_id=t.peer_id) or (m.sender_id=t.peer_id and m.recipient_id=t.owner_id)) order by m.created_at desc,m.id desc limit 1) last,
 (select count(*) from public.messages m where m.sender_id=t.peer_id and m.recipient_id=t.owner_id and m.status='ready' and m.read_at is null and (m.expires_at is null or m.expires_at>now())) unread
 from public.chat_threads t left join public.profiles p on p.id=t.peer_id join auth.users u on u.id=t.peer_id
 where t.owner_id=auth.uid() order by t.last_activity desc limit 500
 ) q;
$$;
create or replace function public.mark_messages(p_ids uuid[],p_read boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or cardinality(p_ids)>150 then raise exception 'Invalid receipt'; end if;
 update public.messages set delivered_at=coalesce(delivered_at,now()),read_at=case when p_read then coalesce(read_at,now()) else read_at end
 where id=any(p_ids) and recipient_id=auth.uid() and status='ready' and (expires_at is null or expires_at>now());
end $$;
create or replace function public.delete_text_message(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.messages where id=p_id and sender_id=auth.uid() and status='ready' and media_kind is null and media_path is null;
 if not found then raise exception 'Only your own text messages can be deleted'; end if;
end $$;

create table if not exists public.chat_profile_cards (
 owner_id uuid references auth.users(id) on delete cascade,peer_id uuid references auth.users(id) on delete cascade,
 envelopes jsonb not null,updated_at timestamptz not null default now(), primary key(owner_id,peer_id)
);
alter table public.chat_profile_cards enable row level security;
drop policy if exists "Profile card participants" on public.chat_profile_cards;
create policy "Profile card participants" on public.chat_profile_cards for select to authenticated using(auth.uid() in(owner_id,peer_id) and not exists(select 1 from public.blocked_contacts b where (b.owner_id=auth.uid() and b.peer_id=chat_profile_cards.owner_id) or (b.owner_id=chat_profile_cards.owner_id and b.peer_id=auth.uid())));
revoke insert,update,delete on public.chat_profile_cards from authenticated,anon;
create or replace function public.set_chat_profile(p_peer uuid,p_envelopes jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_chat_envelopes(p_peer,p_envelopes);
 insert into public.chat_profile_cards(owner_id,peer_id,envelopes) values(auth.uid(),p_peer,p_envelopes)
 on conflict(owner_id,peer_id) do update set envelopes=excluded.envelopes,updated_at=now();
end $$;

create table if not exists public.push_devices (
 user_id uuid primary key references auth.users(id) on delete cascade, token text not null unique,
 updated_at timestamptz not null default now(),check(length(token)<250)
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from authenticated,anon;
create or replace function public.register_push(p_token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid push token'; end if;
 delete from public.push_devices where token=p_token and user_id<>auth.uid();
 insert into public.push_devices(user_id,token) values(auth.uid(),p_token) on conflict(user_id) do update set token=excluded.token,updated_at=now();
end $$;
create or replace function public.unregister_push() returns void language sql security definer set search_path='' as $$ delete from public.push_devices where user_id=auth.uid(); $$;
create table if not exists public.push_outbox (
 message_id uuid primary key references public.messages(id) on delete cascade,
 created_at timestamptz not null default now(),sent_at timestamptz,attempts integer not null default 0
);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from authenticated,anon;
create or replace function public.queue_message_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='ready' and (TG_OP='INSERT' or old.status='uploading') then
  insert into public.push_outbox(message_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists queue_message_push on public.messages;
create trigger queue_message_push after insert or update of status on public.messages for each row execute function public.queue_message_push();
revoke all on function public.chat_threads_list(),public.mark_messages(uuid[],boolean),public.delete_text_message(uuid),public.set_chat_profile(uuid,jsonb),public.register_push(text),public.unregister_push() from public,anon;
grant execute on function public.chat_threads_list(),public.mark_messages(uuid[],boolean),public.delete_text_message(uuid),public.set_chat_profile(uuid,jsonb),public.register_push(text),public.unregister_push() to authenticated;
-- Instant foreground refresh when Supabase Realtime is configured; polling remains a fallback.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
end $$;
grant select on public.chat_threads,public.chat_profile_cards to authenticated;
create or replace function public.chat_expiry_warning(p_peer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages where status='ready' and media_kind in('image','video') and expires_at>now() and expires_at<=now()+interval '1 hour'
 and ((sender_id=auth.uid() and recipient_id=p_peer) or (recipient_id=auth.uid() and sender_id=p_peer)));
$$;
revoke all on function public.chat_expiry_warning(uuid) from public,anon;
grant execute on function public.chat_expiry_warning(uuid) to authenticated;
alter table public.push_outbox add column if not exists processing_until timestamptz;

alter table public.push_outbox add column if not exists expo_ticket text;
alter table public.push_outbox add column if not exists last_error text;
