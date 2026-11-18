// Authorization isolation regression suite. HTTP-level, against the locally
// running production build (same server as site-integrity). Uses two fully
// synthetic identities with real next-auth v5 JWT session cookies minted with
// the LOCAL test secret - no GitHub calls, no other person's account, no
// network beyond localhost, no production mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';

const BASE = `http://localhost:${process.env.PACKPROOF_TEST_PORT || 3100}`;
const SECRET = process.env.AUTH_SECRET || 'packproof-local-test-secret';
const COOKIE = 'authjs.session-token'; // http localhost => non-secure cookie name
const SLUG = 'pr-review-pass';

async function sessionCookie(sub) {
  const token = { name: 'Synthetic', email: `${sub}@example.invalid`, picture: null };
  if (sub) token.sub = sub;
  const jwt = await encode({ token, secret: SECRET, salt: COOKIE, maxAge: 3600 });
  return `${COOKIE}=${jwt}`;
}

async function call(method, cookie, body) {
  const r = await fetch(BASE + '/api/library', {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method === 'POST' ? { 'content-type': 'application/json', origin: BASE } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

test('cross-user library isolation over real session plumbing', async () => {
  const a = await sessionCookie('pp-synth-user-a');
  const b = await sessionCookie('pp-synth-user-b');

  // unauthenticated is rejected
  assert.equal((await call('GET', null)).status, 401);
  assert.equal((await call('POST', null, { slug: SLUG, saved: true })).status, 401);

  // A saves; A sees it
  assert.equal((await call('POST', a, { slug: SLUG, saved: true })).status, 200);
  let ra = await call('GET', a);
  assert.equal(ra.status, 200);
  assert.ok(ra.json.slugs.includes(SLUG), 'A sees own save');

  // B cannot see A's save
  let rb = await call('GET', b);
  assert.equal(rb.status, 200);
  assert.ok(!rb.json.slugs.includes(SLUG), 'B must not see A save');

  // B unsaving affects only B (no cross-user delete)
  assert.equal((await call('POST', b, { slug: SLUG, saved: false })).status, 200);
  ra = await call('GET', a);
  assert.ok(ra.json.slugs.includes(SLUG), 'A save survives B unsave');

  // Body-supplied userId cannot redirect a write into another user
  assert.equal((await call('POST', b, { slug: SLUG, saved: true, userId: 'pp-synth-user-a' })).status, 200);
  ra = await call('GET', a);
  rb = await call('GET', b);
  assert.ok(rb.json.slugs.includes(SLUG), 'B own save lands');
  assert.equal(ra.json.slugs.filter(s => s === SLUG).length, 1, 'A library unchanged in shape');

  // A unsaves; B unaffected
  assert.equal((await call('POST', a, { slug: SLUG, saved: false })).status, 200);
  ra = await call('GET', a);
  rb = await call('GET', b);
  assert.ok(!ra.json.slugs.includes(SLUG), 'A save removed');
  assert.ok(rb.json.slugs.includes(SLUG), 'B save survives A unsave');

  // cleanup B
  assert.equal((await call('POST', b, { slug: SLUG, saved: false })).status, 200);

  // tampered cookie is rejected, never resolved to a user
  const tampered = a.slice(0, -2) + (a.endsWith('a') ? 'b' : 'a');
  assert.equal((await call('GET', tampered)).status, 401);

  // token without a subject is rejected
  const noSub = await sessionCookie(null);
  assert.equal((await call('GET', noSub)).status, 401);

  console.log(JSON.stringify({ crossUserIsolation: 'ok', syntheticIdentities: 2, realSessionJWT: true, externalOAuth: false }));
});
