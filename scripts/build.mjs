import {mkdir, readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/index.js', root), 'utf8');
const declarations = await readFile(new URL('src/index.d.ts', root), 'utf8');
const exports = [...source.matchAll(/^export function (\w+)\(/gm)].map(match => match[1]);
if (exports.join(',') !== 'analyze,estimateTokens,fitsWithin,truncateToTokens,splitByTokens,supportedEncodings') throw new Error('Review build exports: ' + exports.join(','));
await mkdir(new URL('dist/', root), {recursive: true});
await writeFile(new URL('dist/index.mjs', root), source);
await writeFile(new URL('dist/index.cjs', root), "'use strict';\n" +
  source.replace(/^export function /gm, 'function ') + '\nmodule.exports = {' + exports.join(', ') + '};\n');
for (const extension of ['mts', 'cts']) {
  await writeFile(new URL('dist/index.d.' + extension, root), declarations);
}
