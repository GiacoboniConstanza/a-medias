import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, FieldError, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  createCategory,
  deleteCategory,
  loadCategoryUsage,
  updateCategory,
  type Category,
  type CategoryUsageRow,
} from '../lib/api.ts'
import { iconSurface } from '../lib/icons.ts'

export function CategoriesScreen() {
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const [usage, setUsage] = useState<CategoryUsageRow[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('star')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [moveTo, setMoveTo] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const categories = useMemo(
    () => [...(data?.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data?.categories],
  )
  const usageById = useMemo(() => new Map(usage.map((row) => [row.categoryId, row])), [usage])
  const editingUsage = editing ? usageById.get(editing.id) : undefined
  const needsMove = Boolean(editingUsage?.hasLinks)
  const canDelete = categories.length > 1

  const reloadUsage = useCallback(async () => {
    try {
      setUsage(await loadCategoryUsage())
    } catch {
      setUsage([])
    }
  }, [])

  useEffect(() => {
    void reloadUsage()
  }, [reloadUsage, data?.categories])

  function openNew() {
    setEditing(null)
    setName('')
    setIcon('star')
    setError('')
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setName(category.name)
    setIcon(category.icon || 'star')
    setError('')
    setSheetOpen(true)
  }

  async function save() {
    const trimmed = name.trim().slice(0, 24)
    if (!trimmed || !profile?.householdId) return
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateCategory({ id: editing.id, name: trimmed, icon })
      } else {
        await createCategory({ householdId: profile.householdId, name: trimmed, icon })
      }
      setSheetOpen(false)
      await refresh()
      await reloadUsage()
      setToast('Listo.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    if (needsMove && !moveTo) return
    setSaving(true)
    setError('')
    try {
      await deleteCategory(editing.id, needsMove ? moveTo : null)
      setConfirmOpen(false)
      setSheetOpen(false)
      setEditing(null)
      setMoveTo(null)
      await refresh()
      await reloadUsage()
      setToast('Listo.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude borrar.')
    } finally {
      setSaving(false)
    }
  }

  const others = categories.filter((category) => category.id !== editing?.id)
  const nameError = error === 'Ya hay una con ese nombre.' ? error : ''
  const otherError = nameError ? '' : error

  return (
    <>
      <SectionHeader lead="back" backTo="/ajustes" title="Categorías" screenTitle />
      <Button type="button" variant="alt" className="mt-2" onClick={openNew}>
        <span className="inline-flex items-center gap-2">
          <AppIcon name="plus" /> Nueva
        </span>
      </Button>
      <div className="mt-4 overflow-hidden rounded-2xl border-2 border-azul-ink bg-tarjeta">
        {categories.map((category) => {
          const surface = iconSurface(category.icon)
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => openEdit(category)}
              className="grid min-h-[68px] w-full grid-cols-[40px_1fr_24px] items-center gap-3 border-b border-dashed border-linea-punteada px-3.5 py-2.5 text-left last:border-0"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full border-2 text-base"
                style={{ background: surface.background, color: surface.color, borderColor: surface.border }}
              >
                <AppIcon name={category.icon} />
              </span>
              <span className="truncate font-display text-lg font-semibold text-tinta">{category.name}</span>
              <AppIcon name="chevron-right" className="justify-self-end text-tinta" />
            </button>
          )
        })}
      </div>

      <Sheet
        open={sheetOpen}
        title={editing ? editing.name : 'Nueva categoría'}
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="space-y-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>
              Guardar
            </Button>
            {editing && canDelete ? (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-rosa-texto"
                disabled={saving}
                onClick={() => {
                  setMoveTo(null)
                  setError('')
                  setConfirmOpen(true)
                }}
              >
                <AppIcon name="trash-can" /> Borrar
              </button>
            ) : null}
          </div>
        }
      >
        <label className="mb-4 block text-sm font-semibold text-gris">
          Nombre
          <input
            value={name}
            maxLength={24}
            autoFocus={!editing}
            onChange={(event) => setName(event.target.value.slice(0, 24))}
            className={`mt-1.5 ${inputClass} ${nameError ? 'border-2 border-rosa-texto' : ''}`}
          />
        </label>
        {nameError ? <FieldError>{nameError}</FieldError> : null}
        <p className="mb-2 text-sm font-semibold text-gris">Ícono</p>
        <IconPicker layout="grid" value={icon} onChange={setIcon} />
        {otherError ? <FieldError>{otherError}</FieldError> : null}
      </Sheet>

      <ConfirmSheet
        open={confirmOpen}
        title={editing ? `¿Borrar ${editing.name}?` : '¿Borrar?'}
        confirmLabel="Borrar"
        variant="danger"
        tallCancel
        busy={saving}
        disabled={needsMove && !moveTo}
        error={otherError || null}
        onClose={() => {
          setConfirmOpen(false)
          setMoveTo(null)
        }}
        onConfirm={() => void remove()}
      >
        {needsMove ? (
          <>
            <p className="text-sm font-semibold text-gris">Sus gastos pasan a:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((category) => (
                <Chip key={category.id} active={moveTo === category.id} onClick={() => setMoveTo(category.id)}>
                  <AppIcon name={category.icon} className="text-sm" />
                  {category.name}
                </Chip>
              ))}
            </div>
          </>
        ) : (
          <p className="text-base font-semibold text-tinta">Se saca de la lista.</p>
        )}
      </ConfirmSheet>

      <Toast onDone={() => setToast('')}>{toast}</Toast>
    </>
  )
}
