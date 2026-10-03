/** TIFF / EXIF structure parser (both byte orders), shared by JPEG, PNG, WebP, HEIC and TIFF files. */
import type { Collector } from './util';
import {
  type Reader,
  MemReader,
  clean,
  f32,
  f64,
  fmtNum,
  i16,
  i32,
  imageMime,
  latin1,
  textSmart,
  toHex,
  u16,
  u32,
  utf16,
} from './util';

export interface ExifValue {
  type: number;
  count: number;
  nums: number[];
  rats: Array<[number, number]>;
  str: string;
  bytes: Uint8Array | null;
  /** True when the value was too big to read (only the count is known). */
  skipped?: boolean;
}

export interface ExifEntry {
  tag: number;
  name: string;
  value: string;
  raw: ExifValue;
}

export interface ExifIfd {
  /** "ifd0", "ifd1", "exif", "gps", "interop", "sub0", "page2" … */
  id: string;
  title: string;
  entries: ExifEntry[];
}

export interface GpsInfo {
  lat: number | null;
  lon: number | null;
  alt: number | null;
  latText: string;
  lonText: string;
  link: string | null;
}

export interface ExifData {
  le: boolean;
  ifds: ExifIfd[];
  /** Embedded JPEG thumbnail (IFD1), when present. */
  thumbnail: Uint8Array | null;
  thumbnailLength: number | null;
  /** Number of top-level IFDs (pages for TIFF files). */
  pages: number;
  makerNoteBytes: number | null;
  gps: GpsInfo | null;
  embedded: { xmp?: Uint8Array; iptc?: Uint8Array; icc?: Uint8Array; photoshop?: Uint8Array };
}

// ---------------------------------------------------------------------------
// Tag name tables
// ---------------------------------------------------------------------------

const TAGS_TIFF: Record<number, string> = {
  0x00fe: 'NewSubfileType', 0x00ff: 'SubfileType', 0x0100: 'ImageWidth', 0x0101: 'ImageHeight',
  0x0102: 'BitsPerSample', 0x0103: 'Compression', 0x0106: 'PhotometricInterpretation',
  0x0107: 'Thresholding', 0x010a: 'FillOrder', 0x010d: 'DocumentName', 0x010e: 'ImageDescription',
  0x010f: 'Make', 0x0110: 'Model', 0x0111: 'StripOffsets', 0x0112: 'Orientation',
  0x0115: 'SamplesPerPixel', 0x0116: 'RowsPerStrip', 0x0117: 'StripByteCounts',
  0x011a: 'XResolution', 0x011b: 'YResolution', 0x011c: 'PlanarConfiguration',
  0x011d: 'PageName', 0x0128: 'ResolutionUnit', 0x0129: 'PageNumber', 0x012d: 'TransferFunction',
  0x0131: 'Software', 0x0132: 'ModifyDate', 0x013b: 'Artist', 0x013c: 'HostComputer',
  0x013d: 'Predictor', 0x013e: 'WhitePoint', 0x013f: 'PrimaryChromaticities',
  0x0140: 'ColorMap', 0x0142: 'TileWidth', 0x0143: 'TileLength', 0x0144: 'TileOffsets',
  0x0145: 'TileByteCounts', 0x014a: 'SubIFDs', 0x0152: 'ExtraSamples', 0x0153: 'SampleFormat',
  0x015b: 'JPEGTables', 0x0201: 'ThumbnailOffset', 0x0202: 'ThumbnailLength',
  0x0211: 'YCbCrCoefficients', 0x0212: 'YCbCrSubSampling', 0x0213: 'YCbCrPositioning',
  0x0214: 'ReferenceBlackWhite', 0x02bc: 'XMP', 0x4746: 'Rating', 0x4749: 'RatingPercent',
  0x7032: 'VignettingCorrParams', 0x80a4: 'ImageRegion', 0x8298: 'Copyright', 0x82a5: 'MDFileTag',
  0x830e: 'ModelPixelScale', 0x83bb: 'IPTC-NAA', 0x8482: 'ModelTiepoint', 0x8649: 'PhotoshopImageResources',
  0x8769: 'ExifOffset', 0x8773: 'ICCProfile', 0x8825: 'GPSInfo', 0x85d8: 'ModelTransformation',
  0x87af: 'GeoKeyDirectory', 0x87b0: 'GeoDoubleParams', 0x87b1: 'GeoAsciiParams',
  0x9c9b: 'XPTitle', 0x9c9c: 'XPComment', 0x9c9d: 'XPAuthor', 0x9c9e: 'XPKeywords', 0x9c9f: 'XPSubject',
  0xa480: 'GDALMetadata', 0xa481: 'GDALNoData', 0xc4a5: 'PrintIM', 0xc612: 'DNGVersion',
  0xc613: 'DNGBackwardVersion', 0xc614: 'UniqueCameraModel', 0xc615: 'LocalizedCameraModel',
  0xc62f: 'CameraSerialNumber', 0xc634: 'DNGPrivateData', 0xc65d: 'RawDataUniqueID',
  0xc68b: 'OriginalRawFileName', 0xea1c: 'Padding',
};

