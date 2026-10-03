/**
 * Dockerfile parser and linter (hadolint-style rule IDs, plus our own OUTxxx rules).
 * Pure TypeScript, no dependencies.
 */

export type Severity = 'error' | 'warning' | 'info' | 'style';

export const SEVERITIES: Severity[] = ['error', 'warning', 'info', 'style'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Flag {
  name: string;
  value: string;
}

export interface Heredoc {
  name: string;
  body: string;
  stripTabs: boolean;
  startLine: number;
  endLine: number;
  terminated: boolean;
}

export interface EnvPair {
  name: string;
  value: string;
  hasValue: boolean;
}

export interface Instruction {
  /** 0-based ordinal. */
  index: number;
  /** 1-based line where the instruction starts. */
  line: number;
  /** 1-based last line (continuations and heredoc bodies included). */
  endLine: number;
  /** Upper-cased keyword (the inner one for ONBUILD). */
  keyword: string;
  rawKeyword: string;
  known: boolean;
  onbuild: boolean;
  /** Logical argument text, continuations joined. */
  args: string;
  /** Arguments after leading --flags. */
  rest: string;
  flags: Flag[];
  /** Exec-form arguments (valid JSON string array), else null. */
  json: string[] | null;
  /** Looks like exec form but is not valid JSON. */
  jsonInvalid: boolean;
  heredocs: Heredoc[];
  /** 0-based stage index; -1 before the first FROM. */
  stage: number;
  /** Rule IDs ignored by `# hadolint ignore=` comments directly above. */
  ignore: Set<string>;
  /** Maps an offset in `args` to a 1-based physical line. */
  segs: { offset: number; line: number }[];
  /** Offset of `args` inside the logical text (to map offsets). */
  argsBase: number;
}

export interface Stage {
  index: number;
  name: string | null;
  image: string;
  /** Instruction index of the FROM. */
  from: number;
  line: number;
  platform: string | null;
  /** Instruction indices belonging to the stage (excluding FROM). */
  body: number[];
}

export interface ParsedDockerfile {
  lines: string[];
  instructions: Instruction[];
  stages: Stage[];
  escape: string;
  syntax: string | null;
  globalIgnore: Set<string>;
  /** Instructions that appeared before the first FROM. */
  preamble: number[];
}

export interface Finding {
  id: string;
  severity: Severity;
  /** 1-based line the finding points at. */
  line: number;
  endLine: number;
  message: string;
  hint: string;
  instruction: string;
}

export interface LintOptions {
  /** Severities that are reported (default: all). */
  severities?: Partial<Record<Severity, boolean>>;
  /** Extra rule IDs to ignore (e.g. from a UI field). */
  ignoreRules?: string[];
}

export interface LintResult {
  findings: Finding[];
  /** Findings suppressed by `# hadolint ignore=` comments or the ignore list. */
  suppressed: Finding[];
  counts: Record<Severity, number>;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  stages: number;
  instructions: number;
}

export interface RuleInfo {
  id: string;
  severity: Severity;
  title: string;
}

// ---------------------------------------------------------------------------
// Rule catalog
// ---------------------------------------------------------------------------

export const RULES: RuleInfo[] = [
  { id: 'DL3000', severity: 'error', title: 'Use absolute WORKDIR' },
  { id: 'DL3001', severity: 'info', title: 'Command makes no sense in a container (ssh, vim, shutdown, service, ps, free, top, kill, mount, ifconfig)' },
  { id: 'DL3002', severity: 'warning', title: 'Last USER should not be root' },
  { id: 'DL3003', severity: 'warning', title: 'Use WORKDIR instead of cd in RUN' },
  { id: 'DL3004', severity: 'error', title: 'Do not use sudo' },
  { id: 'DL3005', severity: 'error', title: 'Do not use apt-get upgrade or dist-upgrade' },
  { id: 'DL3006', severity: 'warning', title: 'Always tag the version of an image explicitly' },
  { id: 'DL3007', severity: 'warning', title: 'Using latest is prone to errors' },
  { id: 'DL3008', severity: 'info', title: 'Pin versions in apt-get install' },
  { id: 'DL3009', severity: 'info', title: 'Delete the apt-get lists after installing' },
  { id: 'DL3010', severity: 'info', title: 'Use ADD for extracting archives into an image' },
  { id: 'DL3011', severity: 'error', title: 'Valid UNIX ports range from 0 to 65535' },
  { id: 'DL3013', severity: 'info', title: 'Pin versions in pip install' },
  { id: 'DL3014', severity: 'warning', title: 'Use -y with apt-get install' },
  { id: 'DL3015', severity: 'info', title: 'Avoid additional packages: use --no-install-recommends' },
  { id: 'DL3016', severity: 'info', title: 'Pin versions in npm install' },
  { id: 'DL3018', severity: 'info', title: 'Pin versions in apk add' },
  { id: 'DL3019', severity: 'info', title: 'Use apk add --no-cache' },
  { id: 'DL3020', severity: 'error', title: 'Use COPY instead of ADD for files and folders' },
  { id: 'DL3021', severity: 'error', title: 'COPY/ADD with several sources needs a destination ending in /' },
  { id: 'DL3022', severity: 'warning', title: 'COPY --from should reference a previously defined stage' },
  { id: 'DL3023', severity: 'error', title: 'COPY --from cannot reference its own stage' },
  { id: 'DL3024', severity: 'error', title: 'FROM aliases (stage names) must be unique' },
  { id: 'DL3025', severity: 'warning', title: 'Use JSON notation for CMD and ENTRYPOINT' },
  { id: 'DL3027', severity: 'warning', title: 'Do not use apt; use apt-get or apt-cache' },
  { id: 'DL3029', severity: 'warning', title: 'Do not use --platform with a constant value in FROM' },
  { id: 'DL3030', severity: 'warning', title: 'Use -y with yum install' },
  { id: 'DL3032', severity: 'warning', title: 'yum clean all missing after yum install' },
  { id: 'DL3033', severity: 'info', title: 'Pin versions in yum install' },
  { id: 'DL3034', severity: 'warning', title: 'Use --non-interactive with zypper' },
  { id: 'DL3036', severity: 'warning', title: 'zypper clean missing after zypper install' },
  { id: 'DL3038', severity: 'warning', title: 'Use -y with dnf install' },
  { id: 'DL3040', severity: 'warning', title: 'dnf clean all missing after dnf install' },
  { id: 'DL3041', severity: 'info', title: 'Pin versions in dnf install' },
  { id: 'DL3042', severity: 'warning', title: 'Avoid pip cache: use --no-cache-dir' },
  { id: 'DL3043', severity: 'error', title: 'ONBUILD cannot contain ONBUILD, FROM or MAINTAINER' },
  { id: 'DL3044', severity: 'error', title: 'Do not refer to an ENV variable defined in the same ENV' },
  { id: 'DL3045', severity: 'warning', title: 'COPY/ADD to a relative destination without WORKDIR' },
  { id: 'DL3047', severity: 'info', title: 'wget without --progress floods the build log' },
  { id: 'DL3057', severity: 'info', title: 'No HEALTHCHECK instruction' },
  { id: 'DL3059', severity: 'info', title: 'Multiple consecutive RUN instructions' },
  { id: 'DL3060', severity: 'info', title: 'yarn cache clean missing after yarn install' },
  { id: 'DL3061', severity: 'error', title: 'Invalid instruction order' },
  { id: 'DL4000', severity: 'error', title: 'MAINTAINER is deprecated' },
  { id: 'DL4001', severity: 'warning', title: 'Use either wget or curl, not both' },
  { id: 'DL4003', severity: 'warning', title: 'Multiple CMD instructions: only the last takes effect' },
  { id: 'DL4004', severity: 'error', title: 'Multiple ENTRYPOINT instructions: only the last takes effect' },
  { id: 'DL4005', severity: 'warning', title: 'Use SHELL to change the default shell' },
  { id: 'DL4006', severity: 'warning', title: 'Set -o pipefail before RUN with a pipe' },
  { id: 'OUT001', severity: 'info', title: 'Build stage is never used' },
  { id: 'OUT002', severity: 'warning', title: 'No USER instruction: the container runs as root' },
  { id: 'OUT003', severity: 'warning', title: 'apt-get update without install in the same RUN' },
  { id: 'OUT004', severity: 'info', title: 'Prefer npm ci over npm install' },
  { id: 'OUT005', severity: 'info', title: 'yarn/pnpm install without a frozen lockfile' },
  { id: 'OUT006', severity: 'warning', title: 'ADD from a remote URL' },
  { id: 'OUT007', severity: 'warning', title: 'Downloaded script piped into a shell' },
  { id: 'OUT008', severity: 'warning', title: 'EXPOSE 22: running SSH in a container' },
  { id: 'OUT009', severity: 'error', title: 'Secret stored in ENV or ARG' },
  { id: 'OUT010', severity: 'info', title: 'COPY . . before installing dependencies busts the layer cache' },
  { id: 'OUT011', severity: 'info', title: 'No LABEL metadata' },
  { id: 'OUT012', severity: 'style', title: 'Instruction keyword is not upper-case' },
  { id: 'OUT013', severity: 'error', title: 'Unknown instruction' },
  { id: 'OUT014', severity: 'warning', title: 'World-writable permissions (chmod 777)' },
  { id: 'OUT015', severity: 'warning', title: 'TLS certificate verification disabled' },
  { id: 'OUT016', severity: 'info', title: 'ENV DEBIAN_FRONTEND persists into the running container' },
  { id: 'OUT017', severity: 'warning', title: 'Exec form is not valid JSON' },
  { id: 'OUT018', severity: 'error', title: 'SHELL requires JSON (exec) form' },
  { id: 'OUT019', severity: 'error', title: 'Unterminated heredoc' },
];

const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME',
  'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL',
]);

