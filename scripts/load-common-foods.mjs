#!/usr/bin/env node
/**
 * Lista «De todos los días» (ARGENFOODS) desde un archivo LOCAL que NO va al repo.
 *
 * Formato JSON (ver data/common-foods.example.json):
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
 * --- Modo SQL (recomendado para que la usuaria cargue en Production ella misma) ---
 * Genera data/argenfoods.sql (idempotente, ignorado por git). Los bots no lo aplican.
 *
 *   node scripts/load-common-foods.mjs --sql data/argenfoods.json
 *
 * Después del respaldo, en la máquina de la usuaria (linked al proyecto):
 *
 *   npx supabase db query --remote -f data/argenfoods.sql
 *
 * (`db query --remote` existe en la CLI del repo; pide confirmación / token con
 * database_write. No usar --yes desde un bot.)
 *
 * --- Modo carga local (psql; aborta si la URL parece Production) ---
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     node scripts/load-common-foods.mjs data/argenfoods.json
 *
 * data/argenfoods.json y data/argenfoods.sql están en .gitignore.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const sqlMode = args.includes('--sql')
const file = args.find((arg) => arg !== '--sql')
const databaseUrl = process.env.DATABASE_URL ?? ''
const outSql = resolve('data/argenfoods.sql')

if (!file) {
  console.error('Uso:')
  console.error('  node scripts/load-common-foods.mjs --sql data/argenfoods.json')
  console.error('  DATABASE_URL=... node scripts/load-common-foods.mjs data/argenfoods.json')
  process.exit(1)
}

if (!sqlMode) {
  if (!databaseUrl) {
    console.error('Falta DATABASE_URL (modo carga local). Para solo generar SQL usá --sql.')
    process.exit(1)
  }
  if (/qjjdcauwovbdlacuslgt/i.test(databaseUrl)) {
    console.error('Abortado: esa URL parece el proyecto de Production. No cargo ahí.')
    console.error('Generá el SQL con --sql y que la usuaria lo aplique con:')
    console.error('  npx supabase db query --remote -f data/argenfoods.sql')
    process.exit(1)
  }
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

function buildStatements(rows, { withProbe } = { withProbe: false }) {
  const statements = []
  if (withProbe) {
    statements.push(
      "select current_database() as db, coalesce(inet_server_addr()::text, 'socket') as addr;",
    )
  }
  statements.push('-- Carga idempotente de common_foods (source=argenfoods).')
  statements.push('-- Upsert por search_name (nombre normalizado).')
  statements.push('begin;')
  let count = 0
  for (const row of rows) {
    const name = String(row.name ?? '').trim()
    if (!name) continue
    const searchName = normalize(name)
    const portions = JSON.stringify(Array.isArray(row.portions) ? row.portions : [])
    statements.push(`delete from public.common_foods where search_name = ${sqlLiteral(searchName)};`)
    statements.push(`insert into public.common_foods (
  name, search_name, protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g, portions, source
) values (
  ${sqlLiteral(name)},
  ${sqlLiteral(searchName)},
  ${sqlLiteral(row.protein_per_100g ?? null)},
  ${sqlLiteral(row.carbs_per_100g ?? null)},
  ${sqlLiteral(row.fat_per_100g ?? null)},
  ${sqlLiteral(row.kcal_per_100g ?? null)},
  ${sqlLiteral(portions)}::jsonb,
  'argenfoods'
);`)
    count += 1
  }
  statements.push('commit;')
  return { statements, count }
}

const { statements, count } = buildStatements(raw, { withProbe: !sqlMode })

if (sqlMode) {
  const header = [
    '-- Generado por scripts/load-common-foods.mjs --sql',
    '-- NO commitear. Aplicar a mano después del respaldo:',
    '--   npx supabase db query --remote -f data/argenfoods.sql',
    '',
  ]
  writeFileSync(outSql, `${header.join('\n')}${statements.join('\n')}\n`)
  console.log(`Generado ${outSql} (${count} alimentos). No se conectó a ninguna base.`)
  console.log('Para cargarlo en el proyecto linkeado (lo corre la usuaria, no un bot):')
  console.log('  npx supabase db query --remote -f data/argenfoods.sql')
  process.exit(0)
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
console.log(`Listo: ${count} filas procesadas en local (source=argenfoods).`)