const TAGS_EXIF: Record<number, string> = {
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8822: 'ExposureProgram', 0x8824: 'SpectralSensitivity',
  0x8827: 'ISO', 0x8828: 'OECF', 0x8830: 'SensitivityType', 0x8831: 'StandardOutputSensitivity',
  0x8832: 'RecommendedExposureIndex', 0x8833: 'ISOSpeed', 0x8834: 'ISOSpeedLatitudeyyy',
  0x8835: 'ISOSpeedLatitudezzz', 0x882a: 'TimeZoneOffset', 0x882b: 'SelfTimerMode',
  0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal', 0x9004: 'CreateDate', 0x9009: 'GooglePlusUploadCode',
  0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0x9012: 'OffsetTimeDigitized',
  0x9101: 'ComponentsConfiguration', 0x9102: 'CompressedBitsPerPixel', 0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue', 0x9203: 'BrightnessValue', 0x9204: 'ExposureCompensation',
  0x9205: 'MaxApertureValue', 0x9206: 'SubjectDistance', 0x9207: 'MeteringMode', 0x9208: 'LightSource',
  0x9209: 'Flash', 0x920a: 'FocalLength', 0x9214: 'SubjectArea', 0x927c: 'MakerNote',
  0x9286: 'UserComment', 0x9290: 'SubSecTime', 0x9291: 'SubSecTimeOriginal', 0x9292: 'SubSecTimeDigitized',
  0x9400: 'AmbientTemperature', 0x9401: 'Humidity', 0x9402: 'Pressure', 0x9403: 'WaterDepth',
  0x9404: 'Acceleration', 0x9405: 'CameraElevationAngle',
  0xa000: 'FlashpixVersion', 0xa001: 'ColorSpace', 0xa002: 'ExifImageWidth', 0xa003: 'ExifImageHeight',
  0xa004: 'RelatedSoundFile', 0xa005: 'InteropOffset', 0xa20b: 'FlashEnergy',
  0xa20c: 'SpatialFrequencyResponse', 0xa20e: 'FocalPlaneXResolution', 0xa20f: 'FocalPlaneYResolution',
  0xa210: 'FocalPlaneResolutionUnit', 0xa214: 'SubjectLocation', 0xa215: 'ExposureIndex',
  0xa217: 'SensingMethod', 0xa300: 'FileSource', 0xa301: 'SceneType', 0xa302: 'CFAPattern',
  0xa401: 'CustomRendered', 0xa402: 'ExposureMode', 0xa403: 'WhiteBalance', 0xa404: 'DigitalZoomRatio',
  0xa405: 'FocalLengthIn35mmFormat', 0xa406: 'SceneCaptureType', 0xa407: 'GainControl',
  0xa408: 'Contrast', 0xa409: 'Saturation', 0xa40a: 'Sharpness', 0xa40b: 'DeviceSettingDescription',
  0xa40c: 'SubjectDistanceRange', 0xa420: 'ImageUniqueID', 0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber', 0xa432: 'LensSpecification', 0xa433: 'LensMake', 0xa434: 'LensModel',
  0xa435: 'LensSerialNumber', 0xa460: 'CompositeImage', 0xa461: 'CompositeImageCount',
  0xa462: 'CompositeImageExposureTimes', 0xa500: 'Gamma', 0xea1c: 'Padding',
};

const TAGS_GPS: Record<number, string> = {
  0: 'GPSVersionID', 1: 'GPSLatitudeRef', 2: 'GPSLatitude', 3: 'GPSLongitudeRef', 4: 'GPSLongitude',
  5: 'GPSAltitudeRef', 6: 'GPSAltitude', 7: 'GPSTimeStamp', 8: 'GPSSatellites', 9: 'GPSStatus',
  10: 'GPSMeasureMode', 11: 'GPSDOP', 12: 'GPSSpeedRef', 13: 'GPSSpeed', 14: 'GPSTrackRef',
  15: 'GPSTrack', 16: 'GPSImgDirectionRef', 17: 'GPSImgDirection', 18: 'GPSMapDatum',
  19: 'GPSDestLatitudeRef', 20: 'GPSDestLatitude', 21: 'GPSDestLongitudeRef', 22: 'GPSDestLongitude',
  23: 'GPSDestBearingRef', 24: 'GPSDestBearing', 25: 'GPSDestDistanceRef', 26: 'GPSDestDistance',
  27: 'GPSProcessingMethod', 28: 'GPSAreaInformation', 29: 'GPSDateStamp', 30: 'GPSDifferential',
  31: 'GPSHPositioningError',
};

const TAGS_INTEROP: Record<number, string> = {
  1: 'InteropIndex', 2: 'InteropVersion', 0x1000: 'RelatedImageFileFormat', 0x1001: 'RelatedImageWidth',
  0x1002: 'RelatedImageHeight',
};

