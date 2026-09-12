import assert from 'node:assert/strict';

// Shared behavioural checks, used by the unit tests and by the packed-consumer test in both module
// systems, so the published artifact is held to the same behaviour as the source.
export function runChecks({estimateTokens, fitsWithin, truncateToTokens, splitByTokens, analyze, supportedEncodings}) {
  let checks = 0;

  // A short English sentence is a handful of tokens, not a character count.
  const sentence = 'The build finished with no errors.';
  const plain = estimateTokens(sentence);
  assert.ok(plain > 3 && plain < 14, `expected a handful of tokens, got ${plain}`); checks++;

  // Opaque text costs far more per character than prose of the same length. This is the case a
  // characters-per-token ratio gets badly wrong.
  const prose = 'the quick brown fox jumps over the lazy dog and then rests '.repeat(6);
  const blob = Buffer.from(prose).toString('base64');
  assert.ok(estimateTokens(blob) > estimateTokens(prose),
    'base64 must cost more than the prose it encodes'); checks++;

  // Empty input costs nothing; every non-empty input costs at least one token.
  assert.equal(estimateTokens(''), 0);
  assert.ok(estimateTokens('a') >= 1); checks++;

  // The estimate grows as text is added.
  let previous = 0;
  for (const size of [1, 10, 100, 1000]) {
    const value = estimateTokens('word '.repeat(size));
    assert.ok(value > previous, 'more text must not cost fewer tokens');
    previous = value;
  }
  checks++;

  // The safe mode sits at or above the plain estimate, which is the whole point of it.
  for (const text of [sentence, prose, blob, '日本語のテキスト', '   ', '{"a":1}']) {
    assert.ok(estimateTokens(text, {mode: 'safe'}) >= estimateTokens(text),
      `safe mode must not fall below the estimate for ${JSON.stringify(text.slice(0, 20))}`);
  }
  checks++;

  // Both encodings are available and give their own answer.
  assert.deepEqual(supportedEncodings(), ['o200k_base', 'cl100k_base']); checks++;
  assert.ok(estimateTokens(prose, {encoding: 'cl100k_base'}) > 0); checks++;

  // fitsWithin uses the conservative mode, so it is at least as cautious as the plain estimate.
  assert.equal(fitsWithin(sentence, 1000), true);
  assert.equal(fitsWithin(prose, 2), false); checks++;

  // Truncation never exceeds the budget and never splits a character.
  const emoji = '\u{1F389}\u{1F680}\u{1F4A1}'.repeat(60);
  for (const budget of [1, 5, 40]) {
    const result = truncateToTokens(emoji, budget);
    assert.ok(result.estimatedTokens <= budget, 'truncation must respect the budget');
    assert.equal(result.text.includes('�'), false);
    assert.equal(Buffer.from(result.text, 'utf8').toString('utf8'), result.text, 'no broken surrogate pair');
    assert.ok(emoji.startsWith(result.text), 'truncation keeps a prefix');
  }
  assert.equal(truncateToTokens('short', 10000).truncated, false); checks++;

  // Splitting is lossless: the pieces join back into exactly the input.
  for (const text of [prose, blob, sentence]) {
    const pieces = splitByTokens(text, 25);
    assert.equal(pieces.join(''), text, 'joining the pieces must restore the input');
    assert.ok(pieces.length > 0);
  }
  assert.deepEqual(splitByTokens('', 10), []); checks++;

  // analyze explains the estimate, and separates opaque text from ordinary words.
  const wordy = analyze('hello world and friends');
  assert.ok(wordy.wordChunks >= 4 && wordy.opaqueChars === 0);
  const opaque = analyze(blob);
  assert.ok(opaque.opaqueChars > 0, 'base64 must be recognised as opaque'); checks++;

  // Bad arguments are refused rather than guessed at.
  assert.throws(() => estimateTokens(42), TypeError);
  assert.throws(() => estimateTokens('x', {encoding: 'nope'}), TypeError);
  assert.throws(() => estimateTokens('x', {mode: 'nope'}), TypeError);
  assert.throws(() => truncateToTokens('x', 0), RangeError);
  assert.throws(() => fitsWithin('x', -1), RangeError); checks++;

  // Plain ASCII prose lands close to the widely known "about four characters a token" rule, which
  // is the one case the naive ratio does get right.
  const ratio = prose.length / estimateTokens(prose);
  assert.ok(ratio > 2.5 && ratio < 6, `expected roughly 4 characters per token for prose, got ${ratio.toFixed(2)}`); checks++;

  return {checks};
}
