/** ZIP-based documents (Office Open XML, OpenDocument, EPUB, JAR…), ZIP itself, and legacy OLE2 Office files. */
import {
  type Ctx,
  clean,
  fmtBytes,
  fmtNum,
  isoFromMs,
  latin1,
  u16,
  u32,
  u64,
  u8,
  utf16,
  utf8,
} from './util';
import { attr, localName, parseXml, xChildren, xFind, xFindAll, xText, type XNode } from './xml';
import { HOST_OS, ZIP_METHODS, dosToIso, extractZipEntry, readZipDirectory, type ZipDir, type ZipEntry } from './zip';
import type { DetectedType } from './types';

const OFFICE_MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

interface OfficeKind {
  ext: string;
  name: string;
  family: 'docx' | 'xlsx' | 'pptx';
  macros: boolean;
}

function officeKind(contentTypes: string, names: Set<string>): OfficeKind | null {
  const ct = contentTypes;
  const has = (s: string) => ct.includes(s);
  const mk = (ext: string, name: string, family: OfficeKind['family'], macros = false): OfficeKind => ({ ext, name, family, macros });
  if (has('wordprocessingml.document.main+xml')) return mk('docx', 'Word document (DOCX)', 'docx');
  if (has('wordprocessingml.template.main+xml')) return mk('dotx', 'Word template (DOTX)', 'docx');
  if (has('wordprocessingml.document.macroEnabled.main+xml')) return mk('docm', 'Word macro-enabled document (DOCM)', 'docx', true);
  if (has('wordprocessingml.template.macroEnabledTemplate.main+xml')) return mk('dotm', 'Word macro-enabled template (DOTM)', 'docx', true);
  if (has('spreadsheetml.sheet.main+xml')) return mk('xlsx', 'Excel workbook (XLSX)', 'xlsx');
  if (has('spreadsheetml.template.main+xml')) return mk('xltx', 'Excel template (XLTX)', 'xlsx');
  if (has('sheet.macroEnabled.main+xml')) return mk('xlsm', 'Excel macro-enabled workbook (XLSM)', 'xlsx', true);
  if (has('ms-excel.sheet.binary.macroEnabled.main')) return mk('xlsb', 'Excel binary workbook (XLSB)', 'xlsx', true);
  if (has('ms-excel.addin.macroEnabled.main+xml')) return mk('xlam', 'Excel add-in (XLAM)', 'xlsx', true);
  if (has('presentationml.presentation.main+xml')) return mk('pptx', 'PowerPoint presentation (PPTX)', 'pptx');
  if (has('presentationml.slideshow.main+xml')) return mk('ppsx', 'PowerPoint slide show (PPSX)', 'pptx');
  if (has('presentationml.template.main+xml')) return mk('potx', 'PowerPoint template (POTX)', 'pptx');
  if (has('presentation.macroEnabled.main+xml')) return mk('pptm', 'PowerPoint macro-enabled presentation (PPTM)', 'pptx', true);
  if (names.has('word/document.xml')) return mk('docx', 'Word document (DOCX)', 'docx');
  if (names.has('xl/workbook.xml')) return mk('xlsx', 'Excel workbook (XLSX)', 'xlsx');
  if (names.has('ppt/presentation.xml')) return mk('pptx', 'PowerPoint presentation (PPTX)', 'pptx');
  return null;
}

const ODF_KINDS: Record<string, { ext: string; name: string }> = {
  'application/vnd.oasis.opendocument.text': { ext: 'odt', name: 'OpenDocument text (ODT)' },
  'application/vnd.oasis.opendocument.text-template': { ext: 'ott', name: 'OpenDocument text template (OTT)' },
  'application/vnd.oasis.opendocument.spreadsheet': { ext: 'ods', name: 'OpenDocument spreadsheet (ODS)' },
  'application/vnd.oasis.opendocument.spreadsheet-template': { ext: 'ots', name: 'OpenDocument spreadsheet template (OTS)' },
  'application/vnd.oasis.opendocument.presentation': { ext: 'odp', name: 'OpenDocument presentation (ODP)' },
  'application/vnd.oasis.opendocument.presentation-template': { ext: 'otp', name: 'OpenDocument presentation template (OTP)' },
  'application/vnd.oasis.opendocument.graphics': { ext: 'odg', name: 'OpenDocument drawing (ODG)' },
  'application/vnd.oasis.opendocument.formula': { ext: 'odf', name: 'OpenDocument formula (ODF)' },
  'application/vnd.oasis.opendocument.chart': { ext: 'odc', name: 'OpenDocument chart (ODC)' },
  'application/vnd.oasis.opendocument.database': { ext: 'odb', name: 'OpenDocument database (ODB)' },
};

function looksLikePath(s: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(s) || /^\\\\/.test(s) || /^file:\/\//i.test(s) || /^\/(Users|home|var|tmp|private|mnt|Volumes)\//.test(s) || /\\Users\\/i.test(s);
}

class ZipView {
  names: Set<string>;
  byName = new Map<string, ZipEntry>();
  constructor(readonly c: Ctx, readonly dir: ZipDir) {
    this.names = new Set(dir.entries.map((e) => e.name));
    for (const e of dir.entries) if (!this.byName.has(e.name)) this.byName.set(e.name, e);
  }
  has(name: string): boolean {
    return this.names.has(name);
  }
  list(prefix: string): ZipEntry[] {
    return this.dir.entries.filter((e) => e.name.startsWith(prefix) && !e.isDir);
  }
  async bytes(name: string, max = 32 * 1024 * 1024): Promise<Uint8Array | null> {
    const e = this.byName.get(name);
    if (!e) return null;
    return extractZipEntry(this.c.rd, this.dir, e, max);
  }
  async text(name: string, max = 32 * 1024 * 1024): Promise<string | null> {
    const b = await this.bytes(name, max);
    if (!b) return null;
    if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return utf16(b, true, 2);
    if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return utf16(b, false, 2);
    return utf8(b).replace(/^﻿/, '');
  }
  async xml(name: string, max?: number): Promise<XNode | null> {
    const t = await this.text(name, max);
    return t === null ? null : parseXml(t);
  }
}

// ---------------------------------------------------------------------------
// ZIP container section + dispatcher
// ---------------------------------------------------------------------------

