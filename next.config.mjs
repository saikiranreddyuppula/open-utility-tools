/** @type {import('next').NextConfig} */
const nextConfig = {
  // Full static export — the entire app is served as static files with no Node
  // server. This *enforces* the "no server processing" privacy guarantee.
  output: 'export',

  // No Image Optimization server is available in a static export.
  images: { unoptimized: true },

  // Tools live under /tools/<slug>/ — trailing slash keeps deep links working
  // when self-hosted from a plain static file server (index.html resolution).
  trailingSlash: true,

  // Type checking is NOT run inside `next build` (it added ~12s, serially).
  // Strictness is still enforced: `next build` here runs `tsc` in parallel with
  // the compile (see the "build" script in package.json) and CI runs `typecheck`
  // too, so real type errors still fail the pipeline.
  typescript: { ignoreBuildErrors: true },

  experimental: {
    // Persist Turbopack's compilation cache to disk between production builds so
    // unchanged modules are not recompiled. Cold build is unchanged; warm
    // rebuilds (and CI runs that restore .next/cache) skip most of the ~12s compile.
    turbopackFileSystemCacheForBuild: true,
  },

  reactStrictMode: true,
};

export default nextConfig;
