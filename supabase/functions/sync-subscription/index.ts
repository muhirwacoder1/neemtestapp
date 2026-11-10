import { createClient } from 'npm:@supabase/supabase-js@2';
const headers = { 'Content-Type':'application/json','Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN') || 'http://localhost:8081','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type' };
const reply = (status: number,data: unknown) => new Response(JSON.stringify(data),{ status,headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{ headers });
  if (req.method !== 'POST') return reply(405,{ error:'Method not allowed' });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply(401,{ error:'Sign in first.' });
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{ global:{ headers:{ Authorization:authorization } } });
  const { data:{ user },error } = await client.auth.getUser();
  if (error || !user) return reply(401,{ error:'Sign in first.' });
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return reply(503,{ error:'Store verification is not configured.' });
  try {
    const result = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,{ headers:{ Authorization:`Bearer ${key}` },signal:AbortSignal.timeout(15000) });
    if (!result.ok) return reply(503,{ error:'Store verification is temporarily unavailable.' });
    const response = await result.json();
    const entitlement = response.subscriber?.entitlements?.[Deno.env.get('REVENUECAT_ENTITLEMENT') || 'neem_premium'];
    const expiresAt = entitlement?.expires_date;
    const active = typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profiles,error: profileError } = await admin.from('profiles').select('id').eq('owner_id',user.id);
    if (profileError) return reply(503,{ error:'Profile verification is unavailable.' });
    if (profiles?.length) {
      const { error: saveError } = await admin.from('subscriptions').upsert(profiles.map(p => ({ id:`revenuecat-${p.id}`,profile_id:p.id,status:active ? 'active' : 'expired',provider:'revenuecat',expires_at:active ? expiresAt : new Date().toISOString(),updated_at:new Date().toISOString() })));
      if (saveError) return reply(503,{ error:'Entitlement verification could not be saved.' });
    }
    return reply(200,{ active });
  } catch { return reply(503,{ error:'Store verification is temporarily unavailable.' }); }
});
