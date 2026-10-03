/**
 * `docker run` <-> Compose converter. Pure TypeScript, no dependencies.
 *
 * Direction A: one or more `docker run ...` commands -> compose.yaml (Compose Specification).
 * Direction B: compose.yaml -> one `docker run` command per service.
 *
 * A small, strict YAML subset parser/emitter lives here too: the shared lib/data/yaml.ts
 * mis-parses list items containing colons (`- "8080:80"`), which every Compose file has.
 */

export interface Warning {
  level: 'warn' | 'info';
  message: string;
}

export class ConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConvertError';
  }
}

// ---------------------------------------------------------------------------
// Shell tokenizer
// ---------------------------------------------------------------------------

export interface ShellParse {
  commands: string[][];
  warnings: Warning[];
}

/**
 * Splits shell text into commands (separated by newlines, `;`, `&&`, `||`, `|`, `&`) of words.
 * Quotes and escapes are resolved. A literal `$` (single quotes, `$'..'`, `\$`) becomes `$$` so
 * the word can be dropped into a Compose file, where `$` starts an interpolation. Unquoted and
 * double-quoted `$VAR` / `${VAR}` / `$(cmd)` are left untouched.
 */
export function splitShellCommands(input: string): ShellParse {
  const src = input.replace(/\r\n?/g, '\n');
  const n = src.length;
  const commands: string[][] = [];
  const warnings: Warning[] = [];
  let words: string[] = [];
  let cur = '';
  let inWord = false;
  let sawPipe = false;

  const pushWord = (): void => {
    if (inWord) {
      words.push(cur);
      cur = '';
      inWord = false;
    }
  };
  const pushCommand = (): void => {
    pushWord();
    if (words.length) commands.push(words);
    words = [];
  };
  const add = (s: string): void => {
    cur += s;
    inWord = true;
  };

  const readBalanced = (start: number, open: string, close: string): number => {
    // returns index of the matching close char (or n - 1)
    let depth = 0;
    let q: string | null = null;
    for (let k = start; k < n; k++) {
      const c = src.charAt(k);
      if (q) {
        if (c === '\\' && q === '"') k++;
        else if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') q = c;
      else if (c === '\\') k++;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return k;
      }
    }
    return n - 1;
  };

  for (let i = 0; i < n; i++) {
    const c = src.charAt(i);
    const d = src.charAt(i + 1);
    if (c === ' ' || c === '\t') {
      pushWord();
      continue;
    }
    if (c === '\n') {
      pushCommand();
      continue;
    }
    if (c === '#' && !inWord) {
      while (i < n && src.charAt(i) !== '\n') i++;
      i--;
      continue;
    }
    if (c === '\\') {
      // line continuation (tolerate trailing spaces after the backslash)
      const m = /^[ \t]*\n/.exec(src.slice(i + 1));
      if (m) {
        i += m[0].length;
        continue;
      }
      if (i + 1 < n) {
        const e = src.charAt(i + 1);
        add(e === '$' ? '$$' : e);
        i++;
      }
      continue;
    }
    if (c === "'") {
      inWord = true;
      const close = src.indexOf("'", i + 1);
      const end = close < 0 ? n : close;
      add(src.slice(i + 1, end).replace(/\$/g, '$$$$'));
      i = end;
      continue;
    }
    if (c === '"') {
      inWord = true;
      let k = i + 1;
      while (k < n && src.charAt(k) !== '"') {
        const ch = src.charAt(k);
        if (ch === '\\') {
          const nx = src.charAt(k + 1);
          if (nx === '\n') {
            k += 2;
            continue;
          }
          if (nx === '$') {
            add('$$');
            k += 2;
            continue;
          }
          if (nx === '"' || nx === '\\' || nx === '`') {
            add(nx);
            k += 2;
            continue;
          }
          add('\\');
          k++;
          continue;
        }
        if (ch === '$' && src.charAt(k + 1) === '(') {
          const end = readBalanced(k + 1, '(', ')');
          add(src.slice(k, end + 1));
          k = end + 1;
          continue;
        }
        if (ch === '`') {
          const end = src.indexOf('`', k + 1);
          const e2 = end < 0 ? n - 1 : end;
          add(src.slice(k, e2 + 1));
          k = e2 + 1;
          continue;
        }
        add(ch);
        k++;
      }
      i = k;
      continue;
    }
    if (c === '$' && d === "'") {
      inWord = true;
      let k = i + 2;
      while (k < n && src.charAt(k) !== "'") {
        const ch = src.charAt(k);
        if (ch === '\\' && k + 1 < n) {
          const nx = src.charAt(k + 1);
          k += 2;
          switch (nx) {
            case 'n': add('\n'); break;
            case 't': add('\t'); break;
            case 'r': add('\r'); break;
            case 'a': add('\x07'); break;
            case 'b': add('\b'); break;
            case 'f': add('\f'); break;
            case 'v': add('\v'); break;
            case 'e': add('\x1b'); break;
            case '\\': add('\\'); break;
            case "'": add("'"); break;
            case '"': add('"'); break;
            case 'x': {
              const m = /^[0-9a-fA-F]{1,2}/.exec(src.slice(k, k + 2));
              if (m) {
                add(String.fromCharCode(parseInt(m[0], 16)));
                k += m[0].length;
              } else add('\\x');
              break;
            }
            case 'u':
            case 'U': {
              const len = nx === 'u' ? 4 : 8;
              const m = new RegExp(`^[0-9a-fA-F]{1,${len}}`).exec(src.slice(k, k + len));
              if (m) {
                add(String.fromCodePoint(parseInt(m[0], 16)));
                k += m[0].length;
              } else add('\\' + nx);
              break;
            }
            default: {
              if (/[0-7]/.test(nx)) {
                const m = /^[0-7]{1,3}/.exec(src.slice(k - 1, k + 2));
                if (m) {
                  add(String.fromCharCode(parseInt(m[0], 8)));
                  k += m[0].length - 1;
                  break;
                }
              }
              add('\\' + nx);
            }
          }
          continue;
        }
        add(ch === '$' ? '$$' : ch);
        k++;
      }
      i = k;
      continue;
    }
    if (c === '$' && d === '(') {
      const end = readBalanced(i + 1, '(', ')');
      add(src.slice(i, end + 1));
      i = end;
      continue;
    }
    if (c === '`') {
      const close = src.indexOf('`', i + 1);
      const end = close < 0 ? n - 1 : close;
      add(src.slice(i, end + 1));
      i = end;
      continue;
    }
    if (c === '&' && d === '&') {
      pushCommand();
      i++;
      continue;
    }
    if (c === '|' && d === '|') {
      pushCommand();
      i++;
      continue;
    }
    if (c === '|') {
      sawPipe = true;
      pushCommand();
      continue;
    }
    if (c === ';') {
      pushCommand();
      continue;
    }
    if (c === '&') {
      const prev = src.charAt(i - 1);
      if (d === '>' || prev === '>' || prev === '<') {
        add(c);
        continue;
      }
      pushCommand();
      continue;
    }
    add(c);
  }
  pushCommand();
  if (sawPipe) {
    warnings.push({ level: 'info', message: 'Pipes are not converted: only the commands themselves are looked at.' });
  }
  return { commands, warnings };
}

// ---------------------------------------------------------------------------
// docker run flag table
// ---------------------------------------------------------------------------

interface FlagDef {
  key: string;
  kind: 'bool' | 'value';
}

const FLAG_DEFS: FlagDef[] = [];
const LONG = new Map<string, FlagDef>();
const SHORT = new Map<string, FlagDef>();

function defineFlags(kind: 'bool' | 'value', spec: string): void {
  for (const item of spec.split(/\s+/).filter(Boolean)) {
    const [long = '', short] = item.split(':');
    const def: FlagDef = { key: long, kind };
    FLAG_DEFS.push(def);
    LONG.set(long, def);
    if (short) SHORT.set(short, def);
  }
}

defineFlags(
  'value',
  [
    'add-host', 'annotation', 'attach:a', 'blkio-weight', 'blkio-weight-device', 'cap-add', 'cap-drop',
    'cgroup-parent', 'cgroupns', 'cidfile', 'cpu-count', 'cpu-percent', 'cpu-period', 'cpu-quota',
    'cpu-rt-period', 'cpu-rt-runtime', 'cpu-shares:c', 'cpus', 'cpuset-cpus', 'cpuset-mems', 'detach-keys',
    'device', 'device-cgroup-rule', 'device-read-bps', 'device-read-iops', 'device-write-bps',
    'device-write-iops', 'dns', 'dns-option', 'dns-search', 'domainname', 'entrypoint', 'env:e', 'env-file',
    'expose', 'gpus', 'group-add', 'health-cmd', 'health-interval', 'health-retries', 'health-start-interval',
    'health-start-period', 'health-timeout', 'hostname:h', 'io-maxbandwidth', 'io-maxiops', 'ip', 'ip6', 'ipc',
    'isolation', 'kernel-memory', 'label:l', 'label-file', 'link', 'link-local-ip', 'log-driver', 'log-opt',
    'mac-address', 'memory:m', 'memory-reservation', 'memory-swap', 'memory-swappiness', 'mount', 'name',
    'network', 'network-alias', 'oom-score-adj', 'pid', 'pids-limit', 'platform', 'publish:p', 'pull',
    'restart', 'runtime', 'security-opt', 'shm-size', 'stop-signal', 'stop-timeout', 'storage-opt', 'sysctl',
    'tmpfs', 'ulimit', 'user:u', 'userns', 'uts', 'volume:v', 'volume-driver', 'volumes-from', 'workdir:w',
  ].join(' ')
);
defineFlags(
  'bool',
  [
    'detach:d', 'init', 'interactive:i', 'no-healthcheck', 'oom-kill-disable', 'privileged', 'publish-all:P',
    'quiet:q', 'read-only', 'rm', 'sig-proxy', 'tty:t', 'disable-content-trust', 'help',
  ].join(' ')
);
LONG.set('net', LONG.get('network') as FlagDef);
LONG.set('net-alias', LONG.get('network-alias') as FlagDef);

const GLOBAL_VALUE_FLAGS = new Set([
  '-H', '--host', '--context', '-c', '--config', '-l', '--log-level', '--tlscacert', '--tlscert', '--tlskey',
]);

export interface RunSpec {
  image: string;
  command: string[];
  values: Map<string, string[]>;
  bools: Map<string, boolean>;
  unknown: string[];
  /** The tool that was invoked (docker, podman, ...). */
  tool: string;
}

function asBool(v: string | undefined): boolean {
  return !(v !== undefined && /^(false|0|no|off)$/i.test(v));
}

/** Parses the words of one command into a RunSpec; returns null (plus a reason) if it is not a `run` command. */
export function parseRunWords(wordsIn: string[]): { spec: RunSpec | null; skipped?: string; notes: Warning[] } {
  const notes: Warning[] = [];
  const words = [...wordsIn];
  // prompt, sudo, env assignments
  while (words.length) {
    const w = words[0] ?? '';
    if (w === '$' || w === '#' || w === 'sudo' || w === 'time' || w === 'exec') {
      words.shift();
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      notes.push({ level: 'info', message: `Ignored environment assignment before the command: ${w}. It applies to the docker CLI, not to the container.` });
      words.shift();
      continue;
    }
    break;
  }
  if (words.length === 0) return { spec: null, notes };
  const bin = (words[0] ?? '').replace(/^.*\//, '').replace(/\.exe$/i, '');
  if (!['docker', 'podman', 'nerdctl', 'docker-run', 'balena'].includes(bin)) {
    return { spec: null, skipped: words.join(' '), notes };
  }
  words.shift();
  // global options
  while (words.length && (words[0] ?? '').startsWith('-')) {
    const w = words.shift() ?? '';
    if (GLOBAL_VALUE_FLAGS.has(w)) words.shift();
  }
  let sub = words.shift() ?? '';
  if (sub === 'container') sub = words.shift() ?? '';
  if (sub !== 'run' && sub !== 'create') {
    return { spec: null, skipped: [bin, sub, ...words].join(' ').trim(), notes };
  }
  if (sub === 'create') {
    notes.push({ level: 'info', message: '"docker create" was treated like "docker run": Compose creates containers with "docker compose create" / "up".' });
  }

  const spec: RunSpec = { image: '', command: [], values: new Map(), bools: new Map(), unknown: [], tool: bin };
  const addValue = (key: string, v: string): void => {
    const list = spec.values.get(key);
    if (list) list.push(v);
    else spec.values.set(key, [v]);
  };

  let i = 0;
  for (; i < words.length; i++) {
    const a = words[i] ?? '';
    if (a === '--') {
      i++;
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
      const def = LONG.get(name);
      if (!def) {
        spec.unknown.push(a.length > 40 ? a.slice(0, 40) + '…' : a);
        continue;
      }
      if (def.kind === 'bool') {
        spec.bools.set(def.key, asBool(eq < 0 ? undefined : a.slice(eq + 1)));
      } else if (eq >= 0) {
        addValue(def.key, a.slice(eq + 1));
      } else {
        const v = words[i + 1];
        if (v === undefined) {
          notes.push({ level: 'warn', message: `--${name} is missing its value.` });
        } else {
          addValue(def.key, v);
          i++;
        }
      }
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const ch = a.charAt(j);
        const def = SHORT.get(ch);
        if (!def) {
          spec.unknown.push('-' + ch);
          continue;
        }
        if (def.kind === 'bool') {
          spec.bools.set(def.key, true);
          continue;
        }
        let rest = a.slice(j + 1);
        if (rest.startsWith('=')) rest = rest.slice(1);
        if (rest !== '') {
          addValue(def.key, rest);
        } else {
          const v = words[i + 1];
          if (v === undefined) notes.push({ level: 'warn', message: `-${ch} is missing its value.` });
          else {
            addValue(def.key, v);
            i++;
          }
        }
        break;
      }
      continue;
    }
    break; // the image
  }
  spec.image = words[i] ?? '';
  spec.command = words.slice(i + 1);
  if (!spec.image) {
    return { spec: null, skipped: [bin, sub, ...words].join(' '), notes: [...notes, { level: 'warn', message: 'No image name found after the options.' }] };
  }
  return { spec, notes };
}

