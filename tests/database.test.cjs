const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',e='33333333-3333-4333-8333-333333333333';
const textId='44444444-4444-4444-8444-444444444444',mediaId='55555555-5555-4555-8555-555555555555',voiceId='66666666-6666-4666-8666-666666666666';
const keyA=Buffer.alloc(32,1).toString('base64'),keyB=Buffer.alloc(32,2).toString('base64');
const envelopes={sender_key:keyA,recipient_key:keyB,sender:{v:1,box:'fixture'},recipient:{v:1,box:'fixture'}};
test('migration and RLS enforce sender dates, encrypted access, PIN lockout, blocks and retention',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create schema storage; create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,created_at timestamptz default now());
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated;
 grant select,insert,delete,update on storage.objects to authenticated;
 alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
 -- PGlite has no pgcrypto. These deterministic fixtures test SQL control flow ONLY,
 -- not password hashing security. Production uses pgcrypto bcrypt without substitution.
 create function extensions.gen_salt(text,integer) returns text language sql as $$select 'fixture'::text$$;
 create function extensions.crypt(text,text) returns text language sql as $$select md5($1)$$;
 insert into auth.users(id,email_confirmed_at) values('${a}',now()),('${b}',now()),('${e}',now());`);
 for(const name of ['20260929_secure_messaging.sql','20260929_repair_profiles_and_media_limits.sql','20260929_encrypted_exchange.sql']){
  const sql=fs.readFileSync(`supabase/migrations/${name}`,'utf8').replace('create extension if not exists pgcrypto with schema extensions;','');
  await db.exec(sql);
 }
 const as=async id=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);};
 const rpc=async(name,args=[])=>{const placeholders=args.map((_,i)=>`$${i+1}`).join(',');return (await db.query(`select public.${name}(${placeholders}) as result`,args)).rows[0].result;};
 await as(a);assert.equal(await rpc('register_chat_key',[keyA]),keyA);
 assert.equal(await rpc('register_chat_key',[keyB]),keyA,'identity cannot be silently replaced');
 await as(b);await rpc('register_chat_key',[keyB]);
 await as(a);await rpc('send_encrypted_text',[textId,b,envelopes]);
 let text=(await db.query('select * from messages where id=$1',[textId])).rows[0];assert.equal(text.body,null);assert.equal(text.expires_at,null);
 await assert.rejects(db.query('update messages set expires_at=now()+interval \'1 year\' where id=$1',[textId]),/permission denied/);
 const path=await rpc('stage_encrypted_media',[mediaId,b,'image',1,envelopes,'123456']);
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['chat-media',`${path}/0.bin`]);
 await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['chat-media',`${path}/000.bin`]),/row-level security/);
 await rpc('finish_encrypted_media',[mediaId]);
 const media=(await db.query('select * from messages where id=$1',[mediaId])).rows[0];
 assert.equal(new Date(media.expires_at)-new Date(media.created_at),86400000);
 await assert.rejects(db.query('select * from media_secrets'),/permission denied/);
 await as(e);assert.equal((await db.query('select * from messages')).rows.length,0);assert.equal((await rpc('unlock_media',[mediaId,'123456'])).error,'expired');
 assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await as(b);
 for(let i=0;i<5;i++)assert.equal((await rpc('unlock_media',[mediaId,'000000'])).error,'wrong_code');
 assert.equal((await rpc('unlock_media',[mediaId,'123456'])).error,'locked');
 await db.exec('reset role');await db.query('update media_unlock_attempts set blocked_until=now()-interval \'1 second\'');
 await as(b);assert.equal((await rpc('unlock_media',[mediaId,'000000'])).error,'wrong_code');
 assert.deepEqual((await rpc('unlock_media',[mediaId,'123456'])).envelopes,envelopes);
 await db.query('insert into blocked_contacts(owner_id,peer_id) values($1,$2)',[b,a]);
 assert.equal((await rpc('authorize_media',[mediaId])).error,'blocked');
 await as(a);await assert.rejects(rpc('send_encrypted_text',['77777777-7777-4777-8777-777777777777',b,envelopes]),/Contact unavailable/);
 await as(b);await db.query('delete from blocked_contacts where owner_id=$1',[b]);
 await as(a);const voicePath=await rpc('stage_encrypted_media',[voiceId,b,'audio',1,envelopes,null]);
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['chat-media',`${voicePath}/0.bin`]);await rpc('finish_encrypted_media',[voiceId]);
 assert.equal((await db.query('select expires_at from messages where id=$1',[voiceId])).rows[0].expires_at,null);
 await as(b);assert.ok((await rpc('unlock_media',[voiceId,null])).envelopes);
 await db.exec('reset role');await db.query("update messages set expires_at=now()-interval '1 second' where id=$1",[mediaId]);
 await as(b);assert.equal((await rpc('unlock_media',[mediaId,'123456'])).error,'expired');
 assert.equal((await db.query('select * from messages where id=$1',[mediaId])).rows.length,0);
 assert.equal((await db.query('select * from storage.objects where name=$1',[`${path}/0.bin`])).rows.length,0);
 assert.equal((await db.query('select * from messages')).rows.length,2,'text and voice survive photo expiry');
 await db.exec('reset role');
 await db.exec(fs.readFileSync('supabase/migrations/20260929_encrypted_exchange.sql','utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
 }finally{await db.close();}
});