export async function parseZip(c: Ctx): Promise<void> {
  const { out, rd } = c;
  const dir = await readZipDirectory(rd);
  const view = new ZipView(c, dir);
  const entries = dir.entries;
  const sec = out.section('zip', 'ZIP container');
  const files = entries.filter((e) => !e.isDir);
  let comp = 0;
  let uncomp = 0;
  const methods = new Map<number, number>();
  let oldest: string | null = null;
  let newest: string | null = null;
  const hosts = new Map<number, number>();
  for (const e of entries) {
    comp += e.compSize;
    uncomp += e.size;
    methods.set(e.method, (methods.get(e.method) ?? 0) + 1);
    hosts.set(e.madeBy >> 8, (hosts.get(e.madeBy >> 8) ?? 0) + 1);
    const d = dosToIso(e.dosDate, e.dosTime);
    if (d && (!oldest || d < oldest)) oldest = d;
    if (d && (!newest || d > newest)) newest = d;
  }
  out.row(sec, 'Entries', `${entries.length.toLocaleString('en-US')} (${files.length.toLocaleString('en-US')} files, ${entries.length - files.length} folders)${dir.truncated ? ' · listing truncated' : ''}`);
  out.row(sec, 'Compressed size', `${comp.toLocaleString('en-US')} bytes (${fmtBytes(comp)})`);
  out.row(sec, 'Uncompressed size', `${uncomp.toLocaleString('en-US')} bytes (${fmtBytes(uncomp)})`);
  if (uncomp > 0 && comp > 0) out.row(sec, 'Compression ratio', `${fmtNum(uncomp / comp, 2)}:1`);
  out.row(sec, 'Compression methods', Array.from(methods).map(([m, n]) => `${ZIP_METHODS[m] ?? `method ${m}`} ×${n}`).join(', '));
  out.row(sec, 'Created on (host OS)', Array.from(hosts).map(([h, n]) => `${HOST_OS[h] ?? `OS ${h}`}${hosts.size > 1 ? ` ×${n}` : ''}`).join(', '));
  out.row(sec, 'Oldest entry date', oldest ?? undefined);
  out.row(sec, 'Newest entry date', newest ?? undefined);
  if (dir.comment) {
    out.row(sec, 'Archive comment', dir.comment);
    out.find('comments', 'ZIP archive comment', dir.comment);
  }
  const enc = entries.filter((e) => e.encrypted);
  if (enc.length) out.row(sec, 'Encrypted entries', `${enc.length}${enc.some((e) => e.aes) ? ' (AES)' : ' (ZipCrypto)'}`);
  out.row(sec, 'ZIP64', dir.zip64 ? 'yes' : 'no');
  if (dir.prefix > 0) out.row(sec, 'Data before archive', `${dir.prefix.toLocaleString('en-US')} bytes (self-extracting stub or prepended data)`);
  const commented = entries.filter((e) => e.comment);
  if (commented.length) out.row(sec, 'Entries with comments', String(commented.length));

  const pathHits = entries.filter((e) => looksLikePath(e.name) || /(^|\/)(Users|home)\/[^/]+\//.test(e.name)).slice(0, 5);
  if (pathHits.length) out.find('filename', 'Entry names contain user/absolute paths', pathHits.map((e) => e.name).join(', '));

  // --- identify the container flavour
  let handled = false;
  const names = view.names;
  const mimetype = names.has('mimetype') ? (await view.text('mimetype', 4096).catch(() => null))?.trim() ?? null : null;
  const contentTypes = names.has('[Content_Types].xml') ? await view.text('[Content_Types].xml', 2 * 1024 * 1024).catch(() => null) : null;
  const office = contentTypes !== null ? officeKind(contentTypes, names) : null;
  if (office) {
    handled = true;
    c.refine({ id: 'zip', name: office.name, mime: OFFICE_MIME[office.family] ?? 'application/zip', exts: [office.ext, 'zip', office.family, office.family.replace('x', 'm')], kind: 'document' });
    await out.attempt('Office document properties', () => parseOffice(c, view, office));
  } else if (mimetype && mimetype.startsWith('application/vnd.oasis.opendocument')) {
    handled = true;
    const k = ODF_KINDS[mimetype];
    c.refine({ id: 'zip', name: k?.name ?? `OpenDocument (${mimetype})`, mime: mimetype, exts: [k?.ext ?? 'odt', 'zip'], kind: 'document' });
    await out.attempt('OpenDocument properties', () => parseOdf(c, view));
  } else if (mimetype === 'application/epub+zip') {
    handled = true;
    c.refine({ id: 'zip', name: 'EPUB e-book', mime: 'application/epub+zip', exts: ['epub', 'zip'], kind: 'document' });
    await out.attempt('EPUB package', () => parseEpub(c, view));
  } else if (names.has('META-INF/MANIFEST.MF')) {
    handled = true;
    const apk = names.has('AndroidManifest.xml') && names.has('classes.dex');
    c.refine({ id: 'zip', name: apk ? 'Android package (APK)' : 'Java archive (JAR)', mime: apk ? 'application/vnd.android.package-archive' : 'application/java-archive', exts: apk ? ['apk', 'zip', 'xapk'] : ['jar', 'war', 'ear', 'zip', 'aar'], kind: 'archive' });
    await out.attempt('JAR manifest', () => parseJar(c, view));
  } else if (names.has('AndroidManifest.xml') && names.has('classes.dex')) {
    handled = true;
    c.refine({ id: 'zip', name: 'Android package (APK)', mime: 'application/vnd.android.package-archive', exts: ['apk', 'zip', 'xapk'], kind: 'archive' });
    out.note('Android APK detected. AndroidManifest.xml is stored as binary XML and is not decoded here.');
  } else {
    const wheel = entries.find((e) => /\.dist-info\/METADATA$/.test(e.name));
    if (wheel) {
      handled = true;
      c.refine({ id: 'zip', name: 'Python wheel', mime: 'application/zip', exts: ['whl', 'zip'], kind: 'archive' });
      await out.attempt('wheel METADATA', () => parseWheel(c, view, wheel.name));
    }
  }
  if (!handled && names.has('doc.kml')) {
    c.refine({ id: 'zip', name: 'KMZ (zipped KML)', mime: 'application/vnd.google-earth.kmz', exts: ['kmz', 'zip'], kind: 'archive' });
  }
  if (!handled && names.has('manifest.json') && names.has('_locales/en/messages.json')) {
    c.refine({ id: 'zip', name: 'Browser extension package', mime: 'application/zip', exts: ['zip', 'xpi', 'crx'], kind: 'archive' });
  }

  // --- contents listing
  const listSec = out.section('zip-entries', 'Archive contents', { collapsed: handled });
  if (handled) {
    sec.collapsed = true;
    // put the generic container details after the document-specific sections
    out.sections = [...out.sections.filter((s) => s !== sec && s !== listSec), sec, listSec];
  }
  const shown = entries.slice(0, 60);
  for (const e of shown) {
    const when = dosToIso(e.dosDate, e.dosTime) ?? '';
    out.row(listSec, e.name, e.isDir ? `folder · ${when}` : `${e.size.toLocaleString('en-US')} bytes · ${ZIP_METHODS[e.method] ?? `method ${e.method}`}${e.encrypted ? ' · encrypted' : ''} · ${when}`);
  }
  if (entries.length > shown.length) listSec.note = `Showing the first ${shown.length} of ${entries.length.toLocaleString('en-US')} entries.`;
}

// ---------------------------------------------------------------------------
// Office Open XML
// ---------------------------------------------------------------------------

function childText(node: XNode | null, name: string): string {
  if (!node) return '';
  for (const c of xChildren(node, name)) {
    const t = xText(c).trim();
    if (t) return t;
  }
  return '';
}

async function parseOffice(c: Ctx, v: ZipView, kind: OfficeKind): Promise<void> {
  const { out } = c;
  const sec = out.section('office-core', 'Document properties (core)');
  const core = await v.xml('docProps/core.xml', 2 * 1024 * 1024).catch(() => null);
  if (core) {
    const r = (label: string, name: string) => out.row(sec, label, childText(core, name));
    r('Title', 'title');
    r('Subject', 'subject');
    r('Author (creator)', 'creator');
    r('Keywords', 'keywords');
    r('Description / comments', 'description');
    r('Last modified by', 'lastModifiedBy');
    r('Revision', 'revision');
    r('Created', 'created');
    r('Modified', 'modified');
    r('Last printed', 'lastPrinted');
    r('Category', 'category');
    r('Content status', 'contentStatus');
    r('Language', 'language');
    r('Version', 'version');
    r('Identifier', 'identifier');
    const author = childText(core, 'creator');
    const lmb = childText(core, 'lastModifiedBy');
    if (author) out.find('person', 'Author', author);
    if (lmb) out.find('person', 'Last modified by', lmb);
    const desc = childText(core, 'description');
    if (desc) out.find('comments', 'Description / comments property', desc.length > 200 ? `${desc.slice(0, 200)}…` : desc);
    const rev = childText(core, 'revision');
    if (rev && /^\d+$/.test(rev) && parseInt(rev, 10) > 1) out.find('editing', 'Revision number', `${rev} (document saved many times)`);
  } else {
    out.note('No docProps/core.xml: author and date properties were stripped or never written.');
  }

  const app = await v.xml('docProps/app.xml', 2 * 1024 * 1024).catch(() => null);
  if (app) {
    const asec = out.section('office-app', 'Application properties');
    const r = (label: string, name: string) => out.row(asec, label, childText(app, name));
    const appName = childText(app, 'Application');
    const appVer = childText(app, 'AppVersion');
    if (appName) out.row(asec, 'Application', appVer ? `${appName} ${appVer}` : appName);
    r('Company', 'Company');
    r('Manager', 'Manager');
    const tt = childText(app, 'TotalTime');
    if (tt) out.row(asec, 'Total editing time', /^\d+$/.test(tt) ? `${parseInt(tt, 10).toLocaleString('en-US')} minutes` : tt);
    r('Pages', 'Pages');
    r('Words', 'Words');
    r('Characters', 'Characters');
    r('Characters (with spaces)', 'CharactersWithSpaces');
    r('Lines', 'Lines');
    r('Paragraphs', 'Paragraphs');
    r('Slides', 'Slides');
    r('Notes', 'Notes');
    r('Hidden slides', 'HiddenSlides');
    r('Template', 'Template');
    r('Presentation format', 'PresentationFormat');
    const sec2 = childText(app, 'DocSecurity');
    if (sec2 && sec2 !== '0') out.row(asec, 'Document security', ({ '1': 'password protected', '2': 'read-only recommended', '4': 'read-only enforced', '8': 'locked for annotations' } as Record<string, string>)[sec2] ?? sec2);
    const parts = xFind(app, 'TitlesOfParts');
    if (parts) {
      const titles = xFindAll(parts, 'lpstr').map((n) => xText(n).trim()).filter(Boolean);
      if (titles.length > 0) out.row(asec, kind.family === 'xlsx' ? 'Sheet / part names' : 'Parts', titles.slice(0, 40).join(', '));
    }
    const company = childText(app, 'Company');
    if (company) out.find('company', 'Company', company);
    const mgr = childText(app, 'Manager');
    if (mgr) out.find('person', 'Manager', mgr);
    if (appName) out.find('software', 'Application', appVer ? `${appName} ${appVer}` : appName);
    if (tt && /^\d+$/.test(tt) && parseInt(tt, 10) > 0) out.find('editing', 'Total editing time', `${parseInt(tt, 10).toLocaleString('en-US')} minutes`);
    const tpl = childText(app, 'Template');
    if (tpl && looksLikePath(tpl)) out.find('filename', 'Template path', tpl);
    else if (tpl && tpl !== 'Normal.dotm' && tpl !== 'Normal') out.find('filename', 'Template', tpl);
  }

  if (v.has('docProps/custom.xml')) {
    const custom = await v.xml('docProps/custom.xml', 2 * 1024 * 1024).catch(() => null);
    if (custom) {
      const csec = out.section('office-custom', 'Custom properties');
      let n = 0;
      for (const p of xChildren(custom, 'property')) {
        const name = attr(p, 'name') ?? '?';
        const val = p.children.map((ch) => xText(ch).trim()).join(' ');
        out.row(csec, name, val);
        n++;
      }
      if (n > 0) out.find('other', 'Custom document properties', `${n} propert${n === 1 ? 'y' : 'ies'}: ${csec.rows.slice(0, 4).map((r) => r.k).join(', ')}${n > 4 ? '…' : ''}`);
      if (csec.rows.some((r) => /^MSIP_Label_/i.test(r.k))) out.find('other', 'Sensitivity label (Microsoft Purview)', 'Document carries an information-protection label.');
    }
  }

  const structure = out.section('office-structure', 'Document structure');
  const media = v.list(`${kind.family === 'docx' ? 'word' : kind.family === 'xlsx' ? 'xl' : 'ppt'}/media/`);
  if (media.length) {
    const exts = new Map<string, number>();
    for (const m of media) {
      const e = (m.name.split('.').pop() ?? '').toLowerCase();
      exts.set(e, (exts.get(e) ?? 0) + 1);
    }
    out.row(structure, 'Embedded media', `${media.length} file${media.length === 1 ? '' : 's'} (${Array.from(exts).map(([e, n]) => `${e} ×${n}`).join(', ')}); images can carry their own EXIF`);
  }
  const embeds = v.dir.entries.filter((e) => /\/embeddings\//.test(e.name) && !e.isDir);
  if (embeds.length) {
    out.row(structure, 'Embedded objects (OLE)', `${embeds.length}: ${embeds.slice(0, 5).map((e) => e.name.split('/').pop()).join(', ')}`);
    out.find('other', 'Embedded objects', `${embeds.length} embedded OLE/package object${embeds.length === 1 ? '' : 's'}`);
  }
  const macroEntry = v.dir.entries.find((e) => /vbaProject\.bin$/i.test(e.name));
  if (macroEntry || kind.macros) {
    out.row(structure, 'VBA macros', macroEntry ? `present (${macroEntry.name}, ${macroEntry.size.toLocaleString('en-US')} bytes)` : 'macro-enabled format, but no vbaProject.bin');
    if (macroEntry) out.find('other', 'VBA macros present', macroEntry.name);
  }
  if (v.list('').some((e) => /\/activeX\//i.test(e.name))) {
    out.row(structure, 'ActiveX controls', 'present');
    out.find('other', 'ActiveX controls present', 'The document embeds ActiveX controls.');
  }
  const thumb = v.dir.entries.find((e) => /^docProps\/thumbnail\.(jpe?g|png)$/i.test(e.name));
  if (thumb) {
    await out.attempt('document thumbnail', async () => {
      const b = await v.bytes(thumb.name, 4 * 1024 * 1024);
      if (b) {
        out.preview('Embedded document thumbnail', thumb.name.endsWith('png') ? 'image/png' : 'image/jpeg', b);
        out.find('thumbnail', 'Embedded document thumbnail', `${thumb.name} (${b.length.toLocaleString('en-US')} bytes) shows the first page`);
      }
    });
  }

  if (kind.family === 'docx') await officeWord(c, v, structure);
  else if (kind.family === 'xlsx') await officeExcel(c, v, structure);
  else await officePowerPoint(c, v, structure);

  // external relationships
  const relFiles = ['word/_rels/document.xml.rels', 'word/_rels/settings.xml.rels', 'xl/_rels/workbook.xml.rels', 'ppt/_rels/presentation.xml.rels'];
  const externals: string[] = [];
  for (const rf of relFiles) {
    if (!v.has(rf)) continue;
    await out.attempt(rf, async () => {
      const t = await v.text(rf, 4 * 1024 * 1024);
      if (!t) return;
      for (const m of t.matchAll(/<Relationship\b[^>]*>/g)) {
        const tag = m[0];
        if (!/TargetMode="External"/.test(tag)) continue;
        const target = /Target="([^"]*)"/.exec(tag)?.[1];
        const type = /Type="[^"]*\/([A-Za-z]+)"/.exec(tag)?.[1] ?? '';
        if (target) externals.push(`${type}: ${target}`);
      }
    });
  }
  if (externals.length > 0) {
    out.row(structure, 'External links', `${externals.length}: ${externals.slice(0, 6).join(' · ')}${externals.length > 6 ? ' …' : ''}`);
    const pathy = externals.filter((e) => looksLikePath(e.replace(/^[A-Za-z]+: /, '')));
    if (pathy.length) out.find('filename', 'Linked file paths', pathy.slice(0, 4).join(' · '));
    const tpl = externals.find((e) => e.startsWith('attachedTemplate'));
    if (tpl) out.find('filename', 'Attached template', tpl.replace(/^attachedTemplate: /, ''));
  }
}

