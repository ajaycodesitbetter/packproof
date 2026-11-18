// Site integrity regression suite. HTTP-level tests against a locally running
// production build (next start on PACKPROOF_TEST_PORT, default 3100).
// No model calls, no network beyond localhost, no new dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PACKPROOF_TEST_PORT || 3100}`;

async function get(path) {
  const r = await fetch(BASE + path, { redirect: 'manual' });
  const text = await r.text();
  return { status: r.status, headers: r.headers, text };
}

let packs; // loaded once
test.before(async () => {
  const r = await get('/api/packs');
  assert.equal(r.status, 200, '/api/packs must respond');
  packs = JSON.parse(r.text).packs;
});

test('registry has 12 packs with required fields and honest status labels', () => {
  assert.equal(packs.length, 12);
  const allowed = new Set(['Sample report', 'Sample partial', 'Not evaluated']);
  for (const p of packs) {
    assert.ok(p.slug && p.version && p.tagline, `pack fields: ${p.slug}`);
    assert.ok(allowed.has(p.status_label), `${p.slug} status label must be one of the honest three, got ${p.status_label}`);
  }
});

test('every pack download serves real SKILL.md content with matching frontmatter', async () => {
  for (const p of packs) {
    const r = await get(`/api/packs/${p.slug}/download?version=${encodeURIComponent(p.version)}`);
    assert.equal(r.status, 200, `${p.slug} download 200`);
    assert.match(r.headers.get('content-type') || '', /text\/markdown/, `${p.slug} content-type`);
    const cd = r.headers.get('content-disposition') || '';
    assert.ok(cd.includes(p.slug), `${p.slug} attachment filename mentions slug`);
    const fm = r.text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, `${p.slug} has frontmatter`);
    assert.ok(fm[1].includes(`name: ${p.slug}`), `${p.slug} frontmatter name matches`);
    assert.match(fm[1], /description: .{20,}/, `${p.slug} frontmatter has a real description`);
    assert.ok(r.text.length > 500, `${p.slug} body is a real file, not a stub`);
  }
});

test('download rejects a wrong version (version-checked claim)', async () => {
  const r = await get('/api/packs/api-change-safety-net/download?version=9.9.9');
  assert.ok([400, 404, 409].includes(r.status), `wrong version must fail, got ${r.status}`);
  const j = JSON.parse(r.text);
  assert.ok(j.error && j.available === '0.3.1', 'error names the available version');
});

test('download rejects an unknown slug', async () => {
  const r = await get('/api/packs/no-such-pack/download?version=1.0.0');
  assert.equal(r.status, 404);
});

test('pack page preview shows the actual file lines the download serves', async () => {
  const p = packs.find(x => x.slug === 'api-change-safety-net');
  const dl = await get(`/api/packs/${p.slug}/download?version=${p.version}`);
  const firstLine = dl.text.split('\n').find(l => l.startsWith('description:'));
  const page = await get(`/packs/${p.slug}`);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Catch regressions when changing an existing API endpoint'),
    'preview pane carries the real file content');
  assert.ok(firstLine && page.text.length > 1000);
});

const ROUTES = [
  '/', '/skills', '/packs', '/discover', '/method', '/changelog',
  '/categories/Backend', '/categories/Research', '/categories/UI-UX',
  '/packs/api-change-safety-net', '/reports/api-change-safety-net',
  '/skills?job=test-debug', '/skills?job=security-review',
  '/skills?task=Video%20%26%20motion', // legacy mapping must keep working
  '/skills?task=Code%20%26%20testing', // legacy
  '/skills?q=api', '/packs?q=migration', '/packs?category=Backend',
];
test('all routes and filter/legacy variants return 200', async () => {
  for (const path of ROUTES) {
    const r = await get(path);
    assert.equal(r.status, 200, `${path} -> ${r.status}`);
    assert.ok(r.text.length > 2000, `${path} renders real content`);
  }
});

test('unknown routes 404', async () => {
  for (const path of ['/packs/nope', '/categories/Nope', '/reports/nope', '/nope']) {
    const r = await get(path);
    assert.equal(r.status, 404, `${path} should 404`);
  }
});

test('job filter counts sum to the full 19-workflow population', async () => {
  let total = 0;
  for (const job of ['build-app','design-ui','video','review-secure','security','test-debug','research-write','documents','data-ml']) {
    const r = await get(`/skills?job=${job}`);
    assert.equal(r.status, 200, `job ${job}`);
    const text = r.text.replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
    const m = text.match(/(\d+)\s+match/);
    if (m) {
      total += parseInt(m[1], 10);
    } else {
      assert.ok(/No matching workflow yet/.test(text), `job ${job}: either a count or the honest empty state`);
    }
  }
  assert.equal(total, 19, 'job counts must cover packs + upstream picks');
});

test('legacy ?task= URLs map onto the job vocabulary', async () => {
  const r = await get('/skills?task=Video%20%26%20motion');
  assert.equal(r.status, 200);
  const m = r.text.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, ' ').match(/(\d+)\s+match/);
  assert.ok(m && parseInt(m[1], 10) > 0, 'legacy task URL yields results');
});

test('catalog search finds workflows by plain words', async () => {
  const r = await get('/api/search?q=caption');
  assert.equal(r.status, 200);
  const j = JSON.parse(r.text);
  const flat = JSON.stringify(j);
  assert.ok(/caption/i.test(flat), 'caption query finds the caption workflow');
});

// Honesty checks are context-aware: exact claim strings that must appear or
// must never appear - not blanket word bans, since disclaimers legitimately
// use words like "tested" in negations.
const HONEST_PAGES = ['/', '/skills', '/packs', '/packs/api-change-safety-net', '/reports/api-change-safety-net'];
const FORBIDDEN = [
  /0 real runs/i,
  /NO REAL RUNS EXECUTED/,
  /Tested - sample/i,
  /benchmark-validated/i,
  /production-ready/i,
  /No benchmark runs happened;/i, // unscoped variant; must be scoped to the sample
];
test('pages keep honest evidence framing', async () => {
  for (const path of HONEST_PAGES) {
    const r = await get(path);
    for (const re of FORBIDDEN) {
      assert.ok(!re.test(r.text), `${path} must not contain ${re}`);
    }
  }
});

test('sample evidence is labeled wherever it appears', async () => {
  const report = await get('/reports/api-change-safety-net');
  assert.ok(/staged demo report/i.test(report.text), 'report says staged demo');
  assert.ok(/SAMPLE DATA/i.test(report.text), 'report carries sample stamps');
  assert.ok(/Staged example scenario/i.test(report.text), 'failure narrative labeled staged');
  const pack = await get('/packs/api-change-safety-net');
  assert.ok(/sample history/i.test(pack.text), 'versions panel labeled sample history');
  assert.ok(/not real evaluation results/i.test(pack.text), 'stat labels honest');
});

test('home search goes to the catalog first, not GitHub discover', async () => {
  const home = await get('/');
  assert.ok(/action="\/skills"/.test(home.text), 'home search form targets /skills');
});
