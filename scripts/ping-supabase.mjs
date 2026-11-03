// Keep-alive: a free Supabase project is paused after a week without activity, which takes the
// synchronisation down. This runs one tiny read so the database counts as active, and fails
// loudly (GitHub then notifies the owner) when the project cannot be reached at all.
// Secret values are never printed.
const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.log('::warning::Supabase secrets missing: nothing to keep awake.');
  process.exit(0);
}

const host = new URL(url).host;
try {
  const response = await fetch(`${url}/rest/v1/couples?select=code&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    console.log(`::error::Supabase answered HTTP ${response.status}.`);
    process.exit(1);
  }
  console.log(`::notice::Supabase reachable (${host}), database pinged.`);
} catch (cause) {
  const reason = cause instanceof Error ? (cause.cause?.code ?? cause.message) : String(cause);
  console.log(
    `::error::Supabase unreachable (${reason}). The project is probably paused: ` +
      'restore it from the Supabase dashboard (Project > Restore project).',
  );
  process.exit(1);
}
