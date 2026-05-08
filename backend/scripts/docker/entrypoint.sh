#!/bin/sh
set -eu

if [ "${PRISMA_SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Application des migrations Prisma..."
  npx prisma migrate deploy
fi

exec "$@"
