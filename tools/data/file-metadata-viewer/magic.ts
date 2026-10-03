/** Magic-byte file type detection (about 90 signatures) and extension sanity checks. */
import type { DetectedType, TypeKind } from './types';
import { asciiBytes, bytesEq, u16, u32 } from './util';

type Test = (h: Uint8Array) => boolean;

interface Sig {
  id: string;
  name: string;
  mime: string;
  exts: string[];
  kind: TypeKind;
  test: Test;
}

const at =
  (off: number, bytes: ArrayLike<number>): Test =>
  (h) =>
    bytesEq(h, off, bytes);
const str =
  (off: number, s: string): Test =>
  (h) =>
    bytesEq(h, off, asciiBytes(s));
const all =
  (...tests: Test[]): Test =>
  (h) =>
    tests.every((t) => t(h));
const any =
  (...tests: Test[]): Test =>
  (h) =>
    tests.some((t) => t(h));

function sig(
  id: string,
  name: string,
  mime: string,
  exts: string[],
  kind: TypeKind,
  test: Test
): Sig {
  return { id, name, mime, exts, kind, test };
}

const ISO_VIDEO_EXTS = ['mp4', 'm4v', 'mov', 'qt', '3gp', '3g2', 'f4v', 'mp4v', 'm4a', 'm4b', 'm4p', 'mj2'];
const TIFF_EXTS = [
  'tif', 'tiff', 'dng', 'cr2', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'orf', 'rw2', 'pef', 'srw', 'raw',
  '3fr', 'iiq', 'erf', 'mef', 'mrw', 'kdc', 'dcr', 'fff', 'rwl', 'gpr',
];
const ZIP_EXTS = [
  'zip', 'docx', 'docm', 'dotx', 'dotm', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm', 'pptx', 'pptm', 'potx',
  'ppsx', 'ppsm', 'odt', 'ods', 'odp', 'odg', 'odf', 'ott', 'ots', 'otp', 'epub', 'jar', 'war', 'ear',
  'apk', 'aab', 'xapk', 'ipa', 'xpi', 'crx', 'vsix', 'nupkg', 'whl', 'egg', 'kmz', '3mf', 'pages',
  'numbers', 'key', 'sketch', 'figma', 'fig', 'xps', 'oxps', 'apkg', 'mxl', 'cbz', 'sb3', 'sb2', 'slx',
  'idml', 'xmind', 'vsdx', 'jmx', 'zipx', 'appx', 'msix', 'smzip', 'mpkg',
];
const OLE_EXTS = [
  'doc', 'dot', 'xls', 'xlt', 'xla', 'ppt', 'pps', 'pot', 'msg', 'msi', 'vsd', 'pub', 'mpp', 'wps', 'hwp',
  'sdw', 'db', 'thmx', 'oft', 'mdi', 'one', 'docx', 'xlsx', 'pptx',
];

