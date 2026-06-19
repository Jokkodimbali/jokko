#!/bin/sh
set -eu

if [ "${PRISMA_SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Application des migrations Prisma..."
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "Erreur: DATABASE_URL est absent. Impossible d'appliquer les migrations Prisma." >&2
    exit 1
  fi

  if [ -n "${PRISMA_MIGRATE_DATABASE_URL:-}" ]; then
    echo "Prisma migrate utilise PRISMA_MIGRATE_DATABASE_URL."
  elif [ -n "${DIRECT_URL:-}" ]; then
    echo "Prisma migrate utilise DIRECT_URL."
  else
    echo "Prisma migrate utilise DATABASE_URL."
  fi

  # Increase connection and query timeout for Prisma migrations
  export PRISMA_CLIENT_ENGINE_TIMEOUT=300000

  max_attempts="${PRISMA_MIGRATE_MAX_ATTEMPTS:-8}"
  attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    echo "Tentative Prisma migrate deploy ${attempt}/${max_attempts}..."
    if npx prisma migrate deploy; then
      echo "Migrations Prisma appliquees avec succes."
      break
    fi

    if [ "$attempt" -eq "$max_attempts" ]; then
      echo "Erreur: impossible d'appliquer les migrations Prisma apres ${max_attempts} tentative(s)." >&2
      exit 1
    fi

    sleep_seconds=$((attempt * 10))
    if [ "$sleep_seconds" -gt 60 ]; then
      sleep_seconds=60
    fi
    echo "Migration Prisma temporairement indisponible. Nouvelle tentative dans ${sleep_seconds}s..."
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done
fi

exec "$@"
