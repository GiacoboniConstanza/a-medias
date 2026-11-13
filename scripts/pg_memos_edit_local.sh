#!/usr/bin/env bash
# Corre las pruebas pgTAP de memos editar/eliminar contra Postgres LOCAL.
# Destino: socket local user=postgres. No es Production (qjjdcauwovbdlacuslgt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MEMOS_TEST_DB:-a_medias_memos_test}"

echo "Destino: socket local user=postgres db=${DB_NAME}. No es Production (qjjdcauwovbdlacuslgt)."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/scripts/sql/memos_edit_bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261028140000_hub_modules_and_memos.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261113120000_memos_done_at.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

echo "Corriendo memos_edit_test.sql"
cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" supabase/tests/memos_edit_test.sql