/** Order matters: more specific signatures first. */
const SIGS: Sig[] = [
  // ---- images
  sig('jpeg', 'JPEG image', 'image/jpeg', ['jpg', 'jpeg', 'jpe', 'jfif', 'jif', 'pjpeg'], 'image', at(0, [0xff, 0xd8, 0xff])),
  sig('png', 'PNG image', 'image/png', ['png', 'apng'], 'image', at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  sig('gif', 'GIF image', 'image/gif', ['gif'], 'image', any(str(0, 'GIF87a'), str(0, 'GIF89a'))),
  sig('webp', 'WebP image', 'image/webp', ['webp'], 'image', all(str(0, 'RIFF'), str(8, 'WEBP'))),
  sig('bmp', 'BMP image', 'image/bmp', ['bmp', 'dib'], 'image', (h) =>
    str(0, 'BM')(h) && [12, 40, 52, 56, 64, 108, 124].includes(u32(h, 14, true))
  ),
  sig('cr2', 'Canon CR2 raw (TIFF)', 'image/x-canon-cr2', ['cr2'], 'image', all(any(at(0, [0x49, 0x49, 0x2a, 0x00])), str(8, 'CR'))),
  sig('tiff', 'TIFF image', 'image/tiff', TIFF_EXTS, 'image', any(at(0, [0x49, 0x49, 0x2a, 0x00]), at(0, [0x4d, 0x4d, 0x00, 0x2a]), str(0, 'IIRO'), str(0, 'IIRS'), at(0, [0x49, 0x49, 0x55, 0x00]))),
  sig('bigtiff', 'BigTIFF image', 'image/tiff', ['tif', 'tiff', 'btf'], 'image', any(at(0, [0x49, 0x49, 0x2b, 0x00]), at(0, [0x4d, 0x4d, 0x00, 0x2b]))),
  sig('ico', 'Windows icon', 'image/vnd.microsoft.icon', ['ico'], 'image', (h) =>
    at(0, [0, 0, 1, 0])(h) && u16(h, 4, true) > 0 && u16(h, 4, true) < 400 && (h[9] ?? 0) === 0
  ),
  sig('cur', 'Windows cursor', 'image/x-icon', ['cur'], 'image', (h) =>
    at(0, [0, 0, 2, 0])(h) && u16(h, 4, true) > 0 && u16(h, 4, true) < 400 && (h[9] ?? 0) === 0
  ),
  sig('psd', 'Adobe Photoshop document', 'image/vnd.adobe.photoshop', ['psd', 'psb'], 'image', all(str(0, '8BPS'), (h) => u16(h, 4) === 1 || u16(h, 4) === 2)),
  sig('jp2', 'JPEG 2000 image', 'image/jp2', ['jp2', 'j2k', 'jpf', 'jpx'], 'image', any(at(0, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]), at(0, [0xff, 0x4f, 0xff, 0x51]))),
  sig('jxl', 'JPEG XL image', 'image/jxl', ['jxl'], 'image', any(at(0, [0xff, 0x0a]), at(0, [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]))),
  sig('dds', 'DirectDraw Surface texture', 'image/vnd.ms-dds', ['dds'], 'image', str(0, 'DDS ')),
  sig('exr', 'OpenEXR image', 'image/x-exr', ['exr'], 'image', at(0, [0x76, 0x2f, 0x31, 0x01])),
  sig('hdr', 'Radiance HDR image', 'image/vnd.radiance', ['hdr', 'pic'], 'image', any(str(0, '#?RADIANCE'), str(0, '#?RGBE'))),
  sig('qoi', 'QOI image', 'image/qoi', ['qoi'], 'image', str(0, 'qoif')),
  sig('ktx', 'KTX texture', 'image/ktx', ['ktx'], 'image', at(0, [0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb])),
  sig('icns', 'Apple icon image', 'image/icns', ['icns'], 'image', str(0, 'icns')),
  sig('xcf', 'GIMP image', 'image/x-xcf', ['xcf'], 'image', str(0, 'gimp xcf')),
  sig('icc', 'ICC colour profile', 'application/vnd.iccprofile', ['icc', 'icm'], 'data', str(36, 'acsp')),
  // ---- ISO base media (MP4 family, HEIF, AVIF …) is resolved by brand in detectIso()
  // ---- documents
  sig('pdf', 'PDF document', 'application/pdf', ['pdf', 'ai'], 'document', (h) => {
    if (str(0, '%PDF-')(h)) return true;
    const lim = Math.min(h.length, 1024) - 5;
    for (let i = 1; i < lim; i++) if (bytesEq(h, i, asciiBytes('%PDF-'))) return true;
    return false;
  }),
  sig('ps', 'PostScript document', 'application/postscript', ['ps', 'eps', 'epsf', 'epsi'], 'document', str(0, '%!PS')),
  sig('rtf', 'Rich Text Format', 'application/rtf', ['rtf'], 'document', str(0, '{\\rtf')),
  sig('ole2', 'OLE2 compound file (legacy Office)', 'application/x-ole-storage', OLE_EXTS, 'document', at(0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  sig('djvu', 'DjVu document', 'image/vnd.djvu', ['djvu', 'djv'], 'document', str(0, 'AT&TFORM')),
  sig('chm', 'Compiled HTML help', 'application/vnd.ms-htmlhelp', ['chm'], 'document', str(0, 'ITSF')),
  sig('mobi', 'MOBI / AZW e-book', 'application/x-mobipocket-ebook', ['mobi', 'azw', 'azw3', 'prc'], 'document', any(str(60, 'BOOKMOBI'), str(60, 'TEXtREAd'))),
  sig('dicom', 'DICOM medical image', 'application/dicom', ['dcm', 'dicom'], 'image', str(128, 'DICM')),
  sig('pem', 'PEM-encoded data', 'application/x-pem-file', ['pem', 'crt', 'cer', 'key', 'pub', 'csr', 'asc', 'gpg'], 'data', str(0, '-----BEGIN ')),
  // ---- audio
  sig('flac', 'FLAC audio', 'audio/flac', ['flac'], 'audio', str(0, 'fLaC')),
  sig('wav', 'WAV audio', 'audio/wav', ['wav', 'wave', 'bwf'], 'audio', all(any(str(0, 'RIFF'), str(0, 'RF64')), str(8, 'WAVE'))),
  sig('aiff', 'AIFF audio', 'audio/aiff', ['aif', 'aiff', 'aifc'], 'audio', all(str(0, 'FORM'), any(str(8, 'AIFF'), str(8, 'AIFC')))),
  sig('ogg', 'Ogg container', 'audio/ogg', ['ogg', 'oga', 'ogv', 'ogx', 'opus', 'spx'], 'audio', str(0, 'OggS')),
  sig('midi', 'MIDI file', 'audio/midi', ['mid', 'midi', 'kar'], 'audio', str(0, 'MThd')),
  sig('amr', 'AMR audio', 'audio/amr', ['amr'], 'audio', str(0, '#!AMR')),
  sig('ape', "Monkey's Audio", 'audio/x-ape', ['ape'], 'audio', str(0, 'MAC ')),
  sig('wv', 'WavPack audio', 'audio/x-wavpack', ['wv'], 'audio', str(0, 'wvpk')),
  sig('caf', 'Core Audio Format', 'audio/x-caf', ['caf'], 'audio', str(0, 'caff')),
  sig('au', 'Sun/NeXT audio', 'audio/basic', ['au', 'snd'], 'audio', str(0, '.snd')),
  sig('dsf', 'DSD Stream File', 'audio/dsf', ['dsf'], 'audio', str(0, 'DSD ')),
  sig('mpc', 'Musepack audio', 'audio/x-musepack', ['mpc', 'mp+'], 'audio', any(str(0, 'MPCK'), str(0, 'MP+'))),
  sig('aac', 'AAC audio (ADTS)', 'audio/aac', ['aac', 'adts'], 'audio', (h) => (h[0] ?? 0) === 0xff && ((h[1] ?? 0) & 0xf6) === 0xf0),
  // ---- video
  sig('avi', 'AVI video', 'video/x-msvideo', ['avi'], 'video', all(str(0, 'RIFF'), str(8, 'AVI '))),
  sig('mkv', 'Matroska / WebM', 'video/x-matroska', ['mkv', 'mka', 'mks', 'mk3d', 'webm'], 'video', at(0, [0x1a, 0x45, 0xdf, 0xa3])),
  sig('flv', 'Flash video', 'video/x-flv', ['flv'], 'video', all(str(0, 'FLV'), at(3, [1]))),
  sig('asf', 'ASF (WMV / WMA)', 'video/x-ms-asf', ['asf', 'wmv', 'wma'], 'video', at(0, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c])),
  sig('mpegps', 'MPEG program stream', 'video/mpeg', ['mpg', 'mpeg', 'vob', 'm2p', 'ps'], 'video', at(0, [0, 0, 1, 0xba])),
  sig('mpegv', 'MPEG video', 'video/mpeg', ['mpg', 'mpeg', 'm1v', 'm2v'], 'video', at(0, [0, 0, 1, 0xb3])),
  sig('mpegts', 'MPEG transport stream', 'video/mp2t', ['ts', 'mts', 'm2ts', 'tsv', 'tp'], 'video', (h) => (h[0] === 0x47 && h[188] === 0x47 && h[376] === 0x47) || (h[4] === 0x47 && h[196] === 0x47 && h[388] === 0x47)),
  sig('swf', 'Shockwave Flash', 'application/x-shockwave-flash', ['swf'], 'video', any(str(0, 'FWS'), str(0, 'CWS'), str(0, 'ZWS'))),
  sig('rm', 'RealMedia', 'application/vnd.rn-realmedia', ['rm', 'rmvb', 'ra'], 'video', str(0, '.RMF')),
  // ---- archives
  sig('zip', 'ZIP archive', 'application/zip', ZIP_EXTS, 'archive', any(at(0, [0x50, 0x4b, 3, 4]), at(0, [0x50, 0x4b, 5, 6]), at(0, [0x50, 0x4b, 7, 8]))),
  sig('rar', 'RAR archive', 'application/vnd.rar', ['rar', 'cbr'], 'archive', str(0, 'Rar!\x1a\x07')),
  sig('7z', '7-Zip archive', 'application/x-7z-compressed', ['7z'], 'archive', at(0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])),
  sig('gzip', 'GZIP compressed data', 'application/gzip', ['gz', 'gzip', 'tgz', 'svgz', 'emz', 'wmz', 'vgz'], 'archive', at(0, [0x1f, 0x8b, 0x08])),
  sig('bzip2', 'BZIP2 compressed data', 'application/x-bzip2', ['bz2', 'tbz2', 'tbz'], 'archive', (h) => str(0, 'BZh')(h) && (h[3] ?? 0) >= 0x31 && (h[3] ?? 0) <= 0x39),
  sig('xz', 'XZ compressed data', 'application/x-xz', ['xz', 'txz', 'lzma'], 'archive', at(0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])),
  sig('zstd', 'Zstandard compressed data', 'application/zstd', ['zst', 'zstd'], 'archive', at(0, [0x28, 0xb5, 0x2f, 0xfd])),
  sig('lz4', 'LZ4 compressed data', 'application/x-lz4', ['lz4'], 'archive', at(0, [0x04, 0x22, 0x4d, 0x18])),
  sig('lzip', 'Lzip compressed data', 'application/x-lzip', ['lz'], 'archive', str(0, 'LZIP')),
  sig('compress', 'Unix compress data', 'application/x-compress', ['z'], 'archive', at(0, [0x1f, 0x9d])),
  sig('cab', 'Microsoft Cabinet', 'application/vnd.ms-cab-compressed', ['cab'], 'archive', str(0, 'MSCF')),
  sig('tar', 'TAR archive', 'application/x-tar', ['tar'], 'archive', any(str(257, 'ustar'), (h) => tarHeaderOk(h))),
  sig('iso', 'ISO 9660 disc image', 'application/x-iso9660-image', ['iso', 'img'], 'archive', str(32769, 'CD001')),
  sig('ar', 'Unix ar archive / .deb', 'application/x-archive', ['a', 'deb', 'lib', 'ar'], 'archive', str(0, '!<arch>\n')),
  sig('rpm', 'RPM package', 'application/x-rpm', ['rpm'], 'archive', at(0, [0xed, 0xab, 0xee, 0xdb])),
  sig('cpio', 'cpio archive', 'application/x-cpio', ['cpio'], 'archive', any(str(0, '070701'), str(0, '070702'), str(0, '070707'))),
  sig('xar', 'XAR archive / macOS pkg', 'application/x-xar', ['xar', 'pkg'], 'archive', str(0, 'xar!')),
  sig('arj', 'ARJ archive', 'application/x-arj', ['arj'], 'archive', at(0, [0x60, 0xea])),
  sig('lzh', 'LHA / LZH archive', 'application/x-lzh-compressed', ['lzh', 'lha'], 'archive', (h) => (h[2] === 0x2d && h[3] === 0x6c && h[4] === 0x68 && h[6] === 0x2d)),
  // ---- executables
  sig('elf', 'ELF executable', 'application/x-elf', ['', 'elf', 'so', 'o', 'bin', 'out', 'axf', 'ko', 'a', 'dylib'], 'executable', at(0, [0x7f, 0x45, 0x4c, 0x46])),
  sig('wasm', 'WebAssembly module', 'application/wasm', ['wasm'], 'executable', at(0, [0x00, 0x61, 0x73, 0x6d])),
  sig('dex', 'Android Dalvik executable', 'application/vnd.android.dex', ['dex'], 'executable', str(0, 'dex\n')),
  sig('llvmbc', 'LLVM bitcode', 'application/x-llvm', ['bc'], 'executable', at(0, [0x42, 0x43, 0xc0, 0xde])),
  sig('lnk', 'Windows shortcut', 'application/x-ms-shortcut', ['lnk'], 'data', at(0, [0x4c, 0, 0, 0, 0x01, 0x14, 0x02, 0])),
  // ---- fonts
  sig('woff2', 'WOFF2 font', 'font/woff2', ['woff2'], 'font', str(0, 'wOF2')),
  sig('woff', 'WOFF font', 'font/woff', ['woff'], 'font', str(0, 'wOFF')),
  sig('otf', 'OpenType font (CFF)', 'font/otf', ['otf'], 'font', str(0, 'OTTO')),
  sig('ttc', 'TrueType / OpenType font collection', 'font/collection', ['ttc', 'otc'], 'font', str(0, 'ttcf')),
  sig('ttf', 'TrueType font', 'font/ttf', ['ttf', 'otf', 'ttc', 'sfnt'], 'font', (h) => (at(0, [0, 1, 0, 0])(h) || str(0, 'true')(h) || str(0, 'typ1')(h)) && u16(h, 4) > 0 && u16(h, 4) < 100),
  sig('pfb', 'PostScript Type 1 font (PFB)', 'application/x-font-type1', ['pfb'], 'font', at(0, [0x80, 0x01])),
  // ---- data
  sig('sqlite', 'SQLite database', 'application/vnd.sqlite3', ['sqlite', 'sqlite3', 'db', 'db3', 's3db', 'sl3'], 'data', str(0, 'SQLite format 3\0')),
  sig('hdf5', 'HDF5 data', 'application/x-hdf5', ['h5', 'hdf5', 'hdf', 'he5', 'nc'], 'data', at(0, [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a])),
  sig('parquet', 'Apache Parquet', 'application/vnd.apache.parquet', ['parquet'], 'data', str(0, 'PAR1')),
  sig('avro', 'Apache Avro', 'application/avro', ['avro'], 'data', at(0, [0x4f, 0x62, 0x6a, 0x01])),
  sig('npy', 'NumPy array', 'application/x-npy', ['npy'], 'data', at(0, [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59])),
  sig('pcap', 'PCAP capture', 'application/vnd.tcpdump.pcap', ['pcap', 'cap', 'dmp'], 'data', any(at(0, [0xd4, 0xc3, 0xb2, 0xa1]), at(0, [0xa1, 0xb2, 0xc3, 0xd4]), at(0, [0x4d, 0x3c, 0xb2, 0xa1]))),
  sig('pcapng', 'PCAPNG capture', 'application/x-pcapng', ['pcapng', 'ntar'], 'data', at(0, [0x0a, 0x0d, 0x0d, 0x0a])),
  sig('mdb', 'Microsoft Access database', 'application/x-msaccess', ['mdb', 'accdb'], 'data', any(str(4, 'Standard Jet DB'), str(4, 'Standard ACE DB'))),
  sig('regf', 'Windows registry hive', 'application/x-ms-registry', ['dat', 'hiv'], 'data', str(0, 'regf')),
  sig('kdbx', 'KeePass database', 'application/x-keepass2', ['kdbx'], 'data', at(0, [0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5])),
  sig('pst', 'Outlook data file', 'application/vnd.ms-outlook', ['pst', 'ost'], 'data', str(0, '!BDN')),
  sig('fits', 'FITS astronomy image', 'image/fits', ['fits', 'fit', 'fts'], 'image', str(0, 'SIMPLE  =')),
  sig('git-pack', 'Git pack file', 'application/x-git-pack', ['pack'], 'data', str(0, 'PACK')),
  sig('luks', 'LUKS encrypted volume', 'application/x-luks', ['luks', 'img'], 'data', at(0, [0x4c, 0x55, 0x4b, 0x53, 0xba, 0xbe])),
  sig('vmdk', 'VMware disk', 'application/x-vmdk', ['vmdk'], 'data', str(0, 'KDMV')),
  sig('qcow', 'QEMU QCOW image', 'application/x-qemu-disk', ['qcow', 'qcow2'], 'data', at(0, [0x51, 0x46, 0x49, 0xfb])),
  sig('torrent', 'BitTorrent metainfo', 'application/x-bittorrent', ['torrent'], 'data', any(str(0, 'd8:announce'), str(0, 'd4:info'), str(0, 'd10:created'), str(0, 'd7:comment'))),
];

