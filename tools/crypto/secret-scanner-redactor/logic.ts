/**
 * Secret Scanner & Redactor — pure logic (no DOM, no network).
 *
 * Pattern-based detection of leaked credentials plus redaction helpers. Everything is
 * scanned line by line with bounded regexes (no nested quantifiers) under a hard size cap.
 */

export type Severity = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';
export type RuleGroup =
  | 'cloud'
  | 'devops'
  | 'comms'
  | 'payments'
  | 'ai'
  | 'keys'
  | 'auth'
  | 'generic'
  | 'pii';

export interface GroupInfo {
  id: RuleGroup;
  label: string;
  description: string;
  defaultOn: boolean;
}

export const GROUPS: GroupInfo[] = [
  { id: 'cloud', label: 'Cloud', description: 'AWS, Google, Azure, DigitalOcean, Heroku, Datadog…', defaultOn: true },
  { id: 'devops', label: 'Code & CI', description: 'GitHub, GitLab, npm, PyPI, Docker, Terraform…', defaultOn: true },
  { id: 'comms', label: 'Chat & email', description: 'Slack, Discord, Telegram, Twilio, SendGrid, Mailgun…', defaultOn: true },
  { id: 'payments', label: 'Payments', description: 'Stripe, Shopify, Square, Braintree…', defaultOn: true },
  { id: 'ai', label: 'AI & ML', description: 'Anthropic, OpenAI, Hugging Face, Groq…', defaultOn: true },
  { id: 'keys', label: 'Private keys', description: 'PEM / OpenSSH / PGP private key blocks', defaultOn: true },
  { id: 'auth', label: 'Auth & URLs', description: 'JWTs, Basic/Bearer headers, credentials in URLs, DB strings', defaultOn: true },
  { id: 'generic', label: 'Generic', description: 'password= / token= / api_key= assignments (entropy-gated)', defaultOn: true },
  { id: 'pii', label: 'PII', description: 'Emails, private IPv4 addresses, card numbers', defaultOn: false },
];

export interface Verdict {
  confidence?: Confidence;
  severity?: Severity;
  notes?: string[];
}

export interface ValidatorContext {
  entropyThreshold: number;
  minLength: number;
  hidePlaceholders: boolean;
  line: string;
}

type Validator = (value: string, m: RegExpExecArray, ctx: ValidatorContext) => Verdict | null;

export interface Rule {
  id: string;
  name: string;
  group: RuleGroup;
  severity: Severity;
  confidence: Confidence;
  /** Pattern; compiled with the d + g flags added. */
  pattern: RegExp;
  /** Capture group(s) that hold the secret value (first defined wins). 0 = whole match. */
  valueGroup?: number | number[];
  /** Cheap pre-filter: the line must contain one of these substrings. */
  hints?: string[];
  hintsCI?: boolean;
  /** Higher wins when two findings overlap. */
  priority: number;
  why: string;
  validate?: Validator;
  /** Block rules (multi-line) are handled by dedicated scanners. */
  block?: 'pem';
}

export interface ScanOptions {
  groups: Record<RuleGroup, boolean>;
  entropyThreshold: number;
  minLength: number;
  hidePlaceholders: boolean;
  minConfidence: Confidence;
}

export interface Finding {
  key: string;
  ruleId: string;
  ruleName: string;
  group: RuleGroup;
  severity: Severity;
  confidence: Confidence;
  line: number;
  col: number;
  start: number;
  end: number;
  length: number;
  value: string;
  preview: string;
  why: string;
  notes: string[];
  entropy: number;
  fingerprint: string;
}

export interface ScanResult {
  findings: Finding[];
  charsScanned: number;
  linesScanned: number;
  inputChars: number;
  truncated: boolean;
  findingsCapped: boolean;
}

export const MAX_INPUT_CHARS = 5_000_000;
export const MAX_FINDINGS = 5000;