const ENUMS: Record<number, Record<number, string>> = {
  0x0103: {
    1: 'Uncompressed', 2: 'CCITT 1D', 3: 'T4/Group 3 Fax', 4: 'T6/Group 4 Fax', 5: 'LZW', 6: 'JPEG (old-style)',
    7: 'JPEG', 8: 'Adobe Deflate', 9: 'JBIG B&W', 10: 'JBIG Color', 32766: 'Next', 32773: 'PackBits',
    34712: 'JPEG 2000', 34925: 'LZMA2', 50000: 'Zstd', 50001: 'WebP', 99: 'JPEG (Samsung)',
  },
  0x0106: {
    0: 'WhiteIsZero', 1: 'BlackIsZero', 2: 'RGB', 3: 'RGB Palette', 4: 'Transparency Mask', 5: 'CMYK',
    6: 'YCbCr', 8: 'CIELab', 9: 'ICCLab', 10: 'ITULab', 32803: 'Color Filter Array', 34892: 'Linear Raw',
  },
  0x0112: {
    1: 'Horizontal (normal)', 2: 'Mirror horizontal', 3: 'Rotate 180', 4: 'Mirror vertical',
    5: 'Mirror horizontal and rotate 270 CW', 6: 'Rotate 90 CW', 7: 'Mirror horizontal and rotate 90 CW',
    8: 'Rotate 270 CW',
  },
  0x011c: { 1: 'Chunky', 2: 'Planar' },
  0x0128: { 1: 'None', 2: 'inches', 3: 'cm' },
  0xa210: { 1: 'None', 2: 'inches', 3: 'cm', 4: 'mm', 5: 'um' },
  0x0153: { 1: 'Unsigned', 2: 'Signed', 3: 'Float', 4: 'Undefined' },
  0x0213: { 1: 'Centered', 2: 'Co-sited' },
  0x8822: {
    0: 'Not Defined', 1: 'Manual', 2: 'Program AE', 3: 'Aperture-priority AE', 4: 'Shutter speed priority AE',
    5: 'Creative (slow speed)', 6: 'Action (high speed)', 7: 'Portrait', 8: 'Landscape', 9: 'Bulb',
  },
  0x9207: {
    0: 'Unknown', 1: 'Average', 2: 'Center-weighted average', 3: 'Spot', 4: 'Multi-spot',
    5: 'Multi-segment', 6: 'Partial', 255: 'Other',
  },
  0x9208: {
    0: 'Unknown', 1: 'Daylight', 2: 'Fluorescent', 3: 'Tungsten (incandescent)', 4: 'Flash', 9: 'Fine weather',
    10: 'Cloudy', 11: 'Shade', 12: 'Daylight fluorescent', 13: 'Day white fluorescent',
    14: 'Cool white fluorescent', 15: 'White fluorescent', 16: 'Warm white fluorescent',
    17: 'Standard light A', 18: 'Standard light B', 19: 'Standard light C', 20: 'D55', 21: 'D65', 22: 'D75',
    23: 'D50', 24: 'ISO studio tungsten', 255: 'Other',
  },
  0xa001: { 1: 'sRGB', 2: 'Adobe RGB', 0xfffd: 'Wide Gamut RGB', 0xfffe: 'ICC Profile', 0xffff: 'Uncalibrated' },
  0xa217: {
    1: 'Not defined', 2: 'One-chip color area', 3: 'Two-chip color area', 4: 'Three-chip color area',
    5: 'Color sequential area', 7: 'Trilinear', 8: 'Color sequential linear',
  },
  0xa300: { 1: 'Film Scanner', 2: 'Reflection Print Scanner', 3: 'Digital Camera' },
  0xa301: { 1: 'Directly photographed' },
  0xa401: { 0: 'Normal', 1: 'Custom', 2: 'HDR (no original saved)', 3: 'HDR (original saved)', 4: 'Original (for HDR)', 6: 'Panorama', 7: 'Portrait HDR', 8: 'Portrait' },
  0xa402: { 0: 'Auto', 1: 'Manual', 2: 'Auto bracket' },
  0xa403: { 0: 'Auto', 1: 'Manual' },
  0xa406: { 0: 'Standard', 1: 'Landscape', 2: 'Portrait', 3: 'Night', 4: 'Other' },
  0xa407: { 0: 'None', 1: 'Low gain up', 2: 'High gain up', 3: 'Low gain down', 4: 'High gain down' },
  0xa408: { 0: 'Normal', 1: 'Low', 2: 'High' },
  0xa409: { 0: 'Normal', 1: 'Low', 2: 'High' },
  0xa40a: { 0: 'Normal', 1: 'Soft', 2: 'Hard' },
  0xa40c: { 0: 'Unknown', 1: 'Macro', 2: 'Close', 3: 'Distant' },
  0x8830: {
    0: 'Unknown', 1: 'Standard Output Sensitivity', 2: 'Recommended Exposure Index', 3: 'ISO Speed',
    4: 'SOS and REI', 5: 'SOS and ISOSpeed', 6: 'REI and ISOSpeed', 7: 'SOS, REI and ISOSpeed',
  },
  0xa460: { 0: 'Unknown', 1: 'Not a Composite Image', 2: 'General Composite Image', 3: 'Composite Image Captured While Shooting' },
};

const GPS_ENUMS: Record<number, Record<number, string>> = {
  5: { 0: 'Above sea level', 1: 'Below sea level' },
  10: { 2: '2-dimensional', 3: '3-dimensional' },
  30: { 0: 'No correction', 1: 'Differential corrected' },
};

const TABLE_EXIF: Record<number, string> = { ...TAGS_TIFF, ...TAGS_EXIF };
const TABLE_TIFF: Record<number, string> = { ...TAGS_EXIF, ...TAGS_TIFF };