/** Mach-O / fat binaries / Java classes (they share magic numbers). */
function detectCafeBabe(h: Uint8Array): DetectedType | null {
  if (!at(0, [0xca, 0xfe, 0xba, 0xbe])(h)) return null;
  const n = u32(h, 4);
  if (n >= 1 && n < 45) {
    return { id: 'macho-fat', name: 'Mach-O universal binary', mime: 'application/x-mach-binary', exts: ['', 'dylib', 'o', 'bundle', 'so', 'a', 'app', 'macho'], kind: 'executable' };
  }
  return { id: 'java-class', name: 'Java class file', mime: 'application/java-vm', exts: ['class'], kind: 'executable' };
}

function detectMachO(h: Uint8Array): DetectedType | null {
  const m = u32(h, 0);
  if (m === 0xfeedface || m === 0xfeedfacf || m === 0xcefaedfe || m === 0xcffaedfe) {
    return { id: 'macho', name: 'Mach-O executable', mime: 'application/x-mach-binary', exts: ['', 'dylib', 'o', 'bundle', 'so', 'a', 'kext', 'macho'], kind: 'executable' };
  }
  if (m === 0xcafebabf || m === 0xbfbafeca) {
    return { id: 'macho-fat', name: 'Mach-O universal binary', mime: 'application/x-mach-binary', exts: ['', 'dylib', 'o', 'bundle', 'so', 'a', 'macho'], kind: 'executable' };
  }
  return null;
}