export function defaultOptions(): ScanOptions {
  const groups = {} as Record<RuleGroup, boolean>;
  for (const g of GROUPS) groups[g.id] = g.defaultOn;
  return { groups, entropyThreshold: 3, minLength: 8, hidePlaceholders: true, minConfidence: 'low' };
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
export function confidenceRank(c: Confidence): number {
  return CONF_RANK[c];
}
const SEV_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
export function severityRank(s: Severity): number {
  return SEV_RANK[s];
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let total = 0;
  for (const c of counts.values()) total += c;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

let CRC_TABLE: Uint32Array | null = null;
/** CRC-32 (IEEE 802.3, as in zlib) of the UTF-8 bytes of `s`. */
export function crc32(s: string): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  const table = CRC_TABLE;
  let crc = 0xffffffff;
  const bytes = new TextEncoder().encode(s);
  for (let i = 0; i < bytes.length; i++) {
    crc = (table[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function base62(n: number, pad = 0): string {
  let out = '';
  let v = Math.floor(n);
  if (v === 0) out = '0';
  while (v > 0) {
    out = BASE62.charAt(v % 62) + out;
    v = Math.floor(v / 62);
  }
  return out.padStart(pad, '0');
}

/** GitHub's token checksum: base62(CRC32(first 30 chars)), zero-padded to 6 chars. */
export function githubChecksum(entropyPart: string): string {
  return base62(crc32(entropyPart), 6);
}

/** Builds a synthetic GitHub-format token (prefix_ + 30 chars + valid 6-char checksum). */
export function makeGithubToken(prefix: 'ghp' | 'gho' | 'ghu' | 'ghs' | 'ghr', body30: string): string {
  if (!/^[A-Za-z0-9]{30}$/.test(body30)) throw new Error('body must be 30 alphanumeric characters');
  return `${prefix}_${body30}${githubChecksum(body30)}`;
}

/** Synchronous SHA-256 (hex). Used for stable fingerprints / placeholders. */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input: string): string {
  const msg = new TextEncoder().encode(input);
  const bitLen = msg.length * 8;
  const padded = new Uint8Array((((msg.length + 9 + 63) >> 6) << 6));
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let a = h[0] ?? 0, b = h[1] ?? 0, c = h[2] ?? 0, d = h[3] ?? 0;
    let e = h[4] ?? 0, f = h[5] ?? 0, g = h[6] ?? 0, hh = h[7] ?? 0;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K256[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] ?? 0) + a) >>> 0; h[1] = ((h[1] ?? 0) + b) >>> 0;
    h[2] = ((h[2] ?? 0) + c) >>> 0; h[3] = ((h[3] ?? 0) + d) >>> 0;
    h[4] = ((h[4] ?? 0) + e) >>> 0; h[5] = ((h[5] ?? 0) + f) >>> 0;
    h[6] = ((h[6] ?? 0) + g) >>> 0; h[7] = ((h[7] ?? 0) + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function decodeBase64Url(s: string): string | null {
  try {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Placeholder / fake detection                                               */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER_EXACT = new Set([
  'password', 'passwd', 'pass', 'secret', 'token', 'apikey', 'api_key', 'api-key', 'key', 'value', 'string',
  'none', 'null', 'nil', 'undefined', 'true', 'false', 'yes', 'no', 'empty', 'default', 'example', 'test',
  'testing', 'dummy', 'sample', 'changeme', 'admin', 'root', 'user', 'username', 'secret_key', 'secretkey',
  'mypassword', 'mysecret', 'redacted', 'hidden', 'masked', 'unset', 'tbd', 'todo', 'required', 'optional',
  'xxxxxxxx', 'password123', 'qwerty', 'letmein',
]);

const PLACEHOLDER_SUBSTR = [
  'your', 'example', 'dummy', 'sample', 'placeholder', 'changeme', 'change_me', 'change-me', 'replace',
  'redacted', 'insert', 'xxxx', '****', 'fixme', 'todo', 'fake', 'mock', 'foobar', 'lorem', 'secret_here',
  'goes_here', 'goes-here', 'put_', 'enter_', 'my_secret', 'my-secret', 'mysecret',
];

const FAKE_SUBSTR = [
  'example', 'dummy', 'sample', 'placeholder', 'changeme', 'xxxxx', 'fake', 'redacted', 'your_', 'your-', 'foobar',
  '0123456789', 'abcdefghij',
];

/** True when a value looks like a template variable, env lookup, mask or documentation filler. */
export function isPlaceholder(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  const lower = v.toLowerCase();
  if (PLACEHOLDER_EXACT.has(lower)) return true;
  if (/^[<[{(].*[>\]})]$/.test(v)) return true;
  if (/^\$\{[^}]*\}?$/.test(v) || /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(v)) return true;
  if (/^\{\{.*\}\}$/.test(v) || /^%\(.*\)[sd]$/.test(v) || /^%[sd]$/.test(v) || /^%[A-Za-z_]+%$/.test(v)) return true;
  if (/^#\{.*\}$/.test(v) || /^<%.*%>$/.test(v) || /^@[A-Za-z_]+@$/.test(v)) return true;
  if (/^(?:process\.env|os\.environ|os\.getenv|ENV\[|getenv|System\.getenv|env\(|Environment\.|config\.|settings\.|secrets\.|vault\.)/i.test(v)) return true;
  if (/^(.)\1{3,}$/.test(v)) return true;
  if (/^[x*#.\-_]+$/i.test(v)) return true;
  for (const s of PLACEHOLDER_SUBSTR) if (lower.includes(s)) return true;
  if (/(?:^|[^a-z])(?:test|testing|demo|temp|tmp|here)(?:[^a-z]|$)/.test(lower)) return true;
  if (v.length >= 6 && new Set(v).size <= 3) return true;
  if ('01234567890123456789'.includes(v) || 'abcdefghijklmnopqrstuvwxyz'.includes(lower)) return v.length >= 4;
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(v)) return true;
  return false;
}

/** Looser check for provider-specific tokens: do not suppress, just demote. */
export function looksFake(value: string): boolean {
  const lower = value.toLowerCase();
  for (const s of FAKE_SUBSTR) if (lower.includes(s)) return true;
  return value.length >= 12 && new Set(value).size <= 4;
}

/* -------------------------------------------------------------------------- */
/* Validators                                                                 */
/* -------------------------------------------------------------------------- */

const ENTROPY_NOTE = (e: number) => `entropy ${e.toFixed(2)} bits/char`;

function githubValidator(value: string): Verdict | null {
  const body = value.slice(4);
  if (body.length !== 36) {
    return { confidence: 'medium', notes: ['Unusual length for a GitHub token; checksum not verified.'] };
  }
  const entropyPart = body.slice(0, 30);
  const checksum = body.slice(30);
  if (githubChecksum(entropyPart) === checksum) {
    return {
      confidence: 'high',
      notes: ['The CRC32 checksum embedded in the last 6 characters is valid, so this is structurally a genuine GitHub token.'],
    };
  }
  return {
    confidence: 'low',
    notes: ['Embedded CRC32 checksum does not match: probably an example, typo or truncated token.'],
  };
}

function jwtValidator(value: string): Verdict | null {
  const parts = value.split('.');
  const headerText = decodeBase64Url(parts[0] ?? '');
  if (!headerText) return null;
  let header: unknown;
  try {
    header = JSON.parse(headerText);
  } catch {
    return null;
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
  const h = header as Record<string, unknown>;
  if (typeof h.alg !== 'string' && typeof h.typ !== 'string') return null;
  const notes: string[] = [];
  if (typeof h.alg === 'string') notes.push(`alg ${h.alg}`);
  let severity: Severity = 'high';
  const payloadText = decodeBase64Url(parts[1] ?? '');
  if (payloadText) {
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      if (typeof payload.iss === 'string') notes.push(`iss ${payload.iss.slice(0, 60)}`);
      if (typeof payload.sub === 'string') notes.push(`sub ${payload.sub.slice(0, 40)}`);
      if (typeof payload.exp === 'number') {
        const exp = new Date(payload.exp * 1000);
        if (!Number.isNaN(exp.getTime())) {
          const expired = exp.getTime() < Date.now();
          notes.push(`${expired ? 'expired' : 'expires'} ${exp.toISOString().slice(0, 19)}Z`);
          if (expired) severity = 'medium';
        }
      } else {
        notes.push('no exp claim (never expires)');
      }
    } catch {
      /* payload is not JSON; keep header-only info */
    }
  }
  if (h.alg === 'none' || (parts[2] ?? '') === '') notes.push('unsigned token');
  return { confidence: 'high', severity, notes };
}

function basicAuthValidator(value: string): Verdict | null {
  let decoded: string | null = null;
  try {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0 || /[\x00-\x08\x0e-\x1f]/.test(decoded)) return null;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  const notes = [`decodes to user “${user.slice(0, 40)}” with a ${pass.length}-character password`];
  if (pass.length === 0) return null;
  if (isPlaceholder(pass) || /^(?:user|username):(?:pass|password)$/i.test(decoded)) {
    return { confidence: 'low', notes: [...notes, 'password looks like a placeholder'] };
  }
  return { confidence: 'high', notes };
}

function bearerValidator(value: string, _m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  if (ctx.hidePlaceholders && isPlaceholder(value)) return null;
  if (/^(?:token|your|<|\$|\{)/i.test(value)) return null;
  const e = shannonEntropy(value);
  if (e < 3) return null;
  return { confidence: e >= 4 ? 'medium' : 'low', notes: [ENTROPY_NOTE(e)] };
}

function urlCredsValidator(value: string, m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  const pass = value;
  if (ctx.hidePlaceholders && isPlaceholder(pass)) return null;
  const lower = pass.toLowerCase();
  if (lower === 'pass' || lower === 'pwd' || lower === 'password' || lower === 'secret') return null;
  const user = m[1] ?? '';
  const host = (m[3] ?? '').toLowerCase();
  const e = shannonEntropy(pass);
  const notes = [`user “${user.slice(0, 40)}” @ ${host.slice(0, 60)}`];
  if (/example\.(?:com|org|net)$/.test(host) && ctx.hidePlaceholders && e < 3) return null;
  return { confidence: e >= 2.5 ? 'medium' : 'low', notes };
}

function discordValidator(value: string): Verdict | null {
  const first = value.split('.')[0] ?? '';
  const decoded = decodeBase64Url(first);
  if (!decoded || !/^\d{17,20}$/.test(decoded)) return null;
  return { confidence: 'high', notes: [`first segment decodes to the bot user id ${decoded}`] };
}

function telegramValidator(value: string): Verdict | null {
  const secret = value.split(':')[1] ?? '';
  return secret.startsWith('AA')
    ? { confidence: 'high', notes: ['bot id + 35-char secret starting with AA'] }
    : { confidence: 'medium', notes: ['matches Telegram bot token layout'] };
}

function stripeValidator(value: string): Verdict {
  const live = value.includes('_live_');
  const restricted = value.startsWith('rk_');
  return {
    severity: live ? 'high' : 'low',
    notes: [`${live ? 'live' : 'test'}-mode ${restricted ? 'restricted' : 'secret'} key${live ? '' : ' (no real money at risk)'}`],
  };
}

function awsIdValidator(value: string): Verdict | null {
  if (/EXAMPLE$/.test(value)) {
    return { confidence: 'low', notes: ['AWS documentation example key, not a real credential.'] };
  }
  const kind: Record<string, string> = {
    AKIA: 'long-term IAM access key',
    ASIA: 'temporary STS access key (pair with a session token)',
    ABIA: 'STS service bearer token id',
    ACCA: 'context-specific credential id',
  };
  return { notes: [kind[value.slice(0, 4)] ?? 'AWS access key id'] };
}

function awsSecretValidator(value: string, _m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  if (/EXAMPLE/.test(value)) {
    return { confidence: 'low', notes: ['AWS documentation example secret, not a real credential.'] };
  }
  if (ctx.hidePlaceholders && isPlaceholder(value)) return null;
  const e = shannonEntropy(value);
  if (e < 3.2) return null;
  return { confidence: 'high', notes: [ENTROPY_NOTE(e)] };
}

function ctxHexValidator(value: string, _m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  if (ctx.hidePlaceholders && (isPlaceholder(value) || looksFake(value))) return null;
  if (shannonEntropy(value) < 2.8) return null;
  return {};
}

function sasValidator(_value: string, _m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  return /(?:^|[?&])(?:sv|sp|se|srt|ss)=/.test(ctx.line) ? {} : null;
}

/** Never rejects: just demotes tokens that look like documentation examples. */
function fakeDemote(value: string): Verdict {
  return looksFake(value) ? { confidence: 'low', notes: ['Looks like a placeholder or documentation example.'] } : {};
}

function privateIpValidator(value: string): Verdict | null {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return {};
}

function emailValidator(value: string): Verdict | null {
  const domain = value.slice(value.lastIndexOf('@') + 1).toLowerCase();
  if (/^(?:example\.(?:com|org|net)|localhost|test\.com|domain\.com)$/.test(domain)) return null;
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(domain)) return null;
  return {};
}

function cardValidator(value: string): Verdict | null {
  const digits = value.replace(/[ -]/g, '');
  if (digits.length < 13 || digits.length > 19) return null;
  if (!luhnValid(digits)) return null;
  const prefixOk =
    /^4/.test(digits) ||
    /^5[1-5]/.test(digits) ||
    /^2(?:2[2-9]|[3-6]\d|7[01]|720)/.test(digits) ||
    /^3[47]/.test(digits) ||
    /^6(?:011|5|4[4-9])/.test(digits) ||
    /^35(?:2[89]|[3-8])/.test(digits) ||
    /^3(?:0[0-5]|[68])/.test(digits);
  if (!prefixOk) return null;
  if (new Set(digits).size <= 1) return null;
  const formatted = /[ -]/.test(value);
  return { confidence: formatted ? 'medium' : 'low', notes: [`${digits.length}-digit number passing the Luhn check`] };
}

/* ---- generic assignment ---- */

const KEY_SUFFIX_BLOCK =
  /(?:url|uri|name|path|file|dir|type|length|len|count|size|id|endpoint|field|header|policy|expiry|expires|expiration|ttl|timeout|label|placeholder|hint|prompt|text|message|msg|error|regex|pattern|format|version|ref|source|location|status|mode|enabled|required|provider|algorithm|alg)$/i;

const NON_SECRET_WORDS = new Set([
  'true', 'false', 'null', 'none', 'nil', 'undefined', 'yes', 'no', 'on', 'off', 'string', 'number', 'object',
  'boolean', 'bool', 'int', 'integer', 'float', 'array', 'required', 'optional', 'secret', 'password', 'token',
  'bearer', 'basic', 'enabled', 'disabled', 'default',
]);

function genericValidator(value: string, m: RegExpExecArray, ctx: ValidatorContext): Verdict | null {
  const key = m[1] ?? '';
  const quoted = m[2] !== undefined || m[3] !== undefined || m[4] !== undefined;
  const keyLower = key.toLowerCase();
  const lastSeg = key.split(/[._-]/).pop() ?? key;
  const camelTail = (key.match(/[A-Z][a-z]+$/) ?? [''])[0];
  if (KEY_SUFFIX_BLOCK.test(lastSeg) || (camelTail && KEY_SUFFIX_BLOCK.test(camelTail))) return null;
  if (value.length < ctx.minLength) return null;
  const lower = value.toLowerCase();
  if (NON_SECRET_WORDS.has(lower)) return null;
  if (ctx.hidePlaceholders && isPlaceholder(value)) return null;
  if (lower === keyLower || lower === keyLower.replace(/[_.-]/g, '')) return null;
  if (/\$\{|\{\{|%\{|#\{|\$\(/.test(value)) return null;
  if (quoted && (value.match(/ /g)?.length ?? 0) >= 4) return null;
  if (!quoted) {
    if (/[([{]/.test(value) || /^[$%@#]/.test(value)) return null;
    if (/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(value)) return null;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      const digits = (value.match(/\d/g) ?? []).length;
      const codeLike =
        /[a-z][A-Z]/.test(value) || /^[A-Z][a-z]/.test(value) || (/_/.test(value) && /[a-z]/.test(value));
      const op = m[0].slice(m[0].indexOf(key) + key.length);
      const envStyle = /^[A-Z][A-Z0-9_]*$/.test(key) && /^["']?\s*=(?!>)/.test(op);
      if (codeLike && digits <= 1 && !envStyle) return null;
    }
  }
  if (/^\d+$/.test(value)) {
    if (!/pass|pwd|secret/.test(keyLower) || value.length < 8) return null;
  }
  const e = shannonEntropy(value);
  if (e < ctx.entropyThreshold) return null;
  let classes = 0;
  if (/[a-z]/.test(value)) classes++;
  if (/[A-Z]/.test(value)) classes++;
  if (/\d/.test(value)) classes++;
  if (/[^A-Za-z0-9]/.test(value)) classes++;
  const confidence: Confidence = e >= 3.5 && classes >= 2 && value.length >= 12 ? 'medium' : 'low';
  const notes = [`key “${key.slice(0, 50)}”`, ENTROPY_NOTE(e), quoted ? 'quoted literal' : 'unquoted value'];
  return { confidence, notes };
}

/* -------------------------------------------------------------------------- */
/* Rule table                                                                 */
/* -------------------------------------------------------------------------- */

const P_SPECIFIC = 100;
const P_CONTEXT = 90;
const P_DB = 88;
const P_JWT = 85;
const P_URL = 80;
const P_BASIC = 78;
const P_BEARER = 60;
const P_GENERIC = 10;
const P_PII = 5;

export const RULES: Rule[] = [
  /* ---- cloud ---- */
  {
    id: 'aws-access-key-id', name: 'AWS access key ID', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])(?:AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}(?![A-Za-z0-9])/,
    hints: ['AKIA', 'ASIA', 'ABIA', 'ACCA'], priority: P_SPECIFIC, validate: awsIdValidator,
    why: 'AKIA…/ASIA… identifiers pair with a secret key to sign AWS API calls.',
  },
  {
    id: 'aws-iam-identifier', name: 'AWS IAM unique ID', group: 'cloud', severity: 'low', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])(?:AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z2-7]{16}(?![A-Za-z0-9])/,
    hints: ['AGPA', 'AIDA', 'AROA', 'AIPA', 'ANPA', 'ANVA'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Identifier of an IAM user/group/role/policy. Not a credential, but leaks account structure.',
  },
  {
    id: 'aws-secret-access-key', name: 'AWS secret access key', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?:aws[\w.-]{0,20}secret[\w.-]{0,20}|secret[_.-]?access[_.-]?key)["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+=])/i,
    valueGroup: 1, hints: ['secret'], hintsCI: true, priority: P_CONTEXT, validate: awsSecretValidator,
    why: 'A 40-character base64 value assigned to an AWS secret key variable.',
  },
  {
    id: 'aws-session-token', name: 'AWS session token', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /aws[\w.-]{0,8}session[_.-]?token["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([A-Za-z0-9/+=]{100,2000})/i,
    valueGroup: 1, hints: ['session'], hintsCI: true, priority: P_CONTEXT,
    why: 'Long base64 session token for temporary AWS credentials.',
  },
  {
    id: 'google-api-key', name: 'Google API key', group: 'cloud', severity: 'medium', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/,
    hints: ['AIza'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'AIza… keys authorise Google Cloud / Maps / Firebase APIs and can incur charges unless restricted.',
  },
  {
    id: 'google-oauth-client-secret', name: 'Google OAuth client secret', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])GOCSPX-[A-Za-z0-9_-]{28}(?![A-Za-z0-9_-])/,
    hints: ['GOCSPX-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'GOCSPX- is the prefix of Google OAuth 2.0 client secrets.',
  },
  {
    id: 'google-oauth-access-token', name: 'Google OAuth access token', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/,
    hints: ['ya29.'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'ya29. tokens are short-lived Google OAuth bearer tokens.',
  },
  {
    id: 'azure-storage-account-key', name: 'Azure storage account key', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /AccountKey=([A-Za-z0-9+/]{40,}={0,2})/i,
    valueGroup: 1, hints: ['accountkey='], hintsCI: true, priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'AccountKey= in a storage connection string grants full access to the storage account.',
  },
  {
    id: 'azure-sas-signature', name: 'Azure SAS signature', group: 'cloud', severity: 'medium', confidence: 'medium',
    pattern: /[?&]sig=([A-Za-z0-9%+/_-]{43,})/,
    valueGroup: 1, hints: ['sig='], priority: P_SPECIFIC, validate: sasValidator,
    why: 'The sig= parameter of a shared-access-signature URL authorises access until it expires.',
  },
  {
    id: 'azure-ad-client-secret', name: 'Azure AD client secret', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9_~.-])[A-Za-z0-9_~.]{3}\dQ~[A-Za-z0-9_~.-]{31,34}(?![A-Za-z0-9_~.-])/,
    hints: ['Q~'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Entra ID (Azure AD) app registration secrets contain the Q~ marker.',
  },
  {
    id: 'digitalocean-token', name: 'DigitalOcean token', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])do[por]_v1_[a-f0-9]{64}(?![A-Za-z0-9])/,
    hints: ['_v1_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'dop_v1_ / doo_v1_ / dor_v1_ are DigitalOcean personal, OAuth and refresh tokens.',
  },
  {
    id: 'heroku-api-key', name: 'Heroku API key', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /heroku[\w.-]{0,20}["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    valueGroup: 1, hints: ['heroku'], hintsCI: true, priority: P_CONTEXT, validate: (v, _m, c) => (c.hidePlaceholders && isPlaceholder(v) ? null : {}),
    why: 'A UUID assigned to a Heroku-named variable is a platform API key.',
  },
  {
    id: 'heroku-platform-key', name: 'Heroku platform API key (HRKU)', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])HRKU-[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_-])/,
    hints: ['HRKU-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'HRKU- is the prefix of newer Heroku authorization tokens.',
  },
  {
    id: 'datadog-key', name: 'Datadog API/app key', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])(?:datadog|dd)[_.-]?(?:api|app|application)[_.-]?key["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([a-f0-9]{32}|[a-f0-9]{40})(?![a-f0-9])/i,
    valueGroup: 1, hints: ['key'], hintsCI: true, priority: P_CONTEXT, validate: ctxHexValidator,
    why: '32/40-hex value assigned to a Datadog API or application key variable.',
  },
  {
    id: 'cloudflare-api-key', name: 'Cloudflare API key/token', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /cloudflare[\w.-]{0,20}["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([A-Za-z0-9_-]{37,40})(?![A-Za-z0-9_-])/i,
    valueGroup: 1, hints: ['cloudflare'], hintsCI: true, priority: P_CONTEXT, validate: ctxHexValidator,
    why: '37–40 character credential assigned to a Cloudflare-named variable.',
  },
  {
    id: 'alibaba-access-key', name: 'Alibaba Cloud AccessKey ID', group: 'cloud', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])LTAI[A-Za-z0-9]{12,20}(?![A-Za-z0-9])/,
    hints: ['LTAI'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'LTAI… is the AccessKey ID prefix for Alibaba Cloud.',
  },
  {
    id: 'firebase-fcm-server-key', name: 'Firebase Cloud Messaging server key', group: 'cloud', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_-])AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}(?![A-Za-z0-9_-])/,
    hints: ['AAAA'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Legacy FCM server keys can send push notifications to every app user.',
  },

  /* ---- devops ---- */
  {
    id: 'github-token', name: 'GitHub token (ghp/gho/ghu/ghs/ghr)', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,251}(?![A-Za-z0-9])/,
    hints: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'], priority: P_SPECIFIC, validate: githubValidator,
    why: 'GitHub tokens end with a CRC32 checksum, which lets this scanner tell real from fake.',
  },
  {
    id: 'github-fine-grained-pat', name: 'GitHub fine-grained token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}(?![A-Za-z0-9])/,
    hints: ['github_pat_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'github_pat_ tokens grant repository access scoped by the owner.',
  },
  {
    id: 'gitlab-token', name: 'GitLab token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])gl(?:pat|ptt|rt|dt|oas|soat|cbt|imt|ffct|agent)-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/,
    hints: ['glpat-', 'glptt-', 'glrt-', 'gldt-', 'gloas-', 'glsoat-', 'glcbt-', 'glimt-', 'glffct-', 'glagent-'],
    priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'glpat-, glptt-, glrt-, gldt-… prefix GitLab personal, trigger, runner and deploy tokens.',
  },
  {
    id: 'npm-token', name: 'npm access token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])npm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/,
    hints: ['npm_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'npm_ tokens can publish packages under your account.',
  },
  {
    id: 'pypi-token', name: 'PyPI API token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])pypi-AgE[A-Za-z0-9_-]{70,}/,
    hints: ['pypi-AgE'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'pypi-AgE… is a macaroon token that can upload releases to PyPI.',
  },
  {
    id: 'docker-hub-pat', name: 'Docker Hub access token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])dckr_pat_[A-Za-z0-9_-]{27,}/,
    hints: ['dckr_pat_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'dckr_pat_ tokens authenticate to Docker Hub.',
  },
  {
    id: 'terraform-cloud-token', name: 'Terraform Cloud token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])[A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9_=-]{60,70}/,
    hints: ['.atlasv1.'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'The .atlasv1. marker identifies Terraform Cloud / Enterprise API tokens.',
  },
  {
    id: 'rubygems-key', name: 'RubyGems API key', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])rubygems_[a-f0-9]{48}(?![A-Za-z0-9])/,
    hints: ['rubygems_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'rubygems_ keys can push gems.',
  },
  {
    id: 'nuget-key', name: 'NuGet API key', group: 'devops', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])oy2[a-z0-9]{43}(?![A-Za-z0-9])/,
    hints: ['oy2'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'oy2… is the NuGet API key layout.',
  },
  {
    id: 'postman-api-key', name: 'Postman API key', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])PMAK-[a-f0-9]{24}-[a-f0-9]{34}(?![A-Za-z0-9])/,
    hints: ['PMAK-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'PMAK- keys access Postman workspaces and collections.',
  },
  {
    id: 'pulumi-token', name: 'Pulumi access token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])pul-[a-f0-9]{40}(?![A-Za-z0-9])/,
    hints: ['pul-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'pul- tokens manage Pulumi stacks.',
  },
  {
    id: 'supabase-token', name: 'Supabase access token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])sbp_[a-f0-9]{40}(?![A-Za-z0-9])/,
    hints: ['sbp_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'sbp_ tokens call the Supabase management API.',
  },
  {
    id: 'doppler-token', name: 'Doppler token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])dp\.(?:pt|st|sa|ct|scim|audit)\.[A-Za-z0-9]{40,44}(?![A-Za-z0-9])/,
    hints: ['dp.'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Doppler personal/service tokens expose project secrets.',
  },
  {
    id: 'linear-api-key', name: 'Linear API key', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])lin_api_[A-Za-z0-9]{40}(?![A-Za-z0-9])/,
    hints: ['lin_api_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'lin_api_ keys read and write Linear issues.',
  },
  {
    id: 'notion-token', name: 'Notion integration token', group: 'devops', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])ntn_[A-Za-z0-9]{40,}(?![A-Za-z0-9])/,
    hints: ['ntn_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'ntn_ tokens grant access to shared Notion pages.',
  },

  /* ---- comms ---- */
  {
    id: 'slack-token', name: 'Slack token', group: 'comms', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9-]{10,72}(?![A-Za-z0-9-])/,
    hints: ['xox'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'xoxb-/xoxp-/xoxa-/xoxr-/xoxs- are Slack bot, user, app, refresh and session tokens.',
  },
  {
    id: 'slack-app-token', name: 'Slack app-level token', group: 'comms', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])xapp-\d-[A-Z0-9]{8,12}-\d{10,14}-[a-f0-9]{40,70}/,
    hints: ['xapp-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'xapp- tokens open Socket Mode connections for a Slack app.',
  },
  {
    id: 'slack-webhook', name: 'Slack webhook URL', group: 'comms', severity: 'medium', confidence: 'high',
    pattern: /https?:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/_-]{20,}/,
    hints: ['hooks.slack.com'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Anyone with the URL can post messages to the channel.',
  },
  {
    id: 'discord-bot-token', name: 'Discord bot token', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9_-])[MNO][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}(?![A-Za-z0-9_-])/,
    hints: ['.'], priority: P_SPECIFIC, validate: discordValidator,
    why: 'Three dot-separated segments; the first is the base64 of the bot’s numeric user id.',
  },
  {
    id: 'discord-webhook', name: 'Discord webhook URL', group: 'comms', severity: 'medium', confidence: 'high',
    pattern: /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d{17,20}\/[A-Za-z0-9_-]{60,}/,
    hints: ['discord'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Anyone with the URL can post to the channel.',
  },
  {
    id: 'telegram-bot-token', name: 'Telegram bot token', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])\d{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/,
    hints: [':'], priority: P_SPECIFIC, validate: telegramValidator,
    why: 'Numeric bot id, a colon, then a 35-character secret.',
  },
  {
    id: 'twilio-api-key', name: 'Twilio API key SID', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])SK[a-f0-9]{32}(?![A-Za-z0-9])/,
    hints: ['SK'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'SK + 32 hex chars is a Twilio API key SID (used together with its secret).',
  },
  {
    id: 'twilio-account-sid', name: 'Twilio account SID', group: 'comms', severity: 'low', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])AC[a-f0-9]{32}(?![A-Za-z0-9])/,
    hints: ['AC'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Account identifier. Not secret alone, but the auth token next to it is.',
  },
  {
    id: 'twilio-auth-token', name: 'Twilio auth token', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /twilio[\w.-]{0,20}auth[\w.-]{0,10}["']?\s{0,5}(?::=|=>|[:=])\s{0,5}["']?([a-f0-9]{32})(?![A-Za-z0-9])/i,
    valueGroup: 1, hints: ['twilio'], hintsCI: true, priority: P_CONTEXT, validate: ctxHexValidator,
    why: '32-hex value assigned to a Twilio auth-token variable.',
  },
  {
    id: 'sendgrid-api-key', name: 'SendGrid API key', group: 'comms', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/,
    hints: ['SG.'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'SG.<22>.<43> is the SendGrid API key layout.',
  },
  {
    id: 'mailgun-api-key', name: 'Mailgun API key', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9-])key-[a-f0-9]{32}(?![A-Za-z0-9])/,
    hints: ['key-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'key- followed by 32 hex chars is a Mailgun private API key.',
  },
  {
    id: 'mailchimp-api-key', name: 'Mailchimp API key', group: 'comms', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])[a-f0-9]{32}-us\d{1,2}(?![A-Za-z0-9])/,
    hints: ['-us'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: '32 hex chars plus a datacenter suffix (-us12) is a Mailchimp key.',
  },

  /* ---- payments ---- */
  {
    id: 'stripe-secret-key', name: 'Stripe secret/restricted key', group: 'payments', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])[sr]k_(?:live|test)_[0-9A-Za-z]{20,99}(?![A-Za-z0-9])/,
    hints: ['k_live_', 'k_test_'], priority: P_SPECIFIC,
    validate: (v) => {
      const s = stripeValidator(v);
      const f = fakeDemote(v);
      return f.confidence ? { ...s, confidence: f.confidence, notes: [...(s?.notes ?? []), ...(f.notes ?? [])] } : s;
    },
    why: 'sk_live_/rk_live_ keys move real money through your Stripe account.',
  },
  {
    id: 'stripe-webhook-secret', name: 'Stripe webhook signing secret', group: 'payments', severity: 'medium', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])whsec_[A-Za-z0-9+/]{30,}={0,2}/,
    hints: ['whsec_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Lets an attacker forge webhook events that your server will trust.',
  },
  {
    id: 'shopify-token', name: 'Shopify token', group: 'payments', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])shp(?:at|ss|ca|pa)_[a-fA-F0-9]{32}(?![A-Za-z0-9])/,
    hints: ['shpat_', 'shpss_', 'shpca_', 'shppa_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'shpat_/shpss_/shpca_/shppa_ are Shopify admin, shared-secret, custom-app and partner tokens.',
  },
  {
    id: 'square-token', name: 'Square access token / secret', group: 'payments', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])(?:sq0atp-[0-9A-Za-z_-]{22}|sq0csp-[0-9A-Za-z_-]{43}|EAAA[A-Za-z0-9_-]{60})(?![A-Za-z0-9_-])/,
    hints: ['sq0atp-', 'sq0csp-', 'EAAA'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'sq0atp-/sq0csp-/EAAA… are Square OAuth and access credentials.',
  },
  {
    id: 'braintree-token', name: 'Braintree access token', group: 'payments', severity: 'high', confidence: 'high',
    pattern: /access_token\$production\$[a-z0-9]{16}\$[a-f0-9]{32}/,
    hints: ['access_token$'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'Production PayPal/Braintree access token.',
  },
  {
    id: 'facebook-access-token', name: 'Facebook/Meta access token', group: 'payments', severity: 'medium', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])EAA[A-Za-z0-9]{90,400}(?![A-Za-z0-9])/,
    hints: ['EAA'], priority: P_SPECIFIC - 5, validate: (v) => fakeDemote(v),
    why: 'EAA… is the prefix of Meta Graph API access tokens.',
  },

  /* ---- ai ---- */
  {
    id: 'anthropic-api-key', name: 'Anthropic API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_-])/,
    hints: ['sk-ant-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'sk-ant-… keys authenticate Claude API calls and bill your account.',
  },
  {
    id: 'openai-api-key', name: 'OpenAI API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])(?:sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|sk-[A-Za-z0-9]{48})(?![A-Za-z0-9_-])/,
    hints: ['sk-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'sk-… / sk-proj-… keys authenticate OpenAI API calls and bill your account.',
  },
  {
    id: 'huggingface-token', name: 'Hugging Face token', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_])(?:hf_[A-Za-z0-9]{34}|api_org_[A-Za-z]{34})(?![A-Za-z0-9_])/,
    hints: ['hf_', 'api_org_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'hf_… tokens read/write Hugging Face models, datasets and Spaces.',
  },
  {
    id: 'groq-api-key', name: 'Groq API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_])gsk_[A-Za-z0-9]{52}(?![A-Za-z0-9])/,
    hints: ['gsk_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'gsk_… keys authenticate Groq API calls.',
  },
  {
    id: 'replicate-token', name: 'Replicate API token', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_])r8_[A-Za-z0-9]{37}(?![A-Za-z0-9])/,
    hints: ['r8_'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'r8_… tokens run Replicate models on your account.',
  },
  {
    id: 'openrouter-key', name: 'OpenRouter API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])sk-or-v1-[a-f0-9]{64}(?![A-Za-z0-9])/,
    hints: ['sk-or-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'sk-or-v1-… keys spend OpenRouter credits.',
  },
  {
    id: 'xai-api-key', name: 'xAI API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{80}(?![A-Za-z0-9])/,
    hints: ['xai-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'xai-… keys authenticate xAI API calls.',
  },
  {
    id: 'perplexity-api-key', name: 'Perplexity API key', group: 'ai', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9])pplx-[A-Za-z0-9]{48}(?![A-Za-z0-9])/,
    hints: ['pplx-'], priority: P_SPECIFIC, validate: (v) => fakeDemote(v),
    why: 'pplx-… keys authenticate Perplexity API calls.',
  },

  /* ---- keys (block scanner) ---- */
  {
    id: 'pem-private-key', name: 'Private key block (PEM/OpenSSH/PGP)', group: 'keys', severity: 'high', confidence: 'high',
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/, block: 'pem', priority: P_SPECIFIC,
    why: 'An unencrypted private key lets anyone impersonate the owner.',
  },
  {
    id: 'pem-encrypted-private-key', name: 'Encrypted private key block', group: 'keys', severity: 'medium', confidence: 'high',
    pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/, block: 'pem', priority: P_SPECIFIC,
    why: 'Protected by a passphrase, but still offline-crackable if the passphrase is weak.',
  },

  /* ---- auth ---- */
  {
    id: 'jwt', name: 'JSON Web Token (JWT)', group: 'auth', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/,
    hints: ['eyJ'], priority: P_JWT, validate: jwtValidator,
    why: 'Header and payload decode as JSON; a valid JWT is a bearer credential until it expires.',
  },
  {
    id: 'db-connection-string', name: 'Database connection string with password', group: 'auth', severity: 'high', confidence: 'high',
    pattern: /(?<![A-Za-z0-9+.-])(?:jdbc:)?(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|mssql|sqlserver|oracle|cockroachdb|clickhouse|couchdb|neo4j(?:\+s|\+ssc)?|bolt|cassandra):\/\/([^\s:@/"'<>]{0,100}):([^\s@"'<>]{3,200})@([^\s/"'<>?#]{1,255})/i,
    valueGroup: 2, hints: ['://'], priority: P_DB,
    validate: urlCredsValidator,
    why: 'Credentials embedded in a connection URI give direct access to the database.',
  },
  {
    id: 'url-credentials', name: 'Credentials embedded in URL', group: 'auth', severity: 'high', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9+.-])[a-z][a-z0-9+.-]{1,20}:\/\/([^\s:@/"'<>]{0,100}):([^\s@/"'<>]{3,200})@([^\s/"'<>?#]{1,255})/i,
    valueGroup: 2, hints: ['://'], priority: P_URL,
    validate: urlCredsValidator,
    why: 'scheme://user:password@host leaks the password in logs, history and referrers.',
  },
  {
    id: 'basic-auth-header', name: 'HTTP Basic auth credentials', group: 'auth', severity: 'high', confidence: 'high',
    pattern: /\bBasic\s+([A-Za-z0-9+/]{8,}={0,2})(?![A-Za-z0-9+/=])/i,
    valueGroup: 1, hints: ['basic'], hintsCI: true, priority: P_BASIC, validate: basicAuthValidator,
    why: 'Base64 is encoding, not encryption: the header decodes straight to user:password.',
  },
  {
    id: 'bearer-token', name: 'Bearer token', group: 'auth', severity: 'high', confidence: 'medium',
    pattern: /\bBearer\s+([A-Za-z0-9._~+/-]{20,}={0,2})/i,
    valueGroup: 1, hints: ['bearer'], hintsCI: true, priority: P_BEARER, validate: bearerValidator,
    why: 'A long random value after “Bearer” in an Authorization header.',
  },

  /* ---- generic ---- */
  {
    id: 'generic-secret-assignment', name: 'Generic secret assignment', group: 'generic', severity: 'medium', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9])([A-Za-z0-9_.-]{0,40}?(?:password|passwd|passphrase|pwd|secret|token|api[_-]?key|apikey|client[_-]?secret|access[_-]?key|auth[_-]?key|private[_-]?key|credentials?)[A-Za-z0-9_.-]{0,40})["']?\s{0,5}(?::=|=>|[:=])\s{0,5}(?:"([^"\r\n]{4,300})"|'([^'\r\n]{4,300})'|`([^`\r\n]{4,300})`|([^\s"'`,;&)}\]<>]{4,300}))/i,
    valueGroup: [2, 3, 4, 5], hints: ['pass', 'pwd', 'secret', 'token', 'key', 'credential'], hintsCI: true,
    priority: P_GENERIC, validate: genericValidator,
    why: 'A secret-sounding name assigned a high-entropy literal (placeholders and variable references are ignored).',
  },

  /* ---- pii ---- */
  {
    id: 'private-ipv4', name: 'Private IPv4 address', group: 'pii', severity: 'low', confidence: 'medium',
    pattern: /(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?![\d]|\.\d)/,
    hints: ['10.', '192.168.', '172.'], priority: P_PII, validate: privateIpValidator,
    why: 'RFC 1918 addresses reveal internal network layout.',
  },
  {
    id: 'email-address', name: 'Email address', group: 'pii', severity: 'low', confidence: 'medium',
    pattern: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,6}\.[A-Za-z]{2,24}(?![A-Za-z0-9-])/,
    hints: ['@'], priority: P_PII, validate: emailValidator,
    why: 'Personal data; often unwanted in shared logs and tickets.',
  },
  {
    id: 'payment-card-number', name: 'Payment card number', group: 'pii', severity: 'medium', confidence: 'low',
    pattern: /(?<![\d.-])(?:\d[ -]?){12,18}\d(?![\d])/,
    priority: P_PII, validate: cardValidator,
    why: '13–19 digits passing the Luhn check with a known issuer prefix.',
  },
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

const COMPILED = new Map<string, RegExp>();
function compiled(rule: Rule): RegExp {
  let re = COMPILED.get(rule.id);
  if (!re) {
    const flags = 'dg' + rule.pattern.flags.replace(/[dg]/g, '');
    re = new RegExp(rule.pattern.source, flags);
    COMPILED.set(rule.id, re);
  }
  re.lastIndex = 0;
  return re;
}

/* -------------------------------------------------------------------------- */
/* Masking & preview                                                          */
/* -------------------------------------------------------------------------- */

/** Keep up to `keep` characters at both ends, always hiding at least 4 characters. */
export function maskMiddle(value: string, keep = 4): string {
  const chars = Array.from(value);
  const n = chars.length;
  if (n <= 4) return '*'.repeat(n);
  const k = Math.max(0, Math.min(keep, Math.floor((n - 4) / 2)));
  const hidden = n - 2 * k;
  return chars.slice(0, k).join('') + '*'.repeat(Math.min(hidden, 24)) + chars.slice(n - k).join('');
}

export function maskPreview(value: string): string {
  if (/[\r\n]/.test(value) || value.length > 80) {
    const flat = value.replace(/\s+/g, ' ');
    return `${flat.slice(0, 11)}…${flat.slice(-4)} (${value.length.toLocaleString('en-US')} chars)`;
  }
  return maskMiddle(value, 4);
}

/* -------------------------------------------------------------------------- */
/* Scanner                                                                    */
/* -------------------------------------------------------------------------- */

interface Candidate {
  rule: Rule;
  start: number;
  end: number;
  value: string;
  verdict: Verdict;
}

export function activeRules(opts: ScanOptions): Rule[] {
  return RULES.filter((r) => opts.groups[r.group]);
}

function pickValueGroup(rule: Rule, m: RegExpExecArray): number {
  const groups = rule.valueGroup === undefined ? [0] : Array.isArray(rule.valueGroup) ? rule.valueGroup : [rule.valueGroup];
  for (const g of groups) if (m[g] !== undefined) return g;
  return 0;
}

function scanLineInto(
  line: string,
  lineStart: number,
  rules: Rule[],
  ctxBase: Omit<ValidatorContext, 'line'>,
  out: Candidate[]
): void {
  let lower: string | null = null;
  const ctx: ValidatorContext = { ...ctxBase, line };
  for (const rule of rules) {
    if (rule.block) continue;
    if (rule.hints) {
      let hit = false;
      if (rule.hintsCI) {
        lower ??= line.toLowerCase();
        for (const h of rule.hints) if (lower.includes(h.toLowerCase())) { hit = true; break; }
      } else {
        for (const h of rule.hints) if (line.includes(h)) { hit = true; break; }
      }
      if (!hit) continue;
    }
    const re = compiled(rule);
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const g = pickValueGroup(rule, m);
      const value = m[g] ?? m[0];
      const idx = m.indices?.[g];
      const s = idx ? idx[0] : m.index;
      const e = idx ? idx[1] : m.index + m[0].length;
      const verdict = rule.validate ? rule.validate(value, m, ctx) : {};
      if (verdict === null) continue;
      out.push({ rule, start: lineStart + s, end: lineStart + e, value, verdict });
    }
  }
}

const PEM_HEADER = /^-----BEGIN ((?:[A-Z0-9]+ ){0,3}PRIVATE KEY(?: BLOCK)?)-----/;
const PEM_BODY_LINE = /^(?:[A-Za-z0-9+/=]{20,200}|[A-Za-z0-9+/]{0,200}=+|(?:Proc-Type|DEK-Info|Version|Comment|Charset|Hash|MessageID): .{0,200})$/;
const PEM_SCAN_CAP = 200_000;

function scanPemBlocks(text: string, rules: Rule[], out: Candidate[]): void {
  const plain = rules.find((r) => r.id === 'pem-private-key');
  const enc = rules.find((r) => r.id === 'pem-encrypted-private-key');
  if (!plain && !enc) return;
  let from = 0;
  for (;;) {
    const at = text.indexOf('-----BEGIN ', from);
    if (at < 0) break;
    const head = PEM_HEADER.exec(text.slice(at, at + 80));
    if (!head) {
      from = at + 11;
      continue;
    }
    const label = head[1] ?? 'PRIVATE KEY';
    const headerEnd = at + head[0].length;
    const endMarker = `-----END ${label}-----`;
    const endAt = text.indexOf(endMarker, headerEnd);
    let end: number;
    let complete = true;
    if (endAt >= 0 && endAt - headerEnd <= PEM_SCAN_CAP) {
      end = endAt + endMarker.length;
    } else {
      complete = false;
      end = headerEnd;
      let pos = headerEnd;
      let lines = 0;
      while (pos < text.length && lines < 400) {
        let nl = text.indexOf('\n', pos);
        if (nl < 0) nl = text.length;
        const ln = text.slice(pos, nl).replace(/\r$/, '');
        if (ln.length > 0 && !PEM_BODY_LINE.test(ln)) break;
        if (ln.length > 0) end = pos + ln.length;
        pos = nl + 1;
        lines++;
      }
    }
    const value = text.slice(at, end);
    const encrypted = label.startsWith('ENCRYPTED') || /Proc-Type:\s*4,\s*ENCRYPTED/.test(value);
    const rule = encrypted ? enc : plain;
    if (rule) {
      const kind = label.replace(/ ?PRIVATE KEY(?: BLOCK)?$/, '');
      const notes = [kind ? `${kind} private key` : 'PKCS#8 private key'];
      if (!complete) notes.push('no matching END line, so the block may be truncated');
      out.push({ rule, start: at, end, value, verdict: { confidence: complete ? 'high' : 'medium', notes } });
    }
    from = Math.max(end, at + 11);
  }
}

function resolveOverlaps(cands: Candidate[]): Candidate[] {
  const sorted = [...cands].sort(
    (a, b) => b.rule.priority - a.rule.priority || b.end - b.start - (a.end - a.start) || a.start - b.start
  );
  const accepted: Candidate[] = [];
  // accepted is kept sorted by start; binary-search the neighbours to detect overlap.
  for (const c of sorted) {
    let lo = 0;
    let hi = accepted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((accepted[mid]?.start ?? 0) < c.start) lo = mid + 1;
      else hi = mid;
    }
    const prev = accepted[lo - 1];
    const next = accepted[lo];
    if (prev && prev.end > c.start) continue;
    if (next && next.start < c.end) continue;
    accepted.splice(lo, 0, c);
  }
  return accepted;
}

function locate(starts: number[], offset: number): { line: number; col: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - (starts[lo] ?? 0) + 1 };
}

/**
 * Generator form of the scan so UIs can yield to the event loop between slices.
 * Yields progress (0..1); returns the final ScanResult.
 */
export function* scanGenerator(
  input: string,
  opts: ScanOptions,
  sliceChars = 200_000
): Generator<number, ScanResult, void> {
  const inputChars = input.length;
  const truncated = inputChars > MAX_INPUT_CHARS;
  const text = truncated ? input.slice(0, MAX_INPUT_CHARS) : input;
  const rules = activeRules(opts);
  const ctxBase = {
    entropyThreshold: opts.entropyThreshold,
    minLength: opts.minLength,
    hidePlaceholders: opts.hidePlaceholders,
  };
  const cands: Candidate[] = [];
  const starts: number[] = [0];
  let pos = 0;
  let sinceYield = 0;
  while (pos <= text.length) {
    let nl = text.indexOf('\n', pos);
    const hasNl = nl >= 0;
    if (!hasNl) nl = text.length;
    let lineEnd = nl;
    if (lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) lineEnd--;
    if (lineEnd > pos) scanLineInto(text.slice(pos, lineEnd), pos, rules, ctxBase, cands);
    sinceYield += nl - pos + 1;
    if (!hasNl) break;
    pos = nl + 1;
    starts.push(pos);
    if (sinceYield >= sliceChars) {
      sinceYield = 0;
      yield pos / Math.max(1, text.length);
    }
  }
  scanPemBlocks(text, rules, cands);
  const resolved = resolveOverlaps(cands).sort((a, b) => a.start - b.start);
  const minRank = confidenceRank(opts.minConfidence);
  const findings: Finding[] = [];
  let findingsCapped = false;
  for (const c of resolved) {
    const confidence = c.verdict.confidence ?? c.rule.confidence;
    if (confidenceRank(confidence) < minRank) continue;
    if (findings.length >= MAX_FINDINGS) {
      findingsCapped = true;
      break;
    }
    const { line, col } = locate(starts, c.start);
    const notes = c.verdict.notes ?? [];
    findings.push({
      key: `${c.start}-${c.end}`,
      ruleId: c.rule.id,
      ruleName: c.rule.name,
      group: c.rule.group,
      severity: c.verdict.severity ?? c.rule.severity,
      confidence,
      line,
      col,
      start: c.start,
      end: c.end,
      length: c.end - c.start,
      value: c.value,
      preview: maskPreview(c.value),
      why: c.rule.why,
      notes,
      entropy: shannonEntropy(c.value),
      fingerprint: sha256Hex(c.value).slice(0, 8),
    });
  }
  return {
    findings,
    charsScanned: text.length,
    linesScanned: starts.length,
    inputChars,
    truncated,
    findingsCapped,
  };
}

export function scanText(input: string, opts: ScanOptions = defaultOptions()): ScanResult {
  const gen = scanGenerator(input, opts, Number.MAX_SAFE_INTEGER);
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

/** Cooperative async scan for the UI: yields to the event loop between slices. */
export async function scanTextAsync(
  input: string,
  opts: ScanOptions,
  isCancelled: () => boolean = () => false
): Promise<ScanResult | null> {
  const gen = scanGenerator(input, opts, 150_000);
  let r = gen.next();
  while (!r.done) {
    if (isCancelled()) return null;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    r = gen.next();
  }
  return isCancelled() ? null : r.value;
}

/* -------------------------------------------------------------------------- */
/* Redaction                                                                  */
/* -------------------------------------------------------------------------- */

export type RedactStyle = 'label' | 'partial' | 'hash';

export interface RedactOutput {
  text: string;
  replaced: number;
  uniqueSecrets: number;
}

/** Assigns <secret-xxxx> tokens: same secret -> same token, extending length on collisions. */
export function hashTokens(values: string[]): Map<string, string> {
  const unique = Array.from(new Set(values));
  const hex = new Map(unique.map((v) => [v, sha256Hex(v)]));
  for (let len = 4; len <= 12; len += 2) {
    const seen = new Set<string>();
    let ok = true;
    for (const h of hex.values()) {
      const p = h.slice(0, len);
      if (seen.has(p)) { ok = false; break; }
      seen.add(p);
    }
    if (ok || len === 12) {
      return new Map(unique.map((v) => [v, `<secret-${(hex.get(v) ?? '').slice(0, len)}>`]));
    }
  }
  return new Map();
}

export function redactText(text: string, findings: Finding[], style: RedactStyle): RedactOutput {
  const sorted = [...findings].sort((a, b) => a.start - b.start);
  const tokens = style === 'hash' ? hashTokens(sorted.map((f) => f.value)) : new Map<string, string>();
  let out = '';
  let cursor = 0;
  let replaced = 0;
  for (const f of sorted) {
    if (f.start < cursor) continue;
    out += text.slice(cursor, f.start);
    if (style === 'label') out += `[REDACTED:${f.ruleId}]`;
    else if (style === 'partial') out += /[\r\n]/.test(f.value) || f.value.length > 120 ? `[REDACTED:${f.ruleId}]` : maskMiddle(f.value, 4);
    else out += tokens.get(f.value) ?? '<secret>';
    cursor = f.end;
    replaced++;
  }
  out += text.slice(cursor);
  return { text: out, replaced, uniqueSecrets: new Set(sorted.map((f) => f.value)).size };
}

/** Findings report that never contains raw secret values. */
export function findingsToJson(result: ScanResult, opts?: ScanOptions): string {
  return JSON.stringify(
    {
      tool: 'Open Utility Tools · Secret Scanner & Redactor',
      note: 'Pattern-based. Raw secret values are intentionally omitted; fingerprints are truncated SHA-256 hashes.',
      scanned: { chars: result.charsScanned, lines: result.linesScanned, truncated: result.truncated },
      options: opts ? { entropyThreshold: opts.entropyThreshold, minLength: opts.minLength, groups: opts.groups } : undefined,
      findings: result.findings.map((f) => ({
        rule: f.ruleId,
        name: f.ruleName,
        severity: f.severity,
        confidence: f.confidence,
        line: f.line,
        column: f.col,
        length: f.length,
        preview: f.preview,
        fingerprint: f.fingerprint,
        entropy: Number(f.entropy.toFixed(2)),
        notes: f.notes,
      })),
    },
    null,
    2
  );
}

/* -------------------------------------------------------------------------- */
/* "What is this token?"                                                      */
/* -------------------------------------------------------------------------- */

export interface IdentifyResult {
  input: string;
  length: number;
  entropy: number;
  charset: string;
  matches: Finding[];
  hints: string[];
}

function charsetOf(s: string): string {
  if (/^[0-9a-f]+$/.test(s)) return 'lowercase hex';
  if (/^[0-9A-F]+$/.test(s)) return 'uppercase hex';
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return 'base64';
  if (/^[A-Za-z0-9_-]+$/.test(s)) return 'base64url / url-safe';
  if (/^[A-Za-z0-9]+$/.test(s)) return 'alphanumeric';
  return 'mixed';
}

export function identifyToken(raw: string): IdentifyResult {
  let s = raw.trim();
  if (/^(["'`]).*\1$/.test(s)) s = s.slice(1, -1);
  const opts: ScanOptions = {
    groups: Object.fromEntries(GROUPS.map((g) => [g.id, true])) as Record<RuleGroup, boolean>,
    entropyThreshold: 0,
    minLength: 4,
    hidePlaceholders: false,
    minConfidence: 'low',
  };
  const matches = s ? scanText(s, opts).findings : [];
  const hints: string[] = [];
  if (s && matches.length === 0) {
    if (/^[A-Za-z0-9/+]{40}$/.test(s)) hints.push('40 base64 characters: could be an AWS secret access key (identifiable only by context, e.g. aws_secret_access_key=…).');
    if (/^[a-f0-9]{40}$/.test(s)) hints.push('40 hex characters: SHA-1 digest, Git commit id, or a pre-2021 GitHub personal access token.');
    if (/^[a-f0-9]{32}$/.test(s)) hints.push('32 hex characters: MD5 digest, or a Datadog / Twilio / Mailgun style key.');
    if (/^[a-f0-9]{64}$/.test(s)) hints.push('64 hex characters: SHA-256 digest or a 256-bit random key.');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) hints.push('UUID: used for Heroku API keys, Azure client/tenant ids and many session ids.');
    if (/^[A-Za-z0-9_-]{43}$/.test(s)) hints.push('43 url-safe base64 characters: a 256-bit secret (e.g. a CSRF or Fernet-style key).');
    if (/^[A-Za-z0-9_-]{22}$/.test(s)) hints.push('22 url-safe base64 characters: a 128-bit random identifier or token.');
  }
  return {
    input: s,
    length: s.length,
    entropy: shannonEntropy(s),
    charset: charsetOf(s),
    matches,
    hints,
  };
}

/* -------------------------------------------------------------------------- */
/* Sample text (tokens are assembled at runtime so no token-shaped literals    */
/* sit in the source tree)                                                     */
/* -------------------------------------------------------------------------- */

export function buildSampleText(): string {
  const gh = makeGithubToken('ghp', 'Q7m2XvB9nLk4RtY1cZa8WdE3sHf6Ju');
  const ghBad = 'gh' + 'p_' + 'Q7m2XvB9nLk4RtY1cZa8WdE3sHf6Ju' + 'AAAAAA';
  const stripe = ['sk', 'live', 'Zt4nR8vK2mQx7LbW9cYd3HfA'].join('_');
  const slack = 'https://hooks.slack.com/' + ['services', 'T03K7ZQ9X', 'B05M2WR8L', 'aB3dE5gH7jK9mN1pQ3sT5vXz'].join('/');
  const jwtHeader = btoa('{"alg":"HS256","typ":"JWT"}').replace(/=+$/, '');
  const jwtPayload = btoa('{"sub":"1234567890","name":"Sample User","iat":1516239022}').replace(/=+$/, '');
  const jwt = `${jwtHeader}.${jwtPayload}.${'c2FtcGxlLXNpZ25hdHVyZS1ub3QtcmVhbA'}`;
  const anthropic = 'sk-ant-' + 'api03-' + 'Hk3Jd9Qw2Lm7Xv5Rt8Yb1Nc4Zp6Sa0Fg3Uo9Ie2Kj5Wh8Td1Qr4Vm7Xc0Bn3Lz6Pa9Ys2Ef5Gu8Ho1Jk4';
  const pemHead = '-----BEGIN ' + 'PRIVATE KEY-----';
  const pemTail = '-----END ' + 'PRIVATE KEY-----';
  const basic = btoa('deploy:Tr0ub4dor&3xK9');
  return [
    '# .env (sample data: every value below is synthetic)',
    'APP_ENV=production',
    'DATABASE_URL=postgres://app_user:Zq7mK2vRx9LwTf4N@db.internal.example.net:5432/appdb',
    'REDIS_URL=redis://:r3d1sPa55w0rdXyQ8@cache.internal:6379/0',
    'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    `STRIPE_SECRET_KEY=${stripe}`,
    `GITHUB_TOKEN=${gh}`,
    `OLD_GITHUB_TOKEN=${ghBad}`,
    `ANTHROPIC_API_KEY=${anthropic}`,
    `SLACK_WEBHOOK=${slack}`,
    'SESSION_SECRET="k8Jd92LmXq0PvR7tYb3NcZ5aWe1UoHs4"',
    'JWT_SECRET=your-secret-here',
    'API_KEY=${API_KEY}',
    '',
    '# curl from a ticket',
    `curl -H "Authorization: Basic ${basic}" https://api.example.com/v1/deploys`,
    `curl -H "Authorization: Bearer ${jwt}" https://api.example.com/v1/me`,
    '',
    '// config.js',
    'const config = {',
    '  password: "Sup3r$ecretP@ssw0rd-2024",',
    '  apiKey: process.env.API_KEY,',
    '  timeout: 30,',
    '};',
    '',
    pemHead,
    'MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAq7BFUpkGp3+LQmlQ',
    'Yx2eqzDV+xeG8kx/sQFV18S5JhzGeIEIeKZ0Ri5YcdKkJWvR2v7QVCYUDkXfZK5h',
    'ZmFrZS1zYW1wbGUtYm9keS1ub3QtYS1yZWFsLWtleQ==',
    pemTail,
    '',
    'Contact: jane.doe@corp.example.org  host: 10.12.34.56',
  ].join('\n');
}
