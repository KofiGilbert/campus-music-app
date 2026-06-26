# syntax=docker/dockerfile:1
#
# API server image for Fly.io. Multi-stage: build the esbuild bundle in a full
# workspace, then ship a pruned, production-only deploy that runs as non-root.
#
# NOTE (Phase 0): not yet built/deployed — no Docker on the dev box and the Fly
# app has no payment method yet (deploy blocked). Reviewed as IaC; will be
# verified with `fly deploy` once billing is enabled.

# ---- Builder ----------------------------------------------------------------
FROM node:24-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# Dependency layer first, keyed only on the lockfile + workspace manifest so it
# stays cached across source-only changes. `pnpm fetch` populates the store from
# the lockfile alone (it needs neither package.json files nor source).
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# Now bring in the full workspace and install offline from the fetched store.
COPY . .
RUN pnpm install --frozen-lockfile --offline

# Build the api-server bundle (esbuild -> dist/index.mjs).
RUN pnpm --filter @workspace/api-server run build

# Produce a pruned, self-contained, production-only deploy directory.
RUN pnpm --filter=@workspace/api-server deploy --prod /app

# ---- Runtime ----------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# PORT is provided by Fly (fly.toml [env]); the server reads process.env.PORT.

# Copy the pruned deploy as the unprivileged `node` user (present in the base
# image) and drop root for the runtime.
COPY --from=builder --chown=node:node /app /app
USER node

EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
