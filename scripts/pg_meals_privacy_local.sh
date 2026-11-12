#!/usr/bin/env bash
# Corre las pruebas pgTAP de Comidas contra Postgres LOCAL (sin Docker, sin Production).
# Simula db reset: migración (tabla vacía) + tramo common_foods del seed, luego pg_prove.
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

# La migración no debe insertar filas (el seed sí). Se comprueba acá, no en el .sql de pgTAP.
EMPTY_COUNT="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from public.common_foods")"
if [[ "${EMPTY_COUNT}" != "0" ]]; then
  echo "Fallo: la migración dejó ${EMPTY_COUNT} filas en common_foods (quería 0)."
  exit 1
fi
echo "OK: common_foods vacía tras la migración."

# Carga el tramo de ejemplos del seed (como haría db reset).
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/seed_common_foods_examples.sql"
SEEDED="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from public.common_foods")"
echo "OK: seed de ejemplos cargado (${SEEDED} filas)."

echo "Corriendo meals_privacy_test.sql + meals_redesign_privacy_test.sql"
cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" \
  supabase/tests/meals_privacy_test.sql \
  supabase/tests/meals_redesign_privacy_test.sql
