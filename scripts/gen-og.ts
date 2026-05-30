#!/usr/bin/env bun
/**
 * Build-time Open Graph image generator.
 *
 * Renders a distinct 1200x630 PNG for every tool, every category, and the home
 * page using Satori (flexbox/text layout -> SVG) + resvg (SVG -> PNG), reusing
 * the project's Geist fonts and lucide-static icons. Output -> public/og/<key>.png,
 * which `next build` copies to out/og/ and serves at /og/<key>.png (referenced
 * by the openGraph.images / twitter.images metadata).
 *
 * Light theme: white card, per-category accent eyebrow + recolored icon tile,
 * near-black tool name, domain footer.
 *
 * Runs in `prebuild` (so Cloudflare CI regenerates on every build) and via
 * `bun run og:gen`. Parallelized across worker threads; hash-guarded so local
 * re-runs only redo changed tools. Pass `--force` (or OG_FORCE=1) to rebuild all.
 *
 * Imports TOOL_META/CATEGORY_META by RELATIVE path (like gen-tools-doc.ts) to
 * avoid pulling the registry's lazy .tsx component loaders into this runtime.
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_META } from '../lib/registry/registry.generated';
import { CATEGORY_META, CATEGORIES, type ToolCategory } from '../lib/registry/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OG_DIR = join(ROOT, 'public', 'og');
const FONT_DIR = join(ROOT, 'node_modules/geist/dist/fonts/geist-sans');
const LUCIDE_DIR = join(ROOT, 'node_modules/lucide-static/icons');
const BRAND_SVG = join(ROOT, 'public', 'icon.svg');
const MANIFEST = join(OG_DIR, '.manifest.json');

/** Bump to force every image to re-render after a design (layout/color) change. */
const STYLE_VERSION = 'og-light-v1';

