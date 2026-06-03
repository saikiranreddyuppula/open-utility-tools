import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Code2,
  Copy,
  FileCode2,
  Package,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { HOME_OG_IMAGE, OG_HEIGHT, OG_WIDTH, SITE_NAME, X_HANDLE } from '@/lib/seo/site';

const PACKAGE_NAME = '@open-utility-tools/core';
const PACKAGE_VERSION = '0.2.0';
const NPM_URL = 'https://www.npmjs.com/package/@open-utility-tools/core';
const GITHUB_URL = 'https://github.com/saikiranreddyuppula/open-utility-tools';
const RELEASE_URL = `${GITHUB_URL}/releases/tag/core-v${PACKAGE_VERSION}`;

const installCommand = `npm install ${PACKAGE_NAME}`;

const importExample = `import { addBusinessDays } from '@open-utility-tools/core/time/add-business-days';
import { convert } from '@open-utility-tools/core/image/convert';
import { tool as jsonFormatterTool } from '@open-utility-tools/core/tools/data/json-formatter';
import { parseColor } from '@open-utility-tools/core/color';

const due = addBusinessDays('2026-06-01', 10).date;
const webp = await convert(sourceBytes, {
  format: 'webp',
  quality: 82,
  maxWidth: 1200,
});
console.log(jsonFormatterTool.webPath);`;

const namespaceExample = `import { text, math, color } from '@open-utility-tools/core';

const slug = text.cases.kebab('Open Utility Tools');
const total = math.evaluateExpression('2 * (12 + 8)');
const contrast = color.contrastRatio('#111827', '#ffffff');`;

const publishExample = `# Maintainers publish through GitHub trusted publishing
bun run version:packages
git push origin main
gh release create core-v0.2.1 --target main --generate-notes`;

const sections = [
  { id: 'install', label: 'Install' },
  { id: 'imports', label: 'Imports' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'exports', label: 'Exports' },
  { id: 'release', label: 'Release workflow' },
] as const;

const exportGroups = [
  {
    importPath: PACKAGE_NAME,
    contents: 'Namespace exports for extracted utility groups plus the full tool catalog.',
  },
  {
    importPath: `${PACKAGE_NAME}/tools`,
    contents: 'Typed catalog entries for every browser tool, searchable by id, slug, or category/slug path.',
  },
  {
    importPath: `${PACKAGE_NAME}/tools/*/*`,
    contents: 'Per-tool catalog imports such as tools/data/json-formatter and tools/text/case-converter.',
  },
  {
    importPath: `${PACKAGE_NAME}/text`,
    contents: 'Case conversion, line tools, diff helpers, markdown, and morse utilities.',
  },
  {
    importPath: `${PACKAGE_NAME}/math`,
    contents: 'Safe expression evaluation, numbers, statistics, roman numerals, and units.',
  },
  {
    importPath: `${PACKAGE_NAME}/color`,
    contents: 'Color conversion, luminance, and WCAG contrast helpers.',
  },
  {
    importPath: `${PACKAGE_NAME}/data`,
    contents: 'CSV, JSON, YAML, and TypeScript-shape conversion helpers.',
  },
  {
    importPath: `${PACKAGE_NAME}/time`,
    contents: 'Legacy cron helpers plus namespaced access to extracted time tools.',
  },
  {
    importPath: `${PACKAGE_NAME}/time/*`,
    contents: 'Per-tool time imports such as add-business-days, cron-parser, and week-number.',
  },
  {
    importPath: `${PACKAGE_NAME}/image`,
    contents: 'WASM-backed raster image convert and probe APIs.',
  },
  {
    importPath: `${PACKAGE_NAME}/image/convert`,
    contents: 'Single-tool image conversion import with types.',
  },
  {
    importPath: `${PACKAGE_NAME}/image/probe`,
    contents: 'Single-tool image metadata probing import with types.',
  },
  {
    importPath: `${PACKAGE_NAME}/web`,
    contents: 'HTTP status and MIME reference data.',
  },
  {
    importPath: `${PACKAGE_NAME}/generators`,
    contents: 'UUID, ULID, nanoid, passwords, fake data, lorem ipsum, and gitignore templates.',
  },
  {
    importPath: `${PACKAGE_NAME}/crypto`,
    contents: 'WebCrypto-backed JWT, HOTP, base32, and base64url helpers.',
  },
] as const;

const runtimeFacts = [
  'ES modules with TypeScript declarations',
  'Node 20 or newer',
  'Browser, Node, and Bun compatible',
  'Zero runtime npm dependencies',
  'Typed catalog entries for every browser tool',
  'Pure utilities first, WASM-backed image tools where needed',
] as const;

