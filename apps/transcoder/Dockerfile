# syntax=docker/dockerfile:1
#
# Audio transcoding worker for Fly.io. Node 22 + ffmpeg; runs the TS worker via
# tsx. sharp's native binary is installed by pnpm (allowBuilds in
# pnpm-workspace.yaml). Needs DATABASE_URL + R2_* in the environment.
#
# NOTE (Phase 2): IaC only — not yet built/deployed (no Docker on the dev box;
# Fly billing pending). Reviewed as infrastructure.

FROM node:22-slim
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ffmpeg for audio transcoding.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Dependency layer first (cached across source-only changes).
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline

WORKDIR /repo/apps/transcoder
ENV NODE_ENV=production
CMD ["pnpm", "start"]
