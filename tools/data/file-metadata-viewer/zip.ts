/** ZIP central-directory reader using ranged reads (no need to load the whole archive). */
import {
  type Reader,
  inflateLimited,
  latin1,
  u16,
  u32,
  u64,
  utf8Strict,
  u8,
} from './util';

export interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compSize: number;
  size: number;
  localOffset: number;
  dosTime: number;
  dosDate: number;
  madeBy: number;
  versionNeeded: number;
  extAttr: number;
  isDir: boolean;
  encrypted: boolean;
  aes: boolean;
  comment: string;
  /** Unix modification time from the "UT" extra field (UTC seconds). */
  unixMtime: number | null;
}

export interface ZipDir {
  entries: ZipEntry[];
  totalEntries: number;
  comment: string;
  zip64: boolean;
  /** Bytes in front of the archive (e.g. a self-extracting stub). */
  prefix: number;
  cdOffset: number;
  cdSize: number;
  truncated: boolean;
}

export const HOST_OS: Record<number, string> = {
  0: 'MS-DOS / FAT', 1: 'Amiga', 2: 'OpenVMS', 3: 'Unix', 4: 'VM/CMS', 5: 'Atari ST', 6: 'OS/2 HPFS',
  7: 'Macintosh (classic)', 8: 'Z-System', 9: 'CP/M', 10: 'Windows NTFS', 11: 'MVS', 12: 'VSE', 13: 'Acorn Risc',
  14: 'VFAT', 15: 'Alternate MVS', 16: 'BeOS', 17: 'Tandem', 18: 'OS/400', 19: 'macOS (Darwin)',
};

export const ZIP_METHODS: Record<number, string> = {
  0: 'stored', 1: 'shrunk', 6: 'imploded', 8: 'deflate', 9: 'deflate64', 12: 'bzip2', 14: 'lzma', 93: 'zstd', 95: 'xz', 98: 'ppmd', 99: 'AES-encrypted',
};

