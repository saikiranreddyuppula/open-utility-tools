/**
 * JSON Schema validator (Draft-07, 2019-09, 2020-12) — pure TypeScript, no dependencies.
 * Local $ref / $id / $anchor / $dynamicRef resolution only (no network).
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Draft = 'draft-07' | '2019-09' | '2020-12';
export type DraftChoice = 'auto' | Draft;

export interface ValidateOptions {
  draft: DraftChoice;
  /** Treat "format" as an assertion (otherwise it is an annotation). */
  formats: boolean;
  /** Collect every error instead of stopping at the first one. */
  allErrors: boolean;
  /** Safety cap on the number of reported errors. */
  maxErrors: number;
}

export const DEFAULT_VALIDATE_OPTIONS: ValidateOptions = {
  draft: 'auto',
  formats: true,
  allErrors: true,
  maxErrors: 500,
};

export interface ValidationError {
  /** JSON Pointer to the offending value inside the instance ("" is the root). */
  instancePath: string;
  /** Location of the failing keyword in the schema, e.g. "#/properties/age/minimum". */
  schemaPath: string;
  keyword: string;
  message: string;
  params?: Record<string, unknown>;
  /** Details for composite keywords (anyOf / oneOf / if / contains …). */
  causes?: ValidationError[];
}

export interface SchemaProblem {
  level: 'error' | 'warning' | 'info';
  path: string;
  message: string;
}

export interface DraftInfo {
  draft: Draft;
  source: 'option' | '$schema' | 'inferred' | 'default';
  note?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  problems: SchemaProblem[];
  draft: DraftInfo;
  truncated: boolean;
}

type Obj = Record<string, unknown>;

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ------------------------------------------------------------------ */
/* Draft detection                                                     */
/* ------------------------------------------------------------------ */

export function detectDraft(schema: unknown, choice: DraftChoice = 'auto'): DraftInfo {
  const decl = isObj(schema) && typeof schema.$schema === 'string' ? schema.$schema : null;
  const fromDecl = ((): { draft: Draft; note?: string } | null => {
    if (decl === null) return null;
    if (/2020-12/.test(decl)) return { draft: '2020-12' };
    if (/2019-09/.test(decl)) return { draft: '2019-09' };
    if (/draft-0?7/.test(decl)) return { draft: 'draft-07' };
    if (/draft-0?6/.test(decl)) return { draft: 'draft-07', note: 'Draft-06 schemas are validated with Draft-07 rules (a compatible superset).' };
    if (/draft-0?[34]/.test(decl)) {
      return { draft: 'draft-07', note: 'Draft-03/04 are not supported: validating with Draft-07 rules (boolean exclusiveMinimum/exclusiveMaximum and id are not understood).' };
    }
    return null;
  })();
  if (choice !== 'auto') {
    const note = fromDecl && fromDecl.draft !== choice ? `The schema declares ${fromDecl.draft} in "$schema" but ${choice} was selected.` : undefined;
    return { draft: choice, source: 'option', note };
  }
  if (fromDecl) return { draft: fromDecl.draft, source: '$schema', note: fromDecl.note };
  if (decl !== null) {
    return { draft: '2020-12', source: 'default', note: `Unrecognised "$schema" (${decl}); using 2020-12.` };
  }
  // no $schema: look for draft-specific keywords
  const seen = new Set<string>();
  let tupleItems = false;
  const walk = (s: unknown, depth: number): void => {
    if (!isObj(s) || depth > 40) return;
    for (const [k, v] of Object.entries(s)) {
      seen.add(k);
      if (k === 'items' && Array.isArray(v)) tupleItems = true;
      if (k === 'properties' || k === 'patternProperties' || k === '$defs' || k === 'definitions' || k === 'dependentSchemas') {
        if (isObj(v)) for (const sub of Object.values(v)) walk(sub, depth + 1);
      } else if (Array.isArray(v)) {
        for (const sub of v) walk(sub, depth + 1);
      } else if (isObj(v) && k !== 'enum' && k !== 'const' && k !== 'default' && k !== 'examples') {
        walk(v, depth + 1);
      }
    }
  };
  walk(schema, 0);
  const has = (...ks: string[]): boolean => ks.some((k) => seen.has(k));
  if (has('prefixItems', '$dynamicRef', '$dynamicAnchor') || has('$defs')) {
    return { draft: '2020-12', source: 'inferred', note: 'No "$schema": inferred 2020-12 from the keywords used.' };
  }
  if (has('$recursiveRef', '$recursiveAnchor', 'dependentRequired', 'dependentSchemas', 'unevaluatedProperties', 'unevaluatedItems', 'minContains', 'maxContains')) {
    return {
      draft: has('dependentRequired', 'dependentSchemas', 'unevaluatedProperties', 'unevaluatedItems', 'minContains', 'maxContains') && !has('$recursiveRef', '$recursiveAnchor') ? '2020-12' : '2019-09',
      source: 'inferred',
      note: 'No "$schema": inferred from the keywords used.',
    };
  }
  if (tupleItems || has('additionalItems', 'dependencies', 'definitions')) {
    return { draft: 'draft-07', source: 'inferred', note: 'No "$schema": inferred Draft-07 because the schema uses tuple "items", "additionalItems", "dependencies" or "definitions".' };
  }
  return { draft: '2020-12', source: 'default' };
}

/* ------------------------------------------------------------------ */
/* Deep equality, canonical form                                       */
/* ------------------------------------------------------------------ */

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'number') return a === (b as number);
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!hasOwn(b as object, k)) return false;
      if (!deepEqual((a as Obj)[k], (b as Obj)[k])) return false;
    }
    return true;
  }
  return false;
}

function canon(v: unknown): string {
  if (v === null) return 'n';
  switch (typeof v) {
    case 'number':
      return 'd' + String(v === 0 ? 0 : v);
    case 'string':
      return 's' + JSON.stringify(v);
    case 'boolean':
      return v ? 't' : 'f';
    default:
      break;
  }
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const o = v as Obj;
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
}

/* ------------------------------------------------------------------ */
/* JSON pointer helpers                                                */
/* ------------------------------------------------------------------ */

export function escapePointerSegment(seg: string): string {
  return seg.replace(/~/g, '~0').replace(/\//g, '~1');
}

function pointerGet(root: unknown, pointer: string): { found: true; value: unknown } | { found: false } {
  if (pointer === '') return { found: true, value: root };
  if (!pointer.startsWith('/')) return { found: false };
  let cur: unknown = root;
  for (const raw of pointer.slice(1).split('/')) {
    let seg = raw;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }
    seg = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(cur)) {
      if (!/^(?:0|[1-9][0-9]*)$/.test(seg)) return { found: false };
      const idx = Number(seg);
      if (idx >= cur.length) return { found: false };
      cur = cur[idx];
    } else if (isObj(cur) && hasOwn(cur, seg)) {
      cur = cur[seg];
    } else return { found: false };
  }
  return { found: true, value: cur };
}

/* ------------------------------------------------------------------ */
/* Numbers: multipleOf without floating point surprises                */
/* ------------------------------------------------------------------ */

function toDecimal(n: number): { mant: bigint; scale: number } | null {
  if (!Number.isFinite(n)) return null;
  const s = Math.abs(n).toString().toLowerCase();
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(s);
  if (!m) return null;
  const int = m[1] ?? '0';
  const frac = m[2] ?? '';
  const exp = m[3] ? Number(m[3]) : 0;
  const digits = int + frac;
  let scale = frac.length - exp;
  let mant = BigInt(digits);
  if (scale < 0) {
    mant *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { mant, scale };
}

export function isMultipleOf(x: number, m: number): boolean {
  if (m === 0 || !Number.isFinite(m)) return false;
  if (!Number.isFinite(x)) return false;
  const a = toDecimal(x);
  const b = toDecimal(m);
  if (!a || !b) return false;
  const scale = Math.max(a.scale, b.scale);
  const A = a.mant * 10n ** BigInt(scale - a.scale);
  const B = b.mant * 10n ** BigInt(scale - b.scale);
  if (B === 0n) return false;
  return A % B === 0n;
}

/* ------------------------------------------------------------------ */
/* Format validators                                                   */
/* ------------------------------------------------------------------ */

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function validTimeParts(hh: number, mm: number, ss: number, off: string): boolean {
  if (hh > 23 || mm > 59 || ss > 60) return false;
  let offMin = 0;
  if (off !== 'Z' && off !== 'z') {
    const om = /^([+-])(\d{2}):(\d{2})$/.exec(off);
    if (!om) return false;
    const oh = Number(om[2]);
    const omm = Number(om[3]);
    if (oh > 23 || omm > 59) return false;
    offMin = (om[1] === '-' ? -1 : 1) * (oh * 60 + omm);
  }
  if (ss === 60) {
    const utc = (((hh * 60 + mm - offMin) % 1440) + 1440) % 1440;
    if (utc !== 23 * 60 + 59) return false;
  }
  return true;
}

export function isTime(s: string): boolean {
  const m = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m) return false;
  return validTimeParts(Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? '');
}