// ---------------------------------------------------------------------------
// YAML emitter
// ---------------------------------------------------------------------------

type YValue = null | boolean | number | string | YValue[] | { [k: string]: YValue | undefined };

const YAML_BARE_WORDS = /^(true|false|yes|no|on|off|y|n|null|~)$/i;

function looksNumeric(s: string): boolean {
  return (
    /^[-+]?(\d[\d_]*)(\.\d*)?([eE][-+]?\d+)?$/.test(s) ||
    /^[-+]?\.\d+([eE][-+]?\d+)?$/.test(s) ||
    /^0x[0-9a-fA-F_]+$/.test(s) ||
    /^0o?[0-7_]+$/.test(s) ||
    /^[-+]?\.(inf|nan)$/i.test(s) ||
    /^[-+]?\d+(:[0-5]?\d)+(\.\d*)?$/.test(s) ||
    /^\d{4}-\d{2}-\d{2}([Tt ].*)?$/.test(s)
  );
}

export function yamlNeedsQuote(s: string): boolean {
  if (s === '') return true;
  if (/^\s|\s$/.test(s)) return true;
  if (/[\x00-\x1f\x7f\u2028\u2029]/.test(s)) return true;
  const c = s.charAt(0);
  if ('[]{},#&*!|>\'"%@`'.includes(c)) return true;
  if ((c === '-' || c === '?' || c === ':') && (s.length === 1 || /\s/.test(s.charAt(1)))) return true;
  if (/:(\s|$)/.test(s) || /\s#/.test(s)) return true;
  if (YAML_BARE_WORDS.test(s)) return true;
  if (looksNumeric(s)) return true;
  if (/^\d+:\d+$/.test(s)) return true;
  return false;
}

function dq(s: string): string {
  return JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function yamlScalar(v: YValue, force = false): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return force || yamlNeedsQuote(v) ? dq(v) : v;
  return '';
}

function yamlKey(k: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_.\-/]*$/.test(k) && !YAML_BARE_WORDS.test(k)) return k;
  if (/^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$/.test(k) && !looksNumeric(k) && !YAML_BARE_WORDS.test(k)) return k;
  return dq(k);
}

interface EmitOptions {
  /** keys whose array values are written in flow style: [a, b] */
  flowKeys: Set<string>;
  /** keys whose (string) values are always double-quoted */
  forceQuoteKeys: Set<string>;
}

const DEFAULT_EMIT: EmitOptions = {
  flowKeys: new Set(['command', 'entrypoint', 'test', 'capabilities', 'device_ids']),
  forceQuoteKeys: new Set(['ports', 'expose', 'group_add']),
};

function isPlainObject(v: unknown): v is { [k: string]: YValue | undefined } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function emitFlowArray(arr: YValue[], plain = false): string {
  return '[' + arr.map((x) => (typeof x === 'string' ? (plain && !yamlNeedsQuote(x) && !/[,[\]{}]/.test(x) ? x : dq(x)) : yamlScalar(x))).join(', ') + ']';
}

