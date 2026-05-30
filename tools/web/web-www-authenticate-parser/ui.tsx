'use client';

import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE =
  'Bearer realm="api.example.com", error="invalid_token", error_description="The access token expired", scope="read write"';

interface Param {
  key: string;
  value: string;
}

interface Challenge {
  scheme: string;
  token68: string | null;
  params: Param[];
}

const BEARER_ERRORS: Record<string, string> = {
  invalid_request: 'The request is missing a parameter or is otherwise malformed (400).',
  invalid_token: 'The access token is expired, revoked, malformed, or otherwise invalid (401).',
  insufficient_scope: 'The token lacks the scope required for this resource (403).',
};

// Known auth-scheme tokens (case-insensitive). Used to detect challenge boundaries,
// since challenges are comma-separated and so are auth-params.
const KNOWN_SCHEMES = new Set<string>([
  'basic',
  'bearer',
  'digest',
  'negotiate',
  'ntlm',
  'mutual',
  'hoba',
  'scram-sha-1',
  'scram-sha-256',
  'aws4-hmac-sha256',
  'oauth',
]);

// Tokenizer that respects double-quoted strings (with backslash escapes).
function splitTopLevelCommas(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (inQuote) {
      if (ch === '\\' && i + 1 < input.length) {
        cur += ch + (input[i + 1] ?? '');
        i++;
        continue;
      }
      if (ch === '"') inQuote = false;
      cur += ch;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      cur += ch;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function unquote(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return t;
}

function isParam(segment: string): boolean {
  // An auth-param looks like  key=value  where key is a token (no spaces before =).
  const eq = segment.indexOf('=');
  if (eq < 0) return false;
  const key = segment.slice(0, eq).trim();
  return key !== '' && /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key);
}

function parseChallenges(header: string): Challenge[] {
  // Strip a leading header name if present.
  let body = header.trim();
  const nameMatch = /^(www-authenticate|proxy-authenticate|authorization|proxy-authorization)\s*:\s*/i.exec(body);
  if (nameMatch) body = body.slice((nameMatch[0] ?? '').length).trim();

  const segments = splitTopLevelCommas(body);
  const challenges: Challenge[] = [];
  let current: Challenge | null = null;

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed === '') continue;

    // A new challenge begins with "Scheme ..." where Scheme is a bare token at the
    // start of the segment followed by whitespace (or nothing), and is NOT a key=value.
    const firstSpace = trimmed.search(/\s/);
    const head = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    const rest = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
    const headIsScheme =
      /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(head) &&
      (KNOWN_SCHEMES.has(head.toLowerCase()) || !isParam(trimmed));

    if (headIsScheme) {
      current = { scheme: head, token68: null, params: [] };
      challenges.push(current);
      if (rest === '') continue;
      // rest is either token68 (no '=' pair / single base64 blob) or first auth-param
      if (isParam(rest)) {
        addParam(current, rest);
      } else {
        current.token68 = rest;
      }
      continue;
    }

    if (!current) {
      // Header started with a stray param; treat scheme as unknown.
      current = { scheme: '(unknown)', token68: null, params: [] };
      challenges.push(current);
    }
    if (isParam(trimmed)) {
      addParam(current, trimmed);
    } else if (current.token68 === null && current.params.length === 0) {
      current.token68 = trimmed;
    }
  }

  return challenges;
}

function addParam(challenge: Challenge, segment: string): void {
  const eq = segment.indexOf('=');
  const key = segment.slice(0, eq).trim();
  const value = unquote(segment.slice(eq + 1));
  challenge.params.push({ key, value });
}

export default function WwwAuthenticateParserTool() {
  return (
    <TextToolLayout
      deps={[]}
      transform={(input) => {
        const text = input.trim();
        if (!text) return '';

        const challenges = parseChallenges(text);
        if (challenges.length === 0) {
          throw new Error('No auth challenge found. Expected something like: Bearer realm="api".');
        }

        const lines: string[] = [];
        challenges.forEach((c, idx) => {
          if (challenges.length > 1) lines.push(`# Challenge ${idx + 1}`);
          lines.push(`Scheme: ${c.scheme}`);
          if (c.token68 !== null) lines.push(`token68: ${c.token68}`);
          if (c.params.length === 0 && c.token68 === null) {
            lines.push('(no parameters)');
          }
          for (const p of c.params) {
            lines.push(`  ${p.key} = ${p.value}`);
          }
          // Explain bearer error codes.
          const errParam = c.params.find((p) => p.key.toLowerCase() === 'error');
          if (errParam) {
            const explain = BEARER_ERRORS[errParam.value.toLowerCase()];
            if (explain) lines.push(`  -> error "${errParam.value}": ${explain}`);
          }
          lines.push('');
        });

        return lines.join('\n').trimEnd();
      }}
      inputLabel="WWW-Authenticate header"
      outputLabel="Parsed challenges"
      sample={SAMPLE}
      downloadName="auth-challenge.txt"
    />
  );
}
