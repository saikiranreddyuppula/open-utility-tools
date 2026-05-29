/** RFC 4180-ish CSV parsing & serialization (handles quotes, commas, newlines). */

export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeCsvField(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || /[\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function toCsv(rows: (string | number | boolean | null)[][], delimiter = ','): string {
  return rows
    .map((r) => r.map((c) => escapeCsvField(c == null ? '' : String(c), delimiter)).join(delimiter))
    .join('\n');
}

/** Convert array-of-objects JSON to CSV rows (union of keys as header). */
export function jsonToCsv(data: unknown, delimiter = ','): string {
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') data = [data];
    else throw new Error('JSON must be an array of objects (or a single object).');
  }
  const arr = data as Record<string, unknown>[];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const obj of arr) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const k of Object.keys(obj)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
  }
  const rows: (string | number | boolean | null)[][] = [keys];
  for (const obj of arr) {
    rows.push(
      keys.map((k) => {
        const v = obj?.[k];
        if (v == null) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return v as string | number | boolean;
      })
    );
  }
  return toCsv(rows, delimiter);
}

/** Convert CSV to array-of-objects JSON using the first row as headers. */
export function csvToJson(text: string, delimiter = ','): Record<string, string>[] {
  const rows = parseCsv(text, delimiter).filter((r) => r.length > 1 || (r[0] ?? '') !== '');
  if (rows.length === 0) return [];
  const headers = rows[0]!;
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}
