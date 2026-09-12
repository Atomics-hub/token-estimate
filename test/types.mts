import {estimateTokens, fitsWithin, truncateToTokens, splitByTokens, analyze, supportedEncodings} from 'token-estimate';
import type {Encoding, Mode, Options, TruncateResult, Features} from 'token-estimate';

const count: number = estimateTokens('hello');
const withOptions: number = estimateTokens('hello', {encoding: 'cl100k_base', mode: 'safe'});
const fits: boolean = fitsWithin('hello', 100);
const cut: TruncateResult = truncateToTokens('hello', 10);
const text: string = cut.text;
const truncated: boolean = cut.truncated;
const estimated: number = cut.estimatedTokens;
const pieces: string[] = splitByTokens('hello', 10);
const features: Features = analyze('hello');
const words: number = features.wordChunks;
const encodings: Encoding[] = supportedEncodings();

const encoding: Encoding = 'o200k_base';
const mode: Mode = 'estimate';
const options: Options = {encoding, mode};
void [count, withOptions, fits, text, truncated, estimated, pieces, words, encodings, options];

// @ts-expect-error a number is not a string
estimateTokens(42);
// @ts-expect-error the encoding must be one of the supported names
estimateTokens('hello', {encoding: 'gpt2'});
// @ts-expect-error the mode must be estimate or safe
estimateTokens('hello', {mode: 'exact'});
// @ts-expect-error a limit is required
fitsWithin('hello');
