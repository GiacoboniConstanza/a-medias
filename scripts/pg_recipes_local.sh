#!/usr/bin/env bash
# Simula el flujo real de Coty: migraciones + seed.sql + seed_common_foods_examples.sql
# y después pg_prove de TODOS los tests en supabase/tests.
# Destino: socket local user=postgres. No es Production (qjjdcauwovbdlacuslgt).
# Sin Docker: usa Postgres local (mismas reglas sagradas).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${RECIPES_TEST_DB:-a_medias_recipes_test}"
SUPABASE_DIR="${ROOT}/supabase"
CONFIG="${SUPABASE_DIR}/config.toml"

echo "Destino: socket local user=postgres db=${DB_NAME}. No es Production (qjjdcauwovbdlacuslgt)."

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
    grep -nE '^\s*\\' "${seed_file}" || true
    exit 1
  fi
done

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
SQL

echo "Bootstrap auth local + migraciones"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/scripts/sql/db_reset_local_bootstrap.sql"

mapfile -t MIGRATIONS < <(ls -1 "${SUPABASE_DIR}/migrations/"*.sql | sort)
for migration in "${MIGRATIONS[@]}"; do
  echo "  migración: ${migration##*/}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${migration}"
done

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

echo "Aplicando seeds (como db reset)"
for rel in "${SEED_REL_PATHS[@]}"; do
  seed_file="${SUPABASE_DIR}/${rel#./}"
  echo "  seed: ${rel}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${seed_file}"
done

SEEDED_USERS="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from auth.users where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')")"
SEEDED_FOODS="$(sudo -u postgres psql -d "${DB_NAME}" -tAc "select count(*) from public.common_foods")"
echo "OK: seed users Coty/Maru=${SEEDED_USERS}, common_foods=${SEEDED_FOODS}"

echo "Corriendo TODOS los tests de supabase/tests con pg_prove"
cd "${ROOT}"
sudo -u postgres pg_prove -d "${DB_NAME}" supabase/tests/*_test.sql