async function officeWord(c: Ctx, v: ZipView, structure: import('./types').Section): Promise<void> {
  const { out } = c;
  const authors = new Set<string>();
  let commentCount = 0;
  await out.attempt('Word comments', async () => {
    if (!v.has('word/comments.xml')) return;
    const t = (await v.text('word/comments.xml', 16 * 1024 * 1024)) ?? '';
    commentCount = (t.match(/<w:comment\b/g) ?? []).length;
    for (const m of t.matchAll(/<w:comment\b[^>]*\bw:author="([^"]*)"/g)) authors.add(m[1] ?? '');
  });
  if (commentCount > 0 || v.has('word/comments.xml')) {
    out.row(structure, 'Comments', `${commentCount} comment${commentCount === 1 ? '' : 's'}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
    if (commentCount > 0) out.find('comments', 'Comments in document', `${commentCount} comment${commentCount === 1 ? '' : 's'}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
  }
  await out.attempt('Word reviewers', async () => {
    if (!v.has('word/people.xml')) return;
    const t = (await v.text('word/people.xml', 4 * 1024 * 1024)) ?? '';
    const people = Array.from(t.matchAll(/w15:author="([^"]*)"/g)).map((m) => m[1] ?? '');
    if (people.length) {
      out.row(structure, 'Reviewers (people.xml)', Array.from(new Set(people)).join(', '));
      out.find('person', 'Reviewer / collaborator names (people.xml)', Array.from(new Set(people)).join(', '));
    }
  });
  await out.attempt('Word tracked changes', async () => {
    if (!v.has('word/document.xml')) return;
    const t = (await v.text('word/document.xml', 32 * 1024 * 1024)) ?? '';
    const re = /<w:(ins|del|moveFrom|moveTo)\b[^>]*?\bw:author="([^"]*)"/g;
    const who = new Map<string, number>();
    let n = 0;
    for (const m of t.matchAll(re)) {
      n++;
      who.set(m[2] ?? '', (who.get(m[2] ?? '') ?? 0) + 1);
    }
    if (n > 0) {
      const desc = `${n} tracked change${n === 1 ? '' : 's'} by ${Array.from(who).map(([a, k]) => `${a} (${k})`).join(', ')}`;
      out.row(structure, 'Tracked changes', desc);
      out.find('comments', 'Tracked changes (revision marks)', desc);
    }
    const paras = (t.match(/<w:p[ >]/g) ?? []).length;
    out.row(structure, 'Paragraphs (approx.)', String(paras));
    const hidden = (t.match(/<w:vanish\b/g) ?? []).length;
    if (hidden > 0) {
      out.row(structure, 'Hidden text runs', String(hidden));
      out.find('other', 'Hidden text', `${hidden} run${hidden === 1 ? '' : 's'} of hidden text (w:vanish)`);
    }
  });
  await out.attempt('Word settings', async () => {
    if (!v.has('word/settings.xml')) return;
    const t = (await v.text('word/settings.xml', 4 * 1024 * 1024)) ?? '';
    if (/<w:trackRevisions\b(?![^>]*w:val="(0|false)")/.test(t)) out.row(structure, 'Track changes', 'turned on');
    if (/<w:documentProtection\b/.test(t)) out.row(structure, 'Document protection', 'enabled');
  });
  const count = (re: RegExp) => v.dir.entries.filter((e) => re.test(e.name)).length;
  const hf = count(/^word\/(header|footer)\d*\.xml$/);
  if (hf) out.row(structure, 'Headers / footers', String(hf));
  if (v.has('word/footnotes.xml')) out.row(structure, 'Footnotes', 'present');
  if (v.has('word/endnotes.xml')) out.row(structure, 'Endnotes', 'present');
}