export function isDateTime(s: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m) return false;
  return isDate(m[1] ?? '') && validTimeParts(Number(m[2]), Number(m[3]), Number(m[4]), m[5] ?? '');
}

export function isIPv4(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  for (let i = 1; i <= 4; i++) {
    const p = m[i] ?? '';
    if (p.length > 1 && p.startsWith('0')) return false;
    if (Number(p) > 255) return false;
  }
  return true;
}

export function isIPv6(s: string): boolean {
  if (s.includes('%') || !/^[0-9A-Fa-f:.]+$/.test(s)) return false;
  const dbl = s.indexOf('::');
  if (dbl !== -1 && s.indexOf('::', dbl + 1) !== -1) return false;
  if (s.includes(':::')) return false;
  let head = s;
  let groupsNeeded = 8;
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (!isIPv4(tail)) return false;
    head = s.slice(0, lastColon + 1);
    if (head.endsWith('::')) {
      /* ok: "::1.2.3.4" */
    } else if (head.endsWith(':')) head = head.slice(0, -1);
    groupsNeeded = 6;
    if (head === '') return false;
  }
  const parts = head.split('::');
  if (parts.length > 2) return false;
  const parse = (p: string): string[] | null => {
    if (p === '') return [];
    const g = p.split(':');
    for (const x of g) if (!/^[0-9A-Fa-f]{1,4}$/.test(x)) return null;
    return g;
  };
  if (parts.length === 1) {
    const g = parse(parts[0] ?? '');
    return g !== null && g.length === groupsNeeded;
  }
  const left = parse(parts[0] ?? '');
  const right = parse(parts[1] ?? '');
  if (left === null || right === null) return false;
  return left.length + right.length < groupsNeeded;
}

export function isHostname(s: string): boolean {
  if (s.length === 0 || s.length > 253) return false;
  const labels = s.split('.');
  for (const l of labels) {
    if (l.length === 0 || l.length > 63) return false;
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(l)) return false;
  }
  return true;
}

export function isEmail(s: string): boolean {
  const at = s.lastIndexOf('@');
  if (at < 1) return false;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (s.length > 254 || domain === '') return false;
  if (local.startsWith('"')) {
    if (!/^"(?:[^"\\\r\n]|\\[ -~])*"$/.test(local)) return false;
  } else {
    if (local.length > 64) return false;
    if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)) return false;
  }
  if (domain.startsWith('[') && domain.endsWith(']')) {
    const lit = domain.slice(1, -1);
    if (/^IPv6:/i.test(lit)) return isIPv6(lit.slice(5));
    return isIPv4(lit);
  }
  return isHostname(domain);
}

const URI_CHARS = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?#[\]]|%[0-9A-Fa-f]{2})*$/;

function validAuthority(auth: string): boolean {
  let host = auth;
  const at = auth.lastIndexOf('@');
  if (at !== -1) {
    const userinfo = auth.slice(0, at);
    if (/[[\]/?#@]/.test(userinfo)) return false;
    host = auth.slice(at + 1);
  }
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    if (close === -1) return false;
    const lit = host.slice(1, close);
    const rest = host.slice(close + 1);
    if (rest !== '' && !/^:\d*$/.test(rest)) return false;
    if (/^v[0-9A-Fa-f]+\./i.test(lit)) return true;
    return isIPv6(lit);
  }
  if (/[[\]]/.test(host)) return false;
  const colon = host.lastIndexOf(':');
  if (colon !== -1) {
    if (!/^\d*$/.test(host.slice(colon + 1))) return false;
  }
  return true;
}

export function isUri(s: string): boolean {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/s.exec(s);
  if (!m) return false;
  return validUriRest(m[2] ?? '', true);
}

function validUriRest(rest: string, absolute: boolean): boolean {
  if (!URI_CHARS.test(rest)) return false;
  const hash = rest.indexOf('#');
  if (hash !== -1 && rest.indexOf('#', hash + 1) !== -1) return false;
  const beforeFrag = hash === -1 ? rest : rest.slice(0, hash);
  const frag = hash === -1 ? '' : rest.slice(hash + 1);
  if (/[[\]]/.test(frag)) return false;
  const q = beforeFrag.indexOf('?');
  const pathPart = q === -1 ? beforeFrag : beforeFrag.slice(0, q);
  const query = q === -1 ? '' : beforeFrag.slice(q + 1);
  if (/[[\]]/.test(query)) return false;
  let path = pathPart;
  if (path.startsWith('//')) {
    const end = path.indexOf('/', 2);
    const auth = end === -1 ? path.slice(2) : path.slice(2, end);
    if (!validAuthority(auth)) return false;
    path = end === -1 ? '' : path.slice(end);
  } else if (!absolute) {
    // relative reference: first segment of a path without leading "/" must not contain ":"
    if (path !== '' && !path.startsWith('/')) {
      const seg = path.split('/')[0] ?? '';
      if (seg.includes(':')) return false;
    }
  }
  if (/[[\]]/.test(path)) return false;
  return true;
}

export function isUriReference(s: string): boolean {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/s.exec(s);
  if (m) return validUriRest(m[2] ?? '', true);
  return validUriRest(s, false);
}

export function isUuid(s: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(s);
}

export function isRegex(s: string): boolean {
  // ECMA-262 in Unicode mode, as recommended for JSON Schema ("\\a" is not a valid escape there)
  try {
    new RegExp(s, 'u');
    return true;
  } catch {
    return false;
  }
}

export function isJsonPointer(s: string): boolean {
  return /^(?:\/(?:[^~/]|~[01])*)*$/.test(s);
}

export function isRelativeJsonPointer(s: string): boolean {
  return /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~[01])*)*)$/.test(s);
}

const DUR_SEC = '\\d+S';
const DUR_MIN = '\\d+M(?:\\d+S)?';
const DUR_HOUR = '\\d+H(?:\\d+M(?:\\d+S)?)?';
const DUR_TIME = `T(?:${DUR_HOUR}|${DUR_MIN}|${DUR_SEC})`;
const DUR_DATE = `(?:\\d+D|\\d+M(?:\\d+D)?|\\d+Y(?:\\d+M(?:\\d+D)?)?)(?:${DUR_TIME})?`;
const DURATION_RE = new RegExp(`^P(?:${DUR_DATE}|${DUR_TIME}|\\d+W)$`);

export function isDuration(s: string): boolean {
  return DURATION_RE.test(s);
}

export const FORMAT_CHECKERS: Record<string, (s: string) => boolean> = {
  'date-time': isDateTime,
  date: isDate,
  time: isTime,
  email: isEmail,
  'idn-email': (s) => isEmail(s) || (/[^\x00-\x7f]/.test(s) && /^[^@\s]+@[^@\s]+$/.test(s)),
  hostname: isHostname,
  ipv4: isIPv4,
  ipv6: isIPv6,
  uri: isUri,
  'uri-reference': isUriReference,
  uuid: isUuid,
  regex: isRegex,
  'json-pointer': isJsonPointer,
  'relative-json-pointer': isRelativeJsonPointer,
  duration: isDuration,
};

export const SUPPORTED_FORMATS = Object.keys(FORMAT_CHECKERS);

/* ------------------------------------------------------------------ */
/* Schema index ($id / $anchor / locations) and static checks          */
/* ------------------------------------------------------------------ */

const DEFAULT_BASE = 'https://json-schema.invalid/root.json';

const ANNOTATION_KEYWORDS = new Set([
  '$schema', '$id', '$comment', '$anchor', '$vocabulary', 'title', 'description', 'default', 'examples',
  'readOnly', 'writeOnly', 'deprecated', 'definitions', '$defs', 'format', 'contentEncoding', 'contentMediaType',
  'contentSchema', '$ref',
]);

const KEYWORDS_BY_DRAFT: Record<Draft, Set<string>> = {
  'draft-07': new Set([
    'type', 'enum', 'const', 'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',
    'maxLength', 'minLength', 'pattern', 'items', 'additionalItems', 'maxItems', 'minItems', 'uniqueItems',
    'contains', 'maxProperties', 'minProperties', 'required', 'properties', 'patternProperties',
    'additionalProperties', 'dependencies', 'propertyNames', 'if', 'then', 'else', 'allOf', 'anyOf', 'oneOf', 'not',
  ]),
  '2019-09': new Set([
    'type', 'enum', 'const', 'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',
    'maxLength', 'minLength', 'pattern', 'items', 'additionalItems', 'maxItems', 'minItems', 'uniqueItems',
    'contains', 'minContains', 'maxContains', 'maxProperties', 'minProperties', 'required', 'properties',
    'patternProperties', 'additionalProperties', 'dependentRequired', 'dependentSchemas', 'propertyNames', 'if', 'then',
    'else', 'allOf', 'anyOf', 'oneOf', 'not', 'unevaluatedItems', 'unevaluatedProperties', '$recursiveRef',
    '$recursiveAnchor',
  ]),
  '2020-12': new Set([
    'type', 'enum', 'const', 'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',
    'maxLength', 'minLength', 'pattern', 'prefixItems', 'items', 'maxItems', 'minItems', 'uniqueItems', 'contains',
    'minContains', 'maxContains', 'maxProperties', 'minProperties', 'required', 'properties', 'patternProperties',
    'additionalProperties', 'dependentRequired', 'dependentSchemas', 'propertyNames', 'if', 'then', 'else', 'allOf',
    'anyOf', 'oneOf', 'not', 'unevaluatedItems', 'unevaluatedProperties', '$dynamicRef', '$dynamicAnchor',
  ]),
};

