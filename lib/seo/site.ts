/**
 * Canonical site identity used across metadata, JSON-LD, sitemap, and the OG
 * image generator. Single source of truth so the host/handles never drift.
 *
 * Host is the canonical https + www form (worker.js 301s the apex to www and
 * next.config has trailingSlash:true) — every emitted URL must match exactly,
 * or canonical/sitemap/og:url send conflicting signals to crawlers.
 */
export const SITE_URL = 'https://www.openutilitytools.com';
export const SITE_NAME = 'Open Utility Tools';
export const SITE_TAGLINE = 'Open Utility Tools — 100% in your browser';

export const GITHUB_URL = 'https://github.com/saikiranreddyuppula/open-utility-tools';
export const X_HANDLE = '@saikiranreddy_u';
export const X_URL = 'https://x.com/saikiranreddy_u';

/** OG image canvas — 1.91:1, the one size every social platform renders. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Absolute OG image URLs (must be absolute — some scrapers ignore metadataBase). */
export const toolOgImage = (slug: string) => `${SITE_URL}/og/${slug}.png`;
export const categoryOgImage = (id: string) => `${SITE_URL}/og/category-${id}.png`;
export const HOME_OG_IMAGE = `${SITE_URL}/og/home.png`;
/** Raster logo for schema.org Organization.logo (SVG is not accepted there). */
export const LOGO_URL = `${SITE_URL}/og/logo-512.png`;