/** Asset versions folded into the cache key so a font/icon upgrade re-renders. */
const ASSET_VERSION = (() => {
  const ver = (pkg: string): string => {
    try {
      return JSON.parse(readFileSync(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')).version;
    } catch {
      return '?';
    }
  };
  return `lucide${ver('lucide-static')}+geist${ver('geist')}`;
})();

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_ACCENT = '#5b5bd6';

/** Light-mode category accents (oklch tokens from globals.css -> sRGB hex). */
const ACCENT: Record<ToolCategory, string> = {
  image: '#da6600',
  pdf: '#de3951',
  data: '#de3951',
  text: '#009b64',
  convert: '#0083d3',
  crypto: '#8857e0',
  encoding: '#009b9e',
  generators: '#b38d00',
  web: '#b249ac',
  time: '#439d3b',
  math: '#b38d00',
  color: '#b950b2',
};

type ToolJob = {
  key: string;
  kind: 'tool';
  accent: string;
  eyebrow: string;
  title: string;
  desc: string;
  icon: string;
};
type CategoryJob = {
  key: string;
  kind: 'category';
  accent: string;
  eyebrow: string;
  title: string;
  desc: string;
  icon: string;
};
type HomeJob = {
  key: string;
  kind: 'home';
  accent: string;
  eyebrow: string;
  title: string;
  desc: string;
};
type Job = ToolJob | CategoryJob | HomeJob;

/** What each worker reports back to the main thread. */
type WorkerResult = { done: string[]; failed: { key: string; msg: string }[] };

// ───────────────────────────── shared helpers ─────────────────────────────

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function titleSize(title: string): number {
  const n = title.length;
  if (n <= 18) return 76;
  if (n <= 26) return 66;
  if (n <= 36) return 56;
  if (n <= 48) return 46;
  return 40;
}

function pngPath(key: string): string {
  return join(OG_DIR, `${key}.png`);
}

/** Content fingerprint — changing any visible field invalidates the cached PNG. */
function hashJob(job: Job): string {
  return createHash('sha1')
    .update(`${STYLE_VERSION} ${ASSET_VERSION} ${WIDTH}x${HEIGHT} ${JSON.stringify(job)}`)
    .digest('hex');
}

function buildJobs(): Job[] {
  const jobs: Job[] = [];
  for (const t of TOOL_META) {
    const cat = CATEGORY_META[t.category as ToolCategory];
    jobs.push({
      key: t.slug,
      kind: 'tool',
      accent: ACCENT[t.category as ToolCategory],
      eyebrow: cat.name.toUpperCase(),
      title: t.name,
      desc: clamp(t.description, 116),
      icon: t.icon,
    });
  }
  for (const id of CATEGORIES) {
    const cat = CATEGORY_META[id];
    const count = TOOL_META.filter((t) => t.category === id).length;
    jobs.push({
      key: `category-${id}`,
      kind: 'category',
      accent: ACCENT[id],
      eyebrow: `${count} FREE TOOLS`,
      title: `${cat.name} Tools`,
      desc: clamp(`${cat.description}. Privacy-first, in your browser.`, 116),
      icon: cat.icon,
    });
  }
  jobs.push({
    key: 'home',
    kind: 'home',
    accent: BRAND_ACCENT,
    eyebrow: `${TOOL_META.length}+ FREE PRIVACY-FIRST TOOLS`,
    title: 'Every utility, in your browser.',
    desc: 'Convert, hash, encode, format, generate and inspect — 100% client-side. No upload. Works offline.',
  });
  return jobs;
}

// ───────────────────────────── main thread ─────────────────────────────

async function rasterizeLogo(): Promise<void> {
  // Organization.logo needs a raster PNG; rasterize the brand SVG to 512x512.
  const svg = readFileSync(BRAND_SVG, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
  writeFileSync(join(OG_DIR, 'logo-512.png'), png);
}

async function main(): Promise<void> {
  mkdirSync(OG_DIR, { recursive: true });
  await rasterizeLogo();

  const force = process.argv.includes('--force') || process.env.OG_FORCE === '1';
  const jobs = buildJobs();
  const hashes = new Map(jobs.map((j) => [j.key, hashJob(j)]));

  let manifest: Record<string, string> = {};
  if (existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
    } catch {
      manifest = {};
    }
  }

  const todo = jobs.filter(
    (j) => force || !existsSync(pngPath(j.key)) || manifest[j.key] !== hashes.get(j.key)
  );

  const t0 = performance.now();
  if (todo.length === 0) {
    console.log(`✓ gen-og: ${jobs.length} OG images already up to date (logo refreshed).`);
    return;
  }

  const workerCount = Math.min(Math.max(cpus().length - 2, 1), 10, todo.length);
  const shards: Job[][] = Array.from({ length: workerCount }, () => []);
  todo.forEach((job, i) => shards[i % workerCount]!.push(job));

  const completed = new Set<string>();
  const failures: { key: string; msg: string }[] = [];
  await Promise.all(
    shards.map(
      (jobsForWorker) =>
        new Promise<void>((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { jobs: jobsForWorker } });
          w.on('message', (m: WorkerResult) => {
            m.done.forEach((k) => completed.add(k));
            failures.push(...m.failed);
          });
          w.on('error', reject);
          w.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`worker exited with code ${code}`))
          );
        })
    )
  );

  for (const key of completed) manifest[key] = hashes.get(key)!;
  // Drop manifest entries for keys that no longer exist (deleted/renamed tools).
  const live = new Set(jobs.map((j) => j.key));
  for (const key of Object.keys(manifest)) if (!live.has(key)) delete manifest[key];
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `✓ gen-og: rendered ${completed.size}/${todo.length} OG images (${jobs.length} total, ${workerCount} workers, ${secs}s)` +
      (failures.length > 0 ? ` — ⚠ ${failures.length} failed` : '')
  );
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✗ ${f.key}: ${f.msg}`);
    process.exitCode = 1;
  }
}

// ───────────────────────────── worker thread ─────────────────────────────

type SatoriNode = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: unknown): SatoriNode => ({
  type: 'div',
  props: children === undefined ? { style } : { style, children },
});
const text = (style: Record<string, unknown>, value: string): SatoriNode => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: value },
});
const image = (src: string, size: number): SatoriNode => ({
  type: 'img',
  props: { src, width: size, height: size, style: { width: `${size}px`, height: `${size}px` } },
});

function buildIconMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of readdirSync(LUCIDE_DIR)) {
    if (!file.endsWith('.svg')) continue;
    const kebab = file.slice(0, -4);
    // kebab -> Pascal is exactly how lucide derives component names: capitalize
    // the first char of each hyphen segment ("grid-3x3" -> "Grid3x3").
    const pascal = kebab
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    map.set(pascal, kebab);
  }
  return map;
}

function lucideDataUri(name: string, accent: string, map: Map<string, string>): string | null {
  const kebab = map.get(name);
  if (!kebab) return null;
  const svg = readFileSync(join(LUCIDE_DIR, `${kebab}.svg`), 'utf8').replace(/currentColor/g, accent);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function brandDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(readFileSync(BRAND_SVG, 'utf8')).toString('base64')}`;
}

