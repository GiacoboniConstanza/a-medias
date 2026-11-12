#!/usr/bin/env bash
# Corre las pruebas pgTAP de Comidas contra Postgres LOCAL (sin Docker, sin Production).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MEALS_TEST_DB:-a_medias_meals_test}"

echo "Destino: socket local user=postgres db=${DB_NAME}. No es Production (qjjdcauwovbdlacuslgt)."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/scripts/sql/meals_privacy_bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261028160000_meals.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261113090000_meals_redesign.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

echo "Corriendo meals_privacy_test.sql + meals_redesign_privacy_test.sql"
cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" \
  supabase/tests/meals_privacy_test.sql \
  supabase/tests/meals_redesign_privacy_test.sql