/** Keywords that exist only in some drafts → hint when used in another one. */
const DRAFT_HINTS: Record<string, { drafts: Draft[]; hint: string }> = {
  prefixItems: { drafts: ['2020-12'], hint: 'is a 2020-12 keyword (for Draft-07/2019-09 use a tuple "items": [...])' },
  additionalItems: { drafts: ['draft-07', '2019-09'], hint: 'was replaced in 2020-12 by "items" after "prefixItems"' },
  dependentRequired: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer (Draft-07 uses "dependencies")' },
  dependentSchemas: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer (Draft-07 uses "dependencies")' },
  unevaluatedProperties: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer' },
  unevaluatedItems: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer' },
  minContains: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer' },
  maxContains: { drafts: ['2019-09', '2020-12'], hint: 'needs Draft 2019-09 or newer' },
  $recursiveRef: { drafts: ['2019-09'], hint: 'exists only in 2019-09 (2020-12 uses $dynamicRef)' },
  $recursiveAnchor: { drafts: ['2019-09'], hint: 'exists only in 2019-09 (2020-12 uses $dynamicAnchor)' },
  $dynamicRef: { drafts: ['2020-12'], hint: 'is a 2020-12 keyword' },
  $dynamicAnchor: { drafts: ['2020-12'], hint: 'is a 2020-12 keyword' },
};

const SINGLE_SUBSCHEMA = ['additionalItems', 'additionalProperties', 'contains', 'propertyNames', 'not', 'if', 'then', 'else', 'unevaluatedItems', 'unevaluatedProperties', 'contentSchema'];
const ARRAY_SUBSCHEMAS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'];
const MAP_SUBSCHEMAS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'];

const TYPE_NAMES = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);

interface Ann {
  props: Set<string>;
  allProps: boolean;
  items: number;
  allItems: boolean;
  extra: Set<number>;
}
const newAnn = (): Ann => ({ props: new Set(), allProps: false, items: 0, allItems: false, extra: new Set() });
function mergeAnn(into: Ann, from: Ann): void {
  for (const p of from.props) into.props.add(p);
  if (from.allProps) into.allProps = true;
  if (from.items > into.items) into.items = from.items;
  if (from.allItems) into.allItems = true;
  for (const i of from.extra) into.extra.add(i);
}

class RecursionError extends Error {}

function cpLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    n++;
  }
  return n;
}

type InstType = 'null' | 'boolean' | 'integer' | 'number' | 'string' | 'array' | 'object';
function instType(v: unknown): InstType {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  switch (typeof v) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return Number.isInteger(v) ? 'integer' : 'number';
    case 'string':
      return 'string';
    default:
      return 'object';
  }
}
function matchesType(v: unknown, t: string): boolean {
  switch (t) {
    case 'null':
      return v === null;
    case 'boolean':
      return typeof v === 'boolean';
    case 'number':
      return typeof v === 'number';
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'string':
      return typeof v === 'string';
    case 'array':
      return Array.isArray(v);
    case 'object':
      return isObj(v);
    default:
      return false;
  }
}

