# emberr-tmdb-proxy

Cloudflare Worker that Emberr's movie and show search goes through. It holds the TMDB API key so the app doesn't have to.

It only forwards the four TMDB endpoints Emberr uses (`search/multi`, `trending/all/week`, `movie/{id}`, `tv/{id}`), limits each IP (each /64 on IPv6) to 120 requests a minute, and caches replies. Posters load straight from `image.tmdb.org`.

## Deploy

```
npx wrangler login
npx wrangler secret put TMDB_API_KEY
npx wrangler deploy
```

Use the TMDB v3 API key. Running `secret put` again swaps the key without an app update.
