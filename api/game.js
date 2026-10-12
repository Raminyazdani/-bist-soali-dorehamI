import {PostgresStore} from '../lib/postgres-store.mjs';
import {gameRequest} from '../lib/http.mjs';
export const config={maxDuration:30};
export default function handler(req,res) { return gameRequest(req,res,new PostgresStore()); }