function parseFlags(args: string): { flags: Flag[]; rest: string } {
  const flags: Flag[] = [];
  let rest = args;
  for (;;) {
    const m = /^\s*--([A-Za-z][\w-]*)(?:=("[^"]*"|'[^']*'|\S*))?(?=\s|$)/.exec(rest);
    if (!m) break;
    let v = m[2] ?? '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    flags.push({ name: (m[1] ?? '').toLowerCase(), value: v });
    rest = rest.slice(m[0].length);
  }
  return { flags, rest: rest.trim() };
}

function tryJsonArray(text: string): { json: string[] | null; invalid: boolean } {
  const t = text.trim();
  if (!t.startsWith('[')) return { json: null, invalid: false };
  try {
    const v: unknown = JSON.parse(t);
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return { json: v as string[], invalid: false };
    return { json: null, invalid: true };
  } catch {
    return { json: null, invalid: true };
  }
}

/** Split on whitespace honouring simple quotes; returns unquoted words. */
export function splitWords(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let has = false;
  let q: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < text.length) cur += text.charAt(++i);
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
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

/** ENV / LABEL / ARG argument lists: `a=b c=d` or the legacy `a b c` form. */
export function parsePairs(args: string, legacyAllowed: boolean): EnvPair[] {
  const words = splitWords(args);
  const pairs: EnvPair[] = [];
  if (words.length === 0) return pairs;
  const first = words[0] ?? '';
  if (legacyAllowed && !first.includes('=')) {
    const sp = /^\s*(\S+)\s+([\s\S]*)$/.exec(args);
    pairs.push({ name: first, value: sp ? (sp[2] ?? '').trim() : '', hasValue: !!sp });
    return pairs;
  }
  for (const w of words) {
    const eq = w.indexOf('=');
    if (eq < 0) pairs.push({ name: w, value: '', hasValue: false });
    else pairs.push({ name: w.slice(0, eq), value: w.slice(eq + 1), hasValue: true });
  }
  return pairs;
}

const HEREDOC_RE = /(?:^|\s)<<(?!<)(-?)(?:(["'])([A-Za-z_][\w]*)\2|([A-Za-z_][\w]*))/g;

function stripEscapeAtEnd(line: string, esc: string): string | null {
  const t = line.replace(/\s+$/, '');
  if (t.endsWith(esc)) return t.slice(0, -1);
  return null;
}

export function parseDockerfile(text: string): ParsedDockerfile {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const n = lines.length;
  const instructions: Instruction[] = [];
  const stages: Stage[] = [];
  const preamble: number[] = [];
  const globalIgnore = new Set<string>();
  let escape = '\\';
  let syntax: string | null = null;

  let i = 0;
  // parser directives
  while (i < n) {
    const m = /^\s*#\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(\S.*?)\s*$/.exec(lines[i] ?? '');
    const key = m?.[1]?.toLowerCase();
    if (!m || (key !== 'syntax' && key !== 'escape' && key !== 'check')) break;
    if (key === 'escape' && (m[2] === '`' || m[2] === '\\')) escape = m[2];
    if (key === 'syntax') syntax = m[2] ?? null;
    i++;
  }
  const directiveLines = i;
  i = 0;

  let pendingIgnore = new Set<string>();
  let currentStage = -1;

  const addIgnores = (target: Set<string>, list: string): void => {
    for (const id of list.split(/[\s,]+/)) {
      if (id) target.add(id.toUpperCase());
    }
  };

  while (i < n) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (trimmed === '') {
      i++;
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (i >= directiveLines) {
        const g = /^#\s*hadolint\s+global\s+ignore\s*=\s*([^#]*)/i.exec(trimmed);
        const l = /^#\s*hadolint\s+ignore\s*=\s*([^#]*)/i.exec(trimmed);
        if (g) addIgnores(globalIgnore, g[1] ?? '');
        else if (l) addIgnores(pendingIgnore, l[1] ?? '');
      }
      i++;
      continue;
    }

    // --- logical line with continuations ---
    const startLine = i + 1;
    let logical = '';
    const segs: { offset: number; line: number }[] = [];
    let j = i;
    for (;;) {
      const physical = lines[j] ?? '';
      segs.push({ offset: logical.length, line: j + 1 });
      const stripped = stripEscapeAtEnd(physical, escape);
      if (stripped === null) {
        logical += physical;
        break;
      }
      logical += stripped;
      j++;
      while (j < n && ((lines[j] ?? '').trim() === '' || (lines[j] ?? '').trim().startsWith('#'))) j++;
      if (j >= n) break;
    }
    let endLine = Math.min(j, n - 1) + 1;
    i = j + 1;

    // --- keyword (and ONBUILD's inner keyword) ---
    let pos = logical.length - logical.trimStart().length;
    const readWord = (): string => {
      const m = /^\S+/.exec(logical.slice(pos));
      const w = m ? m[0] : '';
      pos += w.length;
      const ws = /^\s*/.exec(logical.slice(pos));
      pos += ws ? ws[0].length : 0;
      return w;
    };
    let rawKeyword = readWord();
    let keyword = rawKeyword.toUpperCase();
    let onbuild = false;
    if (keyword === 'ONBUILD' && pos < logical.length) {
      onbuild = true;
      rawKeyword = readWord();
      keyword = rawKeyword.toUpperCase();
    }
    const argsBase = pos;
    const args = logical.slice(pos).trim();

    // --- heredocs ---
    const heredocs: Heredoc[] = [];
    if (keyword === 'RUN' || keyword === 'COPY' || keyword === 'ADD') {
      HEREDOC_RE.lastIndex = 0;
      const markers: { name: string; strip: boolean }[] = [];
      let hm: RegExpExecArray | null;
      while ((hm = HEREDOC_RE.exec(args)) !== null) {
        markers.push({ name: hm[3] ?? hm[4] ?? '', strip: hm[1] === '-' });
      }
      for (const mk of markers) {
        const bodyLines: string[] = [];
        const hStart = i + 1;
        let terminated = false;
        while (i < n) {
          const l = lines[i] ?? '';
          i++;
          const cmp = mk.strip ? l.replace(/^\t+/, '') : l;
          if (cmp === mk.name) {
            terminated = true;
            break;
          }
          bodyLines.push(mk.strip ? l.replace(/^\t+/, '') : l);
        }
        heredocs.push({
          name: mk.name,
          body: bodyLines.join('\n'),
          stripTabs: mk.strip,
          startLine: hStart,
          endLine: Math.min(i, n),
          terminated,
        });
        endLine = Math.min(i, n);
      }
    }

    const known = KEYWORDS.has(keyword);
    const { flags, rest } = parseFlags(args);
    const { json, invalid } = tryJsonArray(rest);

    const ins: Instruction = {
      index: instructions.length,
      line: startLine,
      endLine,
      keyword,
      rawKeyword,
      known,
      onbuild,
      args,
      rest,
      flags,
      json,
      jsonInvalid: invalid,
      heredocs,
      stage: currentStage,
      ignore: pendingIgnore,
      segs,
      argsBase,
    };
    pendingIgnore = new Set<string>();
    instructions.push(ins);

    if (keyword === 'FROM' && !onbuild) {
      const words = splitWords(rest);
      const image = words[0] ?? '';
      let name: string | null = null;
      if ((words[1] ?? '').toLowerCase() === 'as' && words[2]) name = words[2];
      const platform = flags.find((f) => f.name === 'platform')?.value ?? null;
      currentStage = stages.length;
      ins.stage = currentStage;
      stages.push({ index: currentStage, name, image, from: ins.index, line: startLine, platform, body: [] });
    } else if (currentStage >= 0) {
      stages[currentStage]?.body.push(ins.index);
    } else {
      preamble.push(ins.index);
    }
  }

  return { lines, instructions, stages, escape, syntax, globalIgnore, preamble };
}

// ---------------------------------------------------------------------------
// Shell analysis for RUN
// ---------------------------------------------------------------------------

export interface ShellCmd {
  words: string[];
  offset: number;
  pipedTo: boolean;
  pipedFrom: boolean;
}

export function splitShell(text: string): ShellCmd[] {
  const cmds: ShellCmd[] = [];
  let words: string[] = [];
  let cur = '';
  let inWord = false;
  let cmdStart = -1;
  let pipeFrom = false;
  const n = text.length;

  const flushWord = (): void => {
    if (inWord) {
      words.push(cur);
      cur = '';
      inWord = false;
    }
  };
  const flushCmd = (pipe: boolean): void => {
    flushWord();
    if (words.length) {
      cmds.push({ words, offset: Math.max(0, cmdStart), pipedTo: pipe, pipedFrom: pipeFrom });
      pipeFrom = pipe;
    } else if (!pipe) {
      pipeFrom = false;
    }
    words = [];
    cmdStart = -1;
  };
  const addChar = (c: string, at: number): void => {
    if (cmdStart < 0) cmdStart = at;
    cur += c;
    inWord = true;
  };

  for (let i = 0; i < n; i++) {
    const c = text.charAt(i);
    const d = text.charAt(i + 1);
    if (c === ' ' || c === '\t') {
      flushWord();
      continue;
    }
    if (c === '\n') {
      flushCmd(false);
      continue;
    }
    if (c === '#' && !inWord) {
      while (i < n && text.charAt(i) !== '\n') i++;
      i--;
      continue;
    }
    if (c === '&' && d === '&') {
      flushCmd(false);
      i++;
      continue;
    }
    if (c === '|' && d === '|') {
      flushCmd(false);
      i++;
      continue;
    }
    if (c === '|') {
      if (d === '&') i++;
      flushCmd(true);
      continue;
    }
    if (c === ';') {
      flushCmd(false);
      continue;
    }
    if (c === '&') {
      const prev = text.charAt(i - 1);
      if (d === '>' || prev === '>' || prev === '<') {
        addChar(c, i);
        continue;
      }
      flushCmd(false);
      continue;
    }
    if ((c === '(' || c === ')') && !inWord) {
      flushCmd(false);
      continue;
    }
    if (c === "'") {
      if (cmdStart < 0) cmdStart = i;
      inWord = true;
      const close = text.indexOf("'", i + 1);
      const end = close < 0 ? n : close;
      cur += text.slice(i + 1, end);
      i = end;
      continue;
    }
    if (c === '"') {
      if (cmdStart < 0) cmdStart = i;
      inWord = true;
      let k = i + 1;
      while (k < n && text.charAt(k) !== '"') {
        if (text.charAt(k) === '\\' && k + 1 < n) k++;
        cur += text.charAt(k);
        k++;
      }
      i = k;
      continue;
    }
    if (c === '\\' && i + 1 < n) {
      if (text.charAt(i + 1) !== '\n') addChar(text.charAt(i + 1), i);
      i++;
      continue;
    }
    if (c === '$' && d === '(') {
      let depth = 0;
      let k = i + 1;
      for (; k < n; k++) {
        const ch = text.charAt(k);
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (cmdStart < 0) cmdStart = i;
      cur += text.slice(i, k + 1);
      inWord = true;
      i = k;
      continue;
    }
    if (c === '$' && d === '{') {
      const close = text.indexOf('}', i);
      const end = close < 0 ? n - 1 : close;
      if (cmdStart < 0) cmdStart = i;
      cur += text.slice(i, end + 1);
      inWord = true;
      i = end;
      continue;
    }
    if (c === '`') {
      const close = text.indexOf('`', i + 1);
      const end = close < 0 ? n - 1 : close;
      if (cmdStart < 0) cmdStart = i;
      cur += text.slice(i, end + 1);
      inWord = true;
      i = end;
      continue;
    }
    addChar(c, i);
  }
  flushCmd(false);
  return cmds;
}

export interface Cmd {
  name: string;
  args: string[];
  assigns: string[];
  sudo: boolean;
  offset: number;
  pipedTo: boolean;
  pipedFrom: boolean;
  /** All words including the wrapper prefix. */
  words: string[];
}

const WRAPPERS = new Set(['env', 'time', 'exec', 'nohup', 'nice', 'stdbuf']);

function baseName(p: string): string {
  const k = p.lastIndexOf('/');
  return k >= 0 ? p.slice(k + 1) : p;
}

function describeCmd(c: ShellCmd): Cmd {
  const w = [...c.words];
  const assigns: string[] = [];
  let sudo = false;
  while (w.length && (w[0] === '{' || w[0] === '!')) w.shift();
  while (w.length) {
    const first = w[0] ?? '';
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(first)) {
      assigns.push(first);
      w.shift();
      continue;
    }
    const b = baseName(first);
    if (b === 'sudo' || b === 'doas') {
      sudo = true;
      w.shift();
      while (w.length && (w[0] ?? '').startsWith('-')) w.shift();
      continue;
    }
    if (WRAPPERS.has(b)) {
      w.shift();
      while (w.length && ((w[0] ?? '').startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0] ?? ''))) {
        const x = w.shift() ?? '';
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(x)) assigns.push(x);
      }
      continue;
    }
    break;
  }
  const name = baseName(w[0] ?? '');
  const args = w.slice(1);
  // drop redirections from the argument list
  const cleaned: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k] ?? '';
    if (/^\d*[<>]+&?\d*-?$/.test(a) || /^&>>?$/.test(a)) {
      if (!/^\d*>&\d+$/.test(a)) k++; // skip redirect target
      continue;
    }
    if (/^\d*[<>]/.test(a) || /^&>/.test(a)) continue;
    cleaned.push(a);
  }
  return {
    name,
    args: cleaned,
    assigns,
    sudo,
    offset: c.offset,
    pipedTo: c.pipedTo,
    pipedFrom: c.pipedFrom,
    words: c.words,
  };
}