function short(v: unknown, max = 60): string {
  let s: string;
  try {
    s = JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* ------------------------------------------------------------------ */
/* Validator                                                           */
/* ------------------------------------------------------------------ */

type RefResult =
  | { ok: true; target: unknown; loc: string; res: object | undefined }
  | { ok: false; message: string };

class Validator {
  readonly draft: Draft;
  readonly formats: boolean;
  all: boolean;
  readonly maxErrors: number;
  readonly root: unknown;
  readonly problems: SchemaProblem[] = [];
  private problemKeys = new Set<string>();
  private resources = new Map<string, unknown>();
  private anchors = new Map<string, Obj>();
  private dynAnchors = new Map<object, Map<string, Obj>>();
  private baseOf = new Map<object, string>();
  private locOf = new Map<object, string>();
  private resOf = new Map<object, object>();
  private resRoots = new Set<object>();
  private rootBase = DEFAULT_BASE;
  private regexCache = new Map<string, RegExp | null>();
  private needAnn = false;
  private scope: object[] = [];
  private active = new Set<string>();
  private ids = new WeakMap<object, number>();
  private nextId = 1;
  private depth = 0;
  private refsToCheck: { schema: Obj; ref: string; loc: string; kw: string }[] = [];
  private unknownCount = 0;
  truncated = false;

  constructor(root: unknown, draft: Draft, opts: ValidateOptions) {
    this.root = root;
    this.draft = draft;
    this.formats = opts.formats;
    this.all = opts.allErrors;
    this.maxErrors = Math.max(1, opts.maxErrors);
    this.buildIndex();
  }

  /* ----- problems ----- */

  private problem(level: SchemaProblem['level'], path: string, message: string): void {
    const key = `${level}|${path}|${message}`;
    if (this.problemKeys.has(key)) return;
    this.problemKeys.add(key);
    this.problems.push({ level, path, message });
  }

  /* ----- index ----- */

  private buildIndex(): void {
    const root = this.root;
    if (isObj(root) && typeof root.$id === 'string' && root.$id !== '' && !(this.draft === 'draft-07' && root.$id.startsWith('#'))) {
      try {
        const u = new URL(root.$id, DEFAULT_BASE);
        u.hash = '';
        this.rootBase = u.href;
      } catch {
        this.problem('error', '#/$id', `"$id" is not a valid URI reference: ${short(root.$id)}`);
      }
    }
    if (isObj(root)) {
      this.resources.set(this.rootBase, root);
      this.resRoots.add(root);
    }
    const visited = new Set<object>();
    this.walk(root, '#', this.rootBase, isObj(root) ? root : undefined, visited, 0);
    for (const r of this.refsToCheck) {
      const res = this.resolveRef(r.ref, r.schema, r.kw);
      if (!res.ok) this.problem('error', `${r.loc}/${r.kw}`, res.message);
    }
  }

  private walk(schema: unknown, loc: string, base: string, resRoot: object | undefined, visited: Set<object>, depth: number): void {
    if (!isObj(schema) || visited.has(schema) || depth > 200) return;
    visited.add(schema);
    let myBase = base;
    let myRes = resRoot;
    const id = schema.$id;
    if (typeof id === 'string' && id !== '') {
      if (this.draft === 'draft-07' && id.startsWith('#')) {
        this.anchors.set(`${base}${id}`, schema);
      } else if (schema !== this.root) {
        try {
          const u = new URL(id, base);
          u.hash = '';
          myBase = u.href;
          this.resources.set(myBase, schema);
          this.resRoots.add(schema);
          myRes = schema;
        } catch {
          this.problem('error', `${loc}/$id`, `"$id" is not a valid URI reference: ${short(id)}`);
        }
      }
    }
    this.baseOf.set(schema, myBase);
    this.locOf.set(schema, loc);
    if (myRes) this.resOf.set(schema, myRes);

    if (typeof schema.$anchor === 'string' && this.draft !== 'draft-07') this.anchors.set(`${myBase}#${schema.$anchor}`, schema);
    if (typeof schema.$dynamicAnchor === 'string' && this.draft === '2020-12') {
      this.anchors.set(`${myBase}#${schema.$dynamicAnchor}`, schema);
      if (myRes) {
        let m = this.dynAnchors.get(myRes);
        if (!m) {
          m = new Map();
          this.dynAnchors.set(myRes, m);
        }
        m.set(schema.$dynamicAnchor, schema);
      }
    }
    if (this.draft !== 'draft-07' && (hasOwn(schema, 'unevaluatedProperties') || hasOwn(schema, 'unevaluatedItems'))) this.needAnn = true;

    this.checkKeywords(schema, loc);

    for (const kw of ['$ref', '$dynamicRef', '$recursiveRef']) {
      const v = schema[kw];
      if (typeof v === 'string') {
        const applies = kw === '$ref' || (kw === '$dynamicRef' && this.draft === '2020-12') || (kw === '$recursiveRef' && this.draft === '2019-09');
        if (applies) this.refsToCheck.push({ schema, ref: v, loc, kw });
      }
    }

    const child = (s: unknown, l: string): void => this.walk(s, l, myBase, myRes, visited, depth + 1);
    for (const k of SINGLE_SUBSCHEMA) if (hasOwn(schema, k)) child(schema[k], `${loc}/${k}`);
    const items = schema.items;
    if (Array.isArray(items)) items.forEach((s, i) => child(s, `${loc}/items/${i}`));
    else if (items !== undefined) child(items, `${loc}/items`);
    for (const k of ARRAY_SUBSCHEMAS) {
      const v = schema[k];
      if (Array.isArray(v)) v.forEach((s, i) => child(s, `${loc}/${k}/${i}`));
    }
    for (const k of MAP_SUBSCHEMAS) {
      const v = schema[k];
      if (isObj(v)) for (const [name, s] of Object.entries(v)) child(s, `${loc}/${k}/${escapePointerSegment(name)}`);
    }
    const deps = schema.dependencies;
    if (isObj(deps)) {
      for (const [name, s] of Object.entries(deps)) if (!Array.isArray(s)) child(s, `${loc}/dependencies/${escapePointerSegment(name)}`);
    }
  }

  /** Static checks of one schema object: unknown/ignored keywords and malformed values. */
  private checkKeywords(schema: Obj, loc: string): void {
    const known = KEYWORDS_BY_DRAFT[this.draft];
    for (const k of Object.keys(schema)) {
      if (known.has(k) || ANNOTATION_KEYWORDS.has(k) || k === '$ref' || k === 'dependencies' || k.startsWith('x-') || k.startsWith('$')) {
        const hint = DRAFT_HINTS[k];
        if (hint && !hint.drafts.includes(this.draft)) {
          this.problem('warning', `${loc}/${k}`, `"${k}" ${hint.hint}; it is ignored in ${this.draft}.`);
        }
        if (k !== '$ref' && !known.has(k) && k.startsWith('$') && !ANNOTATION_KEYWORDS.has(k) && !hint) {
          this.problem('info', `${loc}/${k}`, `Unknown keyword "${k}" is ignored.`);
        }
        continue;
      }
      const hint = DRAFT_HINTS[k];
      if (hint) {
        this.problem('warning', `${loc}/${k}`, `"${k}" ${hint.hint}; it is ignored in ${this.draft}.`);
      } else if (this.unknownCount < 25) {
        this.unknownCount++;
        this.problem('info', `${loc}/${k}`, `Unknown keyword "${k}" is ignored (check the spelling).`);
      }
    }
    if (this.draft !== 'draft-07' && hasOwn(schema, 'dependencies')) {
      this.problem('info', `${loc}/dependencies`, `"dependencies" is the Draft-07 keyword; ${this.draft} split it into "dependentRequired" and "dependentSchemas". It is still applied here for compatibility.`);
    }
    if (this.draft === '2020-12' && Array.isArray(schema.items)) {
      this.problem('warning', `${loc}/items`, '"items" is an array (tuple form), which only Draft-07/2019-09 understand. In 2020-12 use "prefixItems"; the array form is ignored here.');
    }
    if (this.draft === 'draft-07' && typeof schema.$ref === 'string') {
      const siblings = Object.keys(schema).filter((k) => !ANNOTATION_KEYWORDS.has(k) && k !== '$ref' && k !== '$id' && !k.startsWith('x-'));
      if (siblings.length > 0) {
        this.problem('info', loc, `In Draft-07 the keywords next to "$ref" (${siblings.join(', ')}) are ignored.`);
      }
    }
    const t = schema.type;
    if (t !== undefined) {
      const list = typeof t === 'string' ? [t] : Array.isArray(t) ? t : null;
      if (list === null || list.some((x) => typeof x !== 'string')) this.problem('error', `${loc}/type`, '"type" must be a string or an array of strings.');
      else for (const x of list) if (!TYPE_NAMES.has(x as string)) this.problem('error', `${loc}/type`, `Unknown type "${String(x)}" (use null, boolean, object, array, number, integer or string).`);
    }
    for (const k of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) {
      const v = schema[k];
      if (v !== undefined && typeof v !== 'number') {
        if (typeof v === 'boolean') this.problem('error', `${loc}/${k}`, `"${k}" must be a number (the boolean form is Draft-04 only).`);
        else this.problem('error', `${loc}/${k}`, `"${k}" must be a number.`);
      }
    }
    const mo = schema.multipleOf;
    if (mo !== undefined && !(typeof mo === 'number' && mo > 0)) this.problem('error', `${loc}/multipleOf`, '"multipleOf" must be a number greater than 0.');
    for (const k of ['minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties', 'maxProperties', 'minContains', 'maxContains']) {
      const v = schema[k];
      if (v !== undefined && !(typeof v === 'number' && Number.isInteger(v) && v >= 0)) this.problem('error', `${loc}/${k}`, `"${k}" must be a non-negative integer.`);
    }
    const req = schema.required;
    if (req !== undefined && !(Array.isArray(req) && req.every((x) => typeof x === 'string'))) {
      this.problem('error', `${loc}/required`, typeof req === 'boolean' ? '"required" must be an array of property names (the boolean form is Draft-03/04).' : '"required" must be an array of strings.');
    }
    if (schema.enum !== undefined && !Array.isArray(schema.enum)) this.problem('error', `${loc}/enum`, '"enum" must be an array.');
    if (schema.uniqueItems !== undefined && typeof schema.uniqueItems !== 'boolean') this.problem('error', `${loc}/uniqueItems`, '"uniqueItems" must be a boolean.');
    for (const k of ['allOf', 'anyOf', 'oneOf']) {
      const v = schema[k];
      if (v !== undefined && !(Array.isArray(v) && v.length > 0)) this.problem('error', `${loc}/${k}`, `"${k}" must be a non-empty array of schemas.`);
    }
    for (const k of ['properties', 'patternProperties', 'dependentSchemas', '$defs', 'definitions']) {
      const v = schema[k];
      if (v !== undefined && !isObj(v)) this.problem('error', `${loc}/${k}`, `"${k}" must be an object.`);
    }
    if (typeof schema.pattern === 'string') {
      if (this.regex(schema.pattern) === null) this.problem('error', `${loc}/pattern`, `"pattern" is not a valid regular expression: ${short(schema.pattern)}`);
    } else if (schema.pattern !== undefined) this.problem('error', `${loc}/pattern`, '"pattern" must be a string.');
    if (isObj(schema.patternProperties)) {
      for (const p of Object.keys(schema.patternProperties)) {
        if (this.regex(p) === null) this.problem('error', `${loc}/patternProperties`, `Pattern ${short(p)} is not a valid regular expression.`);
      }
    }
    if (this.formats && typeof schema.format === 'string' && !FORMAT_CHECKERS[schema.format]) {
      this.problem('info', `${loc}/format`, `Format "${schema.format}" is not checked by this tool (supported: ${SUPPORTED_FORMATS.join(', ')}).`);
    }
    if (hasOwn(schema, '$ref') && typeof schema.$ref !== 'string') this.problem('error', `${loc}/$ref`, '"$ref" must be a string.');
  }

  private regex(pattern: string): RegExp | null {
    const cached = this.regexCache.get(pattern);
    if (cached !== undefined) return cached;
    let re: RegExp | null = null;
    try {
      re = new RegExp(pattern, 'u');
    } catch {
      try {
        re = new RegExp(pattern);
      } catch {
        re = null;
      }
    }
    this.regexCache.set(pattern, re);
    return re;
  }

  /* ----- $ref resolution ----- */

  private idOf(o: object): number {
    let id = this.ids.get(o);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(o, id);
    }
    return id;
  }

  private resolveRef(ref: string, schema: Obj, kw: string): RefResult {
    const base = this.baseOf.get(schema) ?? this.rootBase;
    let abs: URL;
    try {
      abs = new URL(ref, base);
    } catch {
      return { ok: false, message: `Cannot resolve ${kw} "${ref}": it is not a valid URI reference.` };
    }
    const frag = abs.hash.startsWith('#') ? abs.hash.slice(1) : abs.hash;
    abs.hash = '';
    const docUri = abs.href;
    const resource = this.resources.get(docUri);
    if (frag === '' || frag.startsWith('/')) {
      if (resource === undefined) {
        return {
          ok: false,
          message: `Cannot resolve ${kw} "${ref}": only references inside this schema ("#/…", ids and anchors) are supported — remote schemas are not fetched.`,
        };
      }
      if (frag === '') {
        const res = isObj(resource) ? resource : undefined;
        return { ok: true, target: resource, loc: isObj(resource) ? (this.locOf.get(resource) ?? '#') : '#', res };
      }
      const got = pointerGet(resource, frag);
      if (!got.found) return { ok: false, message: `Cannot resolve ${kw} "${ref}": nothing exists at "${decodeSafe(frag)}".` };
      const t = got.value;
      const loc = isObj(t) && this.locOf.has(t) ? (this.locOf.get(t) as string) : `${isObj(resource) ? (this.locOf.get(resource) ?? '#') : '#'}${frag}`;
      return { ok: true, target: t, loc, res: isObj(t) ? this.resOf.get(t) : undefined };
    }
    let name = frag;
    try {
      name = decodeURIComponent(frag);
    } catch {
      /* keep */
    }
    const t = this.anchors.get(`${docUri}#${name}`);
    if (!t) return { ok: false, message: `Cannot resolve ${kw} "${ref}": no "$anchor"/"$id" named "${name}" exists in this schema.` };
    return { ok: true, target: t, loc: this.locOf.get(t) ?? '#', res: this.resOf.get(t) };
  }

  /* ----- helpers for evaluation ----- */

  private mk(ip: string, loc: string, keyword: string, message: string, params?: Record<string, unknown>, causes?: ValidationError[]): ValidationError {
    const e: ValidationError = { instancePath: ip, schemaPath: loc === '' ? keyword : `${loc}/${keyword}`, keyword, message };
    if (params) e.params = params;
    if (causes && causes.length > 0) e.causes = causes;
    return e;
  }

  private isValid(schema: unknown, inst: unknown, ip: string, loc: string, ann: Ann | null): boolean {
    const prev = this.all;
    this.all = false;
    try {
      return this.v(schema, inst, ip, loc, ann).length === 0;
    } finally {
      this.all = prev;
    }
  }

  /** Entry point. */
  run(instance: unknown): ValidationError[] {
    this.scope = isObj(this.root) ? [this.root] : [];
    try {
      const errs = this.v(this.root, instance, '', '#', null);
      if (errs.length > this.maxErrors) {
        this.truncated = true;
        return errs.slice(0, this.maxErrors);
      }
      return errs;
    } catch (e) {
      if (e instanceof RecursionError) {
        this.problem('error', '#', e.message);
        return [];
      }
      throw e;
    }
  }

  private v(schema: unknown, inst: unknown, ip: string, loc: string, annOut: Ann | null): ValidationError[] {
    if (schema === true) return [];
    if (schema === false) {
      return [{ instancePath: ip, schemaPath: loc, keyword: 'false schema', message: 'is not allowed: the schema here is the boolean false' }];
    }
    if (!isObj(schema)) return [];
    if (++this.depth > 1200) {
      this.depth--;
      throw new RecursionError('Maximum schema recursion depth exceeded (is there a $ref cycle that never consumes the instance?).');
    }
    const isRes = this.resRoots.has(schema) && this.scope[this.scope.length - 1] !== schema;
    if (isRes) this.scope.push(schema);
    try {
      return this.vObj(schema, inst, ip, loc, annOut);
    } finally {
      this.depth--;
      if (isRes) this.scope.pop();
    }
  }

  private followRef(
    ref: string,
    kw: '$ref' | '$dynamicRef' | '$recursiveRef',
    schema: Obj,
    inst: unknown,
    ip: string,
    loc: string,
    ann: Ann | null
  ): ValidationError[] {
    let r = this.resolveRef(ref, schema, kw);
    if (!r.ok) return []; // reported once in problems
    const hashAt = ref.indexOf('#');
    const fragment = hashAt === -1 ? '' : ref.slice(hashAt + 1);
    const anchorForm = fragment !== '' && !fragment.startsWith('/');
    if (kw === '$dynamicRef' && anchorForm && isObj(r.target) && typeof r.target.$dynamicAnchor === 'string') {
      const name = r.target.$dynamicAnchor;
      for (const res of this.scope) {
        const t = this.dynAnchors.get(res)?.get(name);
        if (t) {
          r = { ok: true, target: t, loc: this.locOf.get(t) ?? '#', res: this.resOf.get(t) };
          break;
        }
      }
    } else if (kw === '$recursiveRef' && isObj(r.target) && r.target.$recursiveAnchor === true) {
      for (const res of this.scope) {
        if (isObj(res) && res.$recursiveAnchor === true) {
          r = { ok: true, target: res, loc: this.locOf.get(res) ?? '#', res };
          break;
        }
      }
    }
    if (!r.ok) return [];
    const targetObj = isObj(r.target) ? r.target : null;
    const key = `${targetObj ? this.idOf(targetObj) : String(r.target)}|${ip}`;
    if (this.active.has(key)) {
      return [this.mk(ip, loc, kw, `has a circular ${kw} "${ref}" that returns to the same schema without consuming any of the instance`)];
    }
    this.active.add(key);
    const pushed = r.res !== undefined && this.scope[this.scope.length - 1] !== r.res;
    if (pushed && r.res) this.scope.push(r.res);
    try {
      return this.v(r.target, inst, ip, r.loc, ann);
    } finally {
      if (pushed) this.scope.pop();
      this.active.delete(key);
    }
  }

  /* ----- the keywords ----- */

  private vObj(schema: Obj, inst: unknown, ip: string, loc: string, annOut: Ann | null): ValidationError[] {
    const draft = this.draft;
    const errs: ValidationError[] = [];
    const done = (): boolean => (!this.all && errs.length > 0) || errs.length > this.maxErrors;
    const hasUneval = this.needAnn && (hasOwn(schema, 'unevaluatedProperties') || hasOwn(schema, 'unevaluatedItems'));
    const ann: Ann | null = this.needAnn && (annOut !== null || hasUneval) ? newAnn() : null;
    const finish = (): ValidationError[] => {
      if (errs.length === 0 && ann && annOut) mergeAnn(annOut, ann);
      return errs;
    };
    const add = (e: ValidationError[]): void => {
      for (const x of e) errs.push(x);
    };

    /* $ref & friends */
    if (typeof schema.$ref === 'string') {
      add(this.followRef(schema.$ref, '$ref', schema, inst, ip, loc, ann));
      if (draft === 'draft-07') return finish();
      if (done()) return finish();
    }
    if (draft === '2020-12' && typeof schema.$dynamicRef === 'string') {
      add(this.followRef(schema.$dynamicRef, '$dynamicRef', schema, inst, ip, loc, ann));
      if (done()) return finish();
    }
    if (draft === '2019-09' && typeof schema.$recursiveRef === 'string') {
      add(this.followRef(schema.$recursiveRef, '$recursiveRef', schema, inst, ip, loc, ann));
      if (done()) return finish();
    }

    /* type / enum / const */
    const t = schema.type;
    if (t !== undefined) {
      const list = typeof t === 'string' ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : null;
      if (list && !list.some((x) => matchesType(inst, x))) {
        const got = instType(inst);
        add([this.mk(ip, loc, 'type', `must be ${list.length === 1 ? 'of type ' : 'one of the types '}${list.join(' or ')} (got ${got})`, { type: t, got })]);
        if (done()) return finish();
      }
    }
    if (Array.isArray(schema.enum)) {
      if (!schema.enum.some((x) => deepEqual(x, inst))) {
        add([
          this.mk(ip, loc, 'enum', `must be equal to one of the allowed values: ${schema.enum.slice(0, 12).map((x) => short(x, 30)).join(', ')}${schema.enum.length > 12 ? ', …' : ''}`, {
            allowedValues: schema.enum,
          }),
        ]);
        if (done()) return finish();
      }
    }
    if (hasOwn(schema, 'const')) {
      if (!deepEqual(schema.const, inst)) {
        add([this.mk(ip, loc, 'const', `must be equal to the constant ${short(schema.const, 80)}`, { allowedValue: schema.const })]);
        if (done()) return finish();
      }
    }

    /* numbers */
    if (typeof inst === 'number') {
      const mo = num(schema.multipleOf);
      if (mo !== null && mo > 0 && !isMultipleOf(inst, mo)) {
        add([this.mk(ip, loc, 'multipleOf', `must be a multiple of ${mo} (${inst} is not)`, { multipleOf: mo })]);
        if (done()) return finish();
      }
      const mx = num(schema.maximum);
      if (mx !== null && inst > mx) {
        add([this.mk(ip, loc, 'maximum', `must be <= ${mx} (got ${inst})`, { limit: mx })]);
        if (done()) return finish();
      }
      const xmx = num(schema.exclusiveMaximum);
      if (xmx !== null && inst >= xmx) {
        add([this.mk(ip, loc, 'exclusiveMaximum', `must be < ${xmx} (got ${inst})`, { limit: xmx })]);
        if (done()) return finish();
      }
      const mn = num(schema.minimum);
      if (mn !== null && inst < mn) {
        add([this.mk(ip, loc, 'minimum', `must be >= ${mn} (got ${inst})`, { limit: mn })]);
        if (done()) return finish();
      }
      const xmn = num(schema.exclusiveMinimum);
      if (xmn !== null && inst <= xmn) {
        add([this.mk(ip, loc, 'exclusiveMinimum', `must be > ${xmn} (got ${inst})`, { limit: xmn })]);
        if (done()) return finish();
      }
    }

    /* strings */
    if (typeof inst === 'string') {
      const maxL = num(schema.maxLength);
      const minL = num(schema.minLength);
      if (maxL !== null || minL !== null) {
        const len = cpLength(inst);
        if (maxL !== null && len > maxL) {
          add([this.mk(ip, loc, 'maxLength', `must have at most ${maxL} character${maxL === 1 ? '' : 's'} (has ${len})`, { limit: maxL })]);
          if (done()) return finish();
        }
        if (minL !== null && len < minL) {
          add([this.mk(ip, loc, 'minLength', `must have at least ${minL} character${minL === 1 ? '' : 's'} (has ${len})`, { limit: minL })]);
          if (done()) return finish();
        }
      }
      if (typeof schema.pattern === 'string') {
        const re = this.regex(schema.pattern);
        if (re && !re.test(inst)) {
          add([this.mk(ip, loc, 'pattern', `must match the pattern ${short(schema.pattern, 80)}`, { pattern: schema.pattern })]);
          if (done()) return finish();
        }
      }
      if (this.formats && typeof schema.format === 'string') {
        const chk = FORMAT_CHECKERS[schema.format];
        if (chk && !chk(inst)) {
          add([this.mk(ip, loc, 'format', `must be a valid "${schema.format}" value`, { format: schema.format })]);
          if (done()) return finish();
        }
      }
    }

    /* arrays */
    if (Array.isArray(inst)) {
      add(this.arrayKeywords(schema, inst, ip, loc, ann));
      if (done()) return finish();
    }

    /* objects */
    if (isObj(inst)) {
      add(this.objectKeywords(schema, inst, ip, loc, ann));
      if (done()) return finish();
    }

    /* combinators */
    if (Array.isArray(schema.allOf)) {
      for (let i = 0; i < schema.allOf.length; i++) {
        add(this.v(schema.allOf[i], inst, ip, `${loc}/allOf/${i}`, ann));
        if (done()) return finish();
      }
    }
    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      let anyValid = false;
      const causes: ValidationError[] = [];
      for (let i = 0; i < schema.anyOf.length; i++) {
        const bAnn = ann ? newAnn() : null;
        const be = this.v(schema.anyOf[i], inst, ip, `${loc}/anyOf/${i}`, bAnn);
        if (be.length === 0) {
          anyValid = true;
          if (ann && bAnn) mergeAnn(ann, bAnn);
          if (!ann) break;
        } else if (causes.length < 40) causes.push(...be);
      }
      if (!anyValid) {
        add([this.mk(ip, loc, 'anyOf', `must match at least one of the ${schema.anyOf.length} schemas in "anyOf"`, { count: schema.anyOf.length }, causes)]);
        if (done()) return finish();
      }
    }
    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      const matched: number[] = [];
      const anns: (Ann | null)[] = [];
      const causes: ValidationError[] = [];
      for (let i = 0; i < schema.oneOf.length; i++) {
        const bAnn = ann ? newAnn() : null;
        const be = this.v(schema.oneOf[i], inst, ip, `${loc}/oneOf/${i}`, bAnn);
        if (be.length === 0) {
          matched.push(i);
          anns.push(bAnn);
          if (matched.length > 1 && !ann) break;
        } else if (causes.length < 40) causes.push(...be);
      }
      if (matched.length === 0) {
        add([this.mk(ip, loc, 'oneOf', `must match exactly one of the ${schema.oneOf.length} schemas in "oneOf", but it matches none`, { count: schema.oneOf.length, matched }, causes)]);
        if (done()) return finish();
      } else if (matched.length > 1) {
        add([this.mk(ip, loc, 'oneOf', `must match exactly one schema in "oneOf", but it matches ${matched.length} (schemas ${matched.join(', ')})`, { count: schema.oneOf.length, matched })]);
        if (done()) return finish();
      } else {
        const a = anns[0];
        if (ann && a) mergeAnn(ann, a);
      }
    }
    if (schema.not !== undefined && this.isValid(schema.not, inst, ip, `${loc}/not`, null)) {
      add([this.mk(ip, loc, 'not', 'must NOT be valid against the schema in "not"')]);
      if (done()) return finish();
    }
    if (schema.if !== undefined) {
      const ifAnn = ann ? newAnn() : null;
      const ifOk = this.isValid(schema.if, inst, ip, `${loc}/if`, ifAnn);
      if (ifOk) {
        if (ann && ifAnn) mergeAnn(ann, ifAnn);
        if (schema.then !== undefined) {
          const te = this.v(schema.then, inst, ip, `${loc}/then`, ann);
          if (te.length > 0) {
            add([this.mk(ip, loc, 'then', 'must satisfy the "then" schema, because the "if" schema matched', undefined, te)]);
            if (done()) return finish();
          }
        }
      } else if (schema.else !== undefined) {
        const ee = this.v(schema.else, inst, ip, `${loc}/else`, ann);
        if (ee.length > 0) {
          add([this.mk(ip, loc, 'else', 'must satisfy the "else" schema, because the "if" schema did not match', undefined, ee)]);
          if (done()) return finish();
        }
      }
    }

    /* unevaluated* (annotation based) */
    if (hasUneval && ann) {
      if (Array.isArray(inst) && schema.unevaluatedItems !== undefined && !ann.allItems) {
        for (let i = ann.items; i < inst.length; i++) {
          if (ann.extra.has(i)) continue;
          if (schema.unevaluatedItems === false) {
            add([this.mk(`${ip}/${i}`, loc, 'unevaluatedItems', `must NOT have an unevaluated item at index ${i}`, { index: i })]);
          } else {
            add(this.v(schema.unevaluatedItems, inst[i], `${ip}/${i}`, `${loc}/unevaluatedItems`, null));
          }
          if (done()) return finish();
        }
        ann.allItems = true;
      }
      if (isObj(inst) && schema.unevaluatedProperties !== undefined && !ann.allProps) {
        for (const k of Object.keys(inst)) {
          if (ann.props.has(k)) continue;
          const p = `${ip}/${escapePointerSegment(k)}`;
          if (schema.unevaluatedProperties === false) {
            add([this.mk(p, loc, 'unevaluatedProperties', `must NOT have the unevaluated property "${k}"`, { property: k })]);
          } else {
            add(this.v(schema.unevaluatedProperties, inst[k], p, `${loc}/unevaluatedProperties`, null));
          }
          if (done()) return finish();
        }
        ann.allProps = true;
      }
    }
    return finish();
  }

  private arrayKeywords(schema: Obj, inst: unknown[], ip: string, loc: string, ann: Ann | null): ValidationError[] {
    const draft = this.draft;
    const errs: ValidationError[] = [];
    const done = (): boolean => (!this.all && errs.length > 0) || errs.length > this.maxErrors;
    const add = (e: ValidationError[]): void => {
      for (const x of e) errs.push(x);
    };
    const maxI = num(schema.maxItems);
    if (maxI !== null && inst.length > maxI) {
      add([this.mk(ip, loc, 'maxItems', `must have at most ${maxI} item${maxI === 1 ? '' : 's'} (has ${inst.length})`, { limit: maxI })]);
      if (done()) return errs;
    }
    const minI = num(schema.minItems);
    if (minI !== null && inst.length < minI) {
      add([this.mk(ip, loc, 'minItems', `must have at least ${minI} item${minI === 1 ? '' : 's'} (has ${inst.length})`, { limit: minI })]);
      if (done()) return errs;
    }
    if (schema.uniqueItems === true && inst.length > 1) {
      const seen = new Map<string, number>();
      for (let i = 0; i < inst.length; i++) {
        const key = canon(inst[i]);
        const first = seen.get(key);
        if (first !== undefined) {
          add([this.mk(`${ip}/${i}`, loc, 'uniqueItems', `must NOT have duplicate items (items ${first} and ${i} are identical)`, { i: first, j: i })]);
          if (done()) return errs;
          break;
        }
        seen.set(key, i);
      }
    }

    // items / prefixItems / additionalItems
    if (draft === '2020-12') {
      let start = 0;
      if (Array.isArray(schema.prefixItems)) {
        const n = Math.min(schema.prefixItems.length, inst.length);
        for (let i = 0; i < n; i++) {
          add(this.v(schema.prefixItems[i], inst[i], `${ip}/${i}`, `${loc}/prefixItems/${i}`, null));
          if (done()) return errs;
        }
        if (ann && n > ann.items) ann.items = n;
        start = schema.prefixItems.length;
      }
      const items = schema.items;
      if (items !== undefined && !Array.isArray(items)) {
        for (let i = start; i < inst.length; i++) {
          add(this.v(items, inst[i], `${ip}/${i}`, `${loc}/items`, null));
          if (done()) return errs;
        }
        if (ann) ann.allItems = true;
      }
    } else {
      const items = schema.items;
      if (Array.isArray(items)) {
        const n = Math.min(items.length, inst.length);
        for (let i = 0; i < n; i++) {
          add(this.v(items[i], inst[i], `${ip}/${i}`, `${loc}/items/${i}`, null));
          if (done()) return errs;
        }
        if (ann && n > ann.items) ann.items = n;
        if (schema.additionalItems !== undefined && inst.length > items.length) {
          for (let i = items.length; i < inst.length; i++) {
            if (schema.additionalItems === false) {
              add([this.mk(`${ip}/${i}`, loc, 'additionalItems', `must NOT have more than ${items.length} item${items.length === 1 ? '' : 's'} (item ${i} is not allowed)`, { limit: items.length })]);
              if (done()) return errs;
              break;
            }
            add(this.v(schema.additionalItems, inst[i], `${ip}/${i}`, `${loc}/additionalItems`, null));
            if (done()) return errs;
          }
          if (ann) ann.allItems = true;
        }
      } else if (items !== undefined) {
        for (let i = 0; i < inst.length; i++) {
          add(this.v(items, inst[i], `${ip}/${i}`, `${loc}/items`, null));
          if (done()) return errs;
        }
        if (ann) ann.allItems = true;
      }
    }

    // contains
    if (schema.contains !== undefined) {
      const newer = draft !== 'draft-07';
      const minC = newer ? num(schema.minContains) : null;
      const maxC = newer ? num(schema.maxContains) : null;
      let count = 0;
      const matched: number[] = [];
      for (let i = 0; i < inst.length; i++) {
        if (this.isValid(schema.contains, inst[i], `${ip}/${i}`, `${loc}/contains`, null)) {
          count++;
          matched.push(i);
        }
      }
      const need = minC ?? 1;
      if (count < need) {
        const kw = minC !== null ? 'minContains' : 'contains';
        add([
          this.mk(
            ip,
            loc,
            kw,
            need <= 1 && minC === null
              ? 'must contain at least one item that matches the "contains" schema (none does)'
              : `must contain at least ${need} item${need === 1 ? '' : 's'} matching the "contains" schema (found ${count})`,
            { limit: need, found: count }
          ),
        ]);
        if (done()) return errs;
      }
      if (maxC !== null && count > maxC) {
        add([this.mk(ip, loc, 'maxContains', `must contain at most ${maxC} item${maxC === 1 ? '' : 's'} matching the "contains" schema (found ${count})`, { limit: maxC, found: count })]);
        if (done()) return errs;
      }
      if (ann && draft === '2020-12') for (const m of matched) ann.extra.add(m);
    }
    return errs;
  }

  private objectKeywords(schema: Obj, inst: Obj, ip: string, loc: string, ann: Ann | null): ValidationError[] {
    const draft = this.draft;
    const errs: ValidationError[] = [];
    const done = (): boolean => (!this.all && errs.length > 0) || errs.length > this.maxErrors;
    const add = (e: ValidationError[]): void => {
      for (const x of e) errs.push(x);
    };
    const keys = Object.keys(inst);
    const maxP = num(schema.maxProperties);
    if (maxP !== null && keys.length > maxP) {
      add([this.mk(ip, loc, 'maxProperties', `must have at most ${maxP} propert${maxP === 1 ? 'y' : 'ies'} (has ${keys.length})`, { limit: maxP })]);
      if (done()) return errs;
    }
    const minP = num(schema.minProperties);
    if (minP !== null && keys.length < minP) {
      add([this.mk(ip, loc, 'minProperties', `must have at least ${minP} propert${minP === 1 ? 'y' : 'ies'} (has ${keys.length})`, { limit: minP })]);
      if (done()) return errs;
    }
    if (Array.isArray(schema.required)) {
      for (const r of schema.required) {
        if (typeof r === 'string' && !hasOwn(inst, r)) {
          add([this.mk(ip, loc, 'required', `must have the required property "${r}"`, { missingProperty: r })]);
          if (done()) return errs;
        }
      }
    }
    if (draft !== 'draft-07' && isObj(schema.dependentRequired)) {
      for (const [prop, deps] of Object.entries(schema.dependentRequired)) {
        if (!hasOwn(inst, prop) || !Array.isArray(deps)) continue;
        for (const d of deps) {
          if (typeof d === 'string' && !hasOwn(inst, d)) {
            add([this.mk(ip, loc, 'dependentRequired', `must have the property "${d}" when "${prop}" is present`, { property: prop, missingProperty: d })]);
            if (done()) return errs;
          }
        }
      }
    }
    if (isObj(schema.dependencies)) {
      for (const [prop, dep] of Object.entries(schema.dependencies)) {
        if (!hasOwn(inst, prop)) continue;
        if (Array.isArray(dep)) {
          for (const d of dep) {
            if (typeof d === 'string' && !hasOwn(inst, d)) {
              add([this.mk(ip, loc, 'dependencies', `must have the property "${d}" when "${prop}" is present`, { property: prop, missingProperty: d })]);
              if (done()) return errs;
            }
          }
        } else {
          add(this.v(dep, inst, ip, `${loc}/dependencies/${escapePointerSegment(prop)}`, ann));
          if (done()) return errs;
        }
      }
    }
    if (draft !== 'draft-07' && isObj(schema.dependentSchemas)) {
      for (const [prop, sub] of Object.entries(schema.dependentSchemas)) {
        if (!hasOwn(inst, prop)) continue;
        add(this.v(sub, inst, ip, `${loc}/dependentSchemas/${escapePointerSegment(prop)}`, ann));
        if (done()) return errs;
      }
    }
    if (schema.propertyNames !== undefined) {
      for (const k of keys) {
        const inner = this.v(schema.propertyNames, k, ip, `${loc}/propertyNames`, null);
        if (inner.length > 0) {
          add([this.mk(`${ip}/${escapePointerSegment(k)}`, loc, 'propertyNames', `the property name "${k}" is not allowed: ${inner[0]?.message ?? 'invalid'}`, { propertyName: k }, inner)]);
          if (done()) return errs;
        }
      }
    }

    const props = isObj(schema.properties) ? schema.properties : null;
    const patterns = isObj(schema.patternProperties) ? schema.patternProperties : null;
    if (props) {
      for (const [k, sub] of Object.entries(props)) {
        if (!hasOwn(inst, k)) continue;
        ann?.props.add(k);
        add(this.v(sub, inst[k], `${ip}/${escapePointerSegment(k)}`, `${loc}/properties/${escapePointerSegment(k)}`, null));
        if (done()) return errs;
      }
    }
    const compiled: { p: string; re: RegExp }[] = [];
    if (patterns) {
      for (const p of Object.keys(patterns)) {
        const re = this.regex(p);
        if (re) compiled.push({ p, re });
      }
      for (const { p, re } of compiled) {
        for (const k of keys) {
          if (!re.test(k)) continue;
          ann?.props.add(k);
          add(this.v(patterns[p], inst[k], `${ip}/${escapePointerSegment(k)}`, `${loc}/patternProperties/${escapePointerSegment(p)}`, null));
          if (done()) return errs;
        }
      }
    }
    if (schema.additionalProperties !== undefined) {
      const ap = schema.additionalProperties;
      for (const k of keys) {
        if (props && hasOwn(props, k)) continue;
        if (compiled.some((c) => c.re.test(k))) continue;
        const p = `${ip}/${escapePointerSegment(k)}`;
        if (ap === false) {
          add([this.mk(p, loc, 'additionalProperties', `must NOT have the additional property "${k}"`, { additionalProperty: k })]);
        } else {
          add(this.v(ap, inst[k], p, `${loc}/additionalProperties`, null));
        }
        if (done()) return errs;
      }
      if (ann) ann.allProps = true;
    }
    return errs;
  }
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function validate(schema: unknown, instance: unknown, options: Partial<ValidateOptions> = {}): ValidationResult {
  const opts: ValidateOptions = { ...DEFAULT_VALIDATE_OPTIONS, ...options };
  const draft = detectDraft(schema, opts.draft);
  const v = new Validator(schema, draft.draft, opts);
  const errors = v.run(instance);
  const problems = v.problems;
  if (typeof schema !== 'boolean' && !isObj(schema)) {
    problems.unshift({ level: 'error', path: '#', message: 'The schema must be a JSON object (or the boolean true / false).' });
  }
  if (draft.note) problems.unshift({ level: 'info', path: '#', message: draft.note });
  return {
    valid: errors.length === 0 && !problems.some((p) => p.level === 'error'),
    errors,
    problems,
    draft,
    truncated: v.truncated,
  };
}

