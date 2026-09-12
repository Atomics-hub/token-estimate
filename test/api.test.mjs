import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {estimateTokens, fitsWithin, truncateToTokens, splitByTokens, analyze, supportedEncodings} from '../src/index.js';
import {runChecks} from './checks.mjs';

const api = {estimateTokens, fitsWithin, truncateToTokens, splitByTokens, analyze, supportedEncodings};
const fixtures = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/expected.json', import.meta.url)), 'utf8'));

test('shared behavioural checks', () => {
  assert.deepEqual(runChecks(api), {checks: 13});
});

test('estimates stay close to the real tokenizer on recorded fixtures', () => {
  // The counts in the fixture come from the exact tokenizer. The bound checked here is the one
  // stated in the README; it is deliberately loose enough to be a regression guard rather than a
  // restatement of the calibration.
  const failures = [];
  for (const encoding of Object.keys(fixtures.encodings)) {
    for (const [name, text] of Object.entries(fixtures.samples)) {
      const actual = fixtures.encodings[encoding][name];
      const ratio = estimateTokens(text, {encoding}) / actual;
      if (ratio < 0.55 || ratio > 1.75) failures.push(`${encoding}/${name} ${(ratio * 100).toFixed(0)}%`);
    }
  }
  assert.deepEqual(failures, []);
});

test('safe mode is at or above the plain estimate on every fixture', () => {
  const failures = [];
  for (const encoding of Object.keys(fixtures.encodings)) {
    for (const [name, text] of Object.entries(fixtures.samples)) {
      if (estimateTokens(text, {encoding, mode: 'safe'}) < estimateTokens(text, {encoding})) failures.push(`${encoding}/${name}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('safe mode reaches the true count on most fixtures', () => {
  // Stated as a rate, not a guarantee, because it is an estimator. These fixtures are deliberately
  // adversarial — base64 spliced into source, camelCase runs, accented prose, JWTs — so the rate
  // here is lower than on ordinary text, where it is around 93%. The README quotes the measured
  // held-out figure rather than this one.
  for (const encoding of Object.keys(fixtures.encodings)) {
    const names = Object.keys(fixtures.samples);
    const covered = names.filter(name =>
      estimateTokens(fixtures.samples[name], {encoding, mode: 'safe'}) >= fixtures.encodings[encoding][name]).length;
    assert.ok(covered / names.length >= 0.75, `${encoding}: safe mode covered only ${covered} of ${names.length}`);
  }
});

test('opaque text is charged far more than prose of the same length', () => {
  const prose = 'the quick brown fox jumps over the lazy dog '.repeat(10);
  const blob = Buffer.from(prose).toString('base64');
  const proseRate = estimateTokens(prose) / prose.length;
  const blobRate = estimateTokens(blob) / blob.length;
  assert.ok(blobRate > proseRate * 2, `expected opaque text to cost much more per character (${blobRate} vs ${proseRate})`);
});

test('whitespace is cheap', () => {
  // A long run of indentation is close to free; charging it per character is how estimates drift.
  const indented = Array.from({length: 40}, (_, i) => ' '.repeat(20) + `value${i} = ${i};`).join('\n');
  const stripped = indented.replace(/^ +/gm, '');
  assert.ok(estimateTokens(indented) < estimateTokens(stripped) * 1.6);
});

test('scripts other than Latin cost more per character', () => {
  const latin = 'this is a sentence of ordinary english text here';
  const greek = 'αυτό είναι ένα κείμενο στα ελληνικά';
  assert.ok(estimateTokens(greek) / greek.length > estimateTokens(latin) / latin.length);
});

test('truncateToTokens keeps a prefix within budget', () => {
  const text = 'word '.repeat(400);
  const result = truncateToTokens(text, 50);
  assert.equal(result.truncated, true);
  assert.ok(result.estimatedTokens <= 50);
  assert.ok(text.startsWith(result.text));
  assert.equal(truncateToTokens('', 10).estimatedTokens, 0);
});

test('splitByTokens is lossless and bounded', () => {
  const text = Array.from({length: 200}, (_, i) => `line ${i} with some words`).join('\n');
  const pieces = splitByTokens(text, 40);
  assert.equal(pieces.join(''), text);
  assert.ok(pieces.length > 3);
  for (const piece of pieces.slice(0, -1)) {
    assert.ok(estimateTokens(piece, {mode: 'safe'}) <= 40 * 1.5, 'pieces should be near the budget');
  }
});

test('a single chunk larger than the budget still makes progress', () => {
  const giant = 'a'.repeat(5000);
  const pieces = splitByTokens(giant, 5);
  assert.equal(pieces.join(''), giant);
  assert.ok(pieces.length >= 1);
});

test('analyze accounts for the whole string', () => {
  const text = 'const a = 1; // 日本語 and \u{1F389}\n\n   done';
  const features = analyze(text);
  const counted = features.wordChars + features.opaqueChars + features.digitChars + features.punctChars +
    features.newlineChars + features.spaceChars + features.cjkChars + features.otherScriptChars;
  assert.ok(counted > 0 && counted <= text.length + features.astralUnits * 2);
  assert.ok(features.astralUnits >= 1, 'the emoji should be counted');
  assert.ok(features.cjkChars >= 3, 'the Japanese should be counted');
  assert.deepEqual(analyze(''), analyze(''));
});

test('unicode survives every entry point', () => {
  for (const text of ['héllo wörld', '日本語', 'emoji \u{1F389} here', 'русский']) {
    assert.ok(estimateTokens(text) >= 1);
    assert.equal(truncateToTokens(text, 1000).text, text);
    assert.equal(splitByTokens(text, 1000).join(''), text);
  }
});

test('options are validated', () => {
  assert.throws(() => estimateTokens('x', null), TypeError);
  assert.throws(() => estimateTokens('x', {encoding: 'gpt2'}), TypeError);
  assert.throws(() => estimateTokens('x', {mode: 'exact'}), TypeError);
  assert.throws(() => analyze(7), TypeError);
  assert.throws(() => fitsWithin('x', 'ten'), TypeError);
  assert.throws(() => splitByTokens('x', 0), RangeError);
  assert.throws(() => truncateToTokens('x', Number.NaN), TypeError);
});

test('the two encodings disagree, as they should', () => {
  const text = '日本語のテキストです。'.repeat(10);
  assert.notEqual(estimateTokens(text, {encoding: 'o200k_base'}), estimateTokens(text, {encoding: 'cl100k_base'}));
});

test('estimating a large input stays fast', () => {
  const text = readFileSync(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8').repeat(20);
  const started = Date.now();
  for (let i = 0; i < 20; i++) estimateTokens(text);
  assert.ok(Date.now() - started < 5000, 'twenty passes over a large input should take under five seconds');
});
