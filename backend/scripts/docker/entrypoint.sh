#!/bin/sh
set -eu

if [ "${PRISMA_SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Application des migrations Prisma..."
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "Erreur: DATABASE_URL est absent. Impossible d'appliquer les migrations Prisma." >&2
    exit 1
  fi

  # Increase connection and query timeout for Prisma migrations
  export PRISMA_CLIENT_ENGINE_TIMEOUT=300000
  npx prisma migrate deploy
fi

exec "$@"
