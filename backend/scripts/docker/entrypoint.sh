#!/bin/sh
set -eu

if [ "${PRISMA_SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Application des migrations Prisma..."
  # Increase connection and query timeout for Prisma migrations
  export PRISMA_CLIENT_ENGINE_TIMEOUT=300000
  npx prisma migrate deploy --skip-verify
fi

exec "$@"
