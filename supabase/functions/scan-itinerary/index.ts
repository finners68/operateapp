import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const FIELD_PROMPT = `Extract touring/show itinerary fields from this image. Return ONLY valid JSON with these optional string keys (omit if not visible):
setTime, endTime, venueAddress, city, soundcheck, curfew, doors, stage, guestlist, catering, dressingRoom, parking, wifi, remarks, hotelName, hotelAddress, hotelCheckin, driverName, driverPhone`;

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
  const { data: rateOk } = await supabase.rpc('rate_ok', { p_kind: 'scan_itinerary', p_limit: 40, p_window: '24 hours' });
  if (rateOk === false) return jsonResponse({ error: 'rate_limited' }, 429);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return jsonResponse({ error: 'no_key' });

  let body: { image?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const image = body.image || '';
  if (!image.startsWith('data:')) return jsonResponse({ error: 'bad_image' }, 400);
  if (image.length > 8_000_000) return jsonResponse({ error: 'image_too_large' }, 413);  // ~6MB image

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: FIELD_PROMPT },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      await res.text().catch(() => '');   // drain; do not leak upstream error text to clients
      return jsonResponse({ error: 'openai_failed' }, 502);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let fields: Record<string, string> = {};
    try { fields = JSON.parse(raw); } catch { fields = {}; }

    return jsonResponse({ fields });
  } catch {
    return jsonResponse({ error: 'scan_failed' }, 502);
  }
});