function detectPe(h: Uint8Array): DetectedType | null {
  if (!str(0, 'MZ')(h)) return null;
  const lfanew = u32(h, 0x3c, true);
  const isPe = lfanew > 0 && lfanew < h.length - 4 && bytesEq(h, lfanew, [0x50, 0x45, 0, 0]);
  if (isPe) {
    return { id: 'pe', name: 'Windows PE executable', mime: 'application/vnd.microsoft.portable-executable', exts: ['exe', 'dll', 'sys', 'scr', 'ocx', 'cpl', 'efi', 'drv', 'mui', 'ax', 'tlb', 'winmd', 'mun'], kind: 'executable' };
  }
  if (h.length > 0x40 && lfanew > 0) {
    return { id: 'mz', name: 'DOS / Windows executable (MZ)', mime: 'application/x-dosexec', exts: ['exe', 'dll', 'com', 'sys', 'scr', 'ocx', 'drv', 'ax'], kind: 'executable' };
  }
  return null;
}

function tarHeaderOk(h: Uint8Array): boolean {
  if (h.length < 512) return false;
  // checksum field @148 (octal), valid header = sum of bytes with the field read as spaces
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : (h[i] ?? 0);
  let s = '';
  for (let i = 148; i < 156; i++) {
    const c = h[i] ?? 0;
    if (c === 0 || c === 32) {
      if (s) break;
      continue;
    }
    s += String.fromCharCode(c);
  }
  if (!/^[0-7]+$/.test(s)) return false;
  return parseInt(s, 8) === sum && sum > 256;
}

