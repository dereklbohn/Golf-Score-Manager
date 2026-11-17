const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function load(result, previous) {
  let requests = 0;
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const context = {
    exports: {}, AbortSignal, Date,
    require: (id) => {
      if (id.endsWith('/https')) return { onCall: (_, handler) => handler, HttpsError };
      if (id.endsWith('/params')) return { defineSecret: () => ({ value: () => 'server-secret' }) };
      if (id.endsWith('/app')) return { initializeApp() {} };
      if (id.endsWith('/firestore')) return {
        Timestamp: { fromMillis: (n) => n },
        getFirestore: () => ({ doc: () => ({}), runTransaction: (fn) => fn({ get: async () => ({ data: () => previous }), set() {} }) }),
      };
      throw new Error(id);
    },
    fetch: async (_, options) => {
      requests++;
      assert.equal(options.headers['x-goog-api-key'], 'server-secret');
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }) };
    },
  };
  vm.runInNewContext(readFileSync(require('node:path').join(__dirname, '../functions/index.js'), 'utf8'), context);
  return { scan: context.exports.scanScorecard, requests: () => requests };
}
test('recognition requires login and rejects invalid image before provider call', async () => {
  const api = load({});
  await assert.rejects(api.scan({ data: { image: 'aaaa' } }), { code: 'unauthenticated' });
  await assert.rejects(api.scan({ auth: { uid: 'u' }, data: { image: 'bad data' } }), { code: 'invalid-argument' });
  assert.equal(api.requests(), 0);
});
test('blank scorecards return no players without creating game records', async () => {
  const api = load({ course: 'Bent Creek', notes: 'Blank card', players: [] });
  const result = await api.scan({ auth: { uid: 'u' }, data: { image: 'aaaa' } });
  assert.equal(result.players.length, 0);
  assert.equal(api.requests(), 1);
});
test('invalid provider scores cannot reach review as recognized data', async () => {
  const api = load({ course: 'Bent Creek', notes: '', players: [{ name: 'Smith J', holes: Array(18).fill(4), total: -5 }] });
  await assert.rejects(api.scan({ auth: { uid: 'u' }, data: { image: 'aaaa' } }), { code: 'unavailable' });
});
test('partial rounds preserve unread holes and gross total', async () => {
  const holes = [...Array(9).fill(4), ...Array(9).fill(null)];
  const api = load({ course: 'Bent Creek', notes: 'Nine holes only', players: [{ name: 'Smith J', holes, total: 36 }] });
  const result = await api.scan({ auth: { uid: 'u' }, data: { image: 'aaaa' } });
  assert.equal(result.players[0].total, 36);
  assert.equal(result.players[0].holes[9], null);
});
test('daily limit rejects provider requests', async () => {
  const api = load({}, { day: new Date().toISOString().slice(0, 10), count: 50 });
  await assert.rejects(api.scan({ auth: { uid: 'u' }, data: { image: 'aaaa' } }), { code: 'resource-exhausted' });
  assert.equal(api.requests(), 0);
});
