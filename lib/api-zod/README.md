# @workspace/api-zod

Zod request/response schemas generated from `lib/api-spec/openapi.yaml` (via orval).
Shared between the API server (validation) and clients. Do not hand-edit
`src/generated/` — change the OpenAPI spec and regenerate
(`pnpm --filter @workspace/api-spec run codegen`).

## Operational endpoints are intentionally NOT in the spec

The OpenAPI spec is the **client contract** (it generates the React Query client
and these zod schemas). Operational/infra endpoints are consumed only by
Fly.io / monitoring — they have no client — so they are deliberately kept out of
the spec to avoid generating dead hooks:

- `GET /api/healthz` — liveness (process up; no DB).
- `GET /api/readyz` — readiness (DB reachable; 503 when not).

If you see one of these "missing from the spec", that's intentional — don't add
it (and don't delete the route).
