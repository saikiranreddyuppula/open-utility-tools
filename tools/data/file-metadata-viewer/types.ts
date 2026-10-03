/** Shared types for the File Metadata Viewer parsers. Pure TypeScript, no DOM. */

export type Cat =
  | 'gps'
  | 'person'
  | 'company'
  | 'device'
  | 'software'
  | 'editing'
  | 'comments'
  | 'thumbnail'
  | 'filename'
  | 'other';

export interface Row {
  k: string;
  v: string;
}

export interface Section {
  id: string;
  title: string;
  rows: Row[];
  /** Short muted note shown under the title (limitations, truncation…). */
  note?: string;
  /** Large raw text (e.g. an XMP packet) shown in a scrollable block. */
  raw?: { label: string; text: string };
  /** Start collapsed in the UI. */
  collapsed?: boolean;
}

export interface Finding {
  cat: Cat;
  label: string;
  value: string;
}

export interface Preview {
  label: string;
  mime: string;
  data: Uint8Array;
}

export type TypeKind =
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'
  | 'font'
  | 'executable'
  | 'data'
  | 'text'
  | 'other';

export interface DetectedType {
  /** Stable lowercase id used for parser dispatch (e.g. "jpeg", "mp4", "zip"). */
  id: string;
  name: string;
  mime: string;
  /** Extensions (lowercase, no dot) that are normal for this content. */
  exts: string[];
  kind: TypeKind;
}

export interface TextStats {
  encoding: string;
  lineEndings: string;
  lines: number;
  words?: number;
  chars?: number;
  linesApprox?: boolean;
  bom?: string;
}

export interface FileFacts {
  name: string;
  ext: string;
  size: number;
  mime: string;
  lastModified: number | null;
}

export interface Hashes {
  sha256: string;
  sha1: string;
}

export interface Report {
  file: FileFacts;
  detected: DetectedType | null;
  /** Extension check result: null = fine / unknown, otherwise a human warning. */
  extensionWarning: string | null;
  text: TextStats | null;
  entropy: { value: number; bytes: number } | null;
  /** First 64 bytes, as hex digits. */
  head64: string;
  sections: Section[];
  findings: Finding[];
  /** "could not parse X: reason" messages. */
  errors: string[];
  notes: string[];
  previews: Preview[];
  hashes: Hashes | null;
}
