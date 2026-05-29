/** Client-side password & passphrase generation via crypto.getRandomValues. */

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}
const webcrypto = (globalThis as unknown as { crypto: RandomSource }).crypto;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';
const SIMILAR = /[il1Lo0O]/g;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
}

/** Cryptographically-uniform random index in [0, max). */
function randIndex(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    webcrypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
}

export function generatePassword(opts: PasswordOptions): string {
  let pool = '';
  if (opts.lower) pool += LOWER;
  if (opts.upper) pool += UPPER;
  if (opts.digits) pool += DIGITS;
  if (opts.symbols) pool += SYMBOLS;
  if (opts.excludeSimilar) pool = pool.replace(SIMILAR, '');
  if (!pool) return '';
  let out = '';
  for (let i = 0; i < opts.length; i++) out += pool[randIndex(pool.length)];
  return out;
}

/** Rough entropy estimate in bits for a password from a given pool size. */
export function entropyBits(length: number, poolSize: number): number {
  if (poolSize <= 1) return 0;
  return Math.round(length * Math.log2(poolSize));
}

/** A small embedded diceware-style wordlist (EFF short list subset). */
const WORDS =
  'acid acorn acre acts afar affix aged agent agile aging agout aha aid aim air ajar alarm album alert alias alike alive aloe aloft aloha alone amend amid ample amuse angel anger angle ankle apple april apron aqua area arena argue arms army aroma array arrow ask aspen aster atlas atom attic audio aunt auto avert avid await awake award aware awoke axis bacon badge bagel baggy baker balmy banjo barge barn bash basil bass baton bats bay beach beak beam bean bear beat bee beef been beep beet bell belt bench bend bent best bet bias bike bin bird birth blade blank blast blaze bleak blend bless blew blimp blink blip bliss blitz bloat blob block bloke blood bloom blot blue blunt blurt blush boar boat body bogus boil bok bola bolt bond bone bonus book boost booth boots bored bossy botch both bound bovine boxer brace braid brain brake bran brave bread break bream brew brick bride brim bring brink brisk broad broil broke bronc brook broom brace';
const WORD_LIST = [...new Set(WORDS.split(' ').filter(Boolean))];

export function generatePassphrase(words: number, separator = '-', capitalize = false): string {
  const parts: string[] = [];
  for (let i = 0; i < words; i++) {
    let w = WORD_LIST[randIndex(WORD_LIST.length)]!;
    if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    parts.push(w);
  }
  return parts.join(separator);
}
