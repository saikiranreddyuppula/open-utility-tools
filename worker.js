/**
 * Edge entry for Open Utility Tools.
 *
 * The whole app is a static export served from the `ASSETS` binding. The only
 * dynamic behavior is canonical-host enforcement: the apex `openutilitytools.com`
 * (and any non-canonical host) 301-redirects to `www.openutilitytools.com`,
 * preserving the path and query string. Everything else is served as a static asset.
 *
 * `run_worker_first` is enabled in wrangler.jsonc so this runs before asset
 * matching — otherwise the apex's `/` would be served directly without redirecting.
 */
const CANONICAL_HOST = 'www.openutilitytools.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only redirect real custom-domain hosts to the canonical www host; leave
    // *.workers.dev and localhost untouched so previews keep working.
    const host = url.hostname;
    if (host === 'openutilitytools.com') {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
