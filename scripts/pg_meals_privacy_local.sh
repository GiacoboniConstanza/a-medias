#!/usr/bin/env bash
# Corre las pruebas pgTAP de Comidas contra Postgres LOCAL (sin Docker, sin Production).
# Simula db reset: migración (tabla vacía) + seed vía sql_paths (como la CLI), luego pg_prove.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MEALS_TEST_DB:-a_medias_meals_test}"
SUPABASE_DIR="${ROOT}/supabase"
CONFIG="${SUPABASE_DIR}/config.toml"

echo "Destino: socket local user=postgres db=${DB_NAME}. No es Production (qjjdcauwovbdlacuslgt)."

# Misma lista que [db.seed] sql_paths (la CLI no soporta \i / \ir).
mapfile -t SEED_REL_PATHS < <(
  python3 - <<'PY' "${CONFIG}"
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
block = re.search(r"\[db\.seed\](.*?)(\n\[|\Z)", text, re.S)
if not block:
    raise SystemExit("No encontré [db.seed] en config.toml")
assign = re.search(r"sql_paths\s*=\s*\[(.*?)\]", block.group(1), re.S)
if not assign:
    raise SystemExit("No encontré sql_paths = [...] en [db.seed]")
paths = re.findall(r'"(\./[^"]+\.sql)"', assign.group(1))
if not paths:
    raise SystemExit("sql_paths vacío en [db.seed]")
print("\n".join(paths))
PY
)

echo "Seed sql_paths: ${SEED_REL_PATHS[*]}"
for rel in "${SEED_REL_PATHS[@]}"; do
  seed_file="${SUPABASE_DIR}/${rel#./}"
  if [[ ! -f "${seed_file}" ]]; then
    echo "Fallo: falta ${seed_file}"
    exit 1
  fi
  if grep -nE '^\s*\\' "${seed_file}" >/dev/null; then
    echo "Fallo: ${rel} usa meta-comandos de psql (\\\\i / \\\\ir / etc.)."
    echo "La CLI de Supabase manda el seed en batch y falla con syntax error near \"\\\"."
    grep -nE '^\s*\\' "${seed_file}" || true
    exit 1
  fi
done
echo "OK: ningún seed en sql_paths usa meta-comandos de psql."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/scripts/sql/meals_privacy_bootstrap.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261028160000_meals.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/migrations/20261113090000_meals_redesign.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

EMPTY_COUNT="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from public.common_foods")"
if [[ "${EMPTY_COUNT}" != "0" ]]; then
  echo "Fallo: la migración dejó ${EMPTY_COUNT} filas en common_foods (quería 0)."
  exit 1
fi
echo "OK: common_foods vacía tras la migración."

# Este harness no tiene el esquema completo de seed.sql (hogares, ahorros, etc.).
# Aplica el seed de common_foods listado en sql_paths, igual que la CLI lo mandaría en batch.
COMMON_SEED=""
for rel in "${SEED_REL_PATHS[@]}"; do
  if [[ "${rel}" == *common_foods* ]]; then
    COMMON_SEED="${SUPABASE_DIR}/${rel#./}"
  fi
done
if [[ -z "${COMMON_SEED}" ]]; then
  echo "Fallo: no hay un seed de common_foods en sql_paths."
  exit 1
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${COMMON_SEED}"
SEEDED="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from public.common_foods")"
echo "OK: seed de ejemplos cargado desde ${COMMON_SEED##*/} (${SEEDED} filas)."

echo "Corriendo meals_privacy_test.sql + meals_redesign_privacy_test.sql"
cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" \
  supabase/tests/meals_privacy_test.sql \
  supabase/tests/meals_redesign_privacy_test.sql