const ISO_BRANDS: Array<[RegExp, DetectedType]> = [
  [/^(heic|heix|hevc|hevx|heim|heis|hevm|hevs)$/, { id: 'heic', name: 'HEIC image', mime: 'image/heic', exts: ['heic', 'heif', 'hif', 'heics'], kind: 'image' }],
  [/^(mif1|msf1)$/, { id: 'heic', name: 'HEIF image', mime: 'image/heif', exts: ['heif', 'heic', 'hif', 'avif'], kind: 'image' }],
  [/^(avif|avis)$/, { id: 'avif', name: 'AVIF image', mime: 'image/avif', exts: ['avif', 'avifs', 'heif'], kind: 'image' }],
  [/^jxl $/, { id: 'jxl', name: 'JPEG XL image', mime: 'image/jxl', exts: ['jxl'], kind: 'image' }],
  [/^crx $/, { id: 'cr3', name: 'Canon CR3 raw', mime: 'image/x-canon-cr3', exts: ['cr3'], kind: 'image' }],
  [/^(M4A |M4B |M4P )$/, { id: 'mp4', name: 'MPEG-4 audio (M4A)', mime: 'audio/mp4', exts: ISO_VIDEO_EXTS, kind: 'audio' }],
  [/^qt  $/, { id: 'mp4', name: 'QuickTime movie', mime: 'video/quicktime', exts: ISO_VIDEO_EXTS, kind: 'video' }],
  [/^(3gp|3g2)/, { id: 'mp4', name: '3GPP video', mime: 'video/3gpp', exts: ISO_VIDEO_EXTS, kind: 'video' }],
  [/^M4V /, { id: 'mp4', name: 'MPEG-4 video (M4V)', mime: 'video/x-m4v', exts: ISO_VIDEO_EXTS, kind: 'video' }],
  [/^f4v /, { id: 'mp4', name: 'Flash MP4 video', mime: 'video/x-f4v', exts: ISO_VIDEO_EXTS, kind: 'video' }],
];