const TYPE_SIZE: Array<number> = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];
const BIG_TAGS = new Set([0x02bc, 0x83bb, 0x8649, 0x8773, 0xc634]);
const HIDDEN_TAGS = new Set([0x8769, 0x8825, 0xa005, 0x014a, 0x0111, 0x0117, 0x0144, 0x0145, 0x015b, 0x0201, 0x0202, 0xea1c]);

// ---------------------------------------------------------------------------
// Value decoding
// ---------------------------------------------------------------------------

function decodeValue(type: number, count: number, b: Uint8Array, le: boolean): ExifValue {
  const v: ExifValue = { type, count, nums: [], rats: [], str: '', bytes: null };
  const lim = Math.min(count, 512);
  switch (type) {
    case 1:
    case 7:
      v.bytes = b.subarray(0, count);
      for (let i = 0; i < lim; i++) v.nums.push(b[i] ?? 0);
      break;
    case 6:
      v.bytes = b.subarray(0, count);
      for (let i = 0; i < lim; i++) v.nums.push(((b[i] ?? 0) << 24) >> 24);
      break;
    case 2: {
      let end = count;
      while (end > 0 && (b[end - 1] ?? 0) === 0) end--;
      v.bytes = b.subarray(0, count);
      v.str = textSmart(b.subarray(0, end)).replace(/\u0000/g, ' / ').trim();
      break;
    }
    case 3:
      for (let i = 0; i < lim; i++) v.nums.push(u16(b, i * 2, le));
      break;
    case 8:
      for (let i = 0; i < lim; i++) v.nums.push(i16(b, i * 2, le));
      break;
    case 4:
    case 13:
      for (let i = 0; i < lim; i++) v.nums.push(u32(b, i * 4, le));
      break;
    case 9:
      for (let i = 0; i < lim; i++) v.nums.push(i32(b, i * 4, le));
      break;
    case 5:
      for (let i = 0; i < lim; i++) {
        const n = u32(b, i * 8, le);
        const d = u32(b, i * 8 + 4, le);
        v.rats.push([n, d]);
        v.nums.push(d === 0 ? 0 : n / d);
      }
      break;
    case 10:
      for (let i = 0; i < lim; i++) {
        const n = i32(b, i * 8, le);
        const d = i32(b, i * 8 + 4, le);
        v.rats.push([n, d]);
        v.nums.push(d === 0 ? 0 : n / d);
      }
      break;
    case 11:
      for (let i = 0; i < lim; i++) v.nums.push(f32(b, i * 4, le));
      break;
    case 12:
      for (let i = 0; i < lim; i++) v.nums.push(f64(b, i * 8, le));
      break;
    default:
      break;
  }
  return v;
}

function firstNum(v: ExifValue): number | null {
  const n = v.nums[0];
  return n === undefined || !Number.isFinite(n) ? null : n;
}

function fmtShutter(x: number): string {
  if (!Number.isFinite(x) || x <= 0) return '0 s';
  if (x >= 1) return `${fmtNum(x, 1)} s`;
  const inv = 1 / x;
  const r = Math.round(inv);
  if (Math.abs(inv - r) / inv < 0.03 && r > 1) return `1/${r} s`;
  return `${fmtNum(x, 4)} s`;
}

function fmtFlash(n: number): string {
  const fired = (n & 1) !== 0;
  const ret = (n >> 1) & 3;
  const mode = (n >> 3) & 3;
  const noFn = (n & 0x20) !== 0;
  const red = (n & 0x40) !== 0;
  if (noFn) return 'No flash function';
  const parts: string[] = [];
  if (mode === 1) parts.push('On');
  else if (mode === 2) parts.push('Off');
  else if (mode === 3) parts.push('Auto');
  parts.push(fired ? 'Fired' : 'Did not fire');
  if (ret === 2) parts.push('return not detected');
  else if (ret === 3) parts.push('return detected');
  if (red) parts.push('red-eye reduction');
  return parts.join(', ');
}

function decodeUserComment(b: Uint8Array, le: boolean): string {
  if (b.length < 8) return '';
  const code = latin1(b, 0, 8).replace(/\u0000/g, ' ').trim();
  const body = b.subarray(8);
  let text: string;
  if (code === 'UNICODE') {
    const bom = body.length >= 2 ? ((body[0] ?? 0) << 8) | (body[1] ?? 0) : 0;
    if (bom === 0xfffe) text = utf16(body, true, 2);
    else if (bom === 0xfeff) text = utf16(body, false, 2);
    else text = utf16(body, le);
  } else if (code === 'JIS') {
    text = latin1(body);
  } else {
    text = textSmart(body);
  }
  return text.replace(/\u0000+$/g, '').trim();
}

