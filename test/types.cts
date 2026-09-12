import {estimateTokens, fitsWithin, truncateToTokens, splitByTokens, analyze, supportedEncodings} from 'token-budget';
import type {Encoding, TruncateResult, Features} from 'token-budget';

const count: number = estimateTokens('hello', {encoding: 'cl100k_base'});
const fits: boolean = fitsWithin('hello', 100, {mode: 'safe'});
const cut: TruncateResult = truncateToTokens('hello', 10);
const pieces: string[] = splitByTokens('hello', 10);
const features: Features = analyze('hello');
const encodings: Encoding[] = supportedEncodings();
void [count, fits, cut.text, pieces.length, features.opaqueChars, encodings];

// @ts-expect-error a number is not a string
analyze(42);
