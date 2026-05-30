'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = `query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}`;

/** Single-quote a string for POSIX shells (close, escape, reopen). */
function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, `'\\''`) + "'";
}

export default function GraphqlQueryToCurlTool() {
  const [endpoint, setEndpoint] = useState('https://api.example.com/graphql');
  const [variables, setVariables] = useState('{ "id": "42" }');
  const [auth, setAuth] = useState('');

  return (
    <TextToolLayout
      deps={[endpoint, variables, auth]}
      transform={(input) => {
        const query = input.trim();
        if (!query) return '';

        let vars: unknown = undefined;
        const vTrim = variables.trim();
        if (vTrim) {
          try {
            vars = JSON.parse(vTrim);
          } catch {
            throw new Error('Variables must be valid JSON (or left empty).');
          }
        }

        const url = endpoint.trim() || 'https://api.example.com/graphql';
        const bodyObj: { query: string; variables?: unknown } = { query };
        if (vars !== undefined) bodyObj.variables = vars;
        const body = JSON.stringify(bodyObj);

        const headerLines: string[] = ['  -H ' + shellSingleQuote('Content-Type: application/json')];
        const authTrim = auth.trim();
        if (authTrim) headerLines.push('  -H ' + shellSingleQuote('Authorization: ' + authTrim));

        const curl = [
          'curl -X POST ' + shellSingleQuote(url) + ' \\',
          headerLines.join(' \\\n') + ' \\',
          '  -d ' + shellSingleQuote(body),
        ].join('\n');

        // Equivalent fetch() snippet
        const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authTrim) fetchHeaders.Authorization = authTrim;
        const fetchSnippet = [
          'const res = await fetch(' + JSON.stringify(url) + ', {',
          '  method: "POST",',
          '  headers: ' + JSON.stringify(fetchHeaders, null, 2).replace(/\n/g, '\n  ') + ',',
          '  body: JSON.stringify(' + JSON.stringify(bodyObj, null, 2).replace(/\n/g, '\n  ') + '),',
          '});',
          'const data = await res.json();',
        ].join('\n');

        return curl + '\n\n# --- equivalent fetch() ---\n\n' + fetchSnippet;
      }}
      inputLabel="GraphQL Query"
      outputLabel="cURL + fetch()"
      sample={SAMPLE}
      downloadName="graphql.sh"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Endpoint URL" className="min-w-[260px] flex-1">
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          </Field>
          <Field label="Authorization header" className="min-w-[220px] flex-1">
            <Input
              value={auth}
              onChange={(e) => setAuth(e.target.value)}
              placeholder="Bearer ey…"
            />
          </Field>
          <Field label="Variables (JSON)" className="min-w-[260px] flex-1">
            <Textarea
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              spellCheck={false}
              className="h-16 font-mono text-xs"
            />
          </Field>
        </>
      }
    />
  );
}
