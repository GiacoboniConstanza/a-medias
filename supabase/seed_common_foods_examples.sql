-- Alimentos de ejemplo para desarrollo local (NO son ARGENFOODS).
-- Listado en [db.seed] sql_paths de config.toml (db reset). Sin meta-comandos psql.
insert into public.common_foods (
  id, name, search_name,
  protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g,
  portions, source
) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Café con leche (ejemplo)',
    'cafe con leche ejemplo',
    3.3, 5.0, 3.3, 63,
    '[{"label":"Taza","grams":120,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Tostadas de pan francés (ejemplo)',
    'tostadas de pan frances ejemplo',
    8.3, 55.0, 1.7, 268,
    '[{"label":"2 rebanadas","grams":60,"suggested":true},{"label":"1 rebanada","grams":30}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Queso crema (ejemplo)',
    'queso crema ejemplo',
    6.7, 6.7, 26.7, 293,
    '[{"label":"Cucharada","grams":15,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'Milanesa de pollo al horno (ejemplo)',
    'milanesa de pollo al horno ejemplo',
    20.0, 10.0, 6.7, 180,
    '[{"label":"Mediana","grams":150,"suggested":true},{"label":"Chica","grams":100}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'Puré de papas (ejemplo)',
    'pure de papas ejemplo',
    1.9, 16.7, 1.9, 91,
    '[{"label":"Taza","grams":210,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'Huevo duro (ejemplo)',
    'huevo duro ejemplo',
    12.6, 1.1, 10.6, 155,
    '[{"label":"2 unidades","grams":100,"suggested":true},{"label":"1 unidad","grams":50}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'Banana (ejemplo)',
    'banana ejemplo',
    0.8, 22.5, 0.0, 93,
    '[{"label":"Mediana","grams":120,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'Arroz blanco cocido (ejemplo)',
    'arroz blanco cocido ejemplo',
    2.7, 28.2, 0.3, 130,
    '[{"label":"Taza","grams":158,"suggested":true}]'::jsonb,
    'example'
  )
on conflict (id) do nothing;