async function officeExcel(c: Ctx, v: ZipView, structure: import('./types').Section): Promise<void> {
  const { out } = c;
  await out.attempt('Excel workbook', async () => {
    const wb = await v.xml('xl/workbook.xml', 8 * 1024 * 1024);
    if (!wb) return;
    const sheets = xFindAll(wb, 'sheet');
    if (sheets.length) {
      out.row(structure, 'Worksheets', `${sheets.length}: ${sheets.slice(0, 30).map((s) => `${attr(s, 'name') ?? '?'}${attr(s, 'state') && attr(s, 'state') !== 'visible' ? ` (${attr(s, 'state')})` : ''}`).join(', ')}`);
      const hidden = sheets.filter((s) => attr(s, 'state') === 'hidden' || attr(s, 'state') === 'veryHidden');
      if (hidden.length) out.find('other', 'Hidden worksheets', hidden.map((s) => `${attr(s, 'name')} (${attr(s, 'state')})`).join(', '));
    }
    const names = xFindAll(wb, 'definedName');
    if (names.length) out.row(structure, 'Defined names', String(names.length));
    const fv = xFind(wb, 'fileVersion');
    if (fv) out.row(structure, 'Last edited with', `${attr(fv, 'appName') ?? 'xl'} build ${attr(fv, 'lastEdited') ?? '?'}.${attr(fv, 'rupBuild') ?? '?'}`);
    const pr = xFind(wb, 'workbookPr');
    if (pr && attr(pr, 'codeName')) out.row(structure, 'VBA code name', attr(pr, 'codeName'));
    if (pr && attr(pr, 'date1904') === '1') out.row(structure, 'Date system', '1904');
  });
  const comments = v.dir.entries.filter((e) => /^xl\/(comments\d*\.xml|threadedComments\/)/.test(e.name));
  if (comments.length) {
    out.row(structure, 'Cell comments', `${comments.length} comment part${comments.length === 1 ? '' : 's'}`);
    out.find('comments', 'Cell comments / threaded comments', `${comments.length} comment part${comments.length === 1 ? '' : 's'}`);
    await out.attempt('comment authors', async () => {
      const authors = new Set<string>();
      for (const e of comments.slice(0, 20)) {
        const t = (await v.text(e.name, 4 * 1024 * 1024)) ?? '';
        for (const m of t.matchAll(/<author>([^<]*)<\/author>/g)) authors.add(m[1] ?? '');
      }
      if (v.has('xl/persons/person.xml')) {
        const t = (await v.text('xl/persons/person.xml', 2 * 1024 * 1024)) ?? '';
        for (const m of t.matchAll(/displayName="([^"]*)"/g)) authors.add(m[1] ?? '');
      }
      if (authors.size) {
        out.row(structure, 'Comment authors', Array.from(authors).join(', '));
        out.find('person', 'Comment authors', Array.from(authors).join(', '));
      }
    });
  }
  if (v.list('xl/revisions/').length > 0) {
    out.row(structure, 'Revision history (shared workbook)', 'present');
    out.find('comments', 'Shared-workbook revision history', 'xl/revisions/ present');
  }
  if (v.list('xl/externalLinks/').length > 0) {
    out.row(structure, 'External workbook links', String(v.list('xl/externalLinks/').filter((e) => e.name.endsWith('.xml')).length));
    out.find('filename', 'Links to external workbooks', 'The workbook references other files (their paths may be stored).');
  }
  const sheetsN = v.dir.entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).length;
  if (sheetsN) out.row(structure, 'Worksheet parts', String(sheetsN));
  if (v.has('xl/sharedStrings.xml')) {
    const e = v.byName.get('xl/sharedStrings.xml');
    if (e) out.row(structure, 'Shared strings', `${e.size.toLocaleString('en-US')} bytes of text`);
  }
}

