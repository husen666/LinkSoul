/* eslint-disable no-console */
const API_BASE = process.env.LS_API_BASE || 'http://localhost:3000/api/v1';

function randomPhone() {
  return `13${Math.floor(100000000 + Math.random() * 900000000)}`;
}

async function call(path, method = 'GET', body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.raw || `HTTP ${res.status}`;
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  return data;
}

async function createUser(label) {
  const phone = randomPhone();
  const password = '123456';
  const nickname = `smoke_${label}_${phone.slice(-4)}`;
  await call('/auth/register', 'POST', { phone, password, nickname });
  const login = await call('/auth/login', 'POST', { phone, password });
  return { phone, password, token: login.token, user: login.user };
}

async function main() {
  console.log(`\n[smoke] API base: ${API_BASE}`);
  await call('/health');
  console.log('[ok] health');

  const u1 = await createUser('a');
  const u2 = await createUser('b');
  console.log(`[ok] users: ${u1.user.id.slice(-6)}, ${u2.user.id.slice(-6)}`);

  await call(`/matches/${u2.user.id}/accept`, 'POST', {}, u1.token);
  await call(`/matches/${u1.user.id}/accept`, 'POST', {}, u2.token);
  const matches = await call('/matches', 'GET', undefined, u1.token);
  const accepted = (matches || []).find((m) => m.status === 'ACCEPTED');
  if (!accepted) throw new Error('No ACCEPTED match created for compat-pk smoke');
  console.log(`[ok] accepted match: ${accepted.id.slice(-6)}`);

  const blindbox = await call('/fun/blindbox/open', 'GET', undefined, u1.token);
  console.log(`[ok] blindbox: ${blindbox.nickname || blindbox.userId}`);

  const start = await call(`/fun/compat-pk/${accepted.id}/start`, 'GET', undefined, u1.token);
  if (!Array.isArray(start.questions) || start.questions.length !== 5) {
    throw new Error('compat-pk start did not return 5 questions');
  }
  const answers = ['a', 'b', 'a', 'b', 'a'];
  const result = await call(`/fun/compat-pk/${accepted.id}/result`, 'POST', { answers }, u1.token);
  console.log(`[ok] compat-pk score: ${result.score}`);

  const fortune = await call('/fun/fortune/today', 'GET', undefined, u1.token);
  console.log(`[ok] fortune: ${fortune.luckyColor?.name || 'n/a'}`);

  const soul = await call('/fun/soul-qa/evaluate', 'POST', {
    scores: [[2, 0, 1, 0], [0, 2, 0, 1], [0, 0, 2, 0], [0, 1, 0, 2], [1, 0, 2, 0]],
  }, u1.token);
  console.log(`[ok] soul-qa: ${soul.type}`);

  console.log('\n[done] fun smoke passed');
}

main().catch((err) => {
  console.error(`\n[fail] ${err.message}`);
  process.exit(1);
});