/** Flatten errors and their causes into one list (depth-first), with nesting depth. */
export function flattenErrors(errors: ValidationError[]): { error: ValidationError; depth: number }[] {
  const out: { error: ValidationError; depth: number }[] = [];
  const walk = (list: ValidationError[], depth: number): void => {
    for (const e of list) {
      out.push({ error: e, depth });
      if (e.causes) walk(e.causes, depth + 1);
    }
  };
  walk(errors, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* JSON text scanning: friendly syntax errors + pointer → offset index */
/* ------------------------------------------------------------------ */

export interface JsonSyntaxError {
  message: string;
  offset: number;
  line: number;
  col: number;
}

export interface JsonIndexEntry {
  /** offset of the first character of the value */
  start: number;
  /** offset just after the value */
  end: number;
  /** offset of the property name (for object members) */
  keyStart?: number;
}

export function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let last = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i + 1;
    }
  }
  return { line, col: end - last + 1 };
}

class JsonScanError extends Error {
  offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

export type JsonScanResult =
  | { ok: true; index: Map<string, JsonIndexEntry> | null }
  | { ok: false; error: JsonSyntaxError };

/**
 * Validates JSON text strictly and (optionally) records where every value lives.
 * Error messages explain the usual mistakes (comments, trailing commas, single quotes…).
 */
export function scanJson(text: string, wantIndex = false, maxIndexed = 400_000): JsonScanResult {
  const n = text.length;
  let i = 0;
  const index = wantIndex ? new Map<string, JsonIndexEntry>() : null;
  let depth = 0;

  const fail = (msg: string, at = i): never => {
    throw new JsonScanError(msg, at);
  };
  const ws = (): void => {
    for (;;) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else if (c === 47 && (text.charCodeAt(i + 1) === 47 || text.charCodeAt(i + 1) === 42)) fail('Comments are not allowed in JSON');
      else return;
    }
  };
  const describe = (): string => {
    if (i >= n) return 'the end of the input';
    const c = text.charAt(i);
    return c === '\n' ? 'a line break' : `"${c}"`;
  };

