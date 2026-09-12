// Bounding a tool result before it reaches a model.
//
// The failure this avoids is specific: a command returns a page of base64 or a long hash listing,
// a characters-over-four estimate reads it as a quarter of its real size, the request is assembled
// and sent, and the API rejects it for exceeding the context window.
import {estimateTokens, fitsWithin, truncateToTokens, analyze} from 'token-estimate';

const BUDGET = 4000;

export function prepareToolResult(raw) {
  if (fitsWithin(raw, BUDGET)) return {text: raw, truncated: false};
  const {text, truncated, estimatedTokens} = truncateToTokens(raw, BUDGET);
  return {text, truncated, estimatedTokens};
}

// A worked example: the same byte count costs very different amounts.
const prose = 'The deployment finished and every check passed. '.repeat(40);
const blob = Buffer.from(prose).toString('base64');

for (const [label, text] of [['prose', prose], ['the same bytes, base64', blob]]) {
  const features = analyze(text);
  console.log(`${label.padEnd(24)} ${text.length} chars -> ~${estimateTokens(text)} tokens ` +
    `(${features.opaqueChars} of them opaque)`);
}

const cut = prepareToolResult(blob.repeat(20));
console.log(`\ntruncated: ${cut.truncated}, kept about ${cut.estimatedTokens} tokens of budget ${BUDGET}`);
