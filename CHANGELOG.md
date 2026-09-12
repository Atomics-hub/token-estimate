# Changelog

## 0.1.0

First release.

- `estimateTokens` with two modes: `estimate`, calibrated to sit close on average, and `safe`,
  biased upward for decisions where undercounting fails the request.
- `fitsWithin`, `truncateToTokens` and `splitByTokens`, all defaulting to the conservative mode
  because each one decides rather than reports. Splitting is lossless and never cuts a character.
- `analyze` reports the breakdown behind an estimate.
- Calibrated for `o200k_base` and `cl100k_base` against exact BPE, on a corpus from 42 published
  npm packages split by package. Median error 5.5% on held-out files, against 16.1% for the
  nearest alternative and 23.5% for a characters-over-four ratio.
