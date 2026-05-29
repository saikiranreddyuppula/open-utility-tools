/**
 * Client-side file download + clipboard helpers. Everything stays in the browser;
 * no upload ever happens. Prefers the File System Access API when present, with a
 * synthetic-anchor fallback that works everywhere (and offline).
 */

export type DownloadData = Blob | ArrayBuffer | Uint8Array | string;

function toBlob(data: DownloadData, mime?: string): Blob {
  if (data instanceof Blob) return data;
  if (typeof data === 'string')
    return new Blob([data], { type: mime ?? 'text/plain;charset=utf-8' });
  if (data instanceof Uint8Array)
    return new Blob([data as BlobPart], { type: mime ?? 'application/octet-stream' });
  return new Blob([data], { type: mime ?? 'application/octet-stream' });
}

export async function downloadFile(
  data: DownloadData,
  filename: string,
  mime?: string
): Promise<void> {
  const blob = toBlob(data, mime);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on next tick so the download can start.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for insecure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if ('ClipboardItem' in window && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