function fmtDateTime(s: string): string {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}` : s;
}

function listNums(nums: number[], count: number, digits = 4): string {
  const shown = nums.slice(0, 16).map((n) => fmtNum(n, digits));
  return count > shown.length ? `${shown.join(', ')} … (${count} values)` : shown.join(', ');
}

function formatValue(tag: number, v: ExifValue, le: boolean, ifd: string): string {
  if (v.skipped) return `(${v.count} values, not read)`;
  if (ifd === 'gps') return formatGps(tag, v);
  if (ifd === 'interop') {
    if (tag === 2 && v.bytes) return latin1(v.bytes, 0, 4);
    return v.type === 2 ? v.str : listNums(v.nums, v.count);
  }
  const n = firstNum(v);
  const en = ENUMS[tag];
  if (en && n !== null && v.nums.length === 1) {
    const label = en[n];
    return label !== undefined ? label : String(n);
  }
  switch (tag) {
    case 0x829a:
      return n === null ? '' : fmtShutter(n);
    case 0x829d:
      return n === null ? '' : `f/${fmtNum(n, 1)}`;
    case 0x9201:
      return n === null ? '' : fmtShutter(Math.pow(2, -n));
    case 0x9202:
    case 0x9205:
      return n === null ? '' : `f/${fmtNum(Math.pow(2, n / 2), 1)}`;
    case 0x9204:
      return n === null ? '' : `${n > 0 ? '+' : ''}${fmtNum(n, 2)} EV`;
    case 0x9206:
      return n === null ? '' : n === 0xffffffff ? 'Infinity' : `${fmtNum(n, 2)} m`;
    case 0x920a:
      return n === null ? '' : `${fmtNum(n, 1)} mm`;
    case 0xa405:
      return n === null ? '' : `${n} mm`;
    case 0x9209:
      return n === null ? '' : fmtFlash(n);
    case 0x0132:
    case 0x9003:
    case 0x9004:
      return fmtDateTime(v.str);
    case 0x9286:
      return v.bytes ? decodeUserComment(v.bytes, le) : '';
    case 0x9c9b:
    case 0x9c9c:
    case 0x9c9d:
    case 0x9c9e:
    case 0x9c9f:
      return v.bytes ? utf16(v.bytes, true).replace(/\u0000+$/g, '') : '';
    case 0x9000:
    case 0xa000: {
      const s = v.bytes ? latin1(v.bytes, 0, 4) : '';
      return /^\d{4}$/.test(s) ? `${parseInt(s.slice(0, 2), 10)}.${s.slice(2)}` : s;
    }
    case 0x9101: {
      const names: Record<number, string> = { 0: '-', 1: 'Y', 2: 'Cb', 3: 'Cr', 4: 'R', 5: 'G', 6: 'B' };
      return v.nums.slice(0, 8).map((x) => names[x] ?? String(x)).join(', ');
    }
    case 0xa432: {
      const r = v.nums;
      if (r.length < 4) return listNums(r, v.count);
      const f = (x: number | undefined) => fmtNum(x ?? 0, 1);
      const focal = r[0] === r[1] ? `${f(r[0])} mm` : `${f(r[0])}-${f(r[1])} mm`;
      const ap = r[2] === r[3] ? `f/${f(r[2])}` : `f/${f(r[2])}-${f(r[3])}`;
      return `${focal} ${ap}`;
    }
    case 0x927c:
      return `${v.count} bytes (not decoded)`;
    case 0xa302:
    case 0x8828:
      return `${v.count} bytes`;
    case 0x02bc:
    case 0x83bb:
    case 0x8649:
    case 0x8773:
    case 0xc634:
    case 0xc4a5:
      return `${v.count} bytes`;
    case 0x8827:
      return listNums(v.nums, v.count, 0);
    default:
      break;
  }
  if (v.type === 2) return v.str;
  if (v.type === 5 || v.type === 10) {
    if (v.rats.length === 0) return '';
    return listNums(v.nums, v.count, 5);
  }
  if (v.type === 7 || v.type === 1 || v.type === 6) {
    const b = v.bytes;
    if (b && v.count > 16) {
      return `(${v.count} bytes)`;
    }
    if (v.type === 7 && b) {
      const printable = b.length > 0 && Array.from(b).every((c) => c >= 32 && c < 127);
      return printable ? latin1(b) : toHex(b, ' ');
    }
    return listNums(v.nums, v.count, 0);
  }
  return listNums(v.nums, v.count, 5);
}

function formatGps(tag: number, v: ExifValue): string {
  const n = firstNum(v);
  const en = GPS_ENUMS[tag];
  if (en && n !== null) return en[n] ?? String(n);
  switch (tag) {
    case 0:
      return v.nums.join('.');
    case 1:
    case 3:
    case 19:
    case 21:
      return v.str;
    case 2:
    case 4:
    case 20:
    case 22:
      return dmsString(v.nums, '');
    case 6:
      return n === null ? '' : `${fmtNum(n, 2)} m`;
    case 7: {
      const [h, m, s] = v.nums;
      if (h === undefined) return '';
      return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(m ?? 0)).padStart(2, '0')}:${fmtNum(s ?? 0, 2).padStart(2, '0')} UTC`;
    }
    case 29:
      return v.str.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    case 13:
      return n === null ? '' : fmtNum(n, 2);
    case 12:
      return { K: 'km/h', M: 'mph', N: 'knots' }[v.str] ?? v.str;
    case 14:
    case 16:
    case 23:
      return { T: 'True North', M: 'Magnetic North' }[v.str] ?? v.str;
    case 9:
      return { A: 'Measurement active', V: 'Measurement void' }[v.str] ?? v.str;
    case 17:
    case 15:
    case 24:
      return n === null ? '' : `${fmtNum(n, 2)}°`;
    case 27:
    case 28:
      return v.bytes ? decodeUserComment(v.bytes, false) : v.str;
    default:
      return v.type === 2 ? v.str : listNums(v.nums, v.count, 5);
  }
}

