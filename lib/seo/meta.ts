/**
 * Programmatic title/description builders for the tool pages and 12
 * category pages. Goals (grounded in Google Search Central guidance):
 *  - Front-load the distinctive name so it survives SERP truncation.
 *  - Append the high-intent "Free Online <Type>" modifier searchers use, but
 *    NEVER duplicate a word already in the name (duplication looks like keyword
 *    stuffing and triggers Google title rewrites).
 *  - Keep descriptions unique + ~150 chars with a varied privacy/offline CTA so
 *    the near-identical template pages stay "human-readable and diverse".
 */
import type { ToolCategory } from '@/lib/registry';

/** The noun searchers append per category, e.g. "MD5 Hash" -> "...Generator". */
const TITLE_TYPE: Record<ToolCategory, string> = {
  generators: 'Generator',
  convert: 'Converter',
  math: 'Calculator',
  crypto: 'Tool',
  encoding: 'Tool',
  data: 'Tool',
  text: 'Tool',
  web: 'Tool',
  time: 'Tool',
  color: 'Tool',
  image: 'Tool',
  pdf: 'Tool',
};

/** Any tool-type noun already in the name — skip appending one (no "Generator … Tool"). */
const TYPE_NOUNS =
  /\b(generators?|converters?|calculators?|tools?|validators?|encoders?|decoders?|checkers?|formatters?|builders?|editors?|viewers?|parsers?|inspectors?|analyz(?:er|ers)|creators?|makers?|extractors?|cleaners?|pickers?)\b/i;

/**
 * "MD5 Hash Generator" -> "MD5 Hash Generator - Free Online" (name has a type noun)
 * "MD5 Hash"           -> "MD5 Hash - Free Online Tool"
 * The layout template then appends " — Open Utility Tools".
 */
export function toolTitle(name: string, category: ToolCategory): string {
  return TYPE_NOUNS.test(name)
    ? `${name} - Free Online`
    : `${name} - Free Online ${TITLE_TYPE[category]}`;
}

/** Varied per-category privacy tail so descriptions don't read as boilerplate. */
const PRIVACY_TAIL: Record<ToolCategory, string> = {
  crypto: 'Runs 100% in your browser — free, private, nothing is uploaded.',
  encoding: 'Free, in-browser and offline-capable — your data never leaves the page.',
  image: 'Processed entirely in your browser — free, private, no upload, works offline.',
  pdf: 'Processed entirely in your browser — free, private, no upload, works offline.',
  data: 'Free and private — runs client-side in your browser, no upload, works offline.',
  convert: 'A free online converter that runs client-side — no upload, works offline.',
  text: 'Free, private and instant — runs in your browser, nothing leaves the page.',
  web: 'A free developer utility that runs entirely client-side in your browser.',
  time: 'Free and private — computed in your browser, works offline.',
  math: 'A free calculator that runs entirely in your browser — private and offline.',
  color: 'A free, private color tool — runs in your browser, works offline.',
  generators: 'Free and private — generated locally in your browser, nothing is uploaded.',
};

/** A short privacy CTA used when the category's full tail would overflow 160 chars. */
const SHORT_TAIL = 'Free, private & runs in your browser.';

/** Trim to ≤max chars at the last whole word (no mid-word SERP/OG truncation). */
export function clampToWord(s: string, max = 160): string {
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, '');
}

/**
 * Tool meta description: unique function first, then a privacy/offline CTA,
 * kept ≤160 chars and NEVER cut mid-word — Google truncates around there and a
 * clean sentence boundary reads far better than a hard slice.
 */
export function toolDescription(description: string, category: ToolCategory): string {
  const full = `${description} ${PRIVACY_TAIL[category]}`;
  if (full.length <= 160) return full;
  const short = `${description} ${SHORT_TAIL}`;
  if (short.length <= 160) return short;
  // Description alone is already long: use it, trimming to the last whole word.
  return clampToWord(description);
}