function buildTree(job: Job, iconMap: Map<string, string>): SatoriNode {
  const { accent } = job;

  // Icon tile (right side).
  let iconTile: SatoriNode;
  if (job.kind === 'home') {
    iconTile = box({ display: 'flex', marginLeft: '48px' }, [image(brandDataUri(), 168)]);
  } else {
    const uri = lucideDataUri(job.icon, accent, iconMap);
    const inner = uri ? [image(uri, 104)] : [];
    iconTile = box(
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '168px',
        height: '168px',
        borderRadius: '28px',
        backgroundColor: '#f1f5f9',
        border: `2px solid ${accent}33`,
        marginLeft: '48px',
      },
      inner
    );
  }

  const textCol = box({ display: 'flex', flexDirection: 'column', maxWidth: '800px' }, [
    text(
      { fontSize: 26, fontWeight: 500, letterSpacing: 4, color: accent, marginBottom: '18px' },
      job.eyebrow
    ),
    text(
      { fontSize: titleSize(job.title), fontWeight: 700, color: '#0f172a', lineHeight: 1.08 },
      job.title
    ),
    text(
      { fontSize: 28, fontWeight: 400, color: '#64748b', marginTop: '22px', lineHeight: 1.3 },
      job.desc
    ),
  ]);

  return box(
    {
      display: 'flex',
      flexDirection: 'column',
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      backgroundColor: '#ffffff',
      fontFamily: 'Geist',
      position: 'relative',
      padding: '64px 80px',
      justifyContent: 'space-between',
    },
    [
      box({ position: 'absolute', left: 0, top: 0, bottom: 0, width: '14px', backgroundColor: accent }),
      // header wordmark
      box({ display: 'flex', alignItems: 'center' }, [
        box({
          display: 'flex',
          width: '22px',
          height: '22px',
          backgroundColor: accent,
          borderRadius: '6px',
          marginRight: '14px',
        }),
        text({ fontSize: 30, fontWeight: 600, color: '#475569' }, 'Open Utility Tools'),
      ]),
      // main row
      box({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        textCol,
        iconTile,
      ]),
      // footer
      text(
        { fontSize: 25, fontWeight: 500, color: '#94a3b8' },
        'www.openutilitytools.com  ·  runs offline  ·  no data leaves your browser'
      ),
    ]
  );
}

async function runWorker(): Promise<void> {
  const jobs: Job[] = workerData.jobs;
  const fonts = [
    { name: 'Geist', data: readFileSync(join(FONT_DIR, 'Geist-Regular.ttf')), weight: 400 as const, style: 'normal' as const },
    { name: 'Geist', data: readFileSync(join(FONT_DIR, 'Geist-Medium.ttf')), weight: 500 as const, style: 'normal' as const },
    { name: 'Geist', data: readFileSync(join(FONT_DIR, 'Geist-SemiBold.ttf')), weight: 600 as const, style: 'normal' as const },
    { name: 'Geist', data: readFileSync(join(FONT_DIR, 'Geist-Bold.ttf')), weight: 700 as const, style: 'normal' as const },
  ];
  const iconMap = buildIconMap();
  const result: WorkerResult = { done: [], failed: [] };
  for (const job of jobs) {
    try {
      const svg = await satori(buildTree(job, iconMap) as never, { width: WIDTH, height: HEIGHT, fonts });
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
      writeFileSync(pngPath(job.key), png);
      result.done.push(job.key);
    } catch (err) {
      result.failed.push({ key: job.key, msg: (err as Error).message });
    }
  }
  parentPort!.postMessage(result);
}

if (isMainThread) {
  main().catch((e) => {
    console.error('✗ gen-og failed:', e);
    process.exit(1);
  });
} else {
  await runWorker();
}