function emitObject(obj: { [k: string]: YValue | undefined }, indent: number, o: EmitOptions): string[] {
  const pad = '  '.repeat(indent);
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const key = yamlKey(k);
    if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${key}: []`);
      } else if (o.flowKeys.has(k) && v.every((x) => x === null || typeof x !== 'object')) {
        const flow = emitFlowArray(v, k === 'capabilities');
        if (pad.length + key.length + 2 + flow.length <= 100) out.push(`${pad}${key}: ${flow}`);
        else out.push(`${pad}${key}:`, ...emitArray(v, indent + 1, o, k));
      } else {
        out.push(`${pad}${key}:`, ...emitArray(v, indent + 1, o, k));
      }
    } else if (isPlainObject(v)) {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      if (entries.length === 0) out.push(`${pad}${key}: {}`);
      else out.push(`${pad}${key}:`, ...emitObject(v, indent + 1, o));
    } else if (v === null) {
      out.push(`${pad}${key}:`);
    } else {
      out.push(`${pad}${key}: ${yamlScalar(v, typeof v === 'string' && o.forceQuoteKeys.has(k))}`);
    }
  }
  return out;
}

function emitArray(arr: YValue[], indent: number, o: EmitOptions, parentKey: string): string[] {
  const pad = '  '.repeat(indent);
  const out: string[] = [];
  const force = o.forceQuoteKeys.has(parentKey);
  for (const item of arr) {
    if (Array.isArray(item)) {
      if (item.length === 0) out.push(`${pad}- []`);
      else if (item.every((x) => x === null || typeof x !== 'object')) out.push(`${pad}- ${emitFlowArray(item)}`);
      else {
        const lines = emitArray(item, indent + 1, o, parentKey);
        lines[0] = pad + '- ' + (lines[0] ?? '').slice(pad.length + 2);
        out.push(...lines);
      }
    } else if (isPlainObject(item)) {
      const lines = emitObject(item, indent + 1, o);
      if (lines.length === 0) out.push(`${pad}- {}`);
      else {
        lines[0] = pad + '- ' + (lines[0] ?? '').slice(pad.length + 2);
        out.push(...lines);
      }
    } else {
      out.push(`${pad}- ${yamlScalar(item, force && typeof item === 'string')}`);
    }
  }
  return out;
}

export function emitYaml(doc: YValue, options: Partial<EmitOptions> = {}): string {
  const o: EmitOptions = { ...DEFAULT_EMIT, ...options };
  if (!isPlainObject(doc)) return yamlScalar(doc) + '\n';
  return emitObject(doc, 0, o).join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// YAML parser (the subset Compose files use, plus anchors and block scalars)
// ---------------------------------------------------------------------------

export class YamlError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`YAML error on line ${line}: ${message}`);
    this.name = 'YamlError';
    this.line = line;
  }
}

interface Ln {
  indent: number;
  text: string; // content without leading indent and without trailing comment
  raw: string;
  no: number;
}

function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (q === "'") {
      if (c === "'") {
        if (s.charAt(i + 1) === "'") i++;
        else q = null;
      }
    } else if (q === '"') {
      if (c === '\\') i++;
      else if (c === '"') q = null;
    } else if (c === "'" || c === '"') {
      // a quote only starts a quoted scalar at the start of a token
      const prev = i === 0 ? ' ' : s.charAt(i - 1);
      if (/[\s[{,:-]/.test(prev) || i === 0) q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s.charAt(i - 1)))) {
      return s.slice(0, i).replace(/\s+$/, '');
    }
  }
  return s.replace(/\s+$/, '');
}

class YamlParser {
  lines: Ln[] = [];
  pos = 0;
  anchors = new Map<string, unknown>();
  rawLines: string[];

  constructor(text: string) {
    const t = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    this.rawLines = t.split('\n');
    // only the first document is read
    const kept: { raw: string; no: number }[] = [];
    let hasContent = false;
    for (let i = 0; i < this.rawLines.length; i++) {
      const raw = this.rawLines[i] ?? '';
      if (/^---(\s|$)/.test(raw)) {
        if (hasContent) break;
        const rest = raw.slice(3).trim();
        if (rest && !rest.startsWith('#')) {
          kept.push({ raw: rest, no: i + 1 });
          hasContent = true;
        }
        continue;
      }
      if (/^\.\.\.(\s|$)/.test(raw)) break;
      kept.push({ raw, no: i + 1 });
      const tt = raw.trim();
      if (tt !== '' && !tt.startsWith('#')) hasContent = true;
    }
    this.lines = kept.map((k) => {
      const lead = /^[ \t]*/.exec(k.raw)?.[0] ?? '';
      return { indent: lead.length, text: k.raw.slice(lead.length), raw: k.raw, no: k.no };
    });
  }

  err(msg: string, no?: number): never {
    throw new YamlError(msg, no ?? this.lines[this.pos]?.no ?? this.lines[this.lines.length - 1]?.no ?? 1);
  }

  /** Index of the next line that carries content. */
  skipBlank(from = this.pos): number {
    let p = from;
    while (p < this.lines.length) {
      const l = this.lines[p];
      const t = l ? stripComment(l.text) : '';
      if (t !== '') return p;
      p++;
    }
    return p;
  }

  parse(): unknown {
    this.pos = this.skipBlank();
    if (this.pos >= this.lines.length) return null;
    const first = this.lines[this.pos] as Ln;
    if (/^\t/.test(first.raw)) this.err('tabs are not allowed for indentation');
    const v = this.parseBlock(first.indent);
    const rest = this.skipBlank();
    if (rest < this.lines.length) {
      this.pos = rest;
      this.err('unexpected content (check the indentation)');
    }
    return v;
  }

  private contentOf(l: Ln): string {
    return stripComment(l.text);
  }

  parseBlock(_indent: number): unknown {
    this.pos = this.skipBlank();
    const l = this.lines[this.pos];
    if (!l) return null;
    if (/^\t/.test(l.raw)) this.err('tabs are not allowed for indentation');
    const t = this.contentOf(l);
    if (/^-(\s|$)/.test(t)) return this.parseSeq(l.indent);
    if (this.findMapColon(t) >= 0) return this.parseMap(l.indent);
    // a bare scalar / flow collection document
    this.pos++;
    return this.parseInline(t, l.indent, l.no);
  }

  /** Index of the `:` separating a mapping key from its value, or -1. */
  findMapColon(t: string): number {
    let i = 0;
    if (t.startsWith('?')) return -1;
    const c = t.charAt(0);
    if (c === '"' || c === "'") {
      const end = this.skipQuoted(t, 0);
      if (end < 0) return -1;
      i = end;
      while (t.charAt(i) === ' ') i++;
      return t.charAt(i) === ':' && (i + 1 >= t.length || /\s/.test(t.charAt(i + 1))) ? i : -1;
    }
    if (c === '[' || c === '{') return -1;
    for (; i < t.length; i++) {
      if (t.charAt(i) === ':' && (i + 1 >= t.length || /\s/.test(t.charAt(i + 1)))) return i;
      if (t.charAt(i) === '#' && i > 0 && /\s/.test(t.charAt(i - 1))) return -1;
    }
    return -1;
  }

  /** Returns the index after the closing quote of a quoted scalar starting at `start`, or -1. */
  skipQuoted(t: string, start: number): number {
    const q = t.charAt(start);
    for (let i = start + 1; i < t.length; i++) {
      const c = t.charAt(i);
      if (q === '"' && c === '\\') i++;
      else if (c === q) {
        if (q === "'" && t.charAt(i + 1) === "'") i++;
        else return i + 1;
      }
    }
    return -1;
  }

  parseKey(t: string, colon: number, no: number): string {
    const raw = t.slice(0, colon).trim();
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const v = this.parseQuoted(raw, no);
      return String(v);
    }
    return raw;
  }

  parseMap(indent: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const merges: unknown[] = [];
    for (;;) {
      this.pos = this.skipBlank();
      const l = this.lines[this.pos];
      if (!l || l.indent < indent) break;
      if (/^\t/.test(l.raw)) this.err('tabs are not allowed for indentation');
      if (l.indent > indent) this.err('bad indentation of a mapping entry');
      const t = this.contentOf(l);
      if (/^-(\s|$)/.test(t)) break;
      const colon = this.findMapColon(t);
      if (colon < 0) this.err(`expected "key: value" but found "${t.length > 40 ? t.slice(0, 40) + '…' : t}"`);
      const key = this.parseKey(t, colon, l.no);
      let rest = t.slice(colon + 1).trim();
      this.pos++;
      let anchor: string | null = null;
      // anchor / tag prefixes before the value
      for (;;) {
        const m = /^(&[\w-]+|![\w!./-]*)(\s+|$)/.exec(rest);
        if (!m) break;
        if ((m[1] ?? '').startsWith('&')) anchor = (m[1] ?? '').slice(1);
        rest = rest.slice(m[0].length);
      }
      let value: unknown;
      if (rest === '') {
        const nxt = this.skipBlank();
        const nl = this.lines[nxt];
        if (nl && nl.indent > indent) {
          value = this.parseBlock(nl.indent);
        } else if (nl && nl.indent === indent && /^-(\s|$)/.test(this.contentOf(nl))) {
          value = this.parseSeq(indent);
        } else {
          value = null;
        }
      } else if (rest.startsWith('|') || rest.startsWith('>')) {
        value = this.parseBlockScalar(rest, indent, l.no);
      } else {
        value = this.parseInline(rest, indent, l.no);
      }
      if (anchor) this.anchors.set(anchor, value);
      if (key === '<<') merges.push(value);
      else obj[key] = value;
    }
    if (merges.length) {
      const flat: unknown[] = [];
      for (const m of merges) {
        if (Array.isArray(m)) flat.push(...m);
        else flat.push(m);
      }
      for (const m of flat) {
        if (m && typeof m === 'object' && !Array.isArray(m)) {
          for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
            if (!(k in obj)) obj[k] = v;
          }
        } else {
          this.err('merge key "<<" needs a mapping (or a list of mappings)');
        }
      }
    }
    return obj;
  }

  parseSeq(indent: number): unknown[] {
    const arr: unknown[] = [];
    for (;;) {
      this.pos = this.skipBlank();
      const l = this.lines[this.pos];
      if (!l || l.indent < indent) break;
      if (/^\t/.test(l.raw)) this.err('tabs are not allowed for indentation');
      const t = this.contentOf(l);
      if (l.indent !== indent || !/^-(\s|$)/.test(t)) {
        if (l.indent > indent) this.err('bad indentation of a sequence entry');
        break;
      }
      const afterDash = t.slice(1);
      const lead = /^\s*/.exec(afterDash)?.[0].length ?? 0;
      let item = afterDash.slice(lead);
      let anchor: string | null = null;
      for (;;) {
        const m = /^(&[\w-]+|![\w!./-]*)(\s+|$)/.exec(item);
        if (!m) break;
        if ((m[1] ?? '').startsWith('&')) anchor = (m[1] ?? '').slice(1);
        item = item.slice(m[0].length);
      }
      const contentCol = l.indent + 1 + lead + (afterDash.length - lead - item.length);
      let value: unknown;
      if (item === '') {
        this.pos++;
        const nxt = this.skipBlank();
        const nl = this.lines[nxt];
        value = nl && nl.indent > indent ? this.parseBlock(nl.indent) : null;
      } else if (/^-(\s|$)/.test(item)) {
        // nested sequence on the same line: "- - a"
        l.indent = contentCol;
        l.text = item;
        value = this.parseSeq(contentCol);
      } else if (this.findMapColon(item) >= 0) {
        // mapping whose first entry shares the dash line: rewrite the line so it aligns
        l.indent = contentCol;
        l.text = item;
        value = this.parseMap(l.indent);
      } else if (item.startsWith('|') || item.startsWith('>')) {
        this.pos++;
        value = this.parseBlockScalar(item, indent, l.no);
      } else {
        this.pos++;
        value = this.parseInline(item, indent, l.no);
      }
      if (anchor) this.anchors.set(anchor, value);
      arr.push(value);
    }
    return arr;
  }

  // ---- scalars ----

  parseInline(textIn: string, parentIndent: number, no: number): unknown {
    let text = textIn;
    if (text.startsWith('*')) {
      const name = text.slice(1).trim();
      if (!this.anchors.has(name)) this.err(`unknown alias *${name}`, no);
      return this.anchors.get(name);
    }
    // tags such as !!str, !reset
    const tag = /^!([\w!./-]*)\s*(.*)$/.exec(text);
    if (tag) {
      text = tag[2] ?? '';
      if (text === '') return null;
    }
    const c = text.charAt(0);
    if (c === '[' || c === '{') {
      let full = text;
      // flow collections may continue on the following lines
      while (!this.flowBalanced(full) && this.pos < this.lines.length) {
        const nl = this.lines[this.pos];
        if (!nl) break;
        full += ' ' + this.contentOf(nl).trim();
        this.pos++;
      }
      if (!this.flowBalanced(full)) this.err('unterminated flow collection', no);
      const fp = new FlowParser(full, no, this);
      const v = fp.parseValue();
      fp.skipWs();
      if (fp.i < full.length) this.err(`unexpected "${full.slice(fp.i, fp.i + 10)}" after flow collection`, no);
      return v;
    }
    if (c === '"' || c === "'") {
      let full = text;
      let end = this.skipQuoted(full, 0);
      while (end < 0 && this.pos < this.lines.length) {
        const nl = this.lines[this.pos];
        if (!nl) break;
        full += ' ' + nl.text.trim();
        this.pos++;
        end = this.skipQuoted(full, 0);
      }
      if (end < 0) this.err('unterminated quoted string', no);
      const trailing = full.slice(end).trim();
      if (trailing !== '' && !trailing.startsWith('#')) this.err(`unexpected text after quoted string: "${trailing.slice(0, 20)}"`, no);
      return this.parseQuoted(full.slice(0, end), no);
    }
    // plain scalar, possibly folded over more-indented following lines
    let plain = text;
    while (this.pos < this.lines.length) {
      const nl = this.lines[this.pos];
      if (!nl) break;
      const nt = this.contentOf(nl);
      if (nt === '' || nl.indent <= parentIndent) break;
      if (this.findMapColon(nt) >= 0 || /^-(\s|$)/.test(nt)) break;
      plain += ' ' + nt;
      this.pos++;
    }
    return this.plainScalar(plain);
  }

  flowBalanced(s: string): boolean {
    let depth = 0;
    let q: string | null = null;
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      if (q) {
        if (q === '"' && c === '\\') i++;
        else if (c === q) {
          if (q === "'" && s.charAt(i + 1) === "'") i++;
          else q = null;
        }
        continue;
      }
      if (c === '"' || c === "'") {
        // a quote only opens a quoted scalar at the start of a token
        const prev = i === 0 ? ' ' : s.charAt(i - 1);
        if (/[\s[{,:]/.test(prev)) q = c;
      } else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
    }
    return depth <= 0 && q === null;
  }

  plainScalar(s: string): unknown {
    const t = s.trim();
    if (t === '' || t === '~' || /^(null|Null|NULL)$/.test(t)) return null;
    if (/^(true|True|TRUE)$/.test(t)) return true;
    if (/^(false|False|FALSE)$/.test(t)) return false;
    if (/^[-+]?(0|[1-9][0-9]*)$/.test(t)) {
      const n = Number(t);
      return Number.isSafeInteger(n) ? n : t;
    }
    if (/^[-+]?(\.[0-9]+|[0-9]+\.[0-9]*|[0-9]+)([eE][-+]?[0-9]+)?$/.test(t) && !/^[-+]?0[0-9]/.test(t)) {
      const n = Number(t);
      return Number.isFinite(n) ? n : t;
    }
    return t;
  }

  parseQuoted(raw: string, no: number): string {
    const q = raw.charAt(0);
    const body = raw.slice(1, raw.length - 1);
    if (q === "'") return body.replace(/''/g, "'");
    let out = '';
    for (let i = 0; i < body.length; i++) {
      const c = body.charAt(i);
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = body.charAt(++i);
      switch (e) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case '0': out += '\0'; break;
        case 'a': out += '\x07'; break;
        case 'b': out += '\b'; break;
        case 'e': out += '\x1b'; break;
        case 'f': out += '\f'; break;
        case 'v': out += '\v'; break;
        case ' ': out += ' '; break;
        case '/': out += '/'; break;
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case 'N': out += '\u0085'; break;
        case '_': out += '\u00a0'; break;
        case 'x': {
          out += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16));
          i += 2;
          break;
        }
        case 'u': {
          out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16));
          i += 4;
          break;
        }
        case 'U': {
          out += String.fromCodePoint(parseInt(body.slice(i + 1, i + 9), 16));
          i += 8;
          break;
        }
        default:
          this.err(`unknown escape sequence "\\${e}"`, no);
      }
    }
    return out;
  }

  parseBlockScalar(header: string, parentIndent: number, no: number): string {
    const m = /^([|>])([+-]?)(\d?)([+-]?)\s*(#.*)?$/.exec(header);
    if (!m) this.err(`bad block scalar header "${header}"`, no);
    const style = m[1];
    const chomp = (m[2] || m[4]) ?? '';
    const lines: string[] = [];
    let blockIndent = m[3] ? parentIndent + Number(m[3]) : -1;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos];
      if (!l) break;
      const raw = l.raw;
      if (raw.trim() === '') {
        lines.push('');
        this.pos++;
        continue;
      }
      const ind = /^ */.exec(raw)?.[0].length ?? 0;
      if (blockIndent < 0) {
        if (ind <= parentIndent) break;
        blockIndent = ind;
      }
      if (ind < blockIndent) break;
      lines.push(raw.slice(blockIndent));
      this.pos++;
    }
    // trailing blank lines are subject to chomping
    let trailing = 0;
    while (lines.length && lines[lines.length - 1] === '') {
      lines.pop();
      trailing++;
    }
    let text: string;
    if (style === '|') text = lines.join('\n');
    else {
      text = '';
      for (let i = 0; i < lines.length; i++) {
        const cur = lines[i] ?? '';
        if (i === 0) text = cur;
        else if (cur === '') text += '\n';
        else if ((lines[i - 1] ?? '') === '' || /^\s/.test(cur) || /^\s/.test(lines[i - 1] ?? '')) text += (text.endsWith('\n') ? '' : '\n') + cur;
        else text += ' ' + cur;
      }
    }
    if (lines.length === 0) return chomp === '+' ? '\n'.repeat(trailing) : '';
    if (chomp === '-') return text;
    if (chomp === '+') return text + '\n'.repeat(trailing + 1);
    return text + '\n';
  }
}

class FlowParser {
  i = 0;
  constructor(private s: string, private no: number, private p: YamlParser) {}

  skipWs(): void {
    while (this.i < this.s.length && /\s/.test(this.s.charAt(this.i))) this.i++;
  }

  parseValue(): unknown {
    this.skipWs();
    const c = this.s.charAt(this.i);
    if (c === '[') return this.parseSeq();
    if (c === '{') return this.parseMap();
    if (c === '"' || c === "'") {
      const end = this.p.skipQuoted(this.s, this.i);
      if (end < 0) this.p.err('unterminated quoted string in flow collection', this.no);
      const v = this.p.parseQuoted(this.s.slice(this.i, end), this.no);
      this.i = end;
      return v;
    }
    if (c === '*') {
      const m = /^\*([\w-]+)/.exec(this.s.slice(this.i));
      if (m) {
        this.i += m[0].length;
        if (!this.p.anchors.has(m[1] ?? '')) this.p.err(`unknown alias *${m[1]}`, this.no);
        return this.p.anchors.get(m[1] ?? '');
      }
    }
    // plain scalar up to , ] } or ": "
    let j = this.i;
    while (j < this.s.length) {
      const ch = this.s.charAt(j);
      if (ch === ',' || ch === ']' || ch === '}') break;
      if (ch === ':' && (j + 1 >= this.s.length || /[\s,\]}]/.test(this.s.charAt(j + 1)))) break;
      j++;
    }
    const text = this.s.slice(this.i, j);
    this.i = j;
    return this.p.plainScalar(text);
  }

  parseSeq(): unknown[] {
    const arr: unknown[] = [];
    this.i++; // [
    for (;;) {
      this.skipWs();
      if (this.s.charAt(this.i) === ']') {
        this.i++;
        return arr;
      }
      if (this.i >= this.s.length) this.p.err('unterminated flow sequence', this.no);
      const v = this.parseValue();
      this.skipWs();
      if (this.s.charAt(this.i) === ':') {
        // single-pair mapping inside a sequence: [a: 1]
        this.i++;
        const val = this.parseValue();
        arr.push({ [String(v)]: val });
      } else arr.push(v);
      this.skipWs();
      if (this.s.charAt(this.i) === ',') this.i++;
      else if (this.s.charAt(this.i) !== ']') this.p.err('expected "," or "]" in flow sequence', this.no);
    }
  }

  parseMap(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    this.i++; // {
    for (;;) {
      this.skipWs();
      if (this.s.charAt(this.i) === '}') {
        this.i++;
        return obj;
      }
      if (this.i >= this.s.length) this.p.err('unterminated flow mapping', this.no);
      const k = this.parseValue();
      this.skipWs();
      let v: unknown = null;
      if (this.s.charAt(this.i) === ':') {
        this.i++;
        this.skipWs();
        const nx = this.s.charAt(this.i);
        if (nx !== ',' && nx !== '}') v = this.parseValue();
      }
      obj[String(k)] = v;
      this.skipWs();
      if (this.s.charAt(this.i) === ',') this.i++;
      else if (this.s.charAt(this.i) !== '}') this.p.err('expected "," or "}" in flow mapping', this.no);
    }
  }
}

export function parseYaml(text: string): unknown {
  return new YamlParser(text).parse();
}

// ---------------------------------------------------------------------------
// Direction A: docker run -> compose
// ---------------------------------------------------------------------------

export interface RunToComposeOptions {
  /** `environment:` as a map (KEY: value) or list (- KEY=value). */
  envStyle: 'map' | 'list';
  /** Where CPU/memory limits go: `deploy.resources` or the service-level keys (`cpus`, `mem_limit`...). */
  resources: 'deploy' | 'service';
  /** Declare non-default networks as `external: true` (they must exist) or define them in the file. */
  networks: 'external' | 'define';
}

export const DEFAULT_RUN_TO_COMPOSE: RunToComposeOptions = {
  envStyle: 'map',
  resources: 'deploy',
  networks: 'external',
};

export interface RunToComposeResult {
  yaml: string;
  services: string[];
  volumes: string[];
  networks: string[];
  warnings: Warning[];
  unknown: string[];
  commandCount: number;
}

const SERVICE_KEY_ORDER = [
  'image', 'platform', 'pull_policy', 'container_name', 'entrypoint', 'command', 'working_dir', 'user',
  'hostname', 'domainname', 'ports', 'expose', 'volumes', 'volumes_from', 'tmpfs', 'environment', 'env_file',
  'labels', 'annotations', 'restart', 'networks', 'network_mode', 'links', 'extra_hosts', 'dns', 'dns_search',
  'dns_opt', 'mac_address', 'privileged', 'cap_add', 'cap_drop', 'devices', 'device_cgroup_rules',
  'security_opt', 'userns_mode', 'pid', 'ipc', 'uts', 'cgroup', 'cgroup_parent', 'group_add', 'runtime',
  'isolation', 'init', 'read_only', 'tty', 'stdin_open', 'healthcheck', 'logging', 'stop_signal',
  'stop_grace_period', 'sysctls', 'ulimits', 'shm_size', 'storage_opt', 'mem_limit', 'mem_reservation',
  'memswap_limit', 'mem_swappiness', 'cpus', 'cpu_shares', 'cpuset', 'cpu_quota', 'cpu_period', 'cpu_count',
  'cpu_percent', 'cpu_rt_runtime', 'cpu_rt_period', 'pids_limit', 'oom_score_adj', 'oom_kill_disable',
  'blkio_config', 'link_local_ips', 'deploy',
];

function orderKeys(obj: Record<string, YValue | undefined>): Record<string, YValue | undefined> {
  const out: Record<string, YValue | undefined> = {};
  for (const k of SERVICE_KEY_ORDER) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out) && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function imageBasename(image: string): string {
  let s = image.replace(/@.*$/, '');
  s = s.replace(/^.*\//, '');
  s = s.replace(/:[^:]*$/, '');
  s = s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  return s || 'service';
}

function sanitizeServiceName(name: string): string {
  const s = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return s || 'service';
}

/** `$(pwd)`, `$PWD`, `${PWD}` -> `.` (paths in a Compose file are relative to the file). */
function replacePwd(s: string): { value: string; changed: boolean } {
  const out = s
    .replace(/^(\$\(pwd\)|`pwd`|\$\{PWD(?::-[^}]*)?\}|\$PWD)(?=\/|$)/, '.')
    .replace(/^"?(\$\(pwd\)|\$\{PWD\}|\$PWD)"?(?=\/|$)/, '.');
  return { value: out, changed: out !== s };
}

function splitColons(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === '$' && s.charAt(i + 1) === '{') depth++;
    else if (c === '}' && depth > 0) depth--;
    if (c === ':' && depth === 0) {
      // Windows drive letter: C:\ or C:/ at the very start of a part
      if (cur.length === 1 && /[A-Za-z]/.test(cur) && /^[\\/]/.test(s.slice(i + 1)) && parts.length === 0) {
        cur += c;
        continue;
      }
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function parseCsv(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") q = c;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function numberish(s: string): number | string {
  return /^-?\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : s;
}

const NAMED_VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

interface Ctx {
  opts: RunToComposeOptions;
  warnings: Warning[];
  volumes: Map<string, { [k: string]: YValue | undefined }>;
  networks: Set<string>;
}

function warn(ctx: Ctx, message: string): void {
  if (!ctx.warnings.some((w) => w.message === message)) ctx.warnings.push({ level: 'warn', message });
}
function note(ctx: Ctx, message: string): void {
  if (!ctx.warnings.some((w) => w.message === message)) ctx.warnings.push({ level: 'info', message });
}

function specToService(spec: RunSpec, ctx: Ctx, label: string): Record<string, YValue | undefined> {
  const svc: Record<string, YValue | undefined> = {};
  const vals = (k: string): string[] => spec.values.get(k) ?? [];
  const last = (k: string): string | undefined => {
    const l = vals(k);
    return l[l.length - 1];
  };
  const bool = (k: string): boolean => spec.bools.get(k) === true;
  const W = (m: string): void => warn(ctx, `${label}${m}`);
  const N = (m: string): void => note(ctx, `${label}${m}`);

  svc.image = spec.image;
  const platform = last('platform');
  if (platform) svc.platform = platform;
  const pull = last('pull');
  if (pull) {
    if (['always', 'missing', 'never'].includes(pull)) svc.pull_policy = pull;
    else W(`--pull ${pull} has no Compose equivalent (use always, missing or never).`);
  }
  const name = last('name');
  if (name) svc.container_name = name;

  // entrypoint & command
  const ep = last('entrypoint');
  if (ep !== undefined) {
    svc.entrypoint = ep === '' ? [] : [ep];
    if (/\s/.test(ep)) W(`--entrypoint "${ep}" contains spaces; docker run treats it as one executable. Put arguments after the image name.`);
  }
  if (spec.command.length) svc.command = [...spec.command];

  const wd = last('workdir');
  if (wd) svc.working_dir = wd;
  const user = last('user');
  if (user) svc.user = user;
  const host = last('hostname');
  if (host) svc.hostname = host;
  const dom = last('domainname');
  if (dom) svc.domainname = dom;

  // ports
  const ports = vals('publish');
  if (ports.length) {
    svc.ports = ports.map((p) => {
      if (!/^(?:(?:\[[0-9a-fA-F:]+\]|[0-9.]+|\$\{?[A-Za-z_][\w:-]*\}?):)?[\w${}.:-]*(?:\/(?:tcp|udp|sctp))?$/.test(p)) {
        W(`Port mapping "${p}" looks unusual; check it before use.`);
      }
      return p;
    });
  }
  if (bool('publish-all')) W('-P / --publish-all has no Compose equivalent: list the ports explicitly under "ports:".');
  const exposes = vals('expose');
  if (exposes.length) svc.expose = [...exposes];

  // volumes & mounts
  const volumes: YValue[] = [];
  let sawSubst = false;
  for (const v of vals('volume')) {
    const parts = splitColons(v);
    let source: string | undefined;
    let target: string;
    let mode: string | undefined;
    if (parts.length === 1) {
      target = parts[0] ?? '';
    } else if (parts.length === 2) {
      source = parts[0];
      target = parts[1] ?? '';
    } else {
      source = parts[0];
      target = parts[1] ?? '';
      mode = parts.slice(2).join(':');
    }
    let kind: 'anon' | 'bind' | 'named' | 'var' = 'anon';
    if (source !== undefined) {
      const r = replacePwd(source);
      if (r.changed) {
        source = r.value;
        N('Replaced $PWD / $(pwd) with "." (Compose resolves relative paths against the compose file).');
      }
      if (/^(\/|\.|~|[A-Za-z]:[\\/])/.test(source)) kind = 'bind';
      else if (source.startsWith('$')) kind = source.includes('/') ? 'bind' : 'var';
      else if (NAMED_VOLUME.test(source)) kind = 'named';
      else kind = 'bind';
      if (/\$\(|`/.test(source)) sawSubst = true;
    }
    if (kind === 'var') {
      N(`Volume source ${source} is a variable: declare the volume yourself if it is a named volume.`);
    }
    if (kind === 'named' && source !== undefined && !ctx.volumes.has(source)) ctx.volumes.set(source, {});
    if (source === undefined) volumes.push(target);
    else volumes.push(`${source}:${target}${mode ? ':' + mode : ''}`);
  }
  for (const m of vals('mount')) {
    const entry = mountToCompose(m, ctx, W);
    if (entry) volumes.push(entry);
  }
  for (const vf of vals('volumes-from')) {
    const [c, mode] = vf.split(':');
    const list = (svc.volumes_from as YValue[] | undefined) ?? [];
    list.push(`container:${c ?? ''}${mode ? ':' + mode : ''}`);
    svc.volumes_from = list;
  }
  if (volumes.length) svc.volumes = volumes;
  if (sawSubst) W('Command substitution in a volume path was kept as-is, but Compose does not run commands. Use a relative path or ${VAR}.');
  const tmpfs = vals('tmpfs');
  if (tmpfs.length) svc.tmpfs = [...tmpfs];
  if (last('volume-driver')) W('--volume-driver has no per-service equivalent: set "driver:" on the top-level volume instead.');

  // environment
  const envMap = new Map<string, string | null>();
  for (const e of vals('env')) {
    const eq = e.indexOf('=');
    if (eq < 0) envMap.set(e, null);
    else envMap.set(e.slice(0, eq), e.slice(eq + 1));
  }
  if (envMap.size) {
    if (ctx.opts.envStyle === 'list') {
      svc.environment = [...envMap].map(([k, v]) => (v === null ? k : `${k}=${v}`));
    } else {
      const obj: Record<string, YValue> = {};
      for (const [k, v] of envMap) obj[k] = v;
      svc.environment = obj;
    }
    for (const v of envMap.values()) {
      if (v && /\$\(|`/.test(v)) {
        W('Command substitution in an environment value was kept as-is, but Compose does not run commands. Use a literal value or ${VAR}.');
        break;
      }
    }
  }
  const envFiles = vals('env-file').map((f) => replacePwd(f).value);
  if (envFiles.length) svc.env_file = envFiles;

  // labels
  const labels = vals('label');
  if (labels.length) {
    const obj: Record<string, YValue> = {};
    for (const l of labels) {
      const eq = l.indexOf('=');
      if (eq < 0) obj[l] = '';
      else obj[l.slice(0, eq)] = l.slice(eq + 1);
    }
    svc.labels = obj;
  }
  if (vals('label-file').length) W('--label-file has no Compose equivalent: inline the labels under "labels:".');
  const ann = vals('annotation');
  if (ann.length) {
    const obj: Record<string, YValue> = {};
    for (const l of ann) {
      const eq = l.indexOf('=');
      obj[eq < 0 ? l : l.slice(0, eq)] = eq < 0 ? '' : l.slice(eq + 1);
    }
    svc.annotations = obj;
  }

  // restart
  const restart = last('restart');
  if (restart) svc.restart = restart;

  // networks
  const netSpecs: { name: string; aliases: string[]; ip?: string; ip6?: string; mac?: string }[] = [];
  let networkMode: string | undefined;
  for (const nv of vals('network')) {
    if (nv.includes('=') && /(^|,)name=/.test(nv)) {
      const kv: Record<string, string> = {};
      const aliases: string[] = [];
      for (const part of parseCsv(nv)) {
        const eq = part.indexOf('=');
        const k = eq < 0 ? part : part.slice(0, eq);
        const val = eq < 0 ? '' : part.slice(eq + 1);
        if (k === 'alias') aliases.push(val);
        else kv[k] = val;
      }
      netSpecs.push({ name: kv.name ?? 'default', aliases, ip: kv.ip, ip6: kv.ip6, mac: kv['mac-address'] });
      continue;
    }
    if (nv === 'host' || nv === 'none' || nv === 'bridge' || nv.startsWith('container:') || nv.startsWith('service:')) {
      networkMode = nv;
    } else if (nv === 'default') {
      // the default bridge: nothing to do
    } else {
      netSpecs.push({ name: nv, aliases: [] });
    }
  }
  const aliasFlags = vals('network-alias');
  const ip = last('ip');
  const ip6 = last('ip6');
  const mac = last('mac-address');
  if (networkMode) {
    svc.network_mode = networkMode;
    if (aliasFlags.length || ip || ip6) W(`--network-alias / --ip only work on user-defined networks, not with network mode "${networkMode}".`);
  } else if (netSpecs.length || aliasFlags.length || ip || ip6) {
    if (netSpecs.length === 0) netSpecs.push({ name: 'default', aliases: [] });
    const primary = netSpecs[netSpecs.length - 1];
    if (primary) {
      primary.aliases.push(...aliasFlags);
      if (ip) primary.ip = ip;
      if (ip6) primary.ip6 = ip6;
    }
    const detailed = netSpecs.some((n) => n.aliases.length || n.ip || n.ip6 || n.mac);
    if (detailed) {
      const obj: Record<string, YValue> = {};
      for (const n of netSpecs) {
        const d: Record<string, YValue | undefined> = {};
        if (n.aliases.length) d.aliases = n.aliases;
        if (n.ip) d.ipv4_address = n.ip;
        if (n.ip6) d.ipv6_address = n.ip6;
        if (n.mac) d.mac_address = n.mac;
        obj[n.name] = d as YValue;
      }
      svc.networks = obj;
    } else {
      svc.networks = netSpecs.map((n) => n.name);
    }
    for (const n of netSpecs) if (n.name !== 'default') ctx.networks.add(n.name);
  }
  if (mac) svc.mac_address = mac;
  const lls = vals('link-local-ip');
  if (lls.length) svc.link_local_ips = lls;
  const links = vals('link');
  if (links.length) {
    svc.links = links;
    W('--link is deprecated. Services on the same Compose network reach each other by service name, so "links:" is rarely needed.');
  }
  const hosts = vals('add-host');
  if (hosts.length) svc.extra_hosts = hosts;
  if (vals('dns').length) svc.dns = vals('dns');
  if (vals('dns-search').length) svc.dns_search = vals('dns-search');
  if (vals('dns-option').length) svc.dns_opt = vals('dns-option');

  // security / kernel
  if (bool('privileged')) svc.privileged = true;
  if (vals('cap-add').length) svc.cap_add = vals('cap-add');
  if (vals('cap-drop').length) svc.cap_drop = vals('cap-drop');
  if (vals('device').length) svc.devices = vals('device');
  if (vals('device-cgroup-rule').length) svc.device_cgroup_rules = vals('device-cgroup-rule');
  if (vals('security-opt').length) svc.security_opt = vals('security-opt');
  const userns = last('userns');
  if (userns) svc.userns_mode = userns;
  const pid = last('pid');
  if (pid) svc.pid = pid;
  const ipc = last('ipc');
  if (ipc) svc.ipc = ipc;
  const uts = last('uts');
  if (uts) svc.uts = uts;
  const cgns = last('cgroupns');
  if (cgns) svc.cgroup = cgns;
  const cgp = last('cgroup-parent');
  if (cgp) svc.cgroup_parent = cgp;
  if (vals('group-add').length) svc.group_add = vals('group-add');
  const runtime = last('runtime');
  if (runtime) svc.runtime = runtime;
  const iso = last('isolation');
  if (iso) svc.isolation = iso;
  if (bool('init')) svc.init = true;
  if (bool('read-only')) svc.read_only = true;
  if (bool('tty')) svc.tty = true;
  if (bool('interactive')) svc.stdin_open = true;

  // healthcheck
  if (bool('no-healthcheck')) {
    svc.healthcheck = { disable: true };
  } else {
    const hc: Record<string, YValue | undefined> = {};
    const cmd = last('health-cmd');
    if (cmd !== undefined) hc.test = cmd.toUpperCase() === 'NONE' ? ['NONE'] : ['CMD-SHELL', cmd];
    if (last('health-interval')) hc.interval = last('health-interval');
    if (last('health-timeout')) hc.timeout = last('health-timeout');
    const retries = last('health-retries');
    if (retries !== undefined) hc.retries = numberish(retries);
    if (last('health-start-period')) hc.start_period = last('health-start-period');
    if (last('health-start-interval')) hc.start_interval = last('health-start-interval');
    if (Object.keys(hc).length) svc.healthcheck = hc;
  }

  // logging
  const ld = last('log-driver');
  const lo = vals('log-opt');
  if (ld || lo.length) {
    const lg: Record<string, YValue | undefined> = {};
    if (ld) lg.driver = ld;
    if (lo.length) {
      const o: Record<string, YValue> = {};
      for (const kv of lo) {
        const eq = kv.indexOf('=');
        o[eq < 0 ? kv : kv.slice(0, eq)] = eq < 0 ? '' : kv.slice(eq + 1);
      }
      lg.options = o;
    }
    svc.logging = lg;
  }

  const sig = last('stop-signal');
  if (sig) svc.stop_signal = sig;
  const st = last('stop-timeout');
  if (st !== undefined) svc.stop_grace_period = /^\d+$/.test(st) ? `${st}s` : st;

  // sysctls / ulimits / misc kernel params
  if (vals('sysctl').length) {
    const o: Record<string, YValue> = {};
    for (const kv of vals('sysctl')) {
      const eq = kv.indexOf('=');
      const key = eq < 0 ? kv : kv.slice(0, eq);
      const val = eq < 0 ? '' : kv.slice(eq + 1);
      o[key] = numberish(val);
    }
    svc.sysctls = o;
  }
  if (vals('ulimit').length) {
    const o: Record<string, YValue> = {};
    for (const kv of vals('ulimit')) {
      const eq = kv.indexOf('=');
      if (eq < 0) {
        W(`--ulimit ${kv} needs a value, e.g. nofile=1024:2048.`);
        continue;
      }
      const key = kv.slice(0, eq);
      const val = kv.slice(eq + 1);
      const [soft, hard] = val.split(':');
      if (hard !== undefined) o[key] = { soft: numberish(soft ?? ''), hard: numberish(hard) };
      else o[key] = numberish(val);
    }
    svc.ulimits = o;
  }
  const shm = last('shm-size');
  if (shm) svc.shm_size = shm;
  if (vals('storage-opt').length) {
    const o: Record<string, YValue> = {};
    for (const kv of vals('storage-opt')) {
      const eq = kv.indexOf('=');
      o[eq < 0 ? kv : kv.slice(0, eq)] = eq < 0 ? '' : kv.slice(eq + 1);
    }
    svc.storage_opt = o;
  }

  // resources
  const mem = last('memory');
  const memRes = last('memory-reservation');
  const cpus = last('cpus');
  const deployLimits: Record<string, YValue | undefined> = {};
  const deployRes: Record<string, YValue | undefined> = {};
  if (ctx.opts.resources === 'deploy') {
    if (cpus) deployLimits.cpus = cpus;
    if (mem) deployLimits.memory = mem;
    if (memRes) deployRes.memory = memRes;
  } else {
    if (mem) svc.mem_limit = mem;
    if (memRes) svc.mem_reservation = memRes;
    if (cpus) svc.cpus = /^\d+(\.\d+)?$/.test(cpus) ? Number(cpus) : cpus;
  }
  const swap = last('memory-swap');
  if (swap) svc.memswap_limit = swap;
  const swappiness = last('memory-swappiness');
  if (swappiness !== undefined) svc.mem_swappiness = numberish(swappiness);
  const intKeys: [string, string][] = [
    ['cpu-shares', 'cpu_shares'], ['cpu-quota', 'cpu_quota'], ['cpu-period', 'cpu_period'],
    ['cpu-count', 'cpu_count'], ['cpu-percent', 'cpu_percent'], ['cpu-rt-runtime', 'cpu_rt_runtime'],
    ['cpu-rt-period', 'cpu_rt_period'], ['pids-limit', 'pids_limit'], ['oom-score-adj', 'oom_score_adj'],
  ];
  for (const [flag, key] of intKeys) {
    const v = last(flag);
    if (v !== undefined) svc[key] = numberish(v);
  }
  const cpuset = last('cpuset-cpus');
  if (cpuset) svc.cpuset = cpuset;
  if (last('cpuset-mems')) W('--cpuset-mems has no Compose equivalent.');
  if (bool('oom-kill-disable')) svc.oom_kill_disable = true;
  if (last('kernel-memory')) W('--kernel-memory has no Compose equivalent (it was removed from Docker).');
  if (last('io-maxbandwidth') || last('io-maxiops')) W('--io-maxbandwidth / --io-maxiops (Windows only) have no Compose equivalent.');

  // block IO
  const blk: Record<string, YValue | undefined> = {};
  const bw = last('blkio-weight');
  if (bw !== undefined) blk.weight = numberish(bw);
  const pathVal = (list: string[], valKey: string, numeric: boolean): YValue[] =>
    list.map((s) => {
      const k = s.lastIndexOf(':');
      const path = k < 0 ? s : s.slice(0, k);
      const val = k < 0 ? '' : s.slice(k + 1);
      return { path, [valKey]: numeric ? numberish(val) : val };
    });
  if (vals('blkio-weight-device').length) blk.weight_device = pathVal(vals('blkio-weight-device'), 'weight', true);
  if (vals('device-read-bps').length) blk.device_read_bps = pathVal(vals('device-read-bps'), 'rate', false);
  if (vals('device-write-bps').length) blk.device_write_bps = pathVal(vals('device-write-bps'), 'rate', false);
  if (vals('device-read-iops').length) blk.device_read_iops = pathVal(vals('device-read-iops'), 'rate', true);
  if (vals('device-write-iops').length) blk.device_write_iops = pathVal(vals('device-write-iops'), 'rate', true);
  if (Object.keys(blk).length) svc.blkio_config = blk;

  // GPUs
  const gpus = last('gpus');
  if (gpus !== undefined) {
    const dev = gpuToDevice(gpus);
    deployRes.devices = [dev];
  }
  if (Object.keys(deployLimits).length || Object.keys(deployRes).length) {
    const res: Record<string, YValue | undefined> = {};
    if (Object.keys(deployLimits).length) res.limits = deployLimits;
    if (Object.keys(deployRes).length) res.reservations = deployRes;
    svc.deploy = { resources: res };
    if (gpus === undefined && ctx.opts.resources === 'deploy') {
      N('Resource limits are written under deploy.resources (honoured by Docker Compose v2). Switch the option to get mem_limit / cpus instead.');
    }
  }

  // things without an equivalent
  if (bool('rm')) W('--rm has no Compose equivalent: use "docker compose run --rm <service>" for throw-away containers.');
  if (bool('detach')) N('-d / --detach is a CLI option: start the stack in the background with "docker compose up -d".');
  if (last('cidfile')) W('--cidfile has no Compose equivalent.');
  if (vals('attach').length) W('-a / --attach has no Compose equivalent.');
  if (bool('quiet')) N('-q / --quiet was ignored (pull output is not a service setting).');
  if (spec.bools.has('sig-proxy')) W('--sig-proxy has no Compose equivalent.');
  if (bool('disable-content-trust')) N('--disable-content-trust was ignored: use the DOCKER_CONTENT_TRUST environment variable.');
  if (last('detach-keys')) W('--detach-keys has no Compose equivalent.');
  if (bool('help')) N('--help was ignored.');
  return svc;
}

function gpuToDevice(spec: string): Record<string, YValue | undefined> {
  const dev: Record<string, YValue | undefined> = {};
  let driver: string | undefined;
  let count: YValue | undefined;
  let ids: string[] | undefined;
  let caps: string[] = [];
  const parts = parseCsv(spec);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] ?? '';
    const eq = p.indexOf('=');
    const k = eq < 0 ? '' : p.slice(0, eq);
    const v = eq < 0 ? p : p.slice(eq + 1);
    if (k === 'driver') driver = v;
    else if (k === 'count') count = v === 'all' || v === '-1' ? 'all' : numberish(v);
    else if (k === 'device') {
      ids = v.split(',').filter(Boolean);
      // device=0,1 splits on the comma: gather following bare numbers
      while (i + 1 < parts.length && !(parts[i + 1] ?? '').includes('=')) {
        ids.push(parts[i + 1] ?? '');
        i++;
      }
    } else if (k === 'capabilities') caps.push(...v.split(',').filter(Boolean));
    else if (k === '' && (v === 'all' || v === '-1')) count = 'all';
    else if (k === '' && /^\d+$/.test(v)) count = Number(v);
    else if (k === '' && v) caps.push(v);
  }
  if (caps.length === 0) caps = ['gpu'];
  dev.driver = driver ?? 'nvidia';
  if (ids) dev.device_ids = ids;
  else dev.count = count ?? 'all';
  dev.capabilities = caps;
  return dev;
}

function mountToCompose(m: string, ctx: Ctx, W: (s: string) => void): YValue | null {
  const kv: Record<string, string> = {};
  const volumeOpts: Record<string, string> = {};
  for (const part of parseCsv(m)) {
    const eq = part.indexOf('=');
    const k = (eq < 0 ? part : part.slice(0, eq)).trim();
    const v = eq < 0 ? '' : part.slice(eq + 1);
    if (k === 'volume-opt') {
      const e2 = v.indexOf('=');
      volumeOpts[e2 < 0 ? v : v.slice(0, e2)] = e2 < 0 ? '' : v.slice(e2 + 1);
    } else kv[k] = v;
  }
  const type = kv.type ?? 'volume';
  const source = kv.source ?? kv.src;
  const target = kv.target ?? kv.destination ?? kv.dst;
  if (!target) {
    W(`--mount "${m}" has no target and was skipped.`);
    return null;
  }
  const entry: Record<string, YValue | undefined> = { type, source: source ? replacePwd(source).value : undefined, target };
  const ro = kv.readonly ?? kv.ro;
  if (ro !== undefined && ro !== 'false' && ro !== '0') entry.read_only = true;
  if (type === 'bind') {
    const bind: Record<string, YValue | undefined> = {};
    if (kv['bind-propagation']) bind.propagation = kv['bind-propagation'];
    if (kv['bind-nonrecursive'] !== undefined && kv['bind-nonrecursive'] !== 'false') bind.recursive = 'disabled';
    if (Object.keys(bind).length) entry.bind = bind;
  } else if (type === 'volume') {
    const vol: Record<string, YValue | undefined> = {};
    if (kv['volume-nocopy'] !== undefined && kv['volume-nocopy'] !== 'false') vol.nocopy = true;
    if (kv['volume-subpath']) vol.subpath = kv['volume-subpath'];
    if (Object.keys(vol).length) entry.volume = vol;
    if (source && NAMED_VOLUME.test(source)) {
      const def: Record<string, YValue | undefined> = ctx.volumes.get(source) ?? {};
      if (kv['volume-driver']) def.driver = kv['volume-driver'];
      if (Object.keys(volumeOpts).length) def.driver_opts = volumeOpts;
      ctx.volumes.set(source, def);
    }
  } else if (type === 'tmpfs') {
    const t: Record<string, YValue | undefined> = {};
    if (kv['tmpfs-size']) t.size = numberish(kv['tmpfs-size']);
    if (kv['tmpfs-mode']) t.mode = numberish(kv['tmpfs-mode']);
    if (Object.keys(t).length) entry.tmpfs = t;
  } else if (type !== 'npipe') {
    W(`--mount type=${type} is not a Compose volume type; it was copied as-is.`);
  }
  if (kv.consistency) entry.consistency = kv.consistency;
  return entry as YValue;
}

export function dockerRunToCompose(input: string, options: Partial<RunToComposeOptions> = {}): RunToComposeResult {
  const opts: RunToComposeOptions = { ...DEFAULT_RUN_TO_COMPOSE, ...options };
  const { commands, warnings: shellWarnings } = splitShellCommands(input);
  const ctx: Ctx = { opts, warnings: [...shellWarnings], volumes: new Map(), networks: new Set() };
  const services = new Map<string, Record<string, YValue | undefined>>();
  const unknownAll: string[] = [];
  let count = 0;
  const multi = commands.filter((c) => c.length).length > 1;

  for (const words of commands) {
    const { spec, skipped, notes } = parseRunWords(words);
    for (const nt of notes) {
      if (!ctx.warnings.some((w) => w.message === nt.message)) ctx.warnings.push(nt);
    }
    if (!spec) {
      if (skipped) {
        const short = skipped.length > 70 ? skipped.slice(0, 70) + '…' : skipped;
        ctx.warnings.push({ level: 'info', message: `Skipped (not a docker run command): ${short}` });
      }
      continue;
    }
    count++;
    const nameList = spec.values.get('name');
    const nameFlag = nameList ? nameList[nameList.length - 1] : undefined;
    let base = sanitizeServiceName(nameFlag ?? imageBasename(spec.image));
    let svcName = base;
    let n = 2;
    while (services.has(svcName)) svcName = `${base}-${n++}`;
    base = svcName;
    const label = multi ? `[${svcName}] ` : '';
    const svc = specToService(spec, ctx, label);
    for (const u of spec.unknown) {
      unknownAll.push(u);
      ctx.warnings.push({ level: 'warn', message: `${label}Unknown flag ${u} was not converted. If it takes a value, that value may have been read as the image name.` });
    }
    services.set(svcName, orderKeys(svc));
  }

  if (count === 0) {
    throw new ConvertError(
      commands.length === 0
        ? 'No command found. Paste one or more "docker run ..." commands.'
        : 'No "docker run" command found in the input.'
    );
  }

  const doc: Record<string, YValue | undefined> = {};
  const svcObj: Record<string, YValue | undefined> = {};
  for (const [k, v] of services) svcObj[k] = v;
  doc.services = svcObj;
  if (ctx.volumes.size) {
    const v: Record<string, YValue | undefined> = {};
    for (const [k, def] of ctx.volumes) v[k] = def;
    doc.volumes = v;
  }
  if (ctx.networks.size) {
    const nets: Record<string, YValue | undefined> = {};
    for (const nm of ctx.networks) nets[nm] = opts.networks === 'external' ? { external: true } : {};
    doc.networks = nets;
    if (opts.networks === 'external') {
      ctx.warnings.push({ level: 'info', message: `Network${ctx.networks.size > 1 ? 's' : ''} ${[...ctx.networks].join(', ')} declared as external: create ${ctx.networks.size > 1 ? 'them' : 'it'} first (docker network create), or switch the option to define ${ctx.networks.size > 1 ? 'them' : 'it'} in the file.` });
    }
  }
  return {
    yaml: emitYaml(doc as YValue),
    services: [...services.keys()],
    volumes: [...ctx.volumes.keys()],
    networks: [...ctx.networks],
    warnings: ctx.warnings,
    unknown: unknownAll,
    commandCount: count,
  };
}

// ---------------------------------------------------------------------------
// Direction B: compose -> docker run
// ---------------------------------------------------------------------------

export interface ComposeToRunOptions {
  detach: boolean;
  multiline: boolean;
  /** Emit `docker network create` / `docker volume create` for non-external top-level resources. */
  createResources: boolean;
  /** Add --rm. */
  rm: boolean;
}

export const DEFAULT_COMPOSE_TO_RUN: ComposeToRunOptions = {
  detach: true,
  multiline: true,
  createResources: true,
  rm: false,
};

export interface ComposeToRunResult {
  script: string;
  services: string[];
  warnings: Warning[];
  commandCount: number;
}

/** Quote a string for a POSIX shell. `$VAR`/`${VAR}` (Compose interpolation) stay expandable; `$$` becomes a literal `$`. */
export function shellQuote(value: string): string {
  if (value === '') return "''";
  const hasVar = /\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/.test(value.replace(/\$\$/g, ''));
  if (!hasVar) {
    const lit = value.replace(/\$\$/g, '$');
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(lit)) return lit;
    return `'${lit.replace(/'/g, `'\\''`)}'`;
  }
  // double quotes, keeping expansions alive
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charAt(i);
    if (c === '$' && value.charAt(i + 1) === '$') {
      out += '\\$';
      i++;
    } else if (c === '"' || c === '\\' || c === '`') out += '\\' + c;
    else out += c;
  }
  return `"${out}"`;
}

