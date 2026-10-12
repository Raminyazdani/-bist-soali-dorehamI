import {PostgresStore} from '../lib/postgres-store.mjs';
import {photoRequest} from '../lib/http.mjs';
export const config={maxDuration:30};
export default function handler(req,res) { return photoRequest(req,res,new PostgresStore()); }