export const metadata: Metadata = {
  title: 'Developer Docs',
  description:
    'Install and use the @open-utility-tools/core npm package with typed ESM imports, subpath exports, and browser, Node, and Bun support.',
  alternates: { canonical: '/developers/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: '/developers/',
    title: 'Developer Docs',
    description:
      'Use @open-utility-tools/core in apps, workers, scripts, and build pipelines.',
    images: [
      {
        url: HOME_OG_IMAGE,
        width: OG_WIDTH,
        height: OG_HEIGHT,
        type: 'image/png',
        alt: `${SITE_NAME} developer docs`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: X_HANDLE,
    creator: X_HANDLE,
    title: 'Developer Docs',
    description: `Install and use ${PACKAGE_NAME}.`,
    images: [HOME_OG_IMAGE],
  },
};

export default function DevelopersPage() {
  return (
    <>
      <section className="border-b bg-muted/25">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Package className="size-3.5" />
                {PACKAGE_NAME}
                <span className="font-mono text-foreground">v{PACKAGE_VERSION}</span>
              </span>
              <h1 className="mt-5 text-3xl font-semibold text-foreground sm:text-4xl">
                Developer docs
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Typed, framework-agnostic utility functions extracted from Open Utility Tools.
                Use the same core logic in web apps, Workers, CLIs, tests, and automation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={NPM_URL} target="_blank" rel="noreferrer">
                  <Package className="size-4" />
                  npm package
                  <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={RELEASE_URL} target="_blank" rel="noreferrer">
                  <Code2 className="size-4" />
                  v{PACKAGE_VERSION} release
                  <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-5">
            <nav aria-label="Developer docs sections" className="space-y-1">
              <p className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
                On this page
              </p>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium text-foreground">Package</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{PACKAGE_NAME}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={NPM_URL} target="_blank" rel="noreferrer">
                    npm
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-10">
          <section id="install" className="scroll-mt-20">
            <SectionHeader
              icon={<Terminal className="size-4" />}
              title="Install"
              description="The package is public on npm and ships ESM plus generated TypeScript declarations."
            />
            <CodeBlock code={installCommand} language="sh" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {runtimeFacts.map((fact) => (
                <div key={fact} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="imports" className="scroll-mt-20">
            <SectionHeader
              icon={<FileCode2 className="size-4" />}
              title="Imports"
              description="Prefer per-tool subpaths for the smallest import surface. Category and root namespace imports are available when they fit your app better."
            />
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Per-tool and category imports</h3>
                <CodeBlock code={importExample} language="ts" />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Root namespace imports</h3>
                <CodeBlock code={namespaceExample} language="ts" />
              </div>
            </div>
          </section>

          <section id="runtime" className="scroll-mt-20">
            <SectionHeader
              icon={<ShieldCheck className="size-4" />}
              title="Runtime contract"
              description="The core package has no React or DOM dependency. Browser APIs are used only where they are part of the runtime contract."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <RuntimeCard
                title="Pure TypeScript"
                body="Text, math, color, data, time, web, generators, and crypto helpers are plain ESM modules."
              />
              <RuntimeCard
                title="WebCrypto"
                body="Crypto and secure generator APIs expect globalThis.crypto, which is available in modern browsers, Node 20+, and Bun."
              />
              <RuntimeCard
                title="WASM image tools"
                body="Image conversion and probing use the bundled imaging WASM package and return Uint8Array values."
              />
            </div>
          </section>

          <section id="exports" className="scroll-mt-20">
            <SectionHeader
              icon={<Boxes className="size-4" />}
              title="Subpath exports"
              description="Every exported path includes matching .d.ts files. All browser tools have catalog subpaths; extracted tools also expose direct compute APIs."
            />
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(12rem,0.9fr)_minmax(16rem,1.2fr)] border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                <span>Import path</span>
                <span>Contents</span>
              </div>
              {exportGroups.map((group) => (
                <div
                  key={group.importPath}
                  className="grid grid-cols-1 gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(12rem,0.9fr)_minmax(16rem,1.2fr)]"
                >
                  <code className="min-w-0 break-words rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {group.importPath}
                  </code>
                  <p className="text-sm text-muted-foreground">{group.contents}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="release" className="scroll-mt-20">
            <SectionHeader
              icon={<Copy className="size-4" />}
              title="Release workflow"
              description="Package versions are produced with Changesets and published from GitHub Releases through npm trusted publishing."
            />
            <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Current release</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd className="font-mono">{PACKAGE_VERSION}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Tag</dt>
                    <dd className="font-mono">core-v{PACKAGE_VERSION}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Access</dt>
                    <dd>public</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <a href={NPM_URL} target="_blank" rel="noreferrer">
                      npm
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={RELEASE_URL} target="_blank" rel="noreferrer">
                      release
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
              <CodeBlock code={publishExample} language="sh" />
            </div>
          </section>

          <section className="rounded-lg border bg-muted/30 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Looking for the tools UI?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The package ships extracted utility logic plus typed entries for every browser tool.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/">
                  Browse tools
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">{icon}</span>
        {title}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function RuntimeCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2 font-mono text-2xs uppercase text-muted-foreground">
        {language}
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}
