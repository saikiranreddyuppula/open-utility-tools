/** Infer TypeScript interfaces from a JSON value. Handles nested objects/arrays,
 * merges object shapes within arrays, and names nested interfaces from their key. */

type Json = unknown;

function tsName(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+(.)/g, (_, c) => c.toUpperCase());
  const name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /^[A-Za-z]/.test(name) ? name : 'I' + name;
}

function keyNeedsQuotes(key: string): boolean {
  return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

export function jsonToTypeScript(value: Json, rootName = 'Root'): string {
  const interfaces: string[] = [];
  const seen = new Set<string>();

  function typeOf(v: Json, name: string): string {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'unknown[]';
      // merge element types
      const elemTypes = new Set(v.map((item) => typeOf(item, singular(name))));
      const inner = [...elemTypes].join(' | ');
      return elemTypes.size > 1 ? `(${inner})[]` : `${inner}[]`;
    }
    if (typeof v === 'object') {
      const iface = tsName(name);
      buildInterface(v as Record<string, Json>, iface);
      return iface;
    }
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    return 'string';
  }

  function singular(name: string): string {
    return name.endsWith('s') ? name.slice(0, -1) : name + 'Item';
  }

  function buildInterface(obj: Record<string, Json>, name: string) {
    if (seen.has(name)) return;
    seen.add(name);
    const lines: string[] = [`export interface ${name} {`];
    for (const [key, val] of Object.entries(obj)) {
      const t = typeOf(val, key);
      const k = keyNeedsQuotes(key) ? JSON.stringify(key) : key;
      lines.push(`  ${k}: ${t};`);
    }
    lines.push('}');
    interfaces.push(lines.join('\n'));
  }

  if (value === null || typeof value !== 'object') {
    return `export type ${tsName(rootName)} = ${typeOf(value, rootName)};`;
  }
  if (Array.isArray(value)) {
    const t = typeOf(value, rootName);
    interfaces.push(`export type ${tsName(rootName)} = ${t};`);
  } else {
    buildInterface(value as Record<string, Json>, tsName(rootName));
  }
  // Root interface should come first; we built nested first, so reverse.
  return interfaces.reverse().join('\n\n');
}