  const str = (): string => {
    const start = i;
    i++;
    let out = '';
    let segStart = i;
    for (;;) {
      if (i >= n) fail('Unterminated string: the closing " is missing', start);
      const c = text.charCodeAt(i);
      if (c === 34) {
        out += text.slice(segStart, i);
        i++;
        return out;
      }
      if (c < 32) fail(c === 10 ? 'Strings cannot contain a raw line break (use \\n)' : 'Strings cannot contain raw control characters (escape them as \\uXXXX)');
      if (c === 92) {
        out += text.slice(segStart, i);
        const e = text.charAt(i + 1);
        switch (e) {
          case '"':
            out += '"';
            break;
          case '\\':
            out += '\\';
            break;
          case '/':
            out += '/';
            break;
          case 'b':
            out += '\b';
            break;
          case 'f':
            out += '\f';
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
          case 'u': {
            const hex = text.slice(i + 2, i + 6);
            if (!/^[0-9A-Fa-f]{4}$/.test(hex)) fail('Invalid \\u escape: four hexadecimal digits are required', i);
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
            break;
          }
          default:
            fail(`Invalid escape sequence "\\${e}"`, i);
        }
        i += 2;
        segStart = i;
        continue;
      }
      i++;
    }
  };

  const numberToken = (): void => {
    const start = i;
    if (text.charAt(i) === '-') i++;
    const c = text.charAt(i);
    if (c === '0') {
      i++;
      if (/[0-9]/.test(text.charAt(i))) fail('Numbers cannot have leading zeros', start);
    } else if (c >= '1' && c <= '9') {
      while (/[0-9]/.test(text.charAt(i))) i++;
    } else fail(`Expected a digit but found ${describe()}`);
    if (text.charAt(i) === '.') {
      i++;
      if (!/[0-9]/.test(text.charAt(i))) fail('Expected digits after the decimal point');
      while (/[0-9]/.test(text.charAt(i))) i++;
    }
    if (text.charAt(i) === 'e' || text.charAt(i) === 'E') {
      i++;
      if (text.charAt(i) === '+' || text.charAt(i) === '-') i++;
      if (!/[0-9]/.test(text.charAt(i))) fail('Expected digits in the exponent');
      while (/[0-9]/.test(text.charAt(i))) i++;
    }
  };

