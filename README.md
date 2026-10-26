# Emberr TMDB proxy

A small Cloudflare Worker that sits between Emberr and TMDB, so the TMDB key never ships inside the app.

- Only the requests Emberr uses are passed on: `search/multi`, `trending/all/week`, `movie/{id}` and `tv/{id}`, with the parameters `query`, `language`, `include_adult` and `append_to_response`. Everything else is refused.
- Each IP address can make 120 requests a minute. Past that the Worker answers 429.
- Replies are kept in Cloudflare's cache: details for a day, searches and trending for an hour.
- Posters and cast photos don't go through the Worker. The app loads them from `image.tmdb.org`, which needs no key.

## Deploy

1. Install Wrangler (version 4.36 or newer) and log in:
   ```
   npm install -g wrangler
   wrangler login
   ```
2. From this folder, store the TMDB v3 API key as a secret:
   ```
   wrangler secret put TMDB_API_KEY
   ```
3. Deploy:
   ```
   wrangler deploy
   ```
   Wrangler prints the Worker's address, like `https://emberr-tmdb.<your-subdomain>.workers.dev`.

To change the key later, run `wrangler secret put TMDB_API_KEY` again. No app update is needed.

## Try it

```
curl "https://emberr-tmdb.<your-subdomain>.workers.dev/search/multi?query=dune&language=en-US"
```

Live logs: `wrangler tail`.
