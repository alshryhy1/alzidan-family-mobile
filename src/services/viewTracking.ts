const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export async function trackAppView(path: string) {
  if (!supabaseUrl || !supabaseAnonKey) return;

  const normalized = String(path || '').trim();
  if (!normalized) return;

  await fetch(`${supabaseUrl}/rest/v1/rpc/site_track_view_v1`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_path: normalized }),
  }).catch(() => undefined);
}
