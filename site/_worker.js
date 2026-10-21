// Cloudflare Pages advanced mode. Access protects the production custom hostname.
// Reject alternate Pages hostnames so they cannot expose an ungated copy.
export default {
  async fetch(request, env) {
    if (new URL(request.url).hostname !== "project-2624.bldgtyp.com") {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const { pathname } = new URL(request.url);
    if (pathname === "/results" || pathname === "/results.html")
      return Response.redirect(new URL("/annual-energy", request.url), 301);
    return env.ASSETS.fetch(request);
  },
};
