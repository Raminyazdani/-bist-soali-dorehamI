import {defineConfig} from 'vite';
import {execFileSync} from 'node:child_process';

const supplied = process.env.VERCEL_GIT_COMMIT_SHA;
let revision = typeof supplied === 'string' && /^[0-9a-f]{40}$/i.test(supplied) ? supplied.toLowerCase() : null;
if (!revision) {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); }
  catch { revision = 'development'; }
}
const version = /^[0-9a-f]{40}$/i.test(revision) ? revision.slice(0, 12) : 'development';

export default defineConfig({
  define: {'import.meta.env.VITE_APP_VERSION': JSON.stringify(version)},
  plugins: [{
    name: 'public-build-version',
    generateBundle() { this.emitFile({type: 'asset', fileName: 'version.json', source: JSON.stringify({version})}); }
  }]
});