function asList(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function kvList(v: unknown): [string, string | null][] {
  const out: [string, string | null][] = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = str(item);
      const eq = s.indexOf('=');
      if (eq < 0) out.push([s, null]);
      else out.push([s.slice(0, eq), s.slice(eq + 1)]);
    }
  } else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out.push([k, val === null || val === undefined ? null : str(val)]);
    }
  }
  return out;
}

/** "1m30s" / "30s" / "500ms" / 10 -> seconds (rounded up). */
export function durationToSeconds(v: unknown): number | null {
  if (typeof v === 'number') return Math.ceil(v);
  const s = str(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const re = /(\d+(?:\.\d+)?)(ms|us|µs|ns|s|m|h)/g;
  let total = 0;
  let matched = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    const u = m[2];
    total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : u === 's' ? n : u === 'ms' ? n / 1000 : n / 1e6;
    matched += m[0].length;
  }
  if (matched !== s.length || matched === 0) return null;
  return Math.ceil(total);
}

const UNSUPPORTED_RUN_KEYS: Record<string, string> = {
  depends_on: 'start order only: the services are listed in dependency order, start them in that order yourself (or wait for health).',
  profiles: 'profiles select services in Compose; docker run has no equivalent.',
  configs: 'configs have no docker run equivalent (mount the file with -v instead).',
  secrets: 'secrets have no docker run equivalent (mount the secret file with -v, or use Swarm secrets).',
  extends: 'extends is resolved by Compose; merge the base service into this one first.',
  scale: 'scale / replicas: run the command several times with different --name values.',
  develop: 'develop / watch is a Compose feature.',
  post_start: 'lifecycle hooks are a Compose feature.',
  pre_stop: 'lifecycle hooks are a Compose feature.',
  attach: 'attach is a Compose feature.',
  credential_spec: 'credential_spec is Windows/Swarm only.',
  use_api_socket: 'use_api_socket is a Compose feature.',
  models: 'models are a Compose feature.',
  provider: 'provider services are a Compose feature.',
  label_file: 'label_file has no docker run equivalent.',
};

