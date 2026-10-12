import {PostgresStore} from '../lib/postgres-store.mjs';
import {imageImportRequest} from '../lib/http.mjs';
export const config = {maxDuration: 30};
export default function handler(req, res) { return imageImportRequest(req, res, new PostgresStore()); }
