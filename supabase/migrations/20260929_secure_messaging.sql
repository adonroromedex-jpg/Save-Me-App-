-- Run once in the Supabase SQL editor before enabling chat. No service key belongs in the app.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone_e164 text unique,
  updated_at timestamptz not null default now(),
  constraint valid_phone check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

alter table public.profiles enable row level security;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Bound exact-number lookups to reduce account enumeration by authenticated users.
create table if not exists public.contact_lookup_budget (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.contact_lookup_budget enable row level security;

-- Only an exact number selected by the user is looked up. Never download the directory.
create or replace function public.find_contact(p_phone text)
returns table(id uuid, first_name text, last_name text)
language plpgsql volatile security definer set search_path = '' as $$
declare count_attempts integer;
begin
  if (select auth.uid()) is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    return;
  end if;
  insert into public.contact_lookup_budget (user_id, attempts)
  values ((select auth.uid()), 1)
  on conflict (user_id) do update set
    attempts = case when contact_lookup_budget.window_start < now() - interval '1 day'
      then 1 else contact_lookup_budget.attempts + 1 end,
    window_start = case when contact_lookup_budget.window_start < now() - interval '1 day'
      then now() else contact_lookup_budget.window_start end
  returning attempts into count_attempts;
  if count_attempts > 50 then
    raise exception 'Daily contact lookup limit reached';
  end if;
  return query select p.id, p.first_name, p.last_name from public.profiles p
    where p.phone_e164 = p_phone and p.id <> (select auth.uid()) limit 1;
end;
$$;
revoke all on function public.find_contact(text) from public, anon;
grant execute on function public.find_contact(text) to authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text,
  media_path text unique,
  media_kind text check (media_kind in ('image','video')),
  status text not null default 'ready' check (status in ('uploading','ready')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint distinct_users check (sender_id <> recipient_id),
  constraint valid_content check (
    (body is not null and length(body) between 1 and 4000 and media_path is null and media_kind is null and status = 'ready')
    or (body is null and media_path is not null and media_kind is not null and media_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp|mp4|mov)$')
  )
);
create index if not exists messages_participants_idx on public.messages(sender_id, recipient_id, created_at desc);
create index if not exists messages_expiry_idx on public.messages(expires_at) where media_path is not null;

alter table public.messages enable row level security;
create policy "Participants read active ready messages" on public.messages for select to authenticated
  using (expires_at > now() and ((sender_id = (select auth.uid())) or (recipient_id = (select auth.uid()) and status = 'ready')));
create policy "Sender creates active messages" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid())
    and created_at between now() - interval '1 minute' and now() + interval '1 minute'
    and expires_at > now() and expires_at <= now() + interval '24 hours 1 minute'
    and (media_path is null or split_part(media_path, '/', 1) = sender_id::text));
create policy "Sender finishes upload" on public.messages for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'uploading' and expires_at > now())
  with check (sender_id = (select auth.uid()) and status = 'ready' and expires_at > now());
create policy "Sender cancels upload" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()) and status = 'uploading');
revoke update on public.messages from authenticated;
grant update(status) on public.messages to authenticated;

-- A peer's name is visible only after the two users have exchanged a message.
create or replace function public.message_peers()
returns table(id uuid, first_name text, last_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name from public.profiles p
  where (select auth.uid()) is not null and p.id in (
    select case when m.sender_id = (select auth.uid()) then m.recipient_id else m.sender_id end
    from public.messages m
    where (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
      and m.expires_at > now() and m.status = 'ready'
  );
$$;
revoke all on function public.message_peers() from public, anon;
grant execute on function public.message_peers() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants read unexpired chat media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and exists (
    select 1 from public.messages m where m.media_path = name and m.status = 'ready'
      and m.expires_at > now()
      and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  ));
create policy "Sender uploads own pending chat media" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and exists (
    select 1 from public.messages m where m.media_path = name and m.status = 'uploading'
      and m.sender_id = (select auth.uid()) and m.expires_at > now()
  ));
create policy "Sender inspects pending upload" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and exists (
    select 1 from public.messages m where m.media_path = name and m.status = 'uploading'
      and m.sender_id = (select auth.uid()) and m.expires_at > now()
  ));
create policy "Sender cancels pending upload" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and exists (
    select 1 from public.messages m where m.media_path = name and m.status = 'uploading'
      and m.sender_id = (select auth.uid())
  ));

-- The app enforces expiry in the UI and RLS; a scheduled server job must remove expired
-- Storage objects through the Storage API before production. SQL row deletion alone
-- does not delete object bytes.
