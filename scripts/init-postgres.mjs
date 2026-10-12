import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';

// Supply an ignored local env file explicitly, or use deployment DATABASE_URL.
// Schema creation is idempotent; this script never resets or deletes data.
try {
  if(process.argv[2])process.loadEnvFile(process.argv[2]);
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  const sql=neon(process.env.DATABASE_URL);
  const schema=await readFile(new URL('./postgres-schema.sql',import.meta.url),'utf8');
  const statements=schema.split(';').map(text=>text.trim()).filter(Boolean);
  await sql.transaction(statements.map(text=>sql.query(text)));
  console.log(JSON.stringify({schema:'forehead_v3',statements:statements.length,status:'ready'}));
} catch(error) {
  const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value)?value:'UNAVAILABLE';
  console.error(JSON.stringify({status:'failed',kind:identifier(error?.constructor?.name),code:identifier(error?.code)}));
  process.exitCode=1;
}
