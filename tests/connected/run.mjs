// IBVU v6.0 — new file. Runs the connected-site check: "npm run test:connected".
// 1. builds the site pointed at a stand-in database (nothing real is touched)
// 2. starts the stand-in database and the built site on this computer
// 3. runs check.mjs and prints PASS or FAIL for each step
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { check } from './check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(root, 'dist-connected-test');

const env = { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:4400', VITE_SUPABASE_ANON_KEY: 'anon-test-key', VITE_TURNSTILE_SITE_KEY: 'test-site-key', VITE_SENTRY_DSN: '' };
console.log('Building the connected site against the stand-in database…');
execSync('npx vite build --outDir "' + out + '" --emptyOutDir', { cwd: root, env, stdio: 'ignore' });

const mock = spawn(process.execPath, [join(here, 'mock-supabase.cjs')], { env: { ...process.env, PORT: '4400' }, stdio: 'ignore' });
const site = spawn('npx', ['vite', 'preview', '--outDir', out, '--host', '127.0.0.1', '--port', '4320', '--strictPort'], { cwd: root, stdio: 'ignore' });
const stop = () => { try { mock.kill(); } catch {} try { site.kill(); } catch {} };

async function waitFor(url) {
  for (let i = 0; i < 60; i++) { try { await fetch(url); return; } catch { await new Promise(r => setTimeout(r, 500)); } }
  throw new Error('Could not start ' + url);
}

try {
  await waitFor('http://127.0.0.1:4400/__db');
  await waitFor('http://127.0.0.1:4320/');
  const results = await check();
  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  stop();
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(err);
  stop();
  process.exit(1);
}
