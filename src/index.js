const TMDB_ADDRESS = "https://api.themoviedb.org/3";

const ALLOWED_PATHS = [
  /^\/search\/multi$/,
  /^\/trending\/all\/week$/,
  /^\/movie\/\d+$/,
  /^\/tv\/\d+$/,
];
const ALLOWED_PARAMETERS = ["query", "include_adult", "language", "append_to_response"];
const ALLOWED_EXTRA_PARTS = ["credits", "release_dates", "content_ratings", "translations"];
const LONGEST_QUERY = 200;

const SECONDS_TO_KEEP_DETAILS = 24 * 60 * 60;
const SECONDS_TO_KEEP_SEARCHES = 60 * 60;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET") return plainReply(405, "Only GET requests are allowed");

    const requestUrl = new URL(request.url);
    const refusal = refusalFor(requestUrl);
    if (refusal) return refusal;

    const callerAddress = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.REQUESTS_PER_ADDRESS.limit({ key: rateLimitKeyFor(callerAddress) });
    if (!success) return plainReply(429, "Too many requests, try again in a minute");

    if (!env.TMDB_API_KEY) return plainReply(500, "The TMDB key isn't set up");

    const cacheKey = new Request(sortedUrl(requestUrl).toString());
    const cachedReply = await caches.default.match(cacheKey);
    if (cachedReply) return cachedReply;

    const tmdbUrl = new URL(TMDB_ADDRESS + requestUrl.pathname);
    for (const [name, value] of requestUrl.searchParams) tmdbUrl.searchParams.set(name, value);
    if (requestUrl.pathname === "/search/multi") tmdbUrl.searchParams.set("include_adult", "false");
    tmdbUrl.searchParams.set("api_key", env.TMDB_API_KEY);

    const tmdbReply = await fetch(tmdbUrl, { headers: { Accept: "application/json" } });
    const secondsToKeep = isDetailsPath(requestUrl.pathname) ? SECONDS_TO_KEEP_DETAILS : SECONDS_TO_KEEP_SEARCHES;
    const reply = new Response(tmdbReply.body, {
      status: tmdbReply.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": tmdbReply.ok ? `public, max-age=${secondsToKeep}` : "no-store",
      },
    });
    if (tmdbReply.ok) ctx.waitUntil(caches.default.put(cacheKey, reply.clone()));
    return reply;
  },
};

function refusalFor(requestUrl) {
  if (!ALLOWED_PATHS.some((allowedPath) => allowedPath.test(requestUrl.pathname))) {
    return plainReply(404, "Not found");
  }
  for (const [name, value] of requestUrl.searchParams) {
    if (!ALLOWED_PARAMETERS.includes(name)) return plainReply(400, `Unknown parameter: ${name}`);
    if (name === "query" && value.length > LONGEST_QUERY) return plainReply(400, "Search text is too long");
    if (name === "append_to_response" && !value.split(",").every((part) => ALLOWED_EXTRA_PARTS.includes(part))) {
      return plainReply(400, "Unknown extra part");
    }
  }
  return null;
}

function rateLimitKeyFor(address) {
  if (!address.includes(":")) return address;
  const [start, end = ""] = address.split("::");
  const startGroups = start ? start.split(":") : [];
  const endGroups = end ? end.split(":") : [];
  const missingGroups = Array(Math.max(0, 8 - startGroups.length - endGroups.length)).fill("0");
  return [...startGroups, ...missingGroups, ...endGroups].slice(0, 4).join(":");
}

function isDetailsPath(path) {
  return path.startsWith("/movie/") || path.startsWith("/tv/");
}

function sortedUrl(requestUrl) {
  const url = new URL(requestUrl.origin + requestUrl.pathname);
  const sortedParameters = [...requestUrl.searchParams].sort(([first], [second]) => first.localeCompare(second));
  for (const [name, value] of sortedParameters) url.searchParams.set(name, value);
  return url;
}

function plainReply(status, message) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
