# ChudLog

The private ChudLog progressive web application. This repository contains the React interface and the deterministic client-side display rules. The server remains authoritative for authentication, validation, scoring, and stored records and lives in the private `ChudLog-API` repository.

## Local development

Run the API on `http://127.0.0.1:8787`, then:

```sh
npm ci
npm run dev
```

Vite serves the app on `http://127.0.0.1:5173` and proxies `/api` to the local API. Run `npm run typecheck`, `npm test`, and `npm run build` before merging.

## Container

The production image builds the PWA and serves it with Caddy. Its Caddy configuration proxies `/api/*` to a Compose service named `api`. The adjacent `ChudLog-API` repository owns the combined deployment stack.