function dmsString(nums: number[], ref: string): string {
  const d = nums[0];
  if (d === undefined) return '';
  const m = nums[1] ?? 0;
  const s = nums[2] ?? 0;
  const body = `${fmtNum(d, 0)}° ${fmtNum(m, 0)}′ ${fmtNum(s, 2)}″`;
  return ref ? `${body} ${ref}` : body;
}

function dmsToDecimal(nums: number[], ref: string): number | null {
  const d = nums[0];
  if (d === undefined || !Number.isFinite(d)) return null;
  let dec = Math.abs(d) + (nums[1] ?? 0) / 60 + (nums[2] ?? 0) / 3600;
  if (d < 0) dec = -dec;
  if (ref === 'S' || ref === 'W') dec = -Math.abs(dec);
  return dec;
}

export function osmLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=16/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}

function buildGps(entries: ExifEntry[]): GpsInfo | null {
  const get = (tag: number) => entries.find((e) => e.tag === tag)?.raw;
  const latV = get(2);
  const lonV = get(4);
  if (!latV || !lonV) return null;
  const latRef = get(1)?.str ?? 'N';
  const lonRef = get(3)?.str ?? 'E';
  const lat = dmsToDecimal(latV.nums, latRef);
  const lon = dmsToDecimal(lonV.nums, lonRef);
  const altV = get(6);
  let alt: number | null = altV ? firstNum(altV) : null;
  if (alt !== null && (get(5)?.nums[0] ?? 0) === 1) alt = -alt;
  const valid = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return {
    lat: valid ? lat : null,
    lon: valid ? lon : null,
    alt,
    latText: dmsString(latV.nums, latRef),
    lonText: dmsString(lonV.nums, lonRef),
    link: valid && !(lat === 0 && lon === 0) ? osmLink(lat, lon) : null,
  };
}

// ---------------------------------------------------------------------------
// IFD walker
// ---------------------------------------------------------------------------

interface RawEntry {
  tag: number;
  v: ExifValue;
}

async function readIfd(
  rd: Reader,
  le: boolean,
  off: number
): Promise<{ entries: RawEntry[]; next: number }> {
  const head = await rd.read(off, 2);
  if (head.length < 2) throw new Error(`IFD offset ${off} is outside the data`);
  const n = u16(head, 0, le);
  if (n === 0 || n > 3000) return { entries: [], next: 0 };
  const body = await rd.read(off + 2, n * 12 + 4);
  const entries: RawEntry[] = [];
  const count = Math.min(n, Math.floor((body.length - 0) / 12));
  for (let i = 0; i < count; i++) {
    const e = i * 12;
    const tag = u16(body, e, le);
    const type = u16(body, e + 2, le);
    const cnt = u32(body, e + 4, le);
    const size = TYPE_SIZE[type];
    if (!size || cnt === 0) continue;
    const total = size * cnt;
    if (!Number.isFinite(total)) continue;
    let data: Uint8Array;
    if (total <= 4) {
      data = body.subarray(e + 8, e + 8 + total);
    } else {
      const valOff = u32(body, e + 8, le);
      const cap = BIG_TAGS.has(tag) ? 16 * 1024 * 1024 : tag === 0x927c ? 0 : 128 * 1024;
      if (total > cap) {
        entries.push({ tag, v: { type, count: cnt, nums: [], rats: [], str: '', bytes: null, skipped: true } });
        // keep thumbnails / maker note sizes discoverable through count
        continue;
      }
      data = await rd.read(valOff, total);
      if (data.length < total) continue;
    }
    const v = decodeValue(type, cnt, data, le);
    if (BIG_TAGS.has(tag)) v.bytes = data;
    entries.push({ tag, v });
  }
  const next = u32(body, n * 12, le);
  return { entries, next };
}

const IFD_TITLES: Record<string, string> = {
  ifd0: 'Main image (IFD0)',
  ifd1: 'Thumbnail (IFD1)',
  exif: 'Camera & capture (Exif IFD)',
  gps: 'GPS',
  interop: 'Interoperability',
};

function toEntry(ifd: string, raw: RawEntry, le: boolean): ExifEntry {
  const table = ifd === 'gps' ? TAGS_GPS : ifd === 'interop' ? TAGS_INTEROP : ifd === 'exif' ? TABLE_EXIF : TABLE_TIFF;
  const name = table[raw.tag] ?? `Tag 0x${raw.tag.toString(16).padStart(4, '0')}`;
  let value = '';
  try {
    value = formatValue(raw.tag, raw.v, le, ifd);
  } catch {
    value = '';
  }
  return { tag: raw.tag, name, value: clean(value), raw: raw.v };
}

export interface TiffOptions {
  /** Follow the IFD0 "next IFD" chain (multi-page TIFF) instead of treating IFD1 as a thumbnail. */
  pages?: boolean;
  maxIfds?: number;
}