async function officePowerPoint(c: Ctx, v: ZipView, structure: import('./types').Section): Promise<void> {
  const { out } = c;
  const slides = v.dir.entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).length;
  if (slides) out.row(structure, 'Slides', String(slides));
  const notes = v.dir.entries.filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name));
  if (notes.length) {
    out.row(structure, 'Speaker notes', `${notes.length} notes page${notes.length === 1 ? '' : 's'}`);
    out.find('comments', 'Speaker notes', `${notes.length} slide${notes.length === 1 ? '' : 's'} with speaker notes`);
  }
  const cm = v.dir.entries.filter((e) => /^ppt\/(comments\/|comments\d*\.xml)/.test(e.name));
  if (cm.length) {
    out.row(structure, 'Comments', `${cm.length} comment part${cm.length === 1 ? '' : 's'}`);
    out.find('comments', 'Slide comments', `${cm.length} comment part${cm.length === 1 ? '' : 's'}`);
  }
  await out.attempt('PowerPoint comment authors', async () => {
    const name = v.has('ppt/commentAuthors.xml') ? 'ppt/commentAuthors.xml' : v.dir.entries.find((e) => /^ppt\/authors\.xml$/.test(e.name))?.name;
    if (!name) return;
    const t = (await v.text(name, 2 * 1024 * 1024)) ?? '';
    const authors = Array.from(t.matchAll(/\b(?:name|displayName)="([^"]*)"/g)).map((m) => m[1] ?? '').filter(Boolean);
    if (authors.length) {
      out.row(structure, 'Comment authors', Array.from(new Set(authors)).join(', '));
      out.find('person', 'Comment authors', Array.from(new Set(authors)).join(', '));
    }
  });
  await out.attempt('hidden slides', async () => {
    let hidden = 0;
    for (const e of v.dir.entries.filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x.name)).slice(0, 400)) {
      const b = await v.bytes(e.name, 2 * 1024 * 1024);
      if (b && /<p:sld\b[^>]*\bshow="0"/.test(latin1(b.subarray(0, 4096)))) hidden++;
    }
    if (hidden > 0) {
      out.row(structure, 'Hidden slides', String(hidden));
      out.find('other', 'Hidden slides', `${hidden} hidden slide${hidden === 1 ? '' : 's'}`);
    }
  });
}

// ---------------------------------------------------------------------------
// OpenDocument
// ---------------------------------------------------------------------------

function isoDuration(s: string): string {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(s.trim());
  if (!m) return s;
  const [d, h, mi, se] = [m[1], m[2], m[3], m[4]].map((x) => (x ? parseFloat(x) : 0));
  const parts: string[] = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (mi) parts.push(`${mi} min`);
  if (se) parts.push(`${se} s`);
  return `${parts.join(' ') || '0 s'} (${s})`;
}