export function dosToIso(date: number, time: number): string | null {
  const year = 1980 + ((date >> 9) & 0x7f);
  const month = (date >> 5) & 0x0f;
  const day = date & 0x1f;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hh = (time >> 11) & 0x1f;
  const mm = (time >> 5) & 0x3f;
  const ss = (time & 0x1f) * 2;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${year}-${p(month)}-${p(day)} ${p(hh)}:${p(mm)}:${p(ss)}`;
}

export async function readZipDirectory(rd: Reader, maxEntries = 200000): Promise<ZipDir> {
  const size = rd.size;
  const tailLen = Math.min(size, 65535 + 22 + 20 + 56);
  const tailStart = size - tailLen;
  const tail = await rd.read(tailStart, tailLen);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) {
      const commentLen = u16(tail, i + 20, true);
      if (i + 22 + commentLen <= tail.length) {
        eocd = i;
        break;
      }
    }
  }
  if (eocd < 0) throw new Error('end-of-central-directory record not found (file is truncated or not a ZIP)');
  const eocdAbs = tailStart + eocd;
  let total = u16(tail, eocd + 10, true);
  let cdSize = u32(tail, eocd + 12, true);
  let cdOffset = u32(tail, eocd + 16, true);
  const commentLen = u16(tail, eocd + 20, true);
  const commentBytes = tail.subarray(eocd + 22, eocd + 22 + commentLen);
  const comment = utf8Strict(commentBytes) ?? latin1(commentBytes);
  let zip64 = false;
  // ZIP64 locator sits directly before the EOCD
  if (eocd >= 20 && u32(tail, eocd - 20, true) === 0x07064b50) {
    const rec64 = u64(tail, eocd - 20 + 8, true);
    const r = await rd.read(rec64, 56);
    if (u32(r, 0, true) === 0x06064b50) {
      zip64 = true;
      total = u64(r, 32, true);
      cdSize = u64(r, 40, true);
      cdOffset = u64(r, 48, true);
    }
  } else if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    zip64 = true;
  }
  const eocdPos = zip64 && eocd >= 20 && u32(tail, eocd - 20, true) === 0x07064b50 ? eocdAbs - 20 - 56 : eocdAbs;
  let prefix = 0;
  if (cdOffset + cdSize !== eocdPos && eocdPos - cdSize >= 0) prefix = eocdPos - cdSize - cdOffset;
  if (prefix < 0) prefix = 0;
  const cdBytes = Math.min(cdSize, 96 * 1024 * 1024);
  const cd = await rd.read(cdOffset + prefix, cdBytes);
  const entries: ZipEntry[] = [];
  let p = 0;
  let truncated = cdBytes < cdSize;
  while (p + 46 <= cd.length && entries.length < maxEntries) {
    if (u32(cd, p, true) !== 0x02014b50) break;
    const madeBy = u16(cd, p + 4, true);
    const versionNeeded = u16(cd, p + 6, true);
    const flags = u16(cd, p + 8, true);
    const method = u16(cd, p + 10, true);
    const dosTime = u16(cd, p + 12, true);
    const dosDate = u16(cd, p + 14, true);
    const crc = u32(cd, p + 16, true);
    let compSize = u32(cd, p + 20, true);
    let usize = u32(cd, p + 24, true);
    const nameLen = u16(cd, p + 28, true);
    const extraLen = u16(cd, p + 30, true);
    const cmtLen = u16(cd, p + 32, true);
    const extAttr = u32(cd, p + 38, true);
    let localOffset = u32(cd, p + 42, true);
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    const extra = cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
    const cmtBytes = cd.subarray(p + 46 + nameLen + extraLen, p + 46 + nameLen + extraLen + cmtLen);
    let aes = false;
    let unixMtime: number | null = null;
    for (let e = 0; e + 4 <= extra.length; ) {
      const id = u16(extra, e, true);
      const len = u16(extra, e + 2, true);
      const d = extra.subarray(e + 4, e + 4 + len);
      if (id === 0x0001) {
        let q = 0;
        if (usize === 0xffffffff) { usize = u64(d, q, true); q += 8; }
        if (compSize === 0xffffffff) { compSize = u64(d, q, true); q += 8; }
        if (localOffset === 0xffffffff) { localOffset = u64(d, q, true); q += 8; }
      } else if (id === 0x9901) aes = true;
      else if (id === 0x5455 && len >= 5 && (u8(d, 0) & 1) !== 0) unixMtime = u32(d, 1, true);
      e += 4 + len;
    }
    const name = utf8Strict(nameBytes) ?? latin1(nameBytes);
    entries.push({
      name,
      method,
      flags,
      crc,
      compSize,
      size: usize,
      localOffset,
      dosTime,
      dosDate,
      madeBy,
      versionNeeded,
      extAttr,
      isDir: name.endsWith('/') || ((madeBy >> 8) === 3 && ((extAttr >>> 16) & 0xf000) === 0x4000),
      encrypted: (flags & 1) !== 0,
      aes,
      comment: cmtLen ? (utf8Strict(cmtBytes) ?? latin1(cmtBytes)) : '',
      unixMtime,
    });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  if (entries.length < total && entries.length >= maxEntries) truncated = true;
  return { entries, totalEntries: total, comment, zip64, prefix, cdOffset, cdSize, truncated };
}

/** Extract one entry (stored or deflate) with an output cap. */
export async function extractZipEntry(rd: Reader, dir: ZipDir, e: ZipEntry, maxOut = 32 * 1024 * 1024): Promise<Uint8Array> {
  if (e.encrypted) throw new Error(`entry "${e.name}" is encrypted`);
  const off = e.localOffset + dir.prefix;
  const lh = await rd.read(off, 30);
  if (u32(lh, 0, true) !== 0x04034b50) throw new Error(`bad local header for "${e.name}"`);
  const dataOff = off + 30 + u16(lh, 26, true) + u16(lh, 28, true);
  if (e.method === 0) return (await rd.read(dataOff, Math.min(e.compSize, maxOut))).slice();
  if (e.method !== 8) throw new Error(`unsupported compression method ${e.method} (${ZIP_METHODS[e.method] ?? 'unknown'})`);
  if (e.compSize > 64 * 1024 * 1024) throw new Error(`entry "${e.name}" is too large to inspect`);
  const comp = await rd.read(dataOff, e.compSize);
  return inflateLimited(comp, 'raw', maxOut).out;
}