export async function readTiff(rd: Reader, opts: TiffOptions = {}): Promise<ExifData> {
  const hdr = await rd.read(0, 8);
  if (hdr.length < 8) throw new Error('TIFF header is truncated');
  const bo = (hdr[0] ?? 0) === 0x49 && (hdr[1] ?? 0) === 0x49 ? 'II' : (hdr[0] ?? 0) === 0x4d && (hdr[1] ?? 0) === 0x4d ? 'MM' : '';
  if (!bo) throw new Error('missing TIFF byte-order mark (II or MM)');
  const le = bo === 'II';
  const out: ExifData = {
    le,
    ifds: [],
    thumbnail: null,
    thumbnailLength: null,
    pages: 0,
    makerNoteBytes: null,
    gps: null,
    embedded: {},
  };
  const visited = new Set<number>();
  const maxIfds = opts.maxIfds ?? 64;
  const queue: Array<{ id: string; off: number; kind: 'ifd0' | 'ifd1' | 'exif' | 'gps' | 'interop' | 'sub' | 'page'; title?: string }> = [
    { id: 'ifd0', off: u32(hdr, 4, le), kind: 'ifd0' },
  ];
  let pageNo = 1;
  let errors = 0;
  // Multi-page TIFF: parse the first few pages fully, merely count the rest.
  const walkPages = async (start: number): Promise<void> => {
    let next = start;
    let guard = 0;
    while (next > 0 && !visited.has(next) && guard < 5000) {
      guard++;
      pageNo++;
      out.pages = pageNo;
      if (pageNo <= 4) {
        queue.push({ id: `page${pageNo}`, off: next, kind: 'page', title: `Page ${pageNo}` });
        return;
      }
      visited.add(next);
      const h = await rd.read(next, 2);
      if (h.length < 2) return;
      const cnt = u16(h, 0, le);
      const tail = await rd.read(next + 2 + cnt * 12, 4);
      if (tail.length < 4) return;
      next = u32(tail, 0, le);
    }
  };
  while (queue.length > 0 && out.ifds.length < maxIfds) {
    const job = queue.shift();
    if (!job) break;
    if (job.off < 8 || visited.has(job.off)) continue;
    visited.add(job.off);
    let res: { entries: RawEntry[]; next: number };
    try {
      res = await readIfd(rd, le, job.off);
    } catch (e) {
      if (job.kind === 'ifd0') throw e;
      errors++;
      continue;
    }
    const ifdKind = job.kind === 'sub' || job.kind === 'page' ? 'ifd0' : job.kind;
    const entries = res.entries.map((r) => toEntry(ifdKind === 'ifd1' ? 'ifd1' : ifdKind, r, le));
    out.ifds.push({ id: job.id, title: job.title ?? IFD_TITLES[job.id] ?? job.id, entries });
    for (const r of res.entries) {
      const first = r.v.nums[0];
      if (r.tag === 0x8769 && ifdKind === 'ifd0' && first !== undefined) queue.push({ id: 'exif', off: first, kind: 'exif' });
      else if (r.tag === 0x8825 && ifdKind === 'ifd0' && first !== undefined) queue.push({ id: 'gps', off: first, kind: 'gps' });
      else if (r.tag === 0xa005 && ifdKind === 'exif' && first !== undefined) queue.push({ id: 'interop', off: first, kind: 'interop' });
      else if (r.tag === 0x014a && !r.v.skipped) r.v.nums.slice(0, 8).forEach((o, i) => queue.push({ id: `sub${job.id}-${i}`, off: o, kind: 'sub', title: `Sub-image ${i + 1} of ${job.id === 'ifd0' ? 'main image' : job.id}` }));
      else if (r.tag === 0x927c) out.makerNoteBytes = r.v.count;
      else if (r.tag === 0x02bc && r.v.bytes) out.embedded.xmp = r.v.bytes;
      else if (r.tag === 0x83bb && r.v.bytes) out.embedded.iptc = r.v.bytes;
      else if (r.tag === 0x8649 && r.v.bytes) out.embedded.photoshop = r.v.bytes;
      else if (r.tag === 0x8773 && r.v.bytes) out.embedded.icc = r.v.bytes;
    }
    if (job.id === 'ifd0') out.pages = 1;
    if (job.kind === 'ifd1') {
      const offE = res.entries.find((r) => r.tag === 0x0201);
      const lenE = res.entries.find((r) => r.tag === 0x0202);
      const tOff = offE?.v.nums[0];
      const tLen = lenE?.v.nums[0];
      if (tOff !== undefined && tLen !== undefined && tLen > 0) {
        out.thumbnailLength = tLen;
        if (tLen <= 4 * 1024 * 1024) {
          const t = await rd.read(tOff, tLen);
          if (t.length === tLen && imageMime(t) === 'image/jpeg') out.thumbnail = t.slice();
        }
      }
    }
    if (job.id === 'gps') out.gps = buildGps(entries);
    if (res.next > 0) {
      if (job.kind === 'ifd0' && !opts.pages) queue.push({ id: 'ifd1', off: res.next, kind: 'ifd1' });
      else if (opts.pages && (job.kind === 'ifd0' || job.kind === 'page')) await walkPages(res.next);
    }
    if (errors > 8) break;
  }
  if (out.pages === 0) out.pages = 1;
  return out;
}

/** Convenience: parse EXIF data held fully in memory (`data` starts at the TIFF header). */
export async function readExifBytes(data: Uint8Array): Promise<ExifData> {
  return readTiff(new MemReader(data));
}

export function findEntry(d: ExifData, ifd: string, tag: number): ExifEntry | undefined {
  return d.ifds.find((i) => i.id === ifd)?.entries.find((e) => e.tag === tag);
}