interface RunInfo {
  ins: Instruction;
  cmds: Cmd[];
  /** Text analysed (command text), and a function mapping offsets to physical lines. */
  text: string;
  lineAt: (offset: number) => number;
  script: boolean;
}

function runInfo(ins: Instruction): RunInfo {
  if (ins.json) {
    const words = ins.json;
    const c: ShellCmd = { words, offset: 0, pipedTo: false, pipedFrom: false };
    return { ins, cmds: [describeCmd(c)], text: words.join(' '), lineAt: () => ins.line, script: false };
  }
  // heredoc as the whole script: RUN <<EOF ... EOF
  const first = ins.heredocs[0];
  const noMarker = ins.rest.replace(/<<-?["']?\w+["']?/g, '').trim();
  if (first && noMarker === '') {
    const body = ins.heredocs.map((h) => h.body).join('\n');
    const text = body;
    const base = first.startLine;
    return {
      ins,
      cmds: splitShell(text).map(describeCmd),
      text,
      lineAt: (off) => base + (text.slice(0, off).match(/\n/g)?.length ?? 0),
      script: true,
    };
  }
  const text = ins.rest.replace(/<<-?["']?\w+["']?/g, (m) => ' '.repeat(m.length));
  const restBase = ins.argsBase + (ins.args.length - ins.rest.length);
  return {
    ins,
    cmds: splitShell(text).map(describeCmd),
    text,
    lineAt: (off) => {
      const abs = restBase + off;
      let line = ins.line;
      for (const s of ins.segs) {
        if (s.offset <= abs) line = s.line;
        else break;
      }
      return line;
    },
    script: false,
  };
}

// ---------------------------------------------------------------------------
// Image references
// ---------------------------------------------------------------------------

export interface ImageRef {
  name: string;
  tag: string | null;
  digest: string | null;
  hasVar: boolean;
}

export function parseImage(ref: string): ImageRef {
  const hasVar = ref.includes('$');
  let name = ref;
  let digest: string | null = null;
  const at = name.indexOf('@');
  if (at >= 0) {
    digest = name.slice(at + 1);
    name = name.slice(0, at);
  }
  let tag: string | null = null;
  const slash = name.lastIndexOf('/');
  const colon = name.lastIndexOf(':');
  if (colon > slash) {
    tag = name.slice(colon + 1);
    name = name.slice(0, colon);
  }
  return { name, tag, digest, hasVar };
}

// ---------------------------------------------------------------------------
// Linting
// ---------------------------------------------------------------------------

const SECRET_SEGMENTS = new Set([
  'PASSWORD', 'PASSWD', 'PASS', 'SECRET', 'SECRETS', 'TOKEN', 'TOKENS', 'KEY', 'APIKEY', 'CREDENTIAL', 'CREDENTIALS',
  'PRIVATE', 'AUTH',
]);

function looksSecret(name: string): boolean {
  const upper = name.toUpperCase();
  if (/(_|^)(FILE|PATH|DIR|URL|URI|ID|NAME|TYPE|ENDPOINT|HOST|PORT)$/.test(upper)) return false;
  if (/(PUBLIC|PUBKEY)/.test(upper)) return false;
  const segs = upper.split(/[_\-.]+/);
  if (segs.some((s) => SECRET_SEGMENTS.has(s))) {
    // "PRIVATE" / "AUTH" alone are weak signals: require a second secret-ish segment
    const strong = segs.some((s) => ['PASSWORD', 'PASSWD', 'PASS', 'SECRET', 'SECRETS', 'TOKEN', 'TOKENS', 'KEY', 'APIKEY', 'CREDENTIAL', 'CREDENTIALS'].includes(s));
    return strong;
  }
  return /(PASSWORD|PASSWD|SECRET|TOKEN|APIKEY)/.test(upper);
}

function isFlag(a: string): boolean {
  return a.startsWith('-') && a.length > 1;
}

interface Sub {
  sub: string | null;
  rest: string[];
  flags: string[];
}

/** Find the first non-flag word, skipping flags that take a value. */
function subcommand(args: string[], valued: Set<string>): Sub {
  const flags: string[] = [];
  let sub: string | null = null;
  const rest: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k] ?? '';
    if (isFlag(a)) {
      flags.push(a);
      if (valued.has(a) && !a.includes('=')) {
        const v = args[k + 1];
        if (v !== undefined) {
          flags.push(v);
          k++;
        }
      }
      continue;
    }
    if (sub === null) sub = a;
    else rest.push(a);
  }
  return { sub, rest, flags };
}

const APT_VALUED = new Set(['-o', '-t', '-c', '-a', '--option', '--target-release', '--config-file', '--default-release']);

const MAX_FINDINGS_PER_RULE = 200;

class Linter {
  df: ParsedDockerfile;
  findings: Finding[] = [];
  perRule = new Map<string, number>();
  runs = new Map<number, RunInfo>();

  constructor(df: ParsedDockerfile) {
    this.df = df;
  }

  run(ins: Instruction): RunInfo {
    let r = this.runs.get(ins.index);
    if (!r) {
      r = runInfo(ins);
      this.runs.set(ins.index, r);
    }
    return r;
  }

  add(id: string, ins: Instruction, message: string, hint: string, line?: number): void {
    const info = RULE_BY_ID.get(id);
    if (!info) throw new Error(`unknown rule ${id}`);
    this.addSev(id, info.severity, ins, message, hint, line);
  }

  addSev(id: string, severity: Severity, ins: Instruction, message: string, hint: string, line?: number): void {
    const count = (this.perRule.get(id) ?? 0) + 1;
    this.perRule.set(id, count);
    if (count > MAX_FINDINGS_PER_RULE) return;
    const l = line ?? ins.line;
    const key = `${id}:${l}:${message}`;
    if (this.findings.some((f) => `${f.id}:${f.line}:${f.message}` === key)) return;
    this.findings.push({
      id,
      severity,
      line: l,
      endLine: Math.max(l, ins.endLine),
      message,
      hint,
      instruction: ins.keyword,
    });
  }

  lintAll(): Finding[] {
    const { df } = this;
    const ins = df.instructions;

    // --- instruction level ---
    for (const i of ins) this.lintInstruction(i);

    // --- stage level ---
    this.lintStages();

    // --- whole-file rules ---
    this.lintGlobal();

    this.findings.sort((a, b) => a.line - b.line || a.id.localeCompare(b.id));
    return this.findings;
  }

  // ---- per instruction ----------------------------------------------------

  lintInstruction(i: Instruction): void {
    // order and casing
    if (!i.known) {
      this.add('OUT013', i, `Unknown instruction "${i.rawKeyword}".`, 'Docker will refuse to build this file. Check the spelling (instructions are FROM, RUN, CMD, COPY, ...).');
      return;
    }
    if (i.rawKeyword !== i.rawKeyword.toUpperCase()) {
      this.add('OUT012', i, `Instruction "${i.rawKeyword}" should be upper-case (${i.keyword}).`, 'Docker accepts any case, but upper-case keywords are the convention and make Dockerfiles easier to scan.');
    }
    if (i.stage === -1 && i.keyword !== 'ARG' && !(i.keyword === 'FROM')) {
      this.add('DL3061', i, `Invalid instruction order: ${i.keyword} appears before the first FROM.`, 'A Dockerfile must start with FROM (only ARG, comments and parser directives may come first).');
    }
    if (i.onbuild && (i.keyword === 'ONBUILD' || i.keyword === 'FROM' || i.keyword === 'MAINTAINER')) {
      this.add('DL3043', i, `ONBUILD ${i.keyword} is not allowed.`, 'ONBUILD cannot trigger ONBUILD, FROM or MAINTAINER instructions.');
    }
    for (const h of i.heredocs) {
      if (!h.terminated) {
        this.add('OUT019', i, `Heredoc "<<${h.name}" is never terminated.`, `Add a line containing only "${h.name}" after the heredoc body.`, h.startLine - 1);
      }
    }
    if (i.jsonInvalid && ['RUN', 'CMD', 'ENTRYPOINT', 'SHELL', 'VOLUME'].includes(i.keyword)) {
      if (i.keyword === 'SHELL') {
        this.add('OUT018', i, 'SHELL must be written in JSON (exec) form.', 'Example: SHELL ["/bin/bash", "-o", "pipefail", "-c"]');
      } else {
        this.add('OUT017', i, `Arguments start with "[" but are not a valid JSON string array, so Docker runs them as shell form.`, 'Use double quotes and commas: ["executable", "arg1", "arg2"].');
      }
    }

    switch (i.keyword) {
      case 'FROM':
        this.lintFrom(i);
        break;
      case 'MAINTAINER':
        this.add('DL4000', i, 'MAINTAINER is deprecated.', 'Use a label instead: LABEL org.opencontainers.image.authors="you@example.com"');
        break;
      case 'RUN':
        this.lintRun(i);
        break;
      case 'CMD':
      case 'ENTRYPOINT':
        if (!i.json && !i.jsonInvalid && i.rest !== '') {
          this.add('DL3025', i, `Use the JSON (exec) form for ${i.keyword}.`, `Shell form runs your command under "/bin/sh -c", so it becomes PID 2 and does not receive SIGTERM from "docker stop". Write ${i.keyword} ["executable", "arg"].`);
        }
        break;
      case 'SHELL':
        if (!i.json && !i.jsonInvalid) {
          this.add('OUT018', i, 'SHELL must be written in JSON (exec) form.', 'Example: SHELL ["/bin/bash", "-o", "pipefail", "-c"]');
        }
        break;
      case 'WORKDIR': {
        const p = (splitWords(i.rest)[0] ?? '').trim();
        if (p && !/^(\/|\$|\\|[A-Za-z]:[\\/]|["']\/)/.test(i.rest.trim())) {
          this.add('DL3000', i, `WORKDIR "${p}" is relative.`, 'Use an absolute path (for example WORKDIR /app) so the result does not depend on earlier instructions.');
        }
        break;
      }
      case 'EXPOSE':
        this.lintExpose(i);
        break;
      case 'ENV':
        this.lintEnv(i);
        break;
      case 'ARG':
        this.lintArg(i);
        break;
      case 'ADD':
      case 'COPY':
        this.lintCopyAdd(i);
        break;
      default:
        break;
    }
  }

  lintFrom(i: Instruction): void {
    const { df } = this;
    const words = splitWords(i.rest);
    const ref = words[0] ?? '';
    const stage = df.stages[i.stage];
    if (!ref) return;
    const plat = i.flags.find((f) => f.name === 'platform');
    if (plat && !plat.value.includes('$')) {
      this.add('DL3029', i, `Do not use --platform=${plat.value} in FROM.`, 'Hard-coding a platform makes the image impossible to build for other architectures. Use "docker buildx build --platform" or ARG TARGETPLATFORM instead.');
    }
    const lower = ref.toLowerCase();
    const earlier = df.stages.slice(0, i.stage).some((s) => s.name !== null && s.name.toLowerCase() === lower);
    // duplicate names
    if (stage && stage.name) {
      const dup = df.stages.slice(0, i.stage).find((s) => s.name !== null && s.name.toLowerCase() === stage.name?.toLowerCase());
      if (dup) {
        this.add('DL3024', i, `Duplicate stage name "${stage.name}" (first defined on line ${dup.line}).`, 'Give every build stage a unique name.');
      }
    }
    if (earlier || lower === 'scratch') return;
    const img = parseImage(ref);
    if (img.hasVar) return;
    if (img.tag === null && img.digest === null) {
      this.add('DL3006', i, `Image "${ref}" has no tag, so it defaults to :latest.`, `Pin a version, e.g. FROM ${img.name}:<version>, or a digest (${img.name}@sha256:...) for reproducible builds.`);
    } else if (img.tag !== null && img.tag.toLowerCase() === 'latest' && img.digest === null) {
      this.add('DL3007', i, `Image "${ref}" uses the :latest tag.`, 'The tag moves over time, so builds are not reproducible. Pin a specific release tag or a digest.');
    }
  }

  lintExpose(i: Instruction): void {
    for (const tok of splitWords(i.rest)) {
      if (tok.includes('$')) continue;
      const m = /^(\d+)(?:-(\d+))?(?:\/(tcp|udp|sctp))?$/i.exec(tok);
      if (!m) continue;
      const a = Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : a;
      if (a > 65535 || b > 65535) {
        this.add('DL3011', i, `Port ${tok} is out of range.`, 'Valid ports are 0 to 65535.');
      } else if (a === 22 && b === 22) {
        this.add('OUT008', i, 'Exposing port 22 suggests an SSH server inside the container.', 'Containers should not run sshd. Use "docker exec" / "kubectl exec" to get a shell instead.');
      }
    }
  }

  lintEnv(i: Instruction): void {
    const pairs = parsePairs(i.rest, true);
    const defined: string[] = [];
    for (const p of pairs) {
      if (looksSecret(p.name)) {
        const literal = p.value !== '' && !p.value.includes('$');
        this.addSev('OUT009', literal ? 'error' : 'warning', i,
          `${p.name} looks like a secret stored with ENV${literal ? ' with a literal value' : ''}.`,
          'ENV values are baked into the image and visible with "docker history" and "docker inspect". Pass secrets at runtime, or use BuildKit: RUN --mount=type=secret,id=name ...');
      }
      if (p.name === 'DEBIAN_FRONTEND' && p.value.toLowerCase() === 'noninteractive') {
        this.add('OUT016', i, 'ENV DEBIAN_FRONTEND=noninteractive stays set in the running container.', 'Scope it to the build: ARG DEBIAN_FRONTEND=noninteractive, or prefix the command: RUN DEBIAN_FRONTEND=noninteractive apt-get install ...');
      }
    }
    if (pairs.length > 1) {
      for (const p of pairs) {
        const refs = [...p.value.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g)].map((m) => m[1] ?? '');
        const hit = refs.find((r) => defined.includes(r));
        if (hit) {
          this.add('DL3044', i, `${p.name} refers to ${hit}, which is defined in the same ENV instruction.`, 'Variables defined in one ENV instruction are not visible to the other values of that instruction. Split it into two ENV instructions.');
        }
        defined.push(p.name);
      }
    }
  }

  lintArg(i: Instruction): void {
    for (const p of parsePairs(i.rest, false)) {
      if (looksSecret(p.name)) {
        this.addSev('OUT009', 'warning', i,
          `${p.name} looks like a secret passed as a build ARG.`,
          'Build arguments are stored in the image history. Use BuildKit secrets instead: RUN --mount=type=secret,id=name ...');
      }
    }
  }

  lintCopyAdd(i: Instruction): void {
    const words = i.json ?? splitWords(i.rest);
    const isHeredoc = i.heredocs.length > 0;
    const srcs = words.slice(0, -1);
    const dest = words.length ? (words[words.length - 1] ?? '') : '';
    const from = i.flags.find((f) => f.name === 'from')?.value ?? null;
    const isAdd = i.keyword === 'ADD';

    if (from !== null && i.keyword === 'COPY') this.lintCopyFrom(i, from);

    if (!isHeredoc && words.length > 2 && !dest.endsWith('/') && !dest.includes('$')) {
      this.add('DL3021', i, `${i.keyword} with ${srcs.length} sources needs a destination ending with "/".`, `Write the destination as a directory: ${i.keyword} ${srcs.join(' ')} ${dest}/`);
    }

    if (!isHeredoc && dest && !/^(\/|\$|\\|[A-Za-z]:[\\/]|["']\/)/.test(dest)) {
      const hasWorkdir = this.stageHasWorkdir(i);
      if (!hasWorkdir) {
        this.add('DL3045', i, `${i.keyword} to relative destination "${dest}" without a WORKDIR set.`, 'Set WORKDIR first (for example WORKDIR /app), or use an absolute destination path.');
      }
    }

    const isUrl = (s: string): boolean => /^(https?|ftp):\/\//i.test(s) || /^git(@|\+)/i.test(s);
    const isArchive = (s: string): boolean => /\.(tar|tar\.gz|tgz|tar\.bz2|tbz2?|tar\.xz|txz|tar\.zst|tzst|gz|bz2|xz)$/i.test(s);
    if (isAdd && !isHeredoc && from === null) {
      const remote = srcs.filter(isUrl);
      for (const r of remote) {
        if (!i.flags.some((f) => f.name === 'checksum') && !/\.git(#|$)/.test(r) && !/^git/i.test(r)) {
          this.add('OUT006', i, `ADD downloads ${r} without verifying a checksum.`, 'Prefer "ADD --checksum=sha256:<digest> <url> <dest>", or download with curl/wget in a RUN and verify with sha256sum so the layer can be cleaned in the same step.');
        }
      }
      const local = srcs.filter((s) => !isUrl(s));
      if (local.length > 0 && local.every((s) => !isArchive(s)) && !local.some((s) => s.includes('$'))) {
        this.add('DL3020', i, 'Use COPY instead of ADD for files and folders.', 'ADD has extra behaviours (URL download, automatic tar extraction). Use COPY unless you need them.');
      }
    }
    if (!isAdd && !isHeredoc && from === null) {
      const archives = srcs.filter((s) => isArchive(s) && !s.includes('$') && /\.(tar|tar\.gz|tgz|tar\.bz2|tbz2?|tar\.xz|txz)$/i.test(s));
      if (archives.length > 0) {
        this.add('DL3010', i, `COPY of archive ${archives[0]}: it will not be extracted.`, 'Use ADD to extract a local tar archive into the image, or extract it in a RUN if you want it unpacked.');
      }
    }
  }

  lintCopyFrom(i: Instruction, from: string): void {
    const { df } = this;
    if (from.includes('$')) return;
    const own = df.stages[i.stage];
    const lower = from.toLowerCase();
    if (/^\d+$/.test(from)) {
      const idx = Number(from);
      if (idx === i.stage) {
        this.add('DL3023', i, 'COPY --from refers to its own stage.', 'Copy from a previous stage, not the stage being built.');
      } else if (idx > i.stage) {
        this.add('DL3022', i, `COPY --from=${from} refers to a stage that is defined later.`, 'A stage can only copy from stages that appear before it.');
      }
      return;
    }
    if (own && own.name && own.name.toLowerCase() === lower) {
      this.add('DL3023', i, `COPY --from=${from} refers to its own stage.`, 'Copy from a previous stage, not the stage being built.');
      return;
    }
    const idx = df.stages.findIndex((s) => s.name !== null && s.name.toLowerCase() === lower);
    if (idx >= 0) {
      if (idx > i.stage) {
        this.add('DL3022', i, `COPY --from=${from} refers to a stage that is defined later (line ${df.stages[idx]?.line}).`, 'A stage can only copy from stages that appear before it. Reorder the stages.');
      }
      return;
    }
    if (/[/:@.]/.test(from)) return; // an external image reference
    this.add('DL3022', i, `COPY --from=${from} does not match any previous stage name.`, `Define the stage with "FROM ... AS ${from}" earlier in the file. (If ${from} is meant to be an external image, give it a tag or registry.)`);
  }

  stageHasWorkdir(i: Instruction): boolean {
    const { df } = this;
    let st: Stage | undefined = df.stages[i.stage];
    const seen = new Set<number>();
    let limit = i.index;
    while (st && !seen.has(st.index)) {
      seen.add(st.index);
      for (const bi of st.body) {
        if (bi >= limit) break;
        const b = df.instructions[bi];
        if (b && b.keyword === 'WORKDIR') return true;
      }
      // inherit from a parent stage
      const baseName = st.image.toLowerCase();
      const parent: Stage | undefined = df.stages.slice(0, st.index).find((s) => s.name !== null && s.name.toLowerCase() === baseName);
      st = parent;
      limit = Number.MAX_SAFE_INTEGER;
    }
    return false;
  }

  // ---- RUN ------------------------------------------------------------------

  lintRun(i: Instruction): void {
    const info = this.run(i);
    const { cmds } = info;
    const cacheMount = i.flags.some((f) => f.name === 'mount' && /type=cache/.test(f.value));
    const text = info.text;
    const at = (c: Cmd): number => info.lineAt(c.offset);
    const mentions = (re: RegExp): boolean => re.test(text);

    let usedAptInstall = false;
    let usedAptUpdate = false;
    let hasPipeNoFail = false;

    for (const c of cmds) {
      const line = at(c);
      const name = c.name;
      if (c.sudo) {
        this.add('DL3004', i, 'Do not use sudo.', 'Commands in RUN already execute as the current USER (root by default). Use USER to switch users, or gosu/su-exec if you need to drop privileges at runtime.', line);
      }
      if (name === 'cd') {
        this.add('DL3003', i, 'Use WORKDIR to switch to a directory instead of "cd".', 'WORKDIR is persistent and creates the directory if it does not exist. "cd" only affects the current RUN.', line);
      }
      if (['ssh', 'vim', 'shutdown', 'service', 'ps', 'free', 'top', 'kill', 'mount', 'ifconfig'].includes(name)) {
        this.add('DL3001', i, `"${name}" does not make sense in a container build.`, 'Avoid system-management commands (ssh, vim, shutdown, service, ps, free, top, kill, mount) in a Dockerfile. Run the daemon directly as the container process instead of "service".', line);
      }
      if (name === 'ln' && c.args.some((a) => /^-[a-zA-Z]*s/.test(a)) && c.args.some((a) => a === '/bin/sh') && c.args.some((a) => /bash$/.test(a))) {
        this.add('DL4005', i, 'Use SHELL to change the default shell instead of symlinking /bin/sh.', 'Write SHELL ["/bin/bash", "-c"] so later RUN instructions use bash.', line);
      }
      if (name === 'chmod') {
        const mode = c.args.find((a) => !isFlag(a));
        if (mode && /^(0?777|a\+rwx|ugo\+rwx|o\+[rw]*w[rwx]*|a\+w|go\+w)$/.test(mode)) {
          this.add('OUT014', i, `chmod ${mode} makes files world-writable.`, 'Grant only the permissions needed (for example 755 for executables, 644 for files) and use chown/USER to give the right account access.', line);
        }
      }
      // insecure TLS
      if (
        (name === 'curl' && c.args.some((a) => a === '-k' || a === '--insecure' || /^-[a-zA-Z]*k[a-zA-Z]*$/.test(a))) ||
        (name === 'wget' && c.args.includes('--no-check-certificate')) ||
        (name === 'npm' && c.args.join(' ').includes('strict-ssl') && /false/.test(c.args.join(' '))) ||
        (name === 'git' && /http\.sslverify/i.test(c.args.join(' ')) && /false/.test(c.args.join(' '))) ||
        (name === 'pip' && c.args.includes('--trusted-host')) ||
        c.assigns.some((a) => /^NODE_TLS_REJECT_UNAUTHORIZED=0$/.test(a)) ||
        (name === 'yum' && c.args.includes('--nogpgcheck')) ||
        (name === 'apt-get' && c.args.some((a) => /AllowUnauthenticated|--allow-unauthenticated/.test(a)))
      ) {
        this.add('OUT015', i, `${name} is run with TLS/signature verification disabled.`, 'Disabling certificate or signature checks lets a network attacker tamper with downloads. Fix the trust store (ca-certificates) or pin the checksum instead.', line);
      }
      if (name === 'wget' && !c.args.some((a) => /^--progress/.test(a) || a === '-nv' || a === '--no-verbose' || a === '-q' || a === '--quiet' || /^-[a-zA-Z]*q[a-zA-Z]*$/.test(a) || a === '-o' || a === '-a' || /^-[oa]\S/.test(a))) {
        this.add('DL3047', i, 'wget without --progress prints a line per update and floods the build log.', 'Add --progress=dot:giga (or -q / -nv).', line);
      }

      // pipes
      if (c.pipedTo && c.name !== '') {
        const nextIdx = cmds.indexOf(c) + 1;
        const nxt = cmds[nextIdx];
        if (nxt && nxt.pipedFrom) {
          if (['sh', 'bash', 'zsh', 'dash', 'ash', 'ksh'].includes(nxt.name) && (name === 'curl' || name === 'wget' || c.words.some((w) => /^(curl|wget)$/.test(baseName(w))))) {
            this.add('OUT007', i, `Piping the output of ${name} into ${nxt.name} runs unverified remote code.`, 'Download to a file, verify its checksum or signature, then execute it. Pin the version of whatever you install.', line);
          }
          hasPipeNoFail = true;
        }
      }

      // package managers
      this.lintPackageManagers(i, c, line, text, cacheMount);
      if ((name === 'apt-get' || name === 'apt' || name === 'aptitude')) {
        const s = subcommand(c.args, APT_VALUED);
        if (s.sub === 'install') usedAptInstall = true;
        if (s.sub === 'update') usedAptUpdate = true;
      }
    }

    // bash <(curl ...) / sh -c "$(curl ...)"
    const ps = /\b(?:ba|z|da|k)?sh\b[^|;&\n]*?(?:<\(|\$\()\s*(?:curl|wget)\b/.exec(this.run(i).script ? text : info.ins.rest);
    if (ps && !cmds.some((c) => c.pipedTo)) {
      this.add('OUT007', i, 'A shell executes the output of curl/wget, which runs unverified remote code.', 'Download to a file, verify its checksum or signature, then execute it.');
    }

    // apt-get update without install
    if (usedAptUpdate && !usedAptInstall && cmds.length > 0 && !cmds.some((c) => ['apt-get', 'apt', 'aptitude'].includes(c.name) && subcommand(c.args, APT_VALUED).sub === 'upgrade')) {
      const upd = cmds.find((c) => ['apt-get', 'apt', 'aptitude'].includes(c.name) && subcommand(c.args, APT_VALUED).sub === 'update');
      this.add('OUT003', i, 'apt-get update runs alone in its own RUN.', 'A lone "apt-get update" layer is cached and goes stale. Combine it with the install in one RUN: RUN apt-get update && apt-get install -y --no-install-recommends <pkgs> && rm -rf /var/lib/apt/lists/*', upd ? at(upd) : undefined);
    }

    // pipefail
    if (hasPipeNoFail && !mentions(/\bset\s+-[a-zA-Z]*o\s+pipefail|\bset\s+-[a-zA-Z]*\s+-o\s+pipefail|pipefail/)) {
      if (!this.stagePipefail(i)) {
        const c = cmds.find((x) => x.pipedTo && cmds[cmds.indexOf(x) + 1]?.pipedFrom);
        this.add('DL4006', i, 'This RUN uses a pipe, but a failure on the left side of the pipe is ignored.', 'Add SHELL ["/bin/bash", "-o", "pipefail", "-c"] before the RUN (or "set -o pipefail &&" at the start), so a failing command fails the build.', c ? at(c) : undefined);
      }
    }
  }

  stagePipefail(i: Instruction): boolean {
    const { df } = this;
    const st = df.stages[i.stage];
    if (!st) return false;
    for (const bi of st.body) {
      if (bi >= i.index) break;
      const b = df.instructions[bi];
      if (b && b.keyword === 'SHELL' && b.json && b.json.join(' ').includes('pipefail')) return true;
    }
    return false;
  }

  lintPackageManagers(i: Instruction, c: Cmd, line: number, text: string, cacheMount: boolean): void {
    const name = c.name;
    const args = c.args;

    // ---- apt ----
    if (name === 'apt') {
      this.add('DL3027', i, 'Do not use apt: it is meant for interactive use and its CLI is not stable.', 'Use apt-get (or apt-cache) in scripts and Dockerfiles.', line);
    }
    if (name === 'apt-get' || name === 'apt' || name === 'aptitude') {
      const s = subcommand(args, APT_VALUED);
      if (s.sub === 'upgrade' || s.sub === 'dist-upgrade' || s.sub === 'full-upgrade') {
        this.add('DL3005', i, `Do not use ${name} ${s.sub}.`, 'Upgrading everything makes the build depend on the day it runs and hides what is in the image. Pick a newer base image tag instead.', line);
      }
      if (s.sub === 'install') {
        const flags = s.flags;
        const hasYes = flags.some((f) => f === '--yes' || f === '--assume-yes' || f === '-qq' || /^-[a-zA-Z]*y[a-zA-Z]*$/.test(f) || f === '-s' || f === '--simulate' || f === '--dry-run' || /^APT::Get::Assume-Yes=true$/i.test(f));
        if (!hasYes && !c.assigns.some((a) => /APT_YES|assume/i.test(a))) {
          this.add('DL3014', i, `${name} install is missing -y.`, 'The build cannot answer prompts: use "apt-get install -y".', line);
        }
        const noRec = flags.some((f) => f === '--no-install-recommends' || /Install-Recommends=(false|0)/i.test(f) || f === '--install-recommends=false');
        if (!noRec) {
          this.add('DL3015', i, `${name} install without --no-install-recommends pulls in extra packages.`, 'Add --no-install-recommends to keep the image small.', line);
        }
        const unpinned = s.rest.filter((p) => !p.startsWith('$') && !p.includes('=') && !p.includes('/') && !/\.deb$/.test(p) && !/[*]/.test(p) && p !== '\\');
        if (unpinned.length > 0) {
          this.add('DL3008', i, `Package versions are not pinned in ${name} install (${unpinned.slice(0, 4).join(', ')}${unpinned.length > 4 ? ', …' : ''}).`, 'Pin with package=version (see "apt-cache madison <pkg>") for reproducible builds, or ignore this rule if you deliberately track the latest packages.', line);
        }
        // lists cleanup
        if (!cacheMount && !this.listsCleaned(i)) {
          this.add('DL3009', i, 'Delete the apt-get lists after installing something.', 'End the RUN with "&& rm -rf /var/lib/apt/lists/*" (in the same RUN, otherwise the files stay in an earlier layer).', line);
        }
      }
    }

    // ---- apk ----
    if (name === 'apk') {
      const s = subcommand(args, new Set(['-t', '--virtual', '--repository', '-X']));
      if (s.sub === 'add') {
        if (!s.flags.includes('--no-cache') && !/rm\s+(-[a-z]+\s+)*\S*\/var\/cache\/apk/.test(text)) {
          this.add('DL3019', i, 'apk add without --no-cache keeps the package index in the image.', 'Use "apk add --no-cache <pkgs>"; it needs no "apk update" and no cleanup.', line);
        }
        const unpinned = s.rest.filter((p) => !/[=~<>]/.test(p) && !p.startsWith('$') && !p.startsWith('.') && !p.startsWith('/') && !/\.apk$/.test(p));
        if (unpinned.length > 0) {
          this.add('DL3018', i, `Package versions are not pinned in apk add (${unpinned.slice(0, 4).join(', ')}${unpinned.length > 4 ? ', …' : ''}).`, 'Pin with pkg=version, e.g. apk add --no-cache curl=8.5.0-r0.', line);
        }
      }
    }

    // ---- pip ----
    const isPip = /^pip[0-9.]*$/.test(name) || (/^python[0-9.]*$/.test(name) && args[0] === '-m' && args[1] === 'pip');
    if (isPip) {
      const pargs = name.startsWith('python') ? args.slice(2) : args;
      const s = subcommand(pargs, new Set(['--isolated-dummy']));
      if (s.sub === 'install') {
        const noCacheEnv = c.assigns.some((a) => /^PIP_NO_CACHE_DIR=(1|true|on|yes)$/i.test(a)) || this.stageEnv(i, /^PIP_NO_CACHE_DIR$/, /^(1|true|on|yes)$/i);
        if (!pargs.includes('--no-cache-dir') && !pargs.some((a) => /^--no-cache-dir=/.test(a)) && !noCacheEnv && !cacheMount && !/pip\s+cache\s+(purge|remove)/.test(text)) {
          this.add('DL3042', i, 'pip install without --no-cache-dir keeps the download cache in the image.', 'Use "pip install --no-cache-dir <pkgs>" (or ENV PIP_NO_CACHE_DIR=1).', line);
        }
        const valued = new Set(['-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-i', '--index-url', '--extra-index-url', '-f', '--find-links', '-t', '--target', '--prefix', '--root', '--trusted-host', '--platform', '--python-version', '--implementation', '--abi', '--only-binary', '--no-binary', '--global-option', '--install-option', '--proxy', '--cache-dir', '--src', '--upgrade-strategy', '--progress-bar', '--timeout', '--retries', '--constraint']);
        const pk = subcommand(pargs, valued);
        const unpinned = pk.rest.concat(pk.sub && pk.sub !== 'install' ? [pk.sub] : []).filter((p) => {
          if (p.startsWith('$') || p.startsWith('.') || p.startsWith('/') || /^(https?|git\+|file:)/.test(p) || /\.(whl|tar\.gz|zip|tgz)$/.test(p)) return false;
          if (/(==|>=|<=|~=|!=|===|@|<|>)/.test(p)) return false;
          if (['pip', 'setuptools', 'wheel'].includes(p.toLowerCase())) return false;
          return true;
        });
        if (unpinned.length > 0) {
          this.add('DL3013', i, `Package versions are not pinned in pip install (${unpinned.slice(0, 4).join(', ')}${unpinned.length > 4 ? ', …' : ''}).`, 'Pin with package==version or install from a hashed requirements file / lock file.', line);
        }
      }
    }

    // ---- npm / yarn / pnpm ----
    if (name === 'npm') {
      const s = subcommand(args, new Set(['--prefix', '--registry', '--cache', '-w', '--workspace', '--userconfig']));
      if (s.sub === 'install' || s.sub === 'i' || s.sub === 'add') {
        const pkgs = s.rest;
        if (pkgs.length === 0) {
          this.add('OUT004', i, '"npm install" resolves dependencies at build time.', 'Use "npm ci" (reads package-lock.json exactly, fails if it is out of sync) for reproducible, faster builds. Add --omit=dev for production images.', line);
        } else {
          const unpinned = pkgs.filter((p) => {
            if (p.startsWith('.') || p.startsWith('/') || /^(https?:|git\+|github:|file:|git@)/.test(p) || /\.(tgz|tar\.gz)$/.test(p) || p.startsWith('$')) return false;
            const at = p.lastIndexOf('@');
            return at <= 0;
          });
          if (unpinned.length > 0) {
            this.add('DL3016', i, `Package versions are not pinned in npm install (${unpinned.slice(0, 4).join(', ')}${unpinned.length > 4 ? ', …' : ''}).`, 'Pin with name@version, e.g. npm install -g typescript@5.4.5.', line);
          }
        }
      }
    }
    if (name === 'yarn') {
      const s = subcommand(args, new Set(['--cwd', '--registry', '--cache-folder']));
      if (s.sub === null || s.sub === 'install') {
        if (!args.includes('--frozen-lockfile') && !args.includes('--immutable') && !args.includes('--pure-lockfile')) {
          this.add('OUT005', i, '"yarn install" may modify yarn.lock and resolve new versions.', 'Use "yarn install --frozen-lockfile" (Yarn 1) or "yarn install --immutable" (Yarn 2+).', line);
        }
        if (!/yarn\s+cache\s+clean/.test(text) && !cacheMount) {
          this.add('DL3060', i, '"yarn cache clean" is missing after "yarn install".', 'Append "&& yarn cache clean" in the same RUN to keep the cache out of the layer.', line);
        }
      }
    }
    if (name === 'pnpm') {
      const s = subcommand(args, new Set(['--filter', '-C', '--dir']));
      if ((s.sub === 'install' || s.sub === 'i') && s.rest.length === 0 && !args.includes('--frozen-lockfile')) {
        this.add('OUT005', i, '"pnpm install" is not run with --frozen-lockfile.', 'Use "pnpm install --frozen-lockfile" so the build fails if pnpm-lock.yaml is out of date.', line);
      }
    }

    // ---- yum / dnf / zypper ----
    if (name === 'yum' || name === 'dnf' || name === 'microdnf') {
      const s = subcommand(args, new Set(['--setopt', '--enablerepo', '--disablerepo', '-c', '--config', '--releasever']));
      if (s.sub === 'install' || s.sub === 'localinstall' || s.sub === 'groupinstall') {
        const hasY = s.flags.some((f) => f === '--assumeyes' || /^-[a-zA-Z]*y[a-zA-Z]*$/.test(f) || f === '--assume-yes');
        if (!hasY) {
          this.add(name === 'yum' ? 'DL3030' : 'DL3038', i, `${name} install is missing -y.`, `Use "${name} install -y <pkgs>"; the build cannot answer prompts.`, line);
        }
        const cleaned = name === 'yum' ? /yum\s+clean\s+all|rm\s+(-[a-z]+\s+)*\S*\/var\/cache\/yum/.test(text) : /(dnf|microdnf)\s+clean\s+all|rm\s+(-[a-z]+\s+)*\S*\/var\/cache\/(dnf|yum)/.test(text);
        if (!cleaned && !cacheMount) {
          this.add(name === 'yum' ? 'DL3032' : 'DL3040', i, `${name} clean all is missing after ${name} install.`, `Add "&& ${name} clean all" (or rm -rf /var/cache/${name === 'yum' ? 'yum' : 'dnf'}) to the same RUN.`, line);
        }
        const unpinned = s.rest.filter((p) => !p.startsWith('$') && !/-\d/.test(p) && !p.includes('=') && !/\.rpm$/.test(p) && !p.startsWith('@') && !p.includes('*'));
        if (unpinned.length > 0) {
          this.add(name === 'yum' ? 'DL3033' : 'DL3041', i, `Package versions are not pinned in ${name} install (${unpinned.slice(0, 4).join(', ')}${unpinned.length > 4 ? ', …' : ''}).`, `Pin with name-version, e.g. ${name} install -y httpd-2.4.57.`, line);
        }
      }
    }
    if (name === 'zypper') {
      const s = subcommand(args, new Set(['--root', '-R']));
      if (s.sub === 'install' || s.sub === 'in') {
        const all = c.args;
        const nonInteractive = all.some((f) => f === '-n' || f === '--non-interactive' || /^-[a-zA-Z]*n[a-zA-Z]*$/.test(f)) || all.includes('-y');
        if (!nonInteractive) {
          this.add('DL3034', i, 'zypper install without --non-interactive may wait for input.', 'Use "zypper --non-interactive install <pkgs>" (or -n).', line);
        }
        if (!/zypper\s+(\S+\s+)*(clean|cc)\b/.test(text) && !cacheMount) {
          this.add('DL3036', i, '"zypper clean" is missing after "zypper install".', 'Add "&& zypper clean" to the same RUN.', line);
        }
      }
    }
  }

  stageEnv(i: Instruction, nameRe: RegExp, valueRe: RegExp): boolean {
    const { df } = this;
    const st = df.stages[i.stage];
    if (!st) return false;
    for (const bi of st.body) {
      if (bi >= i.index) break;
      const b = df.instructions[bi];
      if (b && b.keyword === 'ENV') {
        for (const p of parsePairs(b.rest, true)) {
          if (nameRe.test(p.name) && valueRe.test(p.value)) return true;
        }
      }
    }
    return false;
  }

  /** Does this RUN, or a later RUN in the same stage, delete /var/lib/apt/lists? */
  listsCleaned(i: Instruction): boolean {
    const { df } = this;
    const re = /(rm\s+(-[a-zA-Z]+\s+|--\S+\s+)*[^;&|]*\/var\/lib\/apt\/lists|find\s+\/var\/lib\/apt\/lists[^;&|]*-delete)/;
    if (re.test(this.run(i).text)) return true;
    const st = df.stages[i.stage];
    if (!st) return false;
    for (const bi of st.body) {
      if (bi <= i.index) continue;
      const b = df.instructions[bi];
      if (b && b.keyword === 'RUN' && re.test(this.run(b).text)) return true;
    }
    return false;
  }

  // ---- stages ---------------------------------------------------------------

  lintStages(): void {
    const { df } = this;
    const ins = df.instructions;
    const stages = df.stages;
    const last = stages[stages.length - 1];

    // unused stages
    for (const st of stages) {
      if (st === last) continue;
      const nameLower = st.name?.toLowerCase() ?? null;
      let used = false;
      for (const later of stages.slice(st.index + 1)) {
        if (nameLower && later.image.toLowerCase() === nameLower) used = true;
        const fromIns = ins[later.from];
        if (fromIns && fromIns.flags.some((f) => f.name === 'from' && nameLower !== null && f.value.toLowerCase() === nameLower)) used = true;
        for (const bi of later.body) {
          const b = ins[bi];
          if (!b) continue;
          for (const f of b.flags) {
            if (f.name === 'from' && ((nameLower && f.value.toLowerCase() === nameLower) || f.value === String(st.index))) used = true;
            if (f.name === 'mount') {
              for (const kv of f.value.split(',')) {
                const [k, v] = kv.split('=');
                if (k?.trim().toLowerCase() === 'from' && v !== undefined && ((nameLower && v.trim().toLowerCase() === nameLower) || v.trim() === String(st.index))) used = true;
              }
            }
          }
        }
      }
      if (!used) {
        const f = ins[st.from];
        if (f) {
          this.add('OUT001', f, `Build stage ${st.name ? `"${st.name}"` : `#${st.index}`} is never used by a later stage.`, 'Remove it, or keep it only if you build it directly with "docker build --target".');
        }
      }
    }

    // per stage checks
    for (const st of stages) {
      const body = st.body.map((k) => ins[k]).filter((x): x is Instruction => !!x);
      const cmds = body.filter((b) => b.keyword === 'CMD' && !b.onbuild);
      const eps = body.filter((b) => b.keyword === 'ENTRYPOINT' && !b.onbuild);
      cmds.slice(0, -1).forEach((c) => {
        const next = cmds[cmds.indexOf(c) + 1];
        this.add('DL4003', c, `This CMD is overridden by the CMD on line ${next?.line ?? '?'}.`, 'Only the last CMD in a stage takes effect. Remove the extra CMD instructions.');
      });
      eps.slice(0, -1).forEach((c) => {
        const next = eps[eps.indexOf(c) + 1];
        this.add('DL4004', c, `This ENTRYPOINT is overridden by the ENTRYPOINT on line ${next?.line ?? '?'}.`, 'Only the last ENTRYPOINT in a stage takes effect. Remove the extra ENTRYPOINT instructions.');
      });

      // consecutive RUN
      for (let k = 1; k < body.length; k++) {
        const a = body[k - 1];
        const b = body[k];
        if (!a || !b) continue;
        if (a.keyword === 'RUN' && b.keyword === 'RUN' && !a.onbuild && !b.onbuild && !a.json && !b.json && a.heredocs.length === 0 && b.heredocs.length === 0) {
          const fa = a.flags.map((f) => `${f.name}=${f.value}`).sort().join('|');
          const fb = b.flags.map((f) => `${f.name}=${f.value}`).sort().join('|');
          if (fa === fb) {
            this.add('DL3059', b, 'Multiple consecutive RUN instructions.', `Merge this RUN with the one on line ${a.line} using "&&" to avoid an extra layer.`);
          }
        }
      }

      // COPY . before dependency install
      let broadCopy: Instruction | null = null;
      let manifestCopied = false;
      for (const b of body) {
        if (b.keyword === 'COPY' && b.flags.every((f) => f.name !== 'from') && !b.onbuild) {
          const words = b.json ?? splitWords(b.rest);
          const srcs = words.slice(0, -1);
          if (srcs.some((s) => s === '.' || s === './' || s === '*' || s === './*')) {
            if (!broadCopy && !manifestCopied) broadCopy = b;
          } else if (srcs.length > 0) {
            manifestCopied = true;
          }
        }
        if (b.keyword === 'RUN' && broadCopy && !b.onbuild) {
          const t = this.run(b);
          const installs = t.cmds.some((c) => this.isDependencyInstall(c));
          if (installs) {
            this.add('OUT010', broadCopy, 'Copying the whole build context before installing dependencies invalidates the dependency layer on every code change.', 'Copy only the manifest first (package.json + lockfile, requirements.txt, go.mod, pom.xml, ...), run the install, then COPY the rest of the source.');
            broadCopy = null;
          }
        }
      }
    }

    // final stage rules
    if (last) {
      const fromIns = ins[last.from];
      const body = last.body.map((k) => ins[k]).filter((x): x is Instruction => !!x && !x.onbuild);
      const users = body.filter((b) => b.keyword === 'USER');
      if (fromIns) {
        if (users.length === 0) {
          if (last.image.toLowerCase() !== 'scratch' && !/(nonroot|rootless|unprivileged|^bitnami\/|chainguard)/i.test(last.image)) {
            this.add('OUT002', fromIns, 'No USER instruction: the container will run as root.', 'Create an unprivileged user and switch to it: RUN useradd -r -u 10001 app  then  USER app. (Ignore this rule if the base image already sets a non-root user.)');
          }
        } else {
          const lastUser = users[users.length - 1];
          if (lastUser) {
            const u = (splitWords(lastUser.rest)[0] ?? '').split(':')[0]?.toLowerCase() ?? '';
            if (u === 'root' || u === '0') {
              this.add('DL3002', lastUser, 'Last USER should not be root.', 'Switch to an unprivileged user at the end of the final stage.');
            }
          }
        }
        if (!body.some((b) => b.keyword === 'HEALTHCHECK')) {
          this.add('DL3057', fromIns, 'No HEALTHCHECK instruction in the final stage.', 'Add HEALTHCHECK CMD <probe> so Docker can report whether the service is actually healthy (orchestrators like Kubernetes use their own probes and may ignore it).');
        }
        if (!body.some((b) => b.keyword === 'LABEL')) {
          this.add('OUT011', fromIns, 'No LABEL instruction: the image carries no metadata.', 'Add OCI labels, e.g. LABEL org.opencontainers.image.source="https://github.com/you/repo" org.opencontainers.image.description="..." org.opencontainers.image.licenses="MIT"');
        }
      }
    }
  }

  isDependencyInstall(c: Cmd): boolean {
    const n = c.name;
    const a0 = c.args[0] ?? '';
    if (n === 'npm') return ['install', 'i', 'ci', 'add'].includes(a0);
    if (n === 'yarn') return a0 === '' || a0 === 'install' || a0 === 'add';
    if (n === 'pnpm') return ['install', 'i', 'add'].includes(a0);
    if (/^pip[0-9.]*$/.test(n)) return a0 === 'install';
    if (/^python[0-9.]*$/.test(n)) return c.args[0] === '-m' && c.args[1] === 'pip';
    if (n === 'bundle') return a0 === 'install' || a0 === '';
    if (n === 'composer') return a0 === 'install' || a0 === 'update';
    if (n === 'go') return a0 === 'mod' || a0 === 'get' || a0 === 'build';
    if (n === 'poetry' || n === 'pipenv') return a0 === 'install' || a0 === 'sync';
    if (n === 'mvn' || n === 'mvnw' || n === './mvnw') return true;
    if (n === 'gradle' || n === 'gradlew' || n === './gradlew') return true;
    if (n === 'cargo') return a0 === 'build' || a0 === 'fetch';
    if (n === 'dotnet') return a0 === 'restore' || a0 === 'build' || a0 === 'publish';
    return false;
  }

  // ---- whole file ------------------------------------------------------------

  lintGlobal(): void {
    const { df } = this;
    // wget and curl together
    let firstTool: string | null = null;
    for (const i of df.instructions) {
      if (i.keyword !== 'RUN' || i.onbuild) continue;
      const info = this.run(i);
      for (const c of info.cmds) {
        if (c.name === 'curl' || c.name === 'wget') {
          if (firstTool === null) firstTool = c.name;
          else if (firstTool !== c.name) {
            this.add('DL4001', i, `Both wget and curl are used (${firstTool} first, now ${c.name}).`, 'Pick one download tool; installing both increases image size and maintenance.', info.lineAt(c.offset));
            return;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const PENALTY: Record<Severity, number> = { error: 12, warning: 6, info: 1.5, style: 0.5 };

export function gradeFor(score: number): LintResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function scoreFindings(findings: Finding[]): { score: number; grade: LintResult['grade']; counts: Record<Severity, number> } {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0, style: 0 };
  let penalty = 0;
  for (const f of findings) {
    counts[f.severity]++;
    penalty += PENALTY[f.severity];
  }
  const score = Math.max(0, Math.round((100 - penalty) * 10) / 10);
  return { score, grade: gradeFor(score), counts };
}

export function lintDockerfile(text: string, options: LintOptions = {}): LintResult {
  const df = parseDockerfile(text);
  const linter = new Linter(df);
  const all = linter.lintAll();
  const enabled: Record<Severity, boolean> = { error: true, warning: true, info: true, style: true, ...options.severities };
  const userIgnore = new Set((options.ignoreRules ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean));

  const findings: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const f of all) {
    if (!enabled[f.severity]) continue;
    const ins = df.instructions.find((x) => f.line >= x.line && f.line <= x.endLine);
    const ignored =
      userIgnore.has(f.id) ||
      df.globalIgnore.has(f.id) ||
      (ins ? ins.ignore.has(f.id) : false) ||
      (findFromAnchor(df, f)?.ignore.has(f.id) ?? false);
    if (ignored) suppressed.push(f);
    else findings.push(f);
  }
  const { score, grade, counts } = scoreFindings(findings);
  return {
    findings,
    suppressed,
    counts,
    score,
    grade,
    stages: df.stages.length,
    instructions: df.instructions.length,
  };
}

/** The instruction a finding is anchored to (the first instruction that starts on the finding's line). */
function findFromAnchor(df: ParsedDockerfile, f: Finding): Instruction | undefined {
  return df.instructions.find((x) => x.line === f.line) ?? df.instructions.find((x) => x.line <= f.line && x.endLine >= f.line);
}