function toGpus(d: Record<string, unknown>): string | null {
  const count = d.count;
  const ids = asList(d.device_ids).map(str);
  const caps = asList(d.capabilities).map(str);
  const parts: string[] = [];
  if (ids.length) parts.push(`"device=${ids.join(',')}"`);
  else if (count === 'all' || count === -1 || count === undefined) parts.push('all');
  else parts.push(str(count));
  if (d.driver && d.driver !== 'nvidia') parts.push(`driver=${str(d.driver)}`);
  const extra = caps.filter((c) => c !== 'gpu');
  if (extra.length) parts.push(`capabilities=${extra.join(',')}`);
  const joined = parts.join(',');
  return joined.startsWith('"') || parts.length > 1 ? `'${joined}'` : joined;
}

interface RunBuild {
  groups: string[][];
  image: string;
  args: string[];
  buildCmd: string | null;
}

export function composeToDockerRun(yamlText: string, options: Partial<ComposeToRunOptions> = {}): ComposeToRunResult {
  const opts: ComposeToRunOptions = { ...DEFAULT_COMPOSE_TO_RUN, ...options };
  if (yamlText.trim() === '') throw new ConvertError('Paste a compose.yaml file.');
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (e) {
    if (e instanceof YamlError) throw new ConvertError(e.message);
    throw e;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new ConvertError('The YAML document must be a mapping with a "services:" key.');
  const root = doc as Record<string, unknown>;
  const servicesRaw = root.services;
  if (!servicesRaw || typeof servicesRaw !== 'object' || Array.isArray(servicesRaw)) {
    throw new ConvertError('No "services:" mapping found in the compose file.');
  }
  const services = servicesRaw as Record<string, unknown>;
  const names = Object.keys(services);
  if (names.length === 0) throw new ConvertError('The "services:" mapping is empty.');

  const warnings: Warning[] = [];
  const addWarn = (level: Warning['level'], message: string): void => {
    if (!warnings.some((w) => w.message === message)) warnings.push({ level, message });
  };
  const topNetworks = (root.networks && typeof root.networks === 'object' ? root.networks : {}) as Record<string, unknown>;
  const topVolumes = (root.volumes && typeof root.volumes === 'object' ? root.volumes : {}) as Record<string, unknown>;

  // dependency order
  const deps = new Map<string, string[]>();
  for (const nm of names) {
    const s = services[nm];
    const d = s && typeof s === 'object' ? (s as Record<string, unknown>).depends_on : undefined;
    deps.set(nm, Array.isArray(d) ? d.map(str) : d && typeof d === 'object' ? Object.keys(d) : []);
  }
  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visit = (nm: string): void => {
    if (ordered.includes(nm)) return;
    if (visiting.has(nm)) return;
    visiting.add(nm);
    for (const dep of deps.get(nm) ?? []) if (names.includes(dep)) visit(dep);
    visiting.delete(nm);
    ordered.push(nm);
  };
  names.forEach(visit);

  const containerNameOf = (nm: string): string => {
    const s = services[nm];
    const cn = s && typeof s === 'object' ? (s as Record<string, unknown>).container_name : undefined;
    return cn ? str(cn) : nm;
  };

  const usedNetworks = new Set<string>();
  const usedVolumes = new Set<string>();
  const out: string[] = [];
  const preamble: string[] = [];
  let count = 0;
  let projectNote = false;

  const networkName = (key: string): string => {
    const def = topNetworks[key];
    if (def && typeof def === 'object') {
      const d = def as Record<string, unknown>;
      if (d.name) return str(d.name);
      if (d.external && typeof d.external === 'object') {
        const en = (d.external as Record<string, unknown>).name;
        if (en) return str(en);
      }
    }
    return key;
  };

  for (const nm of ordered) {
    const raw = services[nm];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      addWarn('warn', `Service "${nm}" is not a mapping and was skipped.`);
      continue;
    }
    const s = raw as Record<string, unknown>;
    const label = names.length > 1 ? `[${nm}] ` : '';
    const W = (m: string): void => addWarn('warn', `${label}${m}`);
    const I = (m: string): void => addWarn('info', `${label}${m}`);
    const b: RunBuild = { groups: [], image: '', args: [], buildCmd: null };
    const add = (...g: string[]): void => {
      b.groups.push(g);
    };

    // image / build
    const build = s.build;
    const imageTag = s.image ? str(s.image) : build ? `${nm}` : '';
    if (!imageTag) {
      W('has neither "image" nor "build"; skipped.');
      continue;
    }
    b.image = imageTag;
    if (build) {
      const ctxDir = typeof build === 'string' ? build : str((build as Record<string, unknown>).context ?? '.');
      const bo = typeof build === 'object' && build !== null ? (build as Record<string, unknown>) : {};
      const bargs: string[] = ['docker', 'build', '-t', shellQuote(imageTag)];
      if (bo.dockerfile) bargs.push('-f', shellQuote(str(bo.dockerfile)));
      if (bo.target) bargs.push('--target', shellQuote(str(bo.target)));
      if (bo.platforms && Array.isArray(bo.platforms) && bo.platforms[0]) bargs.push('--platform', shellQuote(str(bo.platforms[0])));
      for (const [k, v] of kvList(bo.args)) bargs.push('--build-arg', shellQuote(v === null ? k : `${k}=${v}`));
      for (const [k, v] of kvList(bo.labels)) bargs.push('--label', shellQuote(`${k}=${v ?? ''}`));
      for (const c of asList(bo.cache_from)) bargs.push('--cache-from', shellQuote(str(c)));
      if (bo.network) bargs.push('--network', shellQuote(str(bo.network)));
      if (bo.shm_size) bargs.push('--shm-size', shellQuote(str(bo.shm_size)));
      for (const k of Object.keys(bo)) {
        if (!['context', 'dockerfile', 'target', 'platforms', 'args', 'labels', 'cache_from', 'network', 'shm_size'].includes(k)) {
          I(`build.${k} is not converted.`);
        }
      }
      bargs.push(shellQuote(ctxDir));
      b.buildCmd = bargs.join(' ');
      if (!s.image) I(`has no "image": the built image is tagged "${imageTag}".`);
    }

    // name
    add('--name', shellQuote(containerNameOf(nm)));
    if (!s.container_name) addWarn('info', 'Services without container_name get "--name <service>" (Compose itself would name them <project>-<service>-1).');
    if (s.hostname) add('--hostname', shellQuote(str(s.hostname)));
    if (s.domainname) add('--domainname', shellQuote(str(s.domainname)));
    if (s.user !== undefined) add('--user', shellQuote(str(s.user)));
    if (s.working_dir) add('--workdir', shellQuote(str(s.working_dir)));

    // entrypoint / command
    let epExtra: string[] = [];
    if (s.entrypoint !== undefined) {
      const epWords: string[] = Array.isArray(s.entrypoint) ? s.entrypoint.map(str) : splitCommandString(str(s.entrypoint));
      if (epWords.length === 0 || (epWords.length === 1 && epWords[0] === '')) add('--entrypoint', "''");
      else {
        add('--entrypoint', shellQuote(epWords[0] ?? ''));
        epExtra = epWords.slice(1);
      }
    }
    let cmdWords: string[] = [];
    if (s.command !== undefined && s.command !== null) {
      cmdWords = Array.isArray(s.command) ? s.command.map(str) : splitCommandString(str(s.command));
    }
    b.args = [...epExtra, ...cmdWords].map(shellQuote);

    // ports
    for (const p of asList(s.ports)) {
      if (p && typeof p === 'object') {
        const po = p as Record<string, unknown>;
        const target = str(po.target);
        const proto = po.protocol ? `/${str(po.protocol)}` : '';
        const pub = po.published !== undefined ? str(po.published) : '';
        const hip = po.host_ip ? str(po.host_ip) : '';
        let spec: string;
        if (hip) spec = `${hip.includes(':') ? `[${hip}]` : hip}:${pub}:${target}${proto}`;
        else if (pub) spec = `${pub}:${target}${proto}`;
        else spec = `${target}${proto}`;
        add('-p', shellQuote(spec));
      } else add('-p', shellQuote(str(p)));
    }
    for (const e of asList(s.expose)) add('--expose', shellQuote(str(e)));

    // volumes
    for (const v of asList(s.volumes)) {
      if (typeof v === 'string') {
        const parts = splitColons(v);
        const src = parts.length >= 2 ? parts[0] ?? '' : '';
        if (src && !/^(\/|\.|~|\$|[A-Za-z]:[\\/])/.test(src)) usedVolumes.add(src);
        const abs = absoluteBindSource(src);
        if (abs !== src) addWarn('info', 'Relative host paths were made absolute with $PWD / $HOME: docker run requires absolute bind-mount paths.');
        add('-v', shellQuote(abs + v.slice(src.length)));
      } else if (v && typeof v === 'object') {
        const vo = v as Record<string, unknown>;
        const type = str(vo.type ?? 'volume');
        const target = str(vo.target);
        let source = vo.source !== undefined ? str(vo.source) : '';
        if (type === 'bind' && source) {
          const abs = absoluteBindSource(source);
          if (abs !== source) addWarn('info', 'Relative host paths were made absolute with $PWD / $HOME: docker run requires absolute bind-mount paths.');
          source = abs;
        }
        const extra = vo.bind || vo.volume || vo.tmpfs || vo.consistency || vo.image || (type !== 'bind' && type !== 'volume' && type !== 'tmpfs');
        if (type === 'tmpfs' && !extra) {
          add('--tmpfs', shellQuote(target));
        } else if (!extra && (type === 'bind' || type === 'volume')) {
          if (type === 'volume' && source) usedVolumes.add(source);
          const sp = source ? `${source}:${target}` : target;
          add('-v', shellQuote(vo.read_only ? `${sp}:ro` : sp));
        } else {
          const kv: string[] = [`type=${type}`];
          if (source) kv.push(`source=${source}`);
          kv.push(`target=${target}`);
          if (vo.read_only) kv.push('readonly');
          const bind = (vo.bind ?? {}) as Record<string, unknown>;
          if (bind.propagation) kv.push(`bind-propagation=${str(bind.propagation)}`);
          const vol = (vo.volume ?? {}) as Record<string, unknown>;
          if (vol.nocopy) kv.push('volume-nocopy');
          if (vol.subpath) kv.push(`volume-subpath=${str(vol.subpath)}`);
          const tm = (vo.tmpfs ?? {}) as Record<string, unknown>;
          if (tm.size !== undefined) kv.push(`tmpfs-size=${str(tm.size)}`);
          if (tm.mode !== undefined) kv.push(`tmpfs-mode=${str(tm.mode)}`);
          if (vo.consistency) kv.push(`consistency=${str(vo.consistency)}`);
          if (type === 'volume' && source) usedVolumes.add(source);
          add('--mount', shellQuote(kv.join(',')));
        }
      }
    }
    for (const t of asList(s.tmpfs)) add('--tmpfs', shellQuote(str(t)));
    for (const vf of asList(s.volumes_from)) {
      const text = str(vf);
      const parts = text.split(':');
      let target = parts[0] ?? '';
      let mode = '';
      if (target === 'container') {
        target = parts[1] ?? '';
        mode = parts[2] ?? '';
      } else {
        if (names.includes(target)) target = containerNameOf(target);
        mode = parts[1] ?? '';
      }
      add('--volumes-from', shellQuote(target + (mode ? ':' + mode : '')));
    }

    // environment
    for (const [k, v] of kvList(s.environment)) {
      if (v === null) add('-e', shellQuote(k));
      else add('-e', shellQuote(`${k}=${v}`));
    }
    for (const f of asList(s.env_file)) {
      if (f && typeof f === 'object') {
        const fo = f as Record<string, unknown>;
        add('--env-file', shellQuote(str(fo.path)));
        if (fo.required === false) I(`env_file ${str(fo.path)} is optional in Compose; docker run requires it to exist.`);
      } else add('--env-file', shellQuote(str(f)));
    }
    for (const [k, v] of kvList(s.labels)) add('--label', shellQuote(`${k}=${v ?? ''}`));
    for (const [k, v] of kvList(s.annotations)) add('--annotation', shellQuote(`${k}=${v ?? ''}`));

    // restart
    let restart = s.restart !== undefined ? str(s.restart) : '';
    if (s.restart === false) restart = 'no';
    const deploy = (s.deploy && typeof s.deploy === 'object' ? s.deploy : {}) as Record<string, unknown>;
    const rp = deploy.restart_policy as Record<string, unknown> | undefined;
    if (!restart && rp && typeof rp === 'object') {
      const cond = str(rp.condition ?? 'any');
      restart = cond === 'on-failure' ? (rp.max_attempts ? `on-failure:${str(rp.max_attempts)}` : 'on-failure') : cond === 'none' ? 'no' : 'always';
      I('restart policy taken from deploy.restart_policy.');
    }
    if (restart) add('--restart', shellQuote(restart));

    // networking
    if (s.network_mode !== undefined) {
      let nmode = str(s.network_mode);
      if (nmode.startsWith('service:')) {
        const target = nmode.slice(8);
        nmode = `container:${names.includes(target) ? containerNameOf(target) : target}`;
        I(`network_mode "service:${target}" became "${nmode}".`);
      }
      add('--network', shellQuote(nmode));
    } else if (s.networks !== undefined) {
      const nets: { key: string; cfg: Record<string, unknown> }[] = [];
      if (Array.isArray(s.networks)) for (const k of s.networks) nets.push({ key: str(k), cfg: {} });
      else if (s.networks && typeof s.networks === 'object') {
        for (const [k, v] of Object.entries(s.networks as Record<string, unknown>)) {
          nets.push({ key: k, cfg: v && typeof v === 'object' ? (v as Record<string, unknown>) : {} });
        }
      }
      const real = nets.filter((n) => n.key !== 'default');
      for (const n of real) usedNetworks.add(n.key);
      if (real.length > 1) I('several --network flags need Docker 25 or newer (older versions: docker network connect after docker run).');
      for (const n of real) {
        const nname = networkName(n.key);
        const aliases = asList(n.cfg.aliases).map(str);
        const ipv4 = n.cfg.ipv4_address ? str(n.cfg.ipv4_address) : '';
        const ipv6 = n.cfg.ipv6_address ? str(n.cfg.ipv6_address) : '';
        if (real.length === 1) {
          add('--network', shellQuote(nname));
          for (const a of aliases) add('--network-alias', shellQuote(a));
          if (ipv4) add('--ip', shellQuote(ipv4));
          if (ipv6) add('--ip6', shellQuote(ipv6));
        } else {
          const kv = [`name=${nname}`];
          for (const a of aliases) kv.push(`alias=${a}`);
          if (ipv4) kv.push(`ip=${ipv4}`);
          if (ipv6) kv.push(`ip6=${ipv6}`);
          add('--network', shellQuote(kv.join(',')));
        }
      }
    }
    if (s.mac_address) add('--mac-address', shellQuote(str(s.mac_address)));
    for (const l of asList(s.links)) add('--link', shellQuote(str(l)));
    for (const l of asList(s.external_links)) add('--link', shellQuote(str(l)));
    if (s.links !== undefined) I('links is deprecated; prefer user-defined networks.');
    for (const h of kvList(s.extra_hosts)) {
      if (h[1] === null) {
        const text = h[0];
        add('--add-host', shellQuote(text.includes('=') ? text.replace('=', ':') : text));
      } else add('--add-host', shellQuote(`${h[0]}:${h[1]}`));
    }
    for (const d of asList(s.dns)) add('--dns', shellQuote(str(d)));
    for (const d of asList(s.dns_search)) add('--dns-search', shellQuote(str(d)));
    for (const d of asList(s.dns_opt)) add('--dns-option', shellQuote(str(d)));
    for (const l of asList(s.link_local_ips)) add('--link-local-ip', shellQuote(str(l)));

    // security & kernel
    if (s.privileged === true) add('--privileged');
    for (const c of asList(s.cap_add)) add('--cap-add', shellQuote(str(c)));
    for (const c of asList(s.cap_drop)) add('--cap-drop', shellQuote(str(c)));
    for (const d of asList(s.devices)) {
      if (d && typeof d === 'object') {
        const dobj = d as Record<string, unknown>;
        const parts = [str(dobj.source), dobj.target ? str(dobj.target) : '', dobj.permissions ? str(dobj.permissions) : ''];
        add('--device', shellQuote(parts.filter((p, i) => p !== '' || i === 0).join(':')));
      } else add('--device', shellQuote(str(d)));
    }
    for (const d of asList(s.device_cgroup_rules)) add('--device-cgroup-rule', shellQuote(str(d)));
    for (const o of asList(s.security_opt)) add('--security-opt', shellQuote(str(o)));
    if (s.userns_mode) add('--userns', shellQuote(str(s.userns_mode)));
    if (s.pid) add('--pid', shellQuote(str(s.pid)));
    if (s.ipc) add('--ipc', shellQuote(str(s.ipc)));
    if (s.uts) add('--uts', shellQuote(str(s.uts)));
    if (s.cgroup) add('--cgroupns', shellQuote(str(s.cgroup)));
    if (s.cgroup_parent) add('--cgroup-parent', shellQuote(str(s.cgroup_parent)));
    for (const g of asList(s.group_add)) add('--group-add', shellQuote(str(g)));
    if (s.runtime) add('--runtime', shellQuote(str(s.runtime)));
    if (s.isolation) add('--isolation', shellQuote(str(s.isolation)));
    if (s.platform) add('--platform', shellQuote(str(s.platform)));
    if (s.pull_policy) {
      const pp = str(s.pull_policy);
      const map: Record<string, string> = { always: 'always', never: 'never', missing: 'missing', if_not_present: 'missing', build: 'missing', daily: 'always', weekly: 'always' };
      if (map[pp]) add('--pull', map[pp]);
      if (['daily', 'weekly', 'build'].includes(pp)) I(`pull_policy "${pp}" was approximated.`);
    }
    if (s.init === true) add('--init');
    if (s.read_only === true) add('--read-only');
    if (s.tty === true && s.stdin_open === true) add('-it');
    else if (s.tty === true) add('-t');
    else if (s.stdin_open === true) add('-i');

    // healthcheck
    const hc = s.healthcheck as Record<string, unknown> | undefined;
    if (hc && typeof hc === 'object') {
      if (hc.disable === true) add('--no-healthcheck');
      else {
        const test = hc.test;
        if (Array.isArray(test)) {
          const t0 = str(test[0]);
          if (t0 === 'NONE') add('--no-healthcheck');
          else if (t0 === 'CMD-SHELL') add('--health-cmd', shellQuote(str(test[1])));
          else if (t0 === 'CMD') add('--health-cmd', shellQuote(test.slice(1).map((x) => shellQuoteWord(str(x))).join(' ')));
          else add('--health-cmd', shellQuote(test.map((x) => shellQuoteWord(str(x))).join(' ')));
        } else if (typeof test === 'string' && test) add('--health-cmd', shellQuote(test));
        if (hc.interval !== undefined) add('--health-interval', shellQuote(str(hc.interval)));
        if (hc.timeout !== undefined) add('--health-timeout', shellQuote(str(hc.timeout)));
        if (hc.retries !== undefined) add('--health-retries', shellQuote(str(hc.retries)));
        if (hc.start_period !== undefined) add('--health-start-period', shellQuote(str(hc.start_period)));
        if (hc.start_interval !== undefined) add('--health-start-interval', shellQuote(str(hc.start_interval)));
      }
    }
    // logging
    const lg = s.logging as Record<string, unknown> | undefined;
    if (lg && typeof lg === 'object') {
      if (lg.driver) add('--log-driver', shellQuote(str(lg.driver)));
      for (const [k, v] of kvList(lg.options)) add('--log-opt', shellQuote(`${k}=${v ?? ''}`));
    }
    if (s.stop_signal) add('--stop-signal', shellQuote(str(s.stop_signal)));
    if (s.stop_grace_period !== undefined) {
      const secs = durationToSeconds(s.stop_grace_period);
      if (secs === null) W(`stop_grace_period "${str(s.stop_grace_period)}" could not be converted.`);
      else add('--stop-timeout', String(secs));
    }
    for (const [k, v] of kvList(s.sysctls)) add('--sysctl', shellQuote(`${k}=${v ?? ''}`));
    if (s.ulimits && typeof s.ulimits === 'object') {
      for (const [k, v] of Object.entries(s.ulimits as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          const u = v as Record<string, unknown>;
          add('--ulimit', shellQuote(`${k}=${str(u.soft)}:${str(u.hard)}`));
        } else add('--ulimit', shellQuote(`${k}=${str(v)}`));
      }
    }
    if (s.shm_size !== undefined) add('--shm-size', shellQuote(str(s.shm_size)));
    for (const [k, v] of kvList(s.storage_opt)) add('--storage-opt', shellQuote(`${k}=${v ?? ''}`));

    // resources (service level, then deploy.resources)
    const res = (deploy.resources && typeof deploy.resources === 'object' ? deploy.resources : {}) as Record<string, unknown>;
    const lim = (res.limits && typeof res.limits === 'object' ? res.limits : {}) as Record<string, unknown>;
    const rsv = (res.reservations && typeof res.reservations === 'object' ? res.reservations : {}) as Record<string, unknown>;
    const memLimit = s.mem_limit ?? lim.memory;
    if (memLimit !== undefined) add('--memory', shellQuote(str(memLimit)));
    const memRes = s.mem_reservation ?? rsv.memory;
    if (memRes !== undefined) add('--memory-reservation', shellQuote(str(memRes)));
    if (s.memswap_limit !== undefined) add('--memory-swap', shellQuote(str(s.memswap_limit)));
    if (s.mem_swappiness !== undefined) add('--memory-swappiness', shellQuote(str(s.mem_swappiness)));
    const cpus = s.cpus ?? lim.cpus;
    if (cpus !== undefined) add('--cpus', shellQuote(str(cpus)));
    if (rsv.cpus !== undefined) I('deploy.resources.reservations.cpus has no docker run equivalent.');
    const pids = s.pids_limit ?? lim.pids;
    if (pids !== undefined) add('--pids-limit', shellQuote(str(pids)));
    const simple: [string, string][] = [
      ['cpu_shares', '--cpu-shares'], ['cpuset', '--cpuset-cpus'], ['cpu_quota', '--cpu-quota'],
      ['cpu_period', '--cpu-period'], ['cpu_count', '--cpu-count'], ['cpu_percent', '--cpu-percent'],
      ['cpu_rt_runtime', '--cpu-rt-runtime'], ['cpu_rt_period', '--cpu-rt-period'], ['oom_score_adj', '--oom-score-adj'],
    ];
    for (const [k, flag] of simple) if (s[k] !== undefined) add(flag, shellQuote(str(s[k])));
    if (s.oom_kill_disable === true) add('--oom-kill-disable');
    const blk = s.blkio_config as Record<string, unknown> | undefined;
    if (blk && typeof blk === 'object') {
      if (blk.weight !== undefined) add('--blkio-weight', shellQuote(str(blk.weight)));
      const dev = (list: unknown, flag: string, key: string): void => {
        for (const d of asList(list)) {
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>;
            add(flag, shellQuote(`${str(o.path)}:${str(o[key])}`));
          }
        }
      };
      dev(blk.weight_device, '--blkio-weight-device', 'weight');
      dev(blk.device_read_bps, '--device-read-bps', 'rate');
      dev(blk.device_write_bps, '--device-write-bps', 'rate');
      dev(blk.device_read_iops, '--device-read-iops', 'rate');
      dev(blk.device_write_iops, '--device-write-iops', 'rate');
    }
    // GPUs
    const gpuSources = [...asList(s.gpus), ...asList(rsv.devices)];
    const gpuDevs = gpuSources.filter((g) => g && typeof g === 'object' && (asList((g as Record<string, unknown>).capabilities).length === 0 || asList((g as Record<string, unknown>).capabilities).map(str).includes('gpu')));
    if (s.gpus === 'all') add('--gpus', 'all');
    else if (gpuDevs.length) {
      const g = toGpus(gpuDevs[0] as Record<string, unknown>);
      if (g) add('--gpus', g);
      if (gpuDevs.length > 1) I('only the first GPU device request was converted.');
    }
    if (deploy.replicas !== undefined) I(`deploy.replicas (${str(deploy.replicas)}) has no docker run equivalent: run the command once per replica.`);
    for (const k of Object.keys(deploy)) {
      if (!['resources', 'restart_policy', 'replicas'].includes(k)) I(`deploy.${k} is Swarm-only and was ignored.`);
    }

    // anything we did not look at
    const handled = new Set([
      'image', 'build', 'container_name', 'hostname', 'domainname', 'user', 'working_dir', 'entrypoint', 'command',
      'ports', 'expose', 'volumes', 'tmpfs', 'volumes_from', 'environment', 'env_file', 'labels', 'annotations',
      'restart', 'network_mode', 'networks', 'mac_address', 'links', 'external_links', 'extra_hosts', 'dns',
      'dns_search', 'dns_opt', 'link_local_ips', 'privileged', 'cap_add', 'cap_drop', 'devices',
      'device_cgroup_rules', 'security_opt', 'userns_mode', 'pid', 'ipc', 'uts', 'cgroup', 'cgroup_parent',
      'group_add', 'runtime', 'isolation', 'platform', 'pull_policy', 'init', 'read_only', 'tty', 'stdin_open',
      'healthcheck', 'logging', 'stop_signal', 'stop_grace_period', 'sysctls', 'ulimits', 'shm_size',
      'storage_opt', 'mem_limit', 'mem_reservation', 'memswap_limit', 'mem_swappiness', 'cpus', 'pids_limit',
      'cpu_shares', 'cpuset', 'cpu_quota', 'cpu_period', 'cpu_count', 'cpu_percent', 'cpu_rt_runtime',
      'cpu_rt_period', 'oom_score_adj', 'oom_kill_disable', 'blkio_config', 'gpus', 'deploy',
    ]);
    for (const k of Object.keys(s)) {
      if (handled.has(k)) continue;
      if (k.startsWith('x-')) continue;
      const why = UNSUPPORTED_RUN_KEYS[k];
      if (k === 'depends_on') I(`${k}: ${why ?? ''}`);
      else if (why) W(`${k}: ${why}`);
      else W(`${k} is not supported by this converter and was ignored.`);
    }

    // assemble
    const headParts: string[] = ['docker run'];
    if (opts.detach) headParts.push('-d');
    if (opts.rm) headParts.push('--rm');
    const head = headParts.join(' ');
    let text: string;
    const tail = [shellQuote(b.image), ...b.args];
    if (opts.multiline) {
      const lines = [head, ...b.groups.map((g) => g.join(' ')), tail.join(' ')];
      text = lines.map((l, idx) => (idx === 0 ? l : '  ' + l)).join(' \\\n');
    } else {
      text = [head, ...b.groups.map((g) => g.join(' ')), tail.join(' ')].join(' ');
    }
    const header = names.length > 1 ? `# ${nm}\n` : '';
    if (b.buildCmd) out.push(`${header}${b.buildCmd}\n${text}`);
    else out.push(`${header}${text}`);
    count++;
    if (!projectNote && b.groups.some((g) => g[0] === '-v' || g[0] === '--network')) {
      projectNote = true;
      addWarn('info', 'Compose prefixes network and volume names with the project name (<project>_<name>). The commands use the plain names.');
    }
  }

  if (count === 0) throw new ConvertError('No service could be converted.');

  if (opts.createResources) {
    for (const key of usedNetworks) {
      const def = topNetworks[key];
      const d = def && typeof def === 'object' ? (def as Record<string, unknown>) : {};
      if (d.external) continue;
      const parts = ['docker network create'];
      if (d.driver) parts.push('--driver', shellQuote(str(d.driver)));
      for (const [k, v] of kvList(d.driver_opts)) parts.push('--opt', shellQuote(`${k}=${v ?? ''}`));
      if (d.internal === true) parts.push('--internal');
      if (d.attachable === true) parts.push('--attachable');
      parts.push(shellQuote(networkName(key)));
      preamble.push(parts.join(' '));
    }
    for (const key of usedVolumes) {
      const def = topVolumes[key];
      if (!def || typeof def !== 'object') continue;
      const d = def as Record<string, unknown>;
      if (d.external) continue;
      if (!d.driver && !d.driver_opts) continue;
      const parts = ['docker volume create'];
      if (d.driver) parts.push('--driver', shellQuote(str(d.driver)));
      for (const [k, v] of kvList(d.driver_opts)) parts.push('--opt', shellQuote(`${k}=${v ?? ''}`));
      parts.push(shellQuote(d.name ? str(d.name) : key));
      preamble.push(parts.join(' '));
    }
  }
  const script = [...(preamble.length ? ['# networks and volumes first', ...preamble, ''] : []), out.join('\n\n')].join('\n') + '\n';
  return { script, services: ordered, warnings, commandCount: count };
}

