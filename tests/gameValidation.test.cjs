const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the pure validation module without loading React Native in Node.
const source = fs.readFileSync(path.join(__dirname, '../utils/gameValidation.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const validation = { exports: {} };
new Function('exports', 'module', compiled)(validation.exports, validation);
const { validGameDate, validStrokes } = validation.exports;

test('calendar dates reject impossible dates and preserve leap days', () => {
  for (const date of ['2024-02-29', '2026-10-22', '2026-12-31']) assert.equal(validGameDate(date), true, date);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-1-01', '10/22/2026', '', '0099-01-01']) {
    assert.equal(validGameDate(date), false, date);
  }
});

test('calendar date ordering puts games in date order rather than entry order', () => {
  const dates = ['2026-01-01', '2025-12-31', '2026-10-02', '2026-02-10'];
  assert.deepEqual(dates.sort().reverse(), ['2026-10-02', '2026-02-10', '2026-01-01', '2025-12-31']);
});

test('scores accept positive whole strokes and reject invalid input', () => {
  for (const score of ['1', '72', '999', ' 84 ']) assert.equal(validStrokes(score), true, score);
  for (const score of ['', ' ', '0', '-1', '7.5', '1e2', '1000', 'NaN', '72abc']) {
    assert.equal(validStrokes(score), false, score);
  }
});
