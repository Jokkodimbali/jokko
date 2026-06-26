#!/bin/sh
set -eu

is_placeholder_database_url() {
  case "${1:-}" in
    *...*|*ep-xxx*|*@host:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if [ "${PRISMA_SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Application des migrations Prisma..."
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "Erreur: DATABASE_URL est absent. Impossible d'appliquer les migrations Prisma." >&2
    exit 1
  fi

  if is_placeholder_database_url "${PRISMA_MIGRATE_DATABASE_URL:-}"; then
    echo "Avertissement: PRISMA_MIGRATE_DATABASE_URL contient une URL d'exemple; fallback vers DATABASE_URL." >&2
    unset PRISMA_MIGRATE_DATABASE_URL
  fi

  if is_placeholder_database_url "${DIRECT_URL:-}"; then
    echo "Avertissement: DIRECT_URL contient une URL d'exemple; fallback vers DATABASE_URL." >&2
    unset DIRECT_URL
  fi

  if [ -n "${PRISMA_MIGRATE_DATABASE_URL:-}" ]; then
    echo "Prisma migrate utilise PRISMA_MIGRATE_DATABASE_URL."
  elif [ -n "${DIRECT_URL:-}" ]; then
    echo "Prisma migrate utilise DIRECT_URL."
  else
    echo "Prisma migrate utilise DATABASE_URL."
    if echo "$DATABASE_URL" | grep -q -- "-pooler\\."; then
      echo "Avertissement: DATABASE_URL semble pointer vers un pooler Neon. Extraction automatique de l'URL directe pour les migrations..." >&2
      PRISMA_MIGRATE_DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed 's/-pooler\\././')
      export PRISMA_MIGRATE_DATABASE_URL
      echo "Prisma migrate utilisera l'URL directe extraite de DATABASE_URL." >&2
    fi
  fi

  echo "Verification et reparation automatique des migrations Prisma bloquees..."
  if node scripts/fix-stuck-prisma-migration.mjs; then
    echo "Reparation des migrations terminee."
  else
    echo "Avertissement: la reparation automatique a echoue. Les migrations peuvent ne pas s'appliquer." >&2
  fi

  # Increase connection and query timeout for Prisma migrations
  export PRISMA_CLIENT_ENGINE_TIMEOUT=300000

  max_attempts="${PRISMA_MIGRATE_MAX_ATTEMPTS:-3}"
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
    if [ "$sleep_seconds" -gt 30 ]; then
      sleep_seconds=30
    fi
    echo "Migration Prisma temporairement indisponible. Nouvelle tentative dans ${sleep_seconds}s..."
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done
fi

exec "$@"