  const record = (ptr: string, start: number, keyStart?: number): void => {
    if (index && index.size < maxIndexed) index.set(ptr, { start, end: i, keyStart });
  };

  const value = (ptr: string, keyStart?: number): void => {
    ws();
    const start = i;
    const c = text.charAt(i);
    if (++depth > 3000) fail('Nesting is too deep');
    if (c === '{') {
      i++;
      ws();
      if (text.charAt(i) === '}') {
        i++;
      } else {
        for (;;) {
          ws();
          const ks = i;
          const q = text.charAt(i);
          if (q === '}' ) fail('A trailing comma before "}" is not allowed in JSON');
          if (q === "'") fail('Strings must use double quotes, not single quotes');
          if (q !== '"') fail(q === '' ? 'Unexpected end of input: the object is not closed (missing "}")' : `Property names must be double-quoted strings (found ${describe()})`);
          const key = str();
          ws();
          if (text.charAt(i) !== ':') fail(`Expected ":" after the property name but found ${describe()}`);
          i++;
          value(ptr + '/' + escapePointerSegment(key), ks);
          ws();
          const d = text.charAt(i);
          if (d === ',') {
            i++;
            continue;
          }
          if (d === '}') {
            i++;
            break;
          }
          fail(d === '' ? 'Unexpected end of input: the object is not closed (missing "}")' : `Expected "," or "}" after the value but found ${describe()}${d === '"' ? ' (a comma may be missing)' : ''}`);
        }
      }
    } else if (c === '[') {
      i++;
      ws();
      if (text.charAt(i) === ']') {
        i++;
      } else {
        let k = 0;
        for (;;) {
          ws();
          if (text.charAt(i) === ']') fail('A trailing comma before "]" is not allowed in JSON');
          if (text.charAt(i) === '') fail('Unexpected end of input: the array is not closed (missing "]")');
          value(`${ptr}/${k}`);
          k++;
          ws();
          const d = text.charAt(i);
          if (d === ',') {
            i++;
            continue;
          }
          if (d === ']') {
            i++;
            break;
          }
          fail(d === '' ? 'Unexpected end of input: the array is not closed (missing "]")' : `Expected "," or "]" after the item but found ${describe()}${d === '"' ? ' (a comma may be missing)' : ''}`);
        }
      }
    } else if (c === '"') {
      str();
    } else if (c === '-' || (c >= '0' && c <= '9')) {
      numberToken();
    } else if (text.startsWith('true', i)) {
      i += 4;
    } else if (text.startsWith('false', i)) {
      i += 5;
    } else if (text.startsWith('null', i)) {
      i += 4;
    } else if (c === "'") {
      fail('Strings must use double quotes, not single quotes');
    } else if (c === '') {
      fail('Unexpected end of input: a value is missing');
    } else if (c === ']' || c === '}' || c === ',' || c === ':') {
      fail(`Unexpected ${describe()}: a value is missing`);
    } else if (/^(?:NaN|Infinity|undefined)/.test(text.slice(i, i + 9))) {
      fail('NaN, Infinity and undefined are not valid JSON values');
    } else if (c === '+' || c === '.') {
      fail('Numbers cannot start with "' + c + '"');
    } else {
      fail(`Unexpected ${describe()}`);
    }
    depth--;
    record(ptr, start, keyStart);
  };

