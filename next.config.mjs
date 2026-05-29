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

  // Surface real type errors during the build (TS strict everywhere).
  typescript: { ignoreBuildErrors: false },

  reactStrictMode: true,
};

export default nextConfig;
