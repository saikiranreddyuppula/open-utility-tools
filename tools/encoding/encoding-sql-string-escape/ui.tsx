'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'escape' | 'unescape';
type Dialect = 'ansi' | 'mysql' | 'sqlserver';

function escapeBody(s: string, dialect: Dialect): string {
  switch (dialect) {
    case 'ansi': {
      // PostgreSQL / SQLite / ANSI: double the single quotes only.
      return s.replace(/'/g, "''");
    }
    case 'mysql': {
      // MySQL/MariaDB: backslash escapes plus doubled quote.
      let out = '';
      for (const ch of s) {
        switch (ch) {
          case "'":
            out += "''";
            break;
          case '\\':
            out += '\\\\';
            break;
          case '\0':
            out += '\\0';
            break;
          case '\n':
            out += '\\n';
            break;
          case '\r':
            out += '\\r';
            break;
          case '\t':
            out += '\\t';
            break;
          case '\x1a':
            out += '\\Z';
            break;
          default:
            out += ch;
            break;
        }
      }
      return out;
    }
    case 'sqlserver': {
      // T-SQL: double the single quotes.
      return s.replace(/'/g, "''");
    }
    default:
      return s.replace(/'/g, "''");
  }
}

function unescapeBody(body: string, dialect: Dialect): string {
  if (dialect === 'mysql') {
    let out = '';
    let i = 0;
    while (i < body.length) {
      const ch = body[i] ?? '';
      if (ch === '\\') {
        const nxt = body[i + 1] ?? '';
        switch (nxt) {
          case '0':
            out += '\0';
            break;
          case 'n':
            out += '\n';
            break;
          case 'r':
            out += '\r';
            break;
          case 't':
            out += '\t';
            break;
          case 'Z':
            out += '\x1a';
            break;
          case '\\':
            out += '\\';
            break;
          case "'":
            out += "'";
            break;
          case '"':
            out += '"';
            break;
          default:
            out += nxt;
            break;
        }
        i += 2;
        continue;
      }
      if (ch === "'" && body[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }
  // ANSI / SQL Server: just collapse doubled quotes.
  return body.replace(/''/g, "'");
}

export default function SqlStringEscapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [dialect, setDialect] = useState<Dialect>('ansi');
  const [wrap, setWrap] = useState(true);
  const [unicodePrefix, setUnicodePrefix] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input && mode === 'escape') {
        const empty = wrap ? `${unicodePrefix && dialect === 'sqlserver' ? 'N' : ''}''` : '';
        return empty;
      }
      if (!input) return '';

      if (mode === 'escape') {
        const body = escapeBody(input, dialect);
        if (!wrap) return body;
        const prefix = unicodePrefix && dialect === 'sqlserver' ? 'N' : '';
        return `${prefix}'${body}'`;
      }

      // Unescape: strip optional N prefix and surrounding quotes, then reverse escaping.
      let t = input.trim();
      if (t.startsWith('N') || t.startsWith('n')) {
        if (t.length > 1 && t[1] === "'") t = t.slice(1);
      }
      if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        t = t.slice(1, -1);
      } else {
        throw new Error("Expected a single-quoted SQL string literal, e.g. 'text'.");
      }
      return unescapeBody(t, dialect);
    },
    [mode, dialect, wrap, unicodePrefix],
  );

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, dialect, wrap, unicodePrefix]}
        inputLabel={mode === 'escape' ? 'Raw text' : 'SQL string literal'}
        outputLabel={mode === 'escape' ? 'SQL string literal' : 'Raw text'}
        sample={mode === 'escape' ? "O'Brien's data; DROP TABLE users;--" : "'O''Brien''s data; DROP TABLE users;--'"}
        downloadName="sql-escaped.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="escape">Escape</TabsTrigger>
                  <TabsTrigger value="unescape">Unescape</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Dialect">
              <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ansi">ANSI / PostgreSQL / SQLite</SelectItem>
                  <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
                  <SelectItem value="sqlserver">SQL Server (T-SQL)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Wrap in quotes">
              <Switch checked={wrap} onCheckedChange={setWrap} />
            </Field>
            {dialect === 'sqlserver' && (
              <Field label="Unicode N'…' prefix">
                <Switch checked={unicodePrefix} onCheckedChange={setUnicodePrefix} />
              </Field>
            )}
          </>
        }
      />

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Security note:</strong> Escaping is{' '}
        <em>not</em> a substitute for parameterized queries / prepared statements. Use bound
        parameters to prevent SQL injection; this tool is for building static literals and
        understanding dialect quoting only.
      </div>
    </div>
  );
}
