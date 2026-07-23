import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return jsonResponse({ error: 'unauthorized' }, 401);

  // Rate limit (migration 003). Fail-open if the RPC isn't deployed yet.
  const { data: rateOk } = await supabase.rpc('rate_ok', { p_kind: 'flight_status', p_limit: 60, p_window: '1 hour' });
  if (rateOk === false) return jsonResponse({ error: 'rate_limited', found: false }, 429);

  const apiKey = Deno.env.get('FLIGHT_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'no_key', found: false });

  let body: { flight?: string; date?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const flight = (body.flight || '').replace(/\s+/g, '').toUpperCase();
  const date = body.date || '';
  if (!flight) return jsonResponse({ error: 'missing_flight', found: false }, 400);

  // AviationStack free tier — set FLIGHT_API_KEY to your access key
  const url = new URL('http://api.aviationstack.com/v1/flights');
  url.searchParams.set('access_key', apiKey);
  url.searchParams.set('flight_iata', flight);
  if (date) url.searchParams.set('flight_date', date);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const row = data?.data?.[0];
    if (!row) return jsonResponse({ found: false });

    const dep = row.departure || {};
    const delayMin = dep.delay ?? null;
    return jsonResponse({
      found: true,
      status: row.flight_status || '',
      terminal: dep.terminal || '',
      gate: dep.gate || '',
      delay: delayMin != null ? `${delayMin} min` : '',
    });
  } catch {
    return jsonResponse({ error: 'upstream_failed', found: false }, 502);
  }
});
