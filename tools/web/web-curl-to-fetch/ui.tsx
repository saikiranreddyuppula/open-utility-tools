'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `curl -X POST https://api.example.com/v1/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"name":"Ada","role":"admin"}'`;

interface ParsedCurl {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: string | null;
}

/**
 * Tokenize a shell-like command, respecting single/double quotes and
 * line-continuation backslashes.
 */
function tokenize(input: string): string[] {
  // Collapse line continuations (backslash + newline).
  const normalized = input.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === undefined) break;

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"') {
        const next = normalized[i + 1];
        if (next !== undefined) {
          current += next;
          i += 1;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }

    if (ch === '\\') {
      const next = normalized[i + 1];
      if (next !== undefined) {
        current += next;
        hasToken = true;
        i += 1;
      }
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }

    current += ch;
    hasToken = true;
  }
  if (hasToken) tokens.push(current);
  return tokens;
}

function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0 || tokens[0] !== 'curl') {
    throw new Error('Command must start with "curl".');
  }

  let url = '';
  let method = '';
  const headers: Array<[string, string]> = [];
  const dataParts: string[] = [];
  let isForm = false;

  const splitHeader = (value: string): [string, string] => {
    const idx = value.indexOf(':');
    if (idx === -1) return [value.trim(), ''];
    return [value.slice(0, idx).trim(), value.slice(idx + 1).trim()];
  };

  for (let i = 1; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === undefined) continue;

    if (tok === '-X' || tok === '--request') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        method = next.toUpperCase();
        i += 1;
      }
    } else if (tok === '-H' || tok === '--header') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        headers.push(splitHeader(next));
        i += 1;
      }
    } else if (
      tok === '-d' ||
      tok === '--data' ||
      tok === '--data-raw' ||
      tok === '--data-binary' ||
      tok === '--data-ascii'
    ) {
      const next = tokens[i + 1];
      if (next !== undefined) {
        dataParts.push(next);
        i += 1;
      }
    } else if (tok === '--data-urlencode') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        dataParts.push(next);
        i += 1;
      }
    } else if (tok === '-F' || tok === '--form') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        isForm = true;
        dataParts.push(next);
        i += 1;
      }
    } else if (tok === '-u' || tok === '--user') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        const encoded =
          typeof btoa === 'function' ? btoa(next) : Buffer.from(next).toString('base64');
        headers.push(['Authorization', `Basic ${encoded}`]);
        i += 1;
      }
    } else if (
      tok === '-A' ||
      tok === '--user-agent'
    ) {
      const next = tokens[i + 1];
      if (next !== undefined) {
        headers.push(['User-Agent', next]);
        i += 1;
      }
    } else if (tok === '-b' || tok === '--cookie') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        headers.push(['Cookie', next]);
        i += 1;
      }
    } else if (tok === '--url') {
      const next = tokens[i + 1];
      if (next !== undefined) {
        url = next;
        i += 1;
      }
    } else if (
      tok === '-L' ||
      tok === '--location' ||
      tok === '-s' ||
      tok === '--silent' ||
      tok === '-k' ||
      tok === '--insecure' ||
      tok === '-i' ||
      tok === '--include' ||
      tok === '--compressed' ||
      tok === '-v' ||
      tok === '--verbose' ||
      tok === '-#' ||
      tok === '-g' ||
      tok === '--globoff'
    ) {
      // Boolean flags with no fetch equivalent; ignore.
    } else if (tok.startsWith('-')) {
      // Unknown flag that takes an argument; skip its value if present.
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        i += 1;
      }
    } else if (url === '') {
      url = tok;
    }
  }

  if (url === '') {
    throw new Error('No URL found in the curl command.');
  }

  let body: string | null = null;
  if (dataParts.length > 0) {
    if (isForm) {
      body = dataParts.join('&');
    } else {
      body = dataParts.join('&');
    }
    if (method === '') method = 'POST';
  }
  if (method === '') method = 'GET';

  return { url, method, headers, body };
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function buildFetch(parsed: ParsedCurl): string {
  const { url, method, headers, body } = parsed;
  const optionLines: string[] = [];

  optionLines.push(`  method: ${jsString(method)},`);

  if (headers.length > 0) {
    const headerLines = headers
      .map(([k, v]) => `    ${jsString(k)}: ${jsString(v)},`)
      .join('\n');
    optionLines.push(`  headers: {\n${headerLines}\n  },`);
  }

  if (body !== null) {
    // If body looks like JSON, keep it as a string literal.
    optionLines.push(`  body: ${jsString(body)},`);
  }

  const options = optionLines.join('\n');

  return `const response = await fetch(${jsString(url)}, {
${options}
});

const data = await response.json();
console.log(data);`;
}

export default function CurlToFetchTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    return buildFetch(parseCurl(input));
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="curl command"
      outputLabel="fetch() JavaScript"
      inputPlaceholder="curl -X POST https://api.example.com -H 'Content-Type: application/json' -d '{}'"
      sample={SAMPLE}
      downloadName="request.js"
      downloadMime="text/javascript"
    />
  );
}
