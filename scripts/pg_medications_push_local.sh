#!/usr/bin/env bash
# Corre pgTAP de push genérico + medicamentos contra Postgres LOCAL.
# Destino: socket local user=postgres. NO es Production (qjjdcauwovbdlacuslgt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MEDS_PUSH_TEST_DB:-a_medias_meds_push_test}"

echo "Destino: socket local user=postgres db=${DB_NAME}. No es Production (qjjdcauwovbdlacuslgt)."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/scripts/sql/medications_push_bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261113130000_push_reminders.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261113130100_medications.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

echo "Confirmación destino: $(sudo -u postgres psql -d "${DB_NAME}" -tAc "select current_database() || ' @ local'")"

cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" \
  supabase/tests/push_reminders_privacy_test.sql \
  supabase/tests/medications_privacy_test.sql \
  supabase/tests/medications_reminders_sync_test.sql
