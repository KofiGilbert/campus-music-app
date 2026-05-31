# Campus Music

Campus Music is a splash-screen web app that displays the Campus Music logo, serving as the foundation for a full-featured campus music platform.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/campus-music run dev` — run the frontend (Campus Music web app)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v3 (`artifacts/campus-music/`)
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/campus-music/` — React + Vite frontend (web app, previewPath: `/`)
- `artifacts/api-server/` — Express API backend (previewPath: `/api`)
- `lib/db/src/schema/schema.ts` — DB schema (users table)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `artifacts/campus-music/tailwind.config.ts` — Tailwind theme
- `artifacts/campus-music/src/index.css` — CSS variables and base styles
- `attached_assets/` — Figma-exported image assets
- `artifacts/campus-music/public/figmaAssets/` — Public-served Figma assets (logo, etc.)

## Architecture decisions

- Tailwind v3 (postcss-based) used in the frontend — the original app used v3, so we kept it rather than migrating to v4.
- The frontend uses the custom `queryClient.ts` with credential-forwarding fetch and error handling.
- Wouter router is wrapped with `base={import.meta.env.BASE_URL}` so navigation works under the proxied path.
- Attached assets (Figma exports) live at the workspace root and are accessible via the `@assets` alias in Vite.
- Schema defines a `users` table with UUID primary key.

## Product

Campus Music is a mobile-first music platform for college campuses. Currently shows a branded splash screen with the Campus Music logo.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema changes before starting the API server.
- The frontend uses Tailwind v3 (not v4) — do not switch to `@tailwindcss/vite` or `@import "tailwindcss"` syntax.
- Figma assets are served from `public/figmaAssets/` in the frontend artifact.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
