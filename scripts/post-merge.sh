#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply any pending versioned SQL migrations (replaces the old `db push`).
# Requires DATABASE_URL in the environment. See lib/db/README.md.
pnpm --filter db migrate
