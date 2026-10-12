// Explicit opt-in only: the normal unit suite never loads hosted credentials.
// The ignored Preview env file points at the newly owned free Neon project.
try {
  process.loadEnvFile(new URL('../.env.neon.preview.local',import.meta.url));
  if(!process.env.DATABASE_URL)throw new Error('Missing hosted database');
  process.env.POSTGRES_LIVE_TESTS='1';
  await import('./postgres.test.mjs');
} catch(error) {
  const safe=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value)?value:'UNAVAILABLE';
  console.error(JSON.stringify({status:'failed',kind:safe(error?.constructor?.name),code:safe(error?.code)}));
  process.exitCode=1;
}
