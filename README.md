# token-estimate

Estimate how many tokens a string will cost, without installing a tokenizer.

```js
import {estimateTokens, fitsWithin, truncateToTokens} from 'token-estimate';

estimateTokens('The build finished with no errors.');   // 7, and the exact count is 7
fitsWithin(hugeToolOutput, 8000);                        // false
truncateToTokens(hugeToolOutput, 8000).text;             // trimmed to fit
```

Zero runtime dependencies. Strings in, numbers out; nothing is spawned, read or written. ESM, CommonJS and TypeScript declarations. Node 18+.

```sh
npm install token-estimate
```

## Why estimate at all

Because the exact answer is expensive to carry:

| | installed size | cold start to first count |
|---|---:|---:|
| `gpt-tokenizer` (exact) | 29.8 MB | 146 ms |
| `js-tiktoken` (exact) | 22.0 MB | 253 ms |
| **token-estimate** | **39 kB** | **~5 ms** |

Estimating is also linear in input length: 160 kB of pathological whitespace takes about 5 ms.

That 29.8 MB lands in `node_modules` whichever encoding you import, and a single encoding still costs 129 ms of process start. Throughput is comparable either way, so the whole trade is size. If you need exact counts and can afford the weight, use a real tokenizer — this package will tell you the same thing to within a few percent for a thousandth of the footprint.

## Why not characters ÷ 4

Because BPE does not see characters. It sees the chunks its pre-tokenizer produces, and what a chunk costs depends on what it is. `estimateTokenCount` is one token. `YWFhYWFhYWFh`, the same length, is many, because no learned merge covers it. Sixty spaces of indentation are one token. A Japanese character is about two-thirds of one.

Measured against the exact tokenizer on 247 files from npm packages that were **never seen during calibration**:

| | median error | worst 1% | undercounts | undercounts by >10% |
|---|---:|---:|---:|---:|
| **token-estimate** | **5.9%** | 41.7% | 55.5% | **19.0%** |
| `tokenx` | 16.1% | 22.6% | 65.2% | 52.2% |
| `length / 4` | 23.5% | 15.4% | 85.8% | 71.7% |

The gap is not spread evenly. It is concentrated in the content that tools actually move around:

| content | token-estimate | `tokenx` |
|---|---:|---:|
| base64, hashes, JWTs | **99.3%** | 25.2% |
| indentation and blank lines | **110.9%** | 71.0% |
| URLs | **89.7%** | 133.4% |
| emoji | **87.8%** | 63.6% |
| Markdown prose | 98.7% | 105.6% |

A 25% reading on base64 is a fourfold undercount. If that feeds a context-window check, the request is assembled, sent, and rejected.

## Direction matters more than magnitude

Overcounting wastes budget you paid for. Undercounting means the request fails. They are not the same mistake, so there are two modes:

```js
estimateTokens(text);                    // closest on average
estimateTokens(text, {mode: 'safe'});    // biased upward, for decisions
```

`safe` undercounted **8.1%** of held-out samples on `o200k_base` and 13.8% on `cl100k_base`, against 65% and 67% for `tokenx`, at the cost of reading about 10% high. It is a calibration, not a guarantee — see Limits.

`fitsWithin`, `truncateToTokens` and `splitByTokens` all use `safe` by default, because each one is making a decision rather than reporting a number.

## API

### `estimateTokens(text, options?)`

`options`: `{encoding = 'o200k_base', mode = 'estimate', weights?}`.

`encoding` is `'o200k_base'` (GPT-4o and newer) or `'cl100k_base'` (GPT-4, GPT-3.5, `text-embedding-3-*`). `weights` replaces the calibration, to tune for a model shipped here.

### `fitsWithin(text, limit, options?)`

Whether `text` is expected to fit in `limit` tokens. Uses `mode: 'safe'`.

### `truncateToTokens(text, maxTokens, options?)`

Returns `{text, truncated, estimatedTokens}`. Cuts only at a chunk boundary, so a character, a surrogate pair and a combining sequence are never split.

### `splitByTokens(text, maxTokens, options?)`

Consecutive pieces, each estimated to fit. `pieces.join('')` returns the input exactly.

### `analyze(text)`

The breakdown behind the number — `wordChunks`, `opaqueChars`, `cjkChars`, `spaceRuns` and the rest — for when an estimate is surprising and you want to know why.

```js
analyze('const key = "YWFhYWFhYWFhYWFh";').opaqueChars;  // 16
```

### `supportedEncodings()`

All three throw `TypeError` on a non-string input or an unknown encoding or mode, and `RangeError` on a limit that is not positive.

## How it was calibrated

Weights were fitted against `gpt-tokenizer`'s exact BPE on a corpus built from 42 published npm packages — prose, source, declaration files, JSON, and non-English documentation — split **by package**, so the files used to measure come from packages the fit never saw. Files are capped per package so that one large library cannot decide the weights for everyone. The fit trims its worst 3% of residuals, because a handful of samples are not representative text at all: character-encoding tables whose escaped JSON costs more tokens than it has characters.

Per-character rates (CJK, other scripts, long runs, astral characters) are **measured directly** rather than fitted, by tokenising pure samples of each and dividing. Regression cannot recover them reliably, because in real files those characters never appear alone; fitting gave CJK 1.88 and 4.0 tokens per character where measurement gives 0.65 and 0.91, and the fitted values overcounted Japanese prose threefold.

## Limits

This is an estimator. It has no vocabulary, so it cannot be exact, and `safe` is a calibrated bias rather than a proven bound — it undercounted 8.1% and 13.8% of held-out samples on the two encodings. For billing, quota enforcement, or anything where being wrong is expensive, use a real tokenizer.

Known weak spots, all measured: Greek and Cyrillic read about 36% high on `o200k_base`; emoji read 88% and 80% of true on the two encodings; dense CJK inside JSON data files is the worst case in the corpus at 38% of true. Only `o200k_base` and `cl100k_base` are calibrated — other model families differ, and `weights` exists for that. Text is treated as a whole: chat message framing and tool-call scaffolding add tokens this does not see.

## License

MIT.