async function parseOdf(c: Ctx, v: ZipView): Promise<void> {
  const { out } = c;
  const meta = await v.xml('meta.xml', 4 * 1024 * 1024);
  const sec = out.section('odf-meta', 'Document properties (meta.xml)');
  if (meta) {
    const r = (label: string, name: string) => out.row(sec, label, childText(meta, name) || (xFind(meta, name) ? xText(xFind(meta, name) as XNode).trim() : ''));
    const gen = childText(xFind(meta, 'meta') ?? meta, 'generator') || (xFind(meta, 'generator') ? xText(xFind(meta, 'generator') as XNode).trim() : '');
    out.row(sec, 'Generator', gen);
    r('Title', 'title');
    r('Subject', 'subject');
    r('Description', 'description');
    const kws = xFindAll(meta, 'keyword').map((k) => xText(k).trim()).filter(Boolean);
    out.row(sec, 'Keywords', kws.join(', '));
    r('Initial creator', 'initial-creator');
    r('Last modified by (creator)', 'creator');
    r('Created', 'creation-date');
    r('Modified', 'date');
    r('Printed by', 'printed-by');
    r('Print date', 'print-date');
    r('Language', 'language');
    const cycles = xFind(meta, 'editing-cycles');
    if (cycles) out.row(sec, 'Editing cycles', xText(cycles).trim());
    const dur = xFind(meta, 'editing-duration');
    if (dur) out.row(sec, 'Editing duration', isoDuration(xText(dur)));
    const stat = xFind(meta, 'document-statistic');
    if (stat) {
      const s = out.section('odf-stats', 'Document statistics');
      for (const [k, val] of Object.entries(stat.attrs)) out.row(s, localName(k).replace(/-/g, ' '), val);
    }
    for (const ud of xFindAll(meta, 'user-defined')) out.row(sec, `Custom: ${attr(ud, 'name') ?? '?'}`, xText(ud).trim());
    const init = childText(xFind(meta, 'meta') ?? meta, 'initial-creator');
    const last = childText(xFind(meta, 'meta') ?? meta, 'creator');
    if (init) out.find('person', 'Initial creator', init);
    if (last) out.find('person', 'Last modified by', last);
    if (gen) out.find('software', 'Generator', gen);
    if (dur) out.find('editing', 'Editing duration', isoDuration(xText(dur)));
    if (cycles && parseInt(xText(cycles), 10) > 1) out.find('editing', 'Editing cycles', xText(cycles).trim());
    const desc = childText(xFind(meta, 'meta') ?? meta, 'description');
    if (desc) out.find('comments', 'Description property', desc);
  } else {
    out.note('No meta.xml found.');
  }
  const structure = out.section('odf-structure', 'Document structure');
  const pics = v.list('Pictures/');
  if (pics.length) out.row(structure, 'Embedded pictures', String(pics.length));
  if (v.list('Basic/').length || v.list('Scripts/').length) {
    out.row(structure, 'Macros / scripts', 'present');
    out.find('other', 'Macros / scripts present', 'Basic/ or Scripts/ directory found');
  }
  await out.attempt('content.xml', async () => {
    const t = await v.text('content.xml', 48 * 1024 * 1024);
    if (!t) return;
    const ann = (t.match(/<office:annotation\b/g) ?? []).length;
    if (ann > 0) {
      const authors = new Set<string>();
      for (const m of t.matchAll(/<office:annotation\b[\s\S]*?<dc:creator>([^<]*)<\/dc:creator>/g)) authors.add(m[1] ?? '');
      out.row(structure, 'Comments (annotations)', `${ann}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
      out.find('comments', 'Comments in document', `${ann} annotation${ann === 1 ? '' : 's'}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
    }
    if (/<text:tracked-changes\b/.test(t) && /<text:changed-region\b/.test(t)) {
      const regions = (t.match(/<text:changed-region\b/g) ?? []).length;
      const authors = new Set<string>();
      for (const m of t.matchAll(/<text:changed-region\b[\s\S]*?<dc:creator>([^<]*)<\/dc:creator>/g)) authors.add(m[1] ?? '');
      out.row(structure, 'Tracked changes', `${regions}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
      out.find('comments', 'Tracked changes', `${regions} change region${regions === 1 ? '' : 's'}${authors.size ? ` by ${Array.from(authors).join(', ')}` : ''}`);
    }
    const hiddenSheets = (t.match(/<table:table\b[^>]*\btable:display="false"/g) ?? []).length;
    if (hiddenSheets > 0) out.find('other', 'Hidden sheets', `${hiddenSheets} hidden sheet${hiddenSheets === 1 ? '' : 's'}`);
  });
  const thumb = v.byName.get('Thumbnails/thumbnail.png');
  if (thumb) {
    await out.attempt('thumbnail', async () => {
      const b = await v.bytes(thumb.name, 4 * 1024 * 1024);
      if (b) {
        out.preview('Embedded document thumbnail', 'image/png', b);
        out.find('thumbnail', 'Embedded document thumbnail', `${b.length.toLocaleString('en-US')} bytes, shows the first page`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------------------

async function parseEpub(c: Ctx, v: ZipView): Promise<void> {
  const { out } = c;
  const container = await v.xml('META-INF/container.xml', 1024 * 1024);
  const rootfile = container ? xFind(container, 'rootfile') : undefined;
  const opfPath = rootfile ? attr(rootfile, 'full-path') : undefined;
  if (!opfPath) throw new Error('META-INF/container.xml has no rootfile');
  const opf = await v.xml(opfPath, 8 * 1024 * 1024);
  if (!opf) throw new Error(`package document ${opfPath} not found`);
  const sec = out.section('epub-opf', 'EPUB package metadata');
  out.row(sec, 'EPUB version', attr(opf, 'version'));
  out.row(sec, 'Package document', opfPath);
  const md = xFind(opf, 'metadata');
  if (md) {
    const all = (n: string) => xFindAll(md, n).map((x) => xText(x).trim()).filter(Boolean);
    out.row(sec, 'Title', all('title').join(' / '));
    out.row(sec, 'Creator(s)', all('creator').join(', '));
    out.row(sec, 'Contributor(s)', all('contributor').join(', '));
    out.row(sec, 'Language', all('language').join(', '));
    out.row(sec, 'Publisher', all('publisher').join(', '));
    out.row(sec, 'Date', all('date').join(', '));
    out.row(sec, 'Identifier(s)', all('identifier').join(', '));
    out.row(sec, 'Description', all('description').join(' '));
    out.row(sec, 'Subjects', all('subject').join(', '));
    out.row(sec, 'Rights', all('rights').join(' '));
    const ids = all('identifier');
    const isbn = ids.map((i) => /(?:isbn[:\s-]*)?(97[89][\d-]{10,14}|\b\d{9}[\dXx]\b)/i.exec(i)?.[1]).find(Boolean);
    if (isbn) out.row(sec, 'ISBN', isbn);
    const metas = xFindAll(md, 'meta');
    for (const m of metas.slice(0, 30)) {
      const name = attr(m, 'name') ?? attr(m, 'property');
      const content = attr(m, 'content') ?? xText(m).trim();
      if (name && content && !/^cover$/.test(name)) out.row(sec, `meta: ${name}`, content);
    }
    const creators = all('creator');
    if (creators.length) out.find('person', 'Author(s)', creators.join(', '));
    const generator = metas.find((m) => /generator/i.test(attr(m, 'name') ?? ''));
    if (generator) out.find('software', 'Producing tool', attr(generator, 'content') ?? xText(generator).trim());
    const producer = all('contributor').find((t) => /calibre|sigil|pandoc|indesign|pages|vellum|scrivener|jutoh|kindlegen|epubcheck/i.test(t));
    if (producer) out.find('software', 'Producing tool', producer);
  }
  const manifest = xFind(opf, 'manifest');
  const items = manifest ? xChildren(manifest, 'item') : [];
  out.row(sec, 'Manifest items', String(items.length));
  const spine = xFind(opf, 'spine');
  if (spine) out.row(sec, 'Spine (reading order) items', String(xChildren(spine, 'itemref').length));
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const coverMeta = md ? xFindAll(md, 'meta').find((m) => attr(m, 'name') === 'cover') : undefined;
  const coverItem = items.find((i) => (attr(i, 'properties') ?? '').split(/\s+/).includes('cover-image')) ?? items.find((i) => coverMeta && attr(i, 'id') === attr(coverMeta, 'content'));
  const href = coverItem ? attr(coverItem, 'href') : undefined;
  if (href && /\.(jpe?g|png|gif)$/i.test(href)) {
    const path = base + decodeURIComponent(href);
    await out.attempt('cover image', async () => {
      const b = await v.bytes(path, 6 * 1024 * 1024);
      if (b) out.preview('EPUB cover image', /png$/i.test(href) ? 'image/png' : /gif$/i.test(href) ? 'image/gif' : 'image/jpeg', b);
    });
  }
  if (v.has('META-INF/encryption.xml')) out.row(sec, 'Encryption', 'META-INF/encryption.xml present (font obfuscation or DRM)');
  if (v.has('META-INF/rights.xml') || v.has('META-INF/sinf.xml')) out.row(sec, 'DRM', 'rights / sinf present');
}

// ---------------------------------------------------------------------------
// JAR + wheel
// ---------------------------------------------------------------------------

async function parseJar(c: Ctx, v: ZipView): Promise<void> {
  const { out } = c;
  const t = (await v.text('META-INF/MANIFEST.MF', 1024 * 1024)) ?? '';
  const unfolded = t.replace(/\r?\n /g, '');
  const main = unfolded.split(/\r?\n\r?\n/)[0] ?? '';
  const sec = out.section('jar-manifest', 'Manifest (META-INF/MANIFEST.MF)');
  const attrs = new Map<string, string>();
  for (const line of main.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) {
      attrs.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
      out.row(sec, line.slice(0, i).trim(), line.slice(i + 1).trim());
    }
  }
  const classes = v.dir.entries.filter((e) => e.name.endsWith('.class')).length;
  out.row(sec, 'Class files', String(classes));
  const signed = v.dir.entries.some((e) => /^META-INF\/[^/]+\.(SF|RSA|DSA|EC)$/i.test(e.name));
  out.row(sec, 'Signed', signed ? 'yes (META-INF/*.SF + signature block)' : 'no');
  const by = attrs.get('Built-By');
  if (by) out.find('person', 'Built-By (OS user name of the builder)', by);
  const created = attrs.get('Created-By');
  if (created) out.find('software', 'Created-By', created);
  const jdk = attrs.get('Build-Jdk') ?? attrs.get('Build-Jdk-Spec');
  if (jdk) out.find('software', 'Build JDK', jdk);
}

async function parseWheel(c: Ctx, v: ZipView, name: string): Promise<void> {
  const { out } = c;
  const t = (await v.text(name, 1024 * 1024)) ?? '';
  const head = t.split(/\r?\n\r?\n/)[0] ?? '';
  const sec = out.section('wheel-meta', 'Python package metadata');
  const seen = new Set<string>();
  for (const line of head.split(/\r?\n/)) {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1] ?? '';
    if (key === 'Classifier' || key === 'Requires-Dist') {
      if (!seen.has(key)) out.row(sec, key, `(multiple; first: ${m[2] ?? ''})`);
      seen.add(key);
      continue;
    }
    out.row(sec, key, m[2] ?? '');
    if (key === 'Author' || key === 'Author-email' || key === 'Maintainer' || key === 'Maintainer-email') out.find('person', key, m[2] ?? '');
  }
}

// ---------------------------------------------------------------------------
// OLE2 compound files (legacy .doc / .xls / .ppt / .msg / .msi)
// ---------------------------------------------------------------------------

const FMTID_SUMMARY = 'f29f85e0-4ff9-1068-ab91-08002b27b3d9';
const FMTID_DOCSUMMARY = 'd5cdd502-2e9c-101b-97af-00dd010f9f00';

interface OleEntry {
  name: string;
  type: number;
  start: number;
  size: number;
  left: number;
  right: number;
  child: number;
  created: number;
  modified: number;
}

function guidString(b: Uint8Array, o: number): string {
  const h = (x: number, n: number) => x.toString(16).padStart(n, '0');
  const d4 = Array.from(b.subarray(o + 8, o + 16)).map((x) => h(x, 2));
  return `${h(u32(b, o, true), 8)}-${h(u16(b, o + 4, true), 4)}-${h(u16(b, o + 6, true), 4)}-${d4.slice(0, 2).join('')}-${d4.slice(2).join('')}`;
}

function filetimeToMs(lo: number, hi: number): number | null {
  const v = hi * 4294967296 + lo;
  if (v === 0) return null;
  return v / 10000 - 11644473600000;
}

function decodeAnsi(b: Uint8Array, codepage: number): string {
  const nul = b.indexOf(0);
  const body = nul >= 0 ? b.subarray(0, nul) : b;
  if (codepage === 65001) return utf8(body);
  if (codepage === 1200) return utf16(body, true);
  try {
    return new TextDecoder(codepage === 1251 ? 'windows-1251' : codepage === 932 ? 'shift_jis' : codepage === 936 ? 'gbk' : codepage === 950 ? 'big5' : codepage === 949 ? 'euc-kr' : 'windows-1252').decode(body);
  } catch {
    return latin1(body);
  }
}

interface PropValue {
  text: string;
  ms?: number;
  num?: number;
}

function parsePropertySet(b: Uint8Array, setOff: number): Map<number, PropValue> {
  const props = new Map<number, PropValue>();
  const count = Math.min(u32(b, setOff + 4, true), 200);
  const table: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) table.push([u32(b, setOff + 8 + i * 8, true), u32(b, setOff + 12 + i * 8, true)]);
  let codepage = 1252;
  const cpEntry = table.find(([id]) => id === 1);
  if (cpEntry) codepage = u16(b, setOff + cpEntry[1] + 4, true);
  for (const [id, off] of table) {
    const p = setOff + off;
    const type = u16(b, p, true) & 0x0fff;
    switch (type) {
      case 0x02:
        props.set(id, { text: String(u16(b, p + 4, true)), num: u16(b, p + 4, true) });
        break;
      case 0x03:
      case 0x13: {
        const n = u32(b, p + 4, true);
        props.set(id, { text: String(n), num: n });
        break;
      }
      case 0x0b:
        props.set(id, { text: u16(b, p + 4, true) ? 'true' : 'false' });
        break;
      case 0x1e: {
        const len = u32(b, p + 4, true);
        if (len > 0 && len < 1_000_000) props.set(id, { text: clean(decodeAnsi(b.subarray(p + 8, p + 8 + len), codepage)).trim() });
        break;
      }
      case 0x1f: {
        const len = u32(b, p + 4, true);
        if (len > 0 && len < 1_000_000) props.set(id, { text: clean(utf16(b, true, p + 8, p + 8 + len * 2).replace(/\u0000+$/, '')).trim() });
        break;
      }
      case 0x40: {
        const lo = u32(b, p + 4, true);
        const hi = u32(b, p + 8, true);
        const ms = filetimeToMs(lo, hi);
        props.set(id, { text: ms === null ? '' : (isoFromMs(ms) ?? ''), ms: ms ?? undefined, num: hi * 4294967296 + lo });
        break;
      }
      default:
        break;
    }
  }
  return props;
}

export async function parseOle2(c: Ctx): Promise<void> {
  const { rd, out, size } = c;
  const hd = await rd.read(0, 512);
  if (hd.length < 512) throw new Error('compound file header is truncated');
  const sectorShift = u16(hd, 30, true);
  const miniShift = u16(hd, 32, true);
  if (sectorShift < 7 || sectorShift > 16) throw new Error('invalid sector size');
  const ss = 1 << sectorShift;
  const mss = 1 << miniShift;
  const major = u16(hd, 26, true);
  const nFat = u32(hd, 44, true);
  const dirStart = u32(hd, 48, true);
  const miniCutoff = u32(hd, 56, true);
  const miniFatStart = u32(hd, 60, true);
  const nMiniFat = u32(hd, 64, true);
  const difStart = u32(hd, 68, true);
  const nDif = u32(hd, 72, true);
  const END = 0xfffffffe;
  const sectorCount = Math.floor((size - 512) / ss) + 1;
  if (nFat > 20000) throw new Error('implausible FAT size');
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < nFat; i++) {
    const s = u32(hd, 76 + i * 4, true);
    if (s < 0xfffffffa) fatSectors.push(s);
  }
  let dif = difStart;
  for (let n = 0; n < nDif && dif < 0xfffffffa && n < 1000; n++) {
    const sec = await rd.read(512 + dif * ss, ss);
    for (let i = 0; i < ss / 4 - 1 && fatSectors.length < nFat; i++) {
      const s = u32(sec, i * 4, true);
      if (s < 0xfffffffa) fatSectors.push(s);
    }
    dif = u32(sec, ss - 4, true);
  }
  const fat = new Uint32Array(fatSectors.length * (ss / 4));
  for (let i = 0; i < fatSectors.length; i++) {
    const sec = await rd.read(512 + (fatSectors[i] ?? 0) * ss, ss);
    for (let j = 0; j < ss / 4; j++) fat[i * (ss / 4) + j] = u32(sec, j * 4, true);
  }
  const chain = (start: number, limit = 1 << 24): number[] => {
    const res: number[] = [];
    let s = start;
    while (s < 0xfffffffa && res.length < limit) {
      res.push(s);
      if (s >= fat.length) break;
      s = fat[s] ?? END;
    }
    return res;
  };
  const readChain = async (start: number, max: number): Promise<Uint8Array> => {
    const secs = chain(start, Math.ceil(max / ss));
    const buf = new Uint8Array(Math.min(secs.length * ss, max));
    for (let i = 0; i < secs.length && i * ss < buf.length; i++) {
      const d = await rd.read(512 + (secs[i] ?? 0) * ss, ss);
      buf.set(d.subarray(0, Math.min(d.length, buf.length - i * ss)), i * ss);
    }
    return buf;
  };
  // directory
  const dirBytes = await readChain(dirStart, Math.min(sectorCount * ss, 16 * 1024 * 1024));
  const entries: OleEntry[] = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const nameLen = u16(dirBytes, o + 64, true);
    const type = u8(dirBytes, o + 66);
    const name = nameLen >= 2 ? utf16(dirBytes, true, o, o + nameLen - 2) : '';
    entries.push({
      name,
      type,
      left: u32(dirBytes, o + 68, true),
      right: u32(dirBytes, o + 72, true),
      child: u32(dirBytes, o + 76, true),
      created: filetimeToMs(u32(dirBytes, o + 100, true), u32(dirBytes, o + 104, true)) ?? 0,
      modified: filetimeToMs(u32(dirBytes, o + 108, true), u32(dirBytes, o + 112, true)) ?? 0,
      start: u32(dirBytes, o + 116, true),
      size: major >= 4 ? u64(dirBytes, o + 120, true) : u32(dirBytes, o + 120, true),
    });
  }
  const root = entries[0];
  if (!root || root.type !== 5) throw new Error('root directory entry missing');
  const miniFat: number[] = [];
  if (nMiniFat > 0) {
    const mb = await readChain(miniFatStart, nMiniFat * ss);
    for (let i = 0; i + 4 <= mb.length; i += 4) miniFat.push(u32(mb, i, true));
  }
  let miniStream: Uint8Array | null = null;
  const readStream = async (e: OleEntry, max = 4 * 1024 * 1024): Promise<Uint8Array> => {
    if (e.size < miniCutoff) {
      if (!miniStream) miniStream = await readChain(root.start, Math.min(root.size, 64 * 1024 * 1024));
      const out2 = new Uint8Array(Math.min(e.size, max));
      let s = e.start;
      for (let i = 0; i * mss < out2.length && s < 0xfffffffa; i++) {
        out2.set(miniStream.subarray(s * mss, s * mss + Math.min(mss, out2.length - i * mss)), i * mss);
        s = miniFat[s] ?? END;
      }
      return out2;
    }
    return readChain(e.start, Math.min(e.size, max));
  };
  const find = (name: string) => entries.find((e) => e.type === 2 && e.name === name);
  const names = new Set(entries.filter((e) => e.type !== 0).map((e) => e.name));

  let kind = 'OLE2 compound file';
  let ext = 'doc';
  let mime = 'application/x-ole-storage';
  if (names.has('WordDocument')) { kind = 'Word 97-2003 document (DOC)'; ext = 'doc'; mime = 'application/msword'; }
  else if (names.has('Workbook') || names.has('Book')) { kind = 'Excel 97-2003 workbook (XLS)'; ext = 'xls'; mime = 'application/vnd.ms-excel'; }
  else if (names.has('PowerPoint Document')) { kind = 'PowerPoint 97-2003 presentation (PPT)'; ext = 'ppt'; mime = 'application/vnd.ms-powerpoint'; }
  else if (names.has('EncryptedPackage')) { kind = 'Password-protected Office document (encrypted OOXML)'; ext = 'docx'; mime = 'application/octet-stream'; }
  else if (names.has('__properties_version1.0')) { kind = 'Outlook message (MSG)'; ext = 'msg'; mime = 'application/vnd.ms-outlook'; }
  else if (names.has('Contents') && names.has('VisioDocument')) { kind = 'Visio drawing (VSD)'; ext = 'vsd'; mime = 'application/vnd.visio'; }
  else if (names.has('CONTENTS') && names.has('Quill')) { kind = 'Publisher document (PUB)'; ext = 'pub'; mime = 'application/x-mspublisher'; }
  const refined: DetectedType = { id: 'ole2', name: kind, mime, exts: [ext, 'dot', 'xls', 'xlt', 'ppt', 'pps', 'pot', 'msg', 'msi', 'vsd', 'pub', 'mpp', 'doc', 'docx', 'xlsx', 'pptx', 'db'], kind: 'document' };
  c.refine(refined);

  const sec = out.section('ole2', 'OLE2 container');
  out.row(sec, 'Format version', `${major}.${u16(hd, 24, true)} (${ss}-byte sectors)`);
  out.row(sec, 'Directory entries', String(entries.filter((e) => e.type !== 0).length));
  out.row(sec, 'Root storage modified', root.modified ? (isoFromMs(root.modified) ?? undefined) : undefined);
  out.row(sec, 'Root CLSID', dirBytes.subarray(80, 96).some((x) => x) ? guidString(dirBytes, 80) : undefined);
  const hasMacros = entries.some((e) => /^(VBA|_VBA_PROJECT_CUR|Macros)$/i.test(e.name));
  if (hasMacros) {
    out.row(sec, 'VBA macros', 'present');
    out.find('other', 'VBA macros present', 'A VBA / Macros storage exists in this legacy Office file.');
  }
  if (names.has('EncryptedPackage')) out.note('This is an encrypted Office document: the real content and its metadata are encrypted.');
  const streamList = entries.filter((e) => e.type === 2).slice(0, 40).map((e) => `${e.name.replace(/[\u0000-\u001f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)} (${fmtBytes(e.size)})`);
  out.row(sec, 'Streams', streamList.join(', '));

  const si = find('\u0005SummaryInformation');
  if (si) {
    await out.attempt('SummaryInformation', async () => {
      const b = await readStream(si, 1024 * 1024);
      const nSets = u32(b, 24, true);
      for (let i = 0; i < Math.min(nSets, 2); i++) {
        const fmt = guidString(b, 28 + i * 20);
        const off = u32(b, 28 + i * 20 + 16, true);
        if (fmt !== FMTID_SUMMARY) continue;
        const p = parsePropertySet(b, off);
        const s = out.section('ole2-summary', 'Document properties (SummaryInformation)');
        const t = (id: number) => p.get(id)?.text ?? '';
        out.row(s, 'Title', t(2));
        out.row(s, 'Subject', t(3));
        out.row(s, 'Author', t(4));
        out.row(s, 'Keywords', t(5));
        out.row(s, 'Comments', t(6));
        out.row(s, 'Template', t(7));
        out.row(s, 'Last saved by', t(8));
        out.row(s, 'Revision number', t(9));
        const edit = p.get(10);
        if (edit?.num) out.row(s, 'Total editing time', `${fmtNum(edit.num / 600000000, 1)} minutes`);
        out.row(s, 'Last printed', t(11));
        out.row(s, 'Created', t(12));
        out.row(s, 'Last saved', t(13));
        out.row(s, 'Pages', t(14));
        out.row(s, 'Words', t(15));
        out.row(s, 'Characters', t(16));
        out.row(s, 'Application', t(18));
        if (t(4)) out.find('person', 'Author', t(4));
        if (t(8)) out.find('person', 'Last saved by', t(8));
        if (t(18)) out.find('software', 'Application', t(18));
        if (t(6)) out.find('comments', 'Comments property', t(6));
        if (edit?.num && edit.num / 600000000 >= 1) out.find('editing', 'Total editing time', `${fmtNum(edit.num / 600000000, 1)} minutes`);
        if (t(7) && looksLikePath(t(7))) out.find('filename', 'Template path', t(7));
      }
    });
  }
  const dsi = find('\u0005DocumentSummaryInformation');
  if (dsi) {
    await out.attempt('DocumentSummaryInformation', async () => {
      const b = await readStream(dsi, 1024 * 1024);
      const nSets = u32(b, 24, true);
      for (let i = 0; i < Math.min(nSets, 2); i++) {
        const fmt = guidString(b, 28 + i * 20);
        const off = u32(b, 28 + i * 20 + 16, true);
        if (fmt !== FMTID_DOCSUMMARY) continue;
        const p = parsePropertySet(b, off);
        const s = out.section('ole2-docsummary', 'Document properties (DocumentSummaryInformation)');
        const t = (id: number) => p.get(id)?.text ?? '';
        out.row(s, 'Category', t(2));
        out.row(s, 'Manager', t(14));
        out.row(s, 'Company', t(15));
        out.row(s, 'Slides', t(7));
        out.row(s, 'Notes', t(8));
        out.row(s, 'Hidden slides', t(9));
        out.row(s, 'Content type', t(26));
        out.row(s, 'Content status', t(27));
        out.row(s, 'Language', t(28));
        out.row(s, 'Document version', t(29));
        if (t(15)) out.find('company', 'Company', t(15));
        if (t(14)) out.find('person', 'Manager', t(14));
      }
    });
  }
}
