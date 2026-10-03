/** Pure helpers for PDF protection: password strength, validation and generation. */

export interface Strength {
  /** 0 (empty / very weak) … 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Rough entropy estimate in bits. */
  bits: number;
}

const COMMON = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop', 'abc123', 'letmein', 'welcome', 'welcome1', 'admin', 'admin123',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'master', 'login',
  'passw0rd', 'p@ssw0rd', 'secret', 'changeme', 'trustno1', '111111', '000000', '121212', 'test', 'test123',
  'pdf', 'document', 'secure', 'default',
]);

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * Basic strength estimate: character-pool entropy with penalties for repeated
 * characters, simple sequences (abc, 123, qwerty rows) and well-known passwords.
 * It is a guide, not a guarantee.
 */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: '', bits: 0 };
  const chars = Array.from(pw);
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[ !-/:-@[-`{-~]/.test(pw)) pool += 33;
  if (/[^\u0000-\u007f]/.test(pw)) pool += 64;
  if (pool === 0) pool = 10;

  // Count only characters that add information: skip repeats and +1/-1 steps.
  let effective = 0;
  let prevCode = -10;
  let prevStep = 0;
  const seen = new Map<string, number>();
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    const step = code - prevCode;
    const times = seen.get(ch.toLowerCase()) ?? 0;
    seen.set(ch.toLowerCase(), times + 1);
    if (step === 0 || ((step === 1 || step === -1) && step === prevStep)) {
      effective += 0.15;
    } else if (times >= 2) {
      effective += 0.4;
    } else if (times === 1) {
      effective += 0.7;
    } else {
      effective += 1;
    }
    prevStep = step;
    prevCode = code;
  }

  let bits = effective * Math.log2(pool);
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[0-9!@#$%^&*]+$/, ''))) bits = Math.min(bits, 12);
  if (/^(qwerty|asdf|zxcv|1234|abcd)/i.test(pw)) bits = Math.min(bits, 24);

  const score: Strength['score'] = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, label: LABELS[score], bits: Math.round(bits) };
}

/** Length of the password's UTF-8 encoding, in bytes. */
export function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/**
 * Check a password against what the chosen encryption can store.
 * AES-256 (R6) accepts up to 127 UTF-8 bytes; AES-128 (R4) uses only the first
 * 32 bytes of a Latin-1 password. Returns an error message or null.
 */
export function passwordProblem(pw: string, aes256: boolean, what: string): string | null {
  if (!pw) return null;
  if (aes256) {
    if (utf8Length(pw) > 127) return `${what} is too long — AES-256 allows up to 127 bytes (about 127 ASCII characters).`;
    return null;
  }
  for (const ch of pw) {
    if ((ch.codePointAt(0) ?? 0) > 0xff) {
      return `${what} contains characters AES-128 can't store (it supports Latin-1 only). Use AES-256 or plain Latin letters/digits.`;
    }
  }
  if (pw.length > 32) return `${what} is longer than 32 characters — AES-128 only uses the first 32. Shorten it or switch to AES-256.`;
  return null;
}

/** Non-blocking compatibility hint: non-ASCII characters in an AES-128 password are not portable across readers. */
export function passwordWarning(pw: string, aes256: boolean): string | null {
  if (aes256 || !/[^\u0000-\u007f]/.test(pw)) return null;
  return 'Non-ASCII characters in an AES-128 password are only portable between readers that agree on the Latin-1 encoding. Use AES-256 or plain ASCII characters for the widest compatibility.';
}

const GEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const GEN_SYMBOLS = '!@#$%^&*-_=+?';

/**
 * Random password from an unambiguous alphabet (no 0/O/1/l/I). `randomInt(n)` must
 * return a uniformly distributed integer in [0, n). With `symbols` a few punctuation marks are mixed in.
 */
export function generatePassword(length: number, randomInt: (maxExclusive: number) => number, symbols = false): string {
  const alphabet = symbols ? GEN_ALPHABET + GEN_SYMBOLS : GEN_ALPHABET;
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet.charAt(randomInt(alphabet.length));
  return out;
}
