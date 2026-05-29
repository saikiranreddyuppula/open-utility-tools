# Utility Tools

A privacy-first, **100% client-side** collection of **280+** developer & file utilities — a fast,
self-hostable alternative to it-tools.tech / CyberChef / iLoveIMG / SmallPDF.

> **No user data ever leaves your browser.** There is no backend that processes your files
> or text. Every transform runs locally — heavy work in Rust compiled to WebAssembly inside
> Web Workers, light work in TypeScript. The whole app is a static export and works fully
> offline after first load (installable PWA).

## Highlights

- 🔒 **Zero uploads** — all computation is client-side; the static build literally has no
  server to send data to.
- ⚡ **Rust → WASM** for performance-critical tools (hashing, image/PDF processing,
  compression…), run off the UI thread in a worker pool.
- 🧩 **Drop-in tool registry** — each tool is one self-contained folder; a build-time codegen
  step discovers it. No central switch to edit.
- ⌨️ **Power-tool UX** — dense dashboard, ⌘K fuzzy command palette, keyboard-first, dark/light.
- 📦 **Static export** (`output: 'export'`) — host the `out/` folder on any static host or
  open it locally. **PWA** caches everything (incl. `.wasm`) for true offline use.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime / package manager | **Bun** |
| Framework | **Next.js (App Router, static export)** |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix) |
| Theming | **next-themes** (OKLCH design tokens) |
| Heavy compute | **Rust → WASM** via `wasm-pack` / `wasm-bindgen`, in **Web Workers** |
| Command palette | **cmdk** |
| Client-side zip | **fflate** |

## Prerequisites

- [Bun](https://bun.sh) `>= 1.4`
- [Rust](https://rustup.rs) `>= 1.83` with the `wasm32-unknown-unknown` target
- [`wasm-pack`](https://rustwasm.github.io/wasm-pack/)

```bash
# One-time toolchain setup
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

No external `wasm-opt`/binaryen install is required — `wasm-pack` bundles its own, and each
crate passes the feature flags it needs (see `rust/crates/*/Cargo.toml`).

## Getting started

```bash
bun install          # install JS dependencies
bun run wasm:build   # compile Rust crates → public/wasm/<crate>/  (also runs in prebuild)
bun run dev          # dev server at http://localhost:3000
```

### Build the static site

```bash
bun run build        # prebuild compiles WASM + generates the registry, then next build → out/
bun run serve        # preview the static export locally
```

The entire site is emitted to `out/` as static files — deploy it to any static host (GitHub
Pages, Netlify, S3, nginx, `python -m http.server`, …) or open it offline.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Regenerate registry, then start the dev server |
| `bun run build` | Compile WASM + regenerate registry, then `next build` → `out/` |
| `bun run wasm:build` | `wasm-pack build` every crate → `public/wasm/<crate>/` |
| `bun run registry:gen` | Scan `tools/**` → `lib/registry/registry.generated.ts` |
| `bun run typecheck` | Type-check the app and the Bun scripts |
| `bun run lint` | ESLint |
| `bun run serve` | Serve the built `out/` directory |

## Project structure

```
.
├── app/                      # Next.js App Router (static export)
│   ├── layout.tsx            # root shell: theme, sidebar, command palette, PWA register
│   ├── page.tsx              # homepage (category grid + search)
│   ├── tools/[slug]/         # one prebuilt page per tool (generateStaticParams)
│   └── categories/[id]/      # per-category listing
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   ├── layout/               # app shell: sidebar, topbar, command palette
│   └── tools/                # shared tool primitives (dropzone, copy/download, panels…)
├── lib/
│   ├── registry/             # tool registry types + generated manifest
│   ├── worker/               # generic WASM worker + typed client + pool
│   ├── wasm/                 # typed TS wrappers around each WASM crate
│   └── search.ts             # fuzzy search
├── tools/<category>/<slug>/  # ← each tool lives here
│   ├── tool.config.ts        #   static metadata (self-registering)
│   └── ui.tsx                #   the tool's React component (default export)
├── rust/
│   ├── Cargo.toml            # workspace
│   └── crates/<crate>/       # one WASM crate per heavy domain (core, image, pdf, …)
├── scripts/
│   ├── gen-registry.ts       # scans tools/** → lib/registry/registry.generated.ts
│   └── build-wasm.sh         # wasm-pack build for every crate → public/wasm/
└── public/
    ├── wasm/<crate>/         # generated WASM bundles (gitignored)
    ├── sw.js                 # service worker (offline cache)
    └── manifest.webmanifest  # PWA manifest
```

## How to add a tool

### A light (pure-TypeScript) tool

1. Create `tools/<category>/<slug>/tool.config.ts`:

   ```ts
   import type { ToolMetaStatic } from '@/lib/registry/types';

   const meta: ToolMetaStatic = {
     id: 'text-slugify-v1',          // stable, unique, never changes
     name: 'Slugify',
     slug: 'slugify',                // unique URL segment
     description: 'Turn text into URL-safe slugs.',
     category: 'text',               // see lib/registry/types.ts
     tags: ['slug', 'url', 'kebab'],
     keywords: ['url safe', 'permalink'],
     icon: 'Link',                   // a name registered in components/icon.tsx
     relatedTools: ['case-converter'],
   };

   export default meta;
   ```

2. Create `tools/<category>/<slug>/ui.tsx` with a **default-exported** React component. For
   the common input → output shape, reuse `TextToolLayout`:

   ```tsx
   'use client';
   import { TextToolLayout } from '@/components/tools/text-tool';

   export default function SlugifyTool() {
     return (
       <TextToolLayout
         transform={(input) => input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}
         inputLabel="Text"
         outputLabel="Slug"
       />
     );
   }
   ```

3. `bun run dev` (or `bun run registry:gen`) regenerates the registry. Done — it appears on
   the homepage, in its category, and in ⌘K search, with its own prebuilt page.

> If the icon isn't already in `components/icon.tsx`, import it from `lucide-react` and add it
> to the `ICONS` map.

### A heavy (Rust/WASM) tool

1. Add functions to an existing crate under `rust/crates/<crate>/src/` (or create a new crate —
   copy `rust/crates/core/` including the `[package.metadata.wasm-pack.profile.release]`
   `wasm-opt` flags). Export with `#[wasm_bindgen]`; take/return `&[u8]` / `Vec<u8>` / `String`.
2. Add a typed wrapper in `lib/wasm/<crate>.ts` that calls `runWasm(crate, fn, args, opts)` —
   this runs in the worker pool off the UI thread.
3. `bun run wasm:build` recompiles. Build the tool's `ui.tsx` against your wrapper, and set
   `loadWasm: true` in its config.

## Privacy & "what can't run client-side"

A few tools that exist on other sites are **intentionally omitted** rather than phoning home:

- **Live currency conversion** — real-time FX rates require a network call. (A bundled
  offline-rate snapshot is the only client-side-honest option.)
- **AI background removal** (ONNX models), **ffmpeg media transcoding** (~30 MB), **HEIC
  decoding** (libheif) — these need multi-MB non-`wasm-pack` assets; planned for a later phase
  behind an explicit, still-100%-local download.

Anything that would require sending your data to a server is not included. See
[`docs/MASTER-TOOL-LIST.md`](docs/MASTER-TOOL-LIST.md) for the full researched catalog.

## License

MIT