/** docker run needs absolute bind-mount paths: make ./x, ../x and ~/x absolute with $PWD / $HOME. */
function absoluteBindSource(src: string): string {
  if (/^\.\.?(\/|$)/.test(src)) return `$PWD/${src}`.replace(/\/\.(?=\/|$)/g, '');
  if (src === '~' || src.startsWith('~/')) return `$HOME${src.slice(1)}`;
  return src;
}

function shellQuoteWord(s: string): string {
  if (s === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Word splitting for Compose `command:` / `entrypoint:` strings. Compose interpolates variables
 * first and then splits like a shell would, without expanding anything, so `$` is left alone
 * (`$$` stays Compose's escape for a literal `$`).
 */
export function splitCommandString(src: string): string[] {
  const out: string[] = [];
  let cur = '';
  let has = false;
  let q: string | null = null;
  const text = src.replace(/\\\n\s*/g, ' ');
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (q === "'") {
      if (c === "'") q = null;
      else cur += c;
    } else if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && /["\\]/.test(text.charAt(i + 1))) cur += text.charAt(++i);
      else cur += c;
    } else if (c === "'" || c === '"') {
      q = c;
      has = true;
    } else if (c === '\\' && i + 1 < text.length) {
      cur += text.charAt(++i);
      has = true;
    } else if (/\s/.test(c)) {
      if (has) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has) out.push(cur);
  return out;
}
