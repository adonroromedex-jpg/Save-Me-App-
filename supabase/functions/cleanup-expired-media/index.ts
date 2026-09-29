import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// Deploy as a scheduled Edge Function. Only a service-role bearer token may run it.
Deno.serve(async request => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !url) return new Response('Missing server configuration', { status: 500 });
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  let deleted = 0;
  try {
    for (let page = 0; page < 100; page++) {
      const { data, error } = await db.from('messages').select('id,media_path,media_parts')
        .lt('expires_at', new Date().toISOString()).order('expires_at').limit(100);
      if (error) throw error;
      if (!data?.length) break;
      for (const row of data) {
        if (row.media_path) {
          const removal = await db.storage.from('chat-media').remove(row.media_parts ? Array.from({ length: row.media_parts }, (_, i) => `${row.media_path}/${i}.bin`) : [row.media_path]);
          if (removal.error) throw removal.error;
        }
        const removal = await db.from('messages').delete().eq('id', row.id);
        if (removal.error) throw removal.error;
        deleted++;
      }
    }
    return Response.json({ deleted });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
