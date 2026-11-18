// Read-only HTTP acceptance suite. Never signs in or changes library data.
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3100';
let passed = 0;
async function check(path, status = 200) {
  const r = await fetch(new URL(path, base), {redirect: 'manual'});
  assert.equal(r.status, status, `${path}: HTTP ${r.status}, expected ${status}`);
  passed++; return r;
}
const registry = await (await check('/api/packs')).json();
assert(registry.count > 0 && registry.count === registry.packs.length);
for (const p of registry.packs) {
  assert(p.sample_data === true, `${p.slug}: evidence must remain marked sample`);
  await check(p.links.pack);
  const detail = await (await check(`/api/packs/${p.slug}`)).json();
  assert.equal(detail.slug, p.slug);
  if (p.links.download) {
    const r = await check(p.links.download);
    assert.equal(r.headers.get('x-pack-version'), p.version);
    assert.match(r.headers.get('content-type'), /text\/markdown/);
    assert.match(r.headers.get('content-disposition'), /attachment/);
    const md = await r.text(); assert(md.startsWith('---\n') && md.includes(`name: ${p.slug}`));
    // Version guard is a contract of the prepared release, not old production.
    if (process.env.CHECK_VERSION_GUARD === '1') {
      await check(`/api/packs/${p.slug}/download?version=not-a-release`, 409);
      await check(`/api/packs/${p.slug}/download`); // compatibility with existing URLs
    }
  }
  if (p.links.report) await check(p.links.report);
}
for (const path of ['/', '/packs', '/method', '/changelog', '/categories/Backend', '/categories/UI%2FUX', '/categories/Research', '/signin']) await check(path);
await check('/api/packs/no-such-pack',404);
await check('/api/packs/no-such-pack/download',404);
await check('/packs/no-such-pack',404);
await check('/reports/no-such-pack',404);
await check('/api/packs?category=not-a-category',400);
await check('/api/library',401);
const search = await (await check('/api/search?q=review')).json();
assert(search.results.some(p=>p.slug==='pr-review-pass'));
const empty = await (await check('/api/search?q=unfindable-z9q7')).json(); assert.equal(empty.results.length,0);
console.log(JSON.stringify({base,passedHTTPChecks:passed,packs:registry.count,versionGuardTested:process.env.CHECK_VERSION_GUARD==='1',mutations:0}));
