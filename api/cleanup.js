import {PostgresStore} from '../lib/postgres-store.mjs';
import {cleanupRequest} from '../lib/http.mjs';
export const config={maxDuration:60};
export default function handler(req,res) { return cleanupRequest(req,res,new PostgresStore()); }
