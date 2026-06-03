// Isomorphic loader for the `imaging` Rust→WASM crate.
//
// The crate's glue (vendored under ../../wasm/imaging) was built `--target web`,
// but it runs unchanged in Node and Bun too: feed the .wasm bytes to initSync()
// and call start(). In the browser we use the glue's default async init, which
// fetches the .wasm relative to itself. See the repo's wasm-isomorphic note.
//
// The glue is loaded with a *runtime* dynamic import of a computed URL so the
// consumer's bundler treats it (and the .wasm) as an external asset shipped in
// the package rather than trying to inline it.

interface ImagingModule {
  initSync(opts: { module: unknown }): unknown;
  default(opts?: unknown): Promise<unknown>;
  start(): void;
  version(): string;
  probe(bytes: Uint8Array): string;
  convert(
    bytes: Uint8Array,
    target_format: string,
    quality: number,
    max_width: number,
    max_height: number,
    filter: string,
    background: string,
    on_progress: ((p: number) => void) | null,
  ): Uint8Array;
  make_multi_ico(bytes: Uint8Array, sizes_csv: string): Uint8Array;
}

const proc = (globalThis as { process?: { versions?: Record<string, string | undefined> } }).process;
const isNodeLike = !!(proc?.versions?.node || proc?.versions?.bun);

let cached: Promise<ImagingModule> | null = null;

// Non-literal base path: keeps esbuild/other bundlers from statically resolving
// these URLs as assets, so they stay runtime expressions relative to the
// emitted file and resolve against the package's shipped wasm/ directory.
const WASM_DIR = '../../wasm/imaging/';
const assetUrl = (file: string): URL => new URL(WASM_DIR + file, import.meta.url);

/** Loads and initializes the imaging WASM module once, memoized. */
export function loadImaging(): Promise<ImagingModule> {
  if (cached) return cached;
  cached = (async () => {
    const mod = (await import(/* @vite-ignore */ assetUrl('imaging.js').href)) as unknown as ImagingModule;
    if (isNodeLike) {
      // Non-literal specifier keeps bundlers from resolving node:fs for browsers.
      // Minimal inline type avoids a hard @types/node dependency.
      const fs = (await import(/* @vite-ignore */ ('node:' + 'fs'))) as {
        readFileSync(path: URL): unknown;
      };
      mod.initSync({ module: fs.readFileSync(assetUrl('imaging_bg.wasm')) });
    } else {
      await mod.default();
    }
    mod.start();
    return mod;
  })();
  return cached;
}
