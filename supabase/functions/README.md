# Supabase Edge Functions

Deploy after linking your dev project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set FLIGHT_API_KEY=...   # AviationStack or similar
npx supabase functions deploy scan-itinerary
npx supabase functions deploy flight-status
```

## Functions

| Function | Called from | Secrets |
|----------|-------------|---------|
| `scan-itinerary` | [`js/app.js`](../js/app.js) `scanItinerary()` | `OPENAI_API_KEY` |
| `flight-status` | [`js/shows.js`](../js/shows.js) `flightTrack()` | `FLIGHT_API_KEY` |

Both require a signed-in user (JWT in `Authorization` header). RLS is not applied to edge functions — they validate the JWT and run server-side only.

Without secrets set, functions return `{ error: 'no_key' }` and the app shows a friendly toast.