function detectIso(h: Uint8Array): DetectedType | null {
  if (!str(4, 'ftyp')(h)) return null;
  const size = u32(h, 0);
  if (size < 8 && size !== 1 && size !== 0) return null;
  const brand = String.fromCharCode(h[8] ?? 0, h[9] ?? 0, h[10] ?? 0, h[11] ?? 0);
  for (const [re, t] of ISO_BRANDS) if (re.test(brand)) return t;
  return { id: 'mp4', name: 'MP4 video', mime: 'video/mp4', exts: ISO_VIDEO_EXTS, kind: 'video' };
}

function mpegAudioSync(h: Uint8Array, o: number): boolean {
  const b0 = h[o] ?? 0;
  const b1 = h[o + 1] ?? 0;
  const b2 = h[o + 2] ?? 0;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return false;
  if (((b1 >> 3) & 3) === 1) return false;
  if (((b1 >> 1) & 3) === 0) return false;
  if ((b2 >> 4) === 15) return false;
  if (((b2 >> 2) & 3) === 3) return false;
  return true;
}

const MP3_TYPE: DetectedType = { id: 'mp3', name: 'MP3 audio', mime: 'audio/mpeg', exts: ['mp3', 'mp2', 'mp1', 'mpga', 'm2a'], kind: 'audio' };

