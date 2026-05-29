/**
 * Client-side ZIP via fflate — bundles batch outputs into a single download with
 * no server round-trip (preserves the privacy guarantee, works offline).
 */
import { zip, type Zippable } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function zipFiles(
  entries: ZipEntry[],
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const record: Zippable = {};
    // De-dupe identical names by suffixing (1), (2), …
    const seen = new Map<string, number>();
    for (const e of entries) {
      let name = e.name;
      if (seen.has(name)) {
        const n = (seen.get(name) ?? 0) + 1;
        seen.set(name, n);
        const dot = name.lastIndexOf('.');
        name = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
      } else {
        seen.set(name, 0);
      }
      record[name] = [e.data, { level }];
    }
    zip(record, { level }, (err, out) => {
      if (err) reject(err);
      else resolve(new Blob([out as BlobPart], { type: 'application/zip' }));
    });
  });
}
