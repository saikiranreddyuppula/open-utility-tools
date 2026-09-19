/**
 * Edge entry for Open Utility Tools.
 *
 * The whole app is a static export served from the `ASSETS` binding. Dynamic
 * behavior is limited to canonical-host enforcement (apex → www) and CORS /
 * content-type for agent docs (`/llms.txt`, `/llms-full.txt`, `/catalog.json`,
 * `/llms/*.md`). Everything else is served as a static asset.
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

    const res = await env.ASSETS.fetch(request);
    const type = agentDocType(url.pathname);
    if (!type) return res;

    const headers = new Headers(res.headers);
    headers.set('Content-Type', type);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};

function agentDocType(pathname) {
  if (pathname === '/catalog.json') return 'application/json; charset=utf-8';
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return 'text/markdown; charset=utf-8';
  }
  if (pathname.startsWith('/llms/') && pathname.endsWith('.md')) {
    return 'text/markdown; charset=utf-8';
  }
  return null;
}