/** Guard against UTF-16 text (FF FE BOM) and random data that happen to look like an MPEG frame header. */
function plausibleMpegStart(h: Uint8Array): boolean {
  if ((h[1] ?? 0) === 0xfe && ((h[3] ?? 0) === 0 || (h[2] ?? 0) === 0)) return false;
  const first = parseFrameLen(h, 0);
  if (first === 0) return false;
  if (h.length >= first + 4) return mpegAudioSync(h, first);
  return h.length >= 128;
}

function parseFrameLen(h: Uint8Array, o: number): number {
  const versionId = ((h[o + 1] ?? 0) >> 3) & 3;
  const layer = 4 - (((h[o + 1] ?? 0) >> 1) & 3);
  const brIdx = (h[o + 2] ?? 0) >> 4;
  const srIdx = ((h[o + 2] ?? 0) >> 2) & 3;
  const pad = ((h[o + 2] ?? 0) >> 1) & 1;
  const br = [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  ];
  const row = versionId === 3 ? br[layer - 1] : layer === 1 ? br[3] : br[4];
  const bitrate = (row?.[brIdx] ?? 0) * 1000;
  const rate = ({ 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] } as Record<number, number[]>)[versionId]?.[srIdx] ?? 0;
  if (!bitrate || !rate) return 0;
  if (layer === 1) return (Math.floor((12 * bitrate) / rate) + pad) * 4;
  return Math.floor(((layer === 3 && versionId !== 3 ? 72 : 144) * bitrate) / rate) + pad;
}

function id3TagEnd(h: Uint8Array): number {
  if (!str(0, 'ID3')(h)) return -1;
  const size = ((h[6] ?? 0) << 21) | ((h[7] ?? 0) << 14) | ((h[8] ?? 0) << 7) | (h[9] ?? 0);
  const footer = ((h[5] ?? 0) & 0x10) !== 0 ? 10 : 0;
  return 10 + size + footer;
}

