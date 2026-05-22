#!/usr/bin/env bash
# ============================================================================
# PepNationRX - database schema and migration runner.
# ----------------------------------------------------------------------------
# Applies the base schema and then every numbered migration, in order, against
# the database named by DATABASE_URL. Intended for a fresh database or a
# controlled deployment step; it is not a substitute for a migration ledger.
#
# Usage:  DATABASE_URL=postgres://user:pass@host:5432/pepnationrx \
#           infra/scripts/run-migrations.sh
# ============================================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

# Resolve the database directory relative to this script's location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "${SCRIPT_DIR}/../../database" && pwd)"

echo "Applying base schema: ${DB_DIR}/schema.sql"
psql "${DATABASE_URL}" --set ON_ERROR_STOP=1 --file "${DB_DIR}/schema.sql"

# Apply every migration in ascending filename order.
if [ -d "${DB_DIR}/migrations" ]; then
  for migration in $(find "${DB_DIR}/migrations" -name '*.sql' | sort); do
    echo "Applying migration: ${migration}"
    psql "${DATABASE_URL}" --set ON_ERROR_STOP=1 --file "${migration}"
  done
fi

echo "Database schema and migrations applied successfully."