export function exifStr(d: ExifData, ifd: string, tag: number): string {
  const e = findEntry(d, ifd, tag);
  return e ? e.value : '';
}

// ---------------------------------------------------------------------------
// Emit sections + privacy findings
// ---------------------------------------------------------------------------

const FINDING_TAGS: Array<{ ifd: string; tag: number; cat: 'person' | 'device' | 'software' | 'company' | 'comments'; label: string }> = [
  { ifd: 'ifd0', tag: 0x010f, cat: 'device', label: 'Camera make' },
  { ifd: 'ifd0', tag: 0x0110, cat: 'device', label: 'Camera model' },
  { ifd: 'ifd0', tag: 0x0131, cat: 'software', label: 'Software' },
  { ifd: 'ifd0', tag: 0x013b, cat: 'person', label: 'Artist' },
  { ifd: 'ifd0', tag: 0x013c, cat: 'device', label: 'Host computer' },
  { ifd: 'ifd0', tag: 0x9c9d, cat: 'person', label: 'Author (Windows XP tag)' },
  { ifd: 'ifd0', tag: 0xc62f, cat: 'device', label: 'Camera serial number' },
  { ifd: 'ifd0', tag: 0xc614, cat: 'device', label: 'Unique camera model' },
  { ifd: 'ifd0', tag: 0xc68b, cat: 'device', label: 'Original raw file name' },
  { ifd: 'ifd0', tag: 0x010e, cat: 'comments', label: 'Image description' },
  { ifd: 'exif', tag: 0xa430, cat: 'person', label: 'Camera owner name' },
  { ifd: 'exif', tag: 0xa431, cat: 'device', label: 'Body serial number' },
  { ifd: 'exif', tag: 0xa435, cat: 'device', label: 'Lens serial number' },
  { ifd: 'exif', tag: 0xa434, cat: 'device', label: 'Lens model' },
  { ifd: 'exif', tag: 0x9286, cat: 'comments', label: 'User comment' },
  { ifd: 'exif', tag: 0xa420, cat: 'device', label: 'Image unique ID' },
];

export function emitExif(c: Collector, d: ExifData, opts: { prefix?: string } = {}): void {
  const prefix = opts.prefix ?? 'EXIF';
  for (const ifd of d.ifds) {
    if (ifd.id === 'gps') continue;
    const sec = c.section(`exif-${ifd.id}`, `${prefix} · ${ifd.title}`, ifd.id.startsWith('page') || ifd.id.startsWith('sub') ? { collapsed: true } : undefined);
    for (const e of ifd.entries) {
      if (HIDDEN_TAGS.has(e.tag) && !(ifd.id === 'ifd1' && (e.tag === 0x0201 || e.tag === 0x0202))) continue;
      if (e.tag === 0x0201 || e.tag === 0x0202) continue;
      if (!e.value) continue;
      c.row(sec, e.name, e.value);
    }
    if (ifd.id === 'ifd1') {
      if (d.thumbnail) c.row(sec, 'Embedded JPEG thumbnail', `${d.thumbnail.length.toLocaleString('en-US')} bytes`);
      else if (d.thumbnailLength) c.row(sec, 'Embedded JPEG thumbnail', `${d.thumbnailLength.toLocaleString('en-US')} bytes (not readable)`);
    }
  }
  const gps = d.ifds.find((i) => i.id === 'gps');
  if (gps && gps.entries.length > 0) {
    const sec = c.section('exif-gps', 'GPS location');
    if (d.gps) {
      const g = d.gps;
      c.row(sec, 'Latitude', g.latText);
      c.row(sec, 'Longitude', g.lonText);
      if (g.lat !== null && g.lon !== null) {
        c.row(sec, 'Decimal coordinates', `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`);
        c.row(sec, 'Map link (OpenStreetMap)', g.link ?? undefined);
        if (!(g.lat === 0 && g.lon === 0)) c.find('gps', 'GPS coordinates', `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`);
      }
      if (g.alt !== null) c.row(sec, 'Altitude', `${fmtNum(g.alt, 2)} m ${g.alt < 0 ? 'below' : 'above'} sea level`);
    }
    for (const e of gps.entries) {
      if (e.tag === 1 || e.tag === 2 || e.tag === 3 || e.tag === 4 || e.tag === 5 || e.tag === 6) continue;
      if (e.value) c.row(sec, e.name, e.value);
    }
    if (!d.gps) {
      for (const e of gps.entries) if (e.value) c.row(sec, e.name, e.value);
    }
  }
  for (const f of FINDING_TAGS) {
    const v = exifStr(d, f.ifd, f.tag);
    if (v) c.find(f.cat, f.label, v);
  }
  if (d.thumbnail) {
    c.find('thumbnail', 'Embedded EXIF thumbnail', `${d.thumbnail.length.toLocaleString('en-US')} bytes (may show the uncropped original)`);
    c.preview('Embedded EXIF thumbnail', 'image/jpeg', d.thumbnail);
  }
  if (d.makerNoteBytes) {
    c.note(`MakerNote present (${d.makerNoteBytes.toLocaleString('en-US')} bytes, vendor-specific, not decoded). It can hold serial numbers.`);
  }
}