export function detectBinaryType(h: Uint8Array): DetectedType | null {
  if (h.length === 0) return null;
  // ID3-prefixed files: look through the tag to find what really follows.
  const tagEnd = id3TagEnd(h);
  if (tagEnd > 0) {
    if (tagEnd + 4 <= h.length) {
      const after = h.subarray(tagEnd);
      if (str(0, 'fLaC')(after)) return SIGS.find((s) => s.id === 'flac') ?? MP3_TYPE;
      if (str(0, 'RIFF')(after) || str(0, 'FORM')(after)) {
        const t = detectBinaryType(after);
        if (t) return t;
      }
      if (sigAdts(after)) return SIGS.find((s) => s.id === 'aac') ?? MP3_TYPE;
    }
    return MP3_TYPE;
  }
  const iso = detectIso(h);
  if (iso) return iso;
  const cb = detectCafeBabe(h);
  if (cb) return cb;
  const mo = detectMachO(h);
  if (mo) return mo;
  const pe = detectPe(h);
  if (pe) return pe;
  const binaryish = hasBinaryByte(h.subarray(0, 32));
  for (const s of SIGS) {
    if (WEAK.has(s.id) && !binaryish) continue;
    try {
      if (s.test(h)) return { id: s.id, name: s.name, mime: s.mime, exts: s.exts, kind: s.kind };
    } catch {
      /* ignore */
    }
  }
  if (mpegAudioSync(h, 0) && plausibleMpegStart(h)) return MP3_TYPE;
  return null;
}

/** Signatures that are plain ASCII words and could start a text file. */
const WEAK = new Set(['ape', 'dds', 'icns', 'wv', 'caf', 'qoi', 'dex', 'parquet', 'git-pack', 'dsf', 'mpc', 'xar', 'vmdk', 'lzip', 'chm', 'cab', 'regf', 'pst', 'au', 'rm', 'midi', 'avro', 'xcf', 'mobi', 'djvu']);

function hasBinaryByte(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) {
    const c = b[i] ?? 0;
    if (c === 0 || c >= 0x80 || c < 0x09 || (c > 0x0d && c < 0x20 && c !== 0x1b)) return true;
  }
  return false;
}

function sigAdts(h: Uint8Array): boolean {
  return (h[0] ?? 0) === 0xff && ((h[1] ?? 0) & 0xf6) === 0xf0;
}

/** Every extension that implies a binary (non-text) format. */
const BINARY_EXTS: Set<string> = (() => {
  const s = new Set<string>();
  for (const sg of SIGS) {
    if (sg.id === 'pem' || sg.id === 'torrent') continue;
    for (const e of sg.exts) if (e) s.add(e);
  }
  for (const e of ISO_VIDEO_EXTS) s.add(e);
  for (const e of ['heic', 'heif', 'avif', 'exe', 'dll', 'class', 'mp3', 'woff', 'woff2', 'ttf', 'otf', 'jpg', 'jpeg']) s.add(e);
  // ambiguous: genuinely used for text too
  for (const e of ['ps', 'db', 'dat', 'key', 'pub', 'img', 'a', 'o', 'bin', 'out', 'raw', 'cap', 'dmp', 'pack', 'ts', 'bc', 'z', 'lib', 'fig', 'mid', 'kar', 'pic', 'au', 'snd', 'nc', 'ar', 'lz', 'sys', 'hdr', 'ai', 'asc', 'cer', 'crt', 'pem', 'csr', 'tp'])
    s.delete(e);
  return s;
})();

const NEUTRAL_EXTS = new Set(['bin', 'dat', 'tmp', 'temp', 'data', 'download', 'crdownload', 'part', 'partial', 'unknown', 'file', 'blob', 'bak', 'old', 'orig', 'backup', 'cache']);

/** Returns a human warning when the file extension contradicts the detected content. */
export function extensionWarning(det: DetectedType | null, ext: string, isText: boolean): string | null {
  const e = ext.toLowerCase();
  if (!e || NEUTRAL_EXTS.has(e)) return null;
  if (!det) {
    if (isText && BINARY_EXTS.has(e)) return `Extension ".${e}" suggests a binary format, but the content looks like plain text.`;
    return null;
  }
  if (det.exts.includes(e)) return null;
  if (det.kind === 'text') {
    return BINARY_EXTS.has(e) ? `Extension ".${e}" suggests a binary format, but the content is ${det.name}.` : null;
  }
  if (det.id === 'zip' && ZIP_EXTS.includes(e)) return null;
  if (det.id === 'gzip' && /^t?gz$|^tar$/.test(e)) return null;
  const want = det.exts.find((x) => x.length > 0);
  return `Extension ".${e}" does not match the content, which looks like ${det.name}${want ? ` (usually ".${want}")` : ''}.`;
}

export function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const i = base.lastIndexOf('.');
  if (i <= 0 || i === base.length - 1) return '';
  return base.slice(i + 1).toLowerCase();
}

export const SIGNATURE_COUNT = SIGS.length + ISO_BRANDS.length + 6;
