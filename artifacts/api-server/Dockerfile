# syntax=docker/dockerfile:1
#
# API server image for Fly.io. Multi-stage: build the esbuild bundle in a full
# workspace, then ship a pruned, production-only deploy.
#
# NOTE (Phase 0): not yet built/deployed — no Docker available in the dev box and
# the Fly app has no payment method yet (deploy blocked). Reviewed as IaC; will be
# verified with `fly deploy` once billing is enabled.

# ---- Builder ----------------------------------------------------------------
FROM node:24-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# Install with a frozen lockfile for reproducible builds.
COPY . .
RUN pnpm install --frozen-lockfile

# Build the api-server bundle (esbuild -> dist/index.mjs).
RUN pnpm --filter @workspace/api-server run build

# Produce a pruned, self-contained, production-only deploy directory.
RUN pnpm --filter=@workspace/api-server deploy --prod /app

# ---- Runtime ----------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# PORT is provided by Fly (fly.toml [env]); the server reads process.env.PORT.

COPY --from=builder /app /app

EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