  try {
    value('');
    ws();
    if (i < n) fail('Unexpected content after the end of the JSON value');
    return { ok: true, index };
  } catch (e) {
    if (e instanceof JsonScanError) {
      const { line, col } = offsetToLineCol(text, e.offset);
      return { ok: false, error: { message: e.message, offset: e.offset, line, col } };
    }
    throw e;
  }
}

export type ParsedJson = { ok: true; value: unknown } | { ok: false; error: JsonSyntaxError };

/** Parse JSON; on failure explain what is wrong and where. */
export function parseJson(text: string): ParsedJson {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (src.trim() === '') {
    return { ok: false, error: { message: 'The input is empty', offset: 0, line: 1, col: 1 } };
  }
  try {
    return { ok: true, value: JSON.parse(src) as unknown };
  } catch (e) {
    const scan = scanJson(src, false);
    if (!scan.ok) return { ok: false, error: scan.error };
    return { ok: false, error: { message: e instanceof Error ? e.message : 'Invalid JSON', offset: 0, line: 1, col: 1 } };
  }
}

/** Best location for an instance pointer: the key (when present) else the value; falls back to parents. */
export function locatePointer(
  index: Map<string, JsonIndexEntry> | null,
  pointer: string
): JsonIndexEntry | null {
  if (!index) return null;
  let p = pointer;
  for (;;) {
    const e = index.get(p);
    if (e) return e;
    if (p === '') return null;
    p = p.slice(0, p.lastIndexOf('/'));
  }
}
