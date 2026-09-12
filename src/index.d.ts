export type Encoding = 'o200k_base' | 'cl100k_base';

/**
 * `estimate` is calibrated to sit close to the true count on average. `safe` is calibrated to sit
 * above it in the large majority of cases, for decisions where undercounting fails the request.
 */
export type Mode = 'estimate' | 'safe';

export interface Options {
  /** Which tokenizer to estimate for. Default `'o200k_base'`. */
  encoding?: Encoding;
  /** Default `'estimate'` when counting, `'safe'` for the functions that decide whether text fits. */
  mode?: Mode;
  /**
   * Replace the calibrated weights, to tune the estimate for a model this package does not ship a
   * calibration for. Keys match the fields reported by `analyze`, in tokens per unit.
   */
  weights?: Record<string, number>;
}

/** What `analyze` reports: the text broken down the way the estimate charges it. */
export interface Features {
  wordChunks: number;
  wordChars: number;
  opaqueChunks: number;
  opaqueChars: number;
  digitChunks: number;
  digitChars: number;
  punctChunks: number;
  punctChars: number;
  newlineRuns: number;
  newlineChars: number;
  spaceRuns: number;
  spaceChars: number;
  cjkChars: number;
  otherScriptChars: number;
  astralUnits: number;
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
  estimatedTokens: number;
}

/**
 * Break `text` down the way the estimate does, so a surprising number can be explained: how much is
 * ordinary words, how much is opaque, how much is another script, how much is whitespace.
 * Throws `TypeError` for a non-string input.
 */
export function analyze(text: string): Features;

/** Estimate how many tokens `text` will cost. Throws `TypeError` for a non-string input. */
export function estimateTokens(text: string, options?: Options): number;

/** Whether `text` is expected to fit inside `limit` tokens. Uses `mode: 'safe'` unless overridden. */
export function fitsWithin(text: string, limit: number, options?: Options): boolean;

/** Cut `text` to an estimated `maxTokens`, never splitting a character. Uses `mode: 'safe'`. */
export function truncateToTokens(text: string, maxTokens: number, options?: Options): TruncateResult;

/** Split `text` into consecutive pieces each estimated to fit `maxTokens`. Joining them restores the input. */
export function splitByTokens(text: string, maxTokens: number, options?: Options): string[];

/** The encodings this package is calibrated for. */
export function supportedEncodings(): Encoding[];
