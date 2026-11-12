#!/usr/bin/env node
/**
 * Carga la lista «De todos los días» desde un archivo LOCAL que NO va al repo.
 *
 * Destino: Postgres local vía `psql` (nunca Production qjjdcauwovbdlacuslgt).
 *
 * Formato JSON (array):
 * [
 *   {
 *     "name": "Leche entera",
 *     "protein_per_100g": 3.2,
 *     "carbs_per_100g": 4.8,
 *     "fat_per_100g": 3.0,
 *     "kcal_per_100g": 61,
 *     "portions": [{ "label": "Taza", "grams": 200, "suggested": true }]
 *   }
 * ]
 *
 * Uso (local, ejemplo con Supabase local en 54322):
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     node scripts/load-common-foods.mjs data/argenfoods.json
 *
 * Production: solo si alguien con acceso corre el mismo comando apuntando
 * a esa base a propósito. Este script aborta si detecta el ref de Production.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const file = process.argv[2]
const databaseUrl = process.env.DATABASE_URL ?? ''

if (!file) {
  console.error('Uso: node scripts/load-common-foods.mjs <archivo.json>')
  process.exit(1)
}
if (!databaseUrl) {
  console.error('Falta DATABASE_URL. Confirmá host y base (local, no Production).')
  process.exit(1)
}
if (/qjjdcauwovbdlacuslgt/i.test(databaseUrl)) {
  console.error('Abortado: esa URL parece el proyecto de Production. No cargo ahí.')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(resolve(file), 'utf8'))
if (!Array.isArray(raw)) {
  console.error('El archivo tiene que ser un array JSON.')
  process.exit(1)
}

function normalize(name) {
  return String(name)
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function sqlLiteral(value) {
  if (value == null) return 'null'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

const statements = [
  "select current_database() as db, coalesce(inet_server_addr()::text, 'socket') as addr;",
]

for (const row of raw) {
  const name = String(row.name ?? '').trim()
  if (!name) continue
  const portions = JSON.stringify(Array.isArray(row.portions) ? row.portions : [])
  statements.push(`delete from public.common_foods where lower(name) = lower(${sqlLiteral(name)});`)
  statements.push(`insert into public.common_foods (
    name, search_name, protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g, portions, source
  ) values (
    ${sqlLiteral(name)},
    ${sqlLiteral(normalize(name))},
    ${sqlLiteral(row.protein_per_100g ?? null)},
    ${sqlLiteral(row.carbs_per_100g ?? null)},
    ${sqlLiteral(row.fat_per_100g ?? null)},
    ${sqlLiteral(row.kcal_per_100g ?? null)},
    ${sqlLiteral(portions)}::jsonb,
    'argenfoods'
  );`)
}

const sqlPath = join(tmpdir(), `load-common-foods-${process.pid}.sql`)
writeFileSync(sqlPath, statements.join('\n'))
const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
  encoding: 'utf8',
})
unlinkSync(sqlPath)
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) process.exit(result.status ?? 1)
console.log(`Listo: ${raw.length} filas procesadas (source=argenfoods).`)
