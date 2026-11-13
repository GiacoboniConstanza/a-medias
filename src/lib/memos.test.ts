import { describe, expect, it } from 'vitest'
import {
  canToggleMemoLabel,
  checkedThisWeek,
  defaultMemoLabelColor,
  deleteLabelBody,
  duplicateLabelNameError,
  groupMemos,
  isMemoGoneMessage,
  labelCountText,
  labelFilterLive,
  memoCharHint,
  memoDeleteError,
  memoLabelAttachError,
  memoLabelCreateError,
  memoSaveError,
  memoShareDetail,
  withLabelCounts,
  type MemoItem,
} from './memos.ts'

const memo = (patch: Partial<MemoItem> & Pick<MemoItem, 'id' | 'ownerId'>): MemoItem => ({
  text: 'Anotar',
  done: false,
  shared: false,
  updatedAt: '2026-10-27T15:00:00.000Z',
  labelIds: [],
  ...patch,
})

describe('checkedThisWeek con done_at', () => {
  const now = new Date(2026, 9, 28)

  it('cuenta por doneAt y no por updatedAt de una edición', () => {
    expect(
      checkedThisWeek(
        [
          memo({
            id: 'a',
            ownerId: 'coty',
            done: true,
            doneAt: '2026-10-27T12:00:00.000Z',
            updatedAt: '2026-10-28T18:00:00.000Z',
          }),
          memo({
            id: 'b',
            ownerId: 'coty',
            done: true,
            doneAt: '2026-10-20T12:00:00.000Z',
            updatedAt: '2026-10-28T18:00:00.000Z',
          }),
          memo({
            id: 'c',
            ownerId: 'maru',
            done: true,
            doneAt: '2026-10-27T12:00:00.000Z',
          }),
        ],
        'coty',
        now,
      ),
    ).toBe(1)
  })

  it('sin doneAt (select viejo) sigue usando updatedAt', () => {
    expect(
      checkedThisWeek(
        [memo({ id: 'a', ownerId: 'coty', done: true, updatedAt: '2026-10-27T15:00:00.000Z' })],
        'coty',
        now,
      ),
    ).toBe(1)
  })

  it('con doneAt null no cuenta aunque updatedAt sea de esta semana', () => {
    expect(
      checkedThisWeek(
        [
          memo({
            id: 'a',
            ownerId: 'coty',
            done: true,
            doneAt: null,
            updatedAt: '2026-10-27T15:00:00.000Z',
          }),
        ],
        'coty',
        now,
      ),
    ).toBe(0)
  })
})

describe('textos de la hoja de memos', () => {
  it('arma el contador desde 350', () => {
    expect(memoCharHint(349)).toBeNull()
    expect(memoCharHint(350)).toBe('Te quedan 50 caracteres.')
    expect(memoCharHint(399)).toBe('Te queda 1 carácter.')
    expect(memoCharHint(400)).toBe('Llegaste a los 400 caracteres.')
  })

  it('cambia la bajada al dejar de compartir', () => {
    expect(memoShareDetail(true, false, 'Maru')).toBe('Lo ve en su Inicio y cualquiera lo puede tachar')
    expect(memoShareDetail(false, true, 'Maru')).toBe('Cuando guardes, Maru deja de verlo')
    expect(memoShareDetail(false, false, 'Maru')).toBe('Lo ve en su Inicio y cualquiera lo puede tachar')
  })

  it('traduce errores de la base al castellano', () => {
    expect(isMemoGoneMessage('No podés editar este memo')).toBe(true)
    expect(memoSaveError('No podés editar este memo')).toBe('Ese memo ya no está o cambió. Actualicé la lista.')
    expect(memoSaveError('network')).toBe('No pude guardar los cambios. Revisá la conexión y probá de nuevo.')
    expect(memoDeleteError()).toBe('No pude eliminar el memo. Revisá la conexión y probá de nuevo.')
  })
})

describe('etiquetas de memos', () => {
  it('filtra por etiqueta y oculta grupos vacíos', () => {
    const items = [
      memo({ id: '1', ownerId: 'coty', shared: true, labelIds: ['casa'] }),
      memo({ id: '2', ownerId: 'coty', shared: false, labelIds: ['super'] }),
      memo({ id: '3', ownerId: 'coty', shared: true, labelIds: ['super', 'casa'] }),
    ]
    expect(groupMemos(items, 'coty', 'casa').shared.map((item) => item.id)).toEqual(['1', '3'])
    expect(groupMemos(items, 'coty', 'casa').solo).toEqual([])
    expect(groupMemos(items, 'coty', 'super').solo.map((item) => item.id)).toEqual(['2'])
  })

  it('elige el primer color libre y permite repetir cuando están los 5', () => {
    expect(defaultMemoLabelColor([])).toBe('menta')
    expect(defaultMemoLabelColor(['menta', 'agua'])).toBe('durazno')
    expect(defaultMemoLabelColor(['menta', 'agua', 'durazno', 'lila', 'avellana'])).toBe('menta')
  })

  it('respeta el tope de 3 al poner', () => {
    expect(canToggleMemoLabel(['a', 'b', 'c'], 'd')).toBe(false)
    expect(canToggleMemoLabel(['a', 'b', 'c'], 'a')).toBe(true)
    expect(canToggleMemoLabel(['a', 'b'], 'c')).toBe(true)
  })

  it('cuenta solo los memos visibles y arma textos', () => {
    const labels = withLabelCounts(
      [
        { id: 'casa', name: 'Casa', color: 'avellana' },
        { id: 'finde', name: 'Finde', color: 'lila' },
      ],
      [
        memo({ id: '1', ownerId: 'coty', labelIds: ['casa'] }),
        memo({ id: '2', ownerId: 'coty', labelIds: ['casa'] }),
      ],
    )
    expect(labels[0]?.count).toBe(2)
    expect(labels[1]?.count).toBe(0)
    expect(labelCountText(0)).toBe('Sin memos')
    expect(labelCountText(1)).toBe('1 memo')
    expect(labelCountText(2)).toBe('2 memos')
    expect(labelFilterLive(0, 'Finde')).toBe('No hay memos con «Finde».')
    expect(labelFilterLive(2, 'Casa')).toBe('2 memos con «Casa»')
    expect(deleteLabelBody(0, 'Maru')).toContain('No la ves en ningún memo')
    expect(deleteLabelBody(1, 'Maru')).toContain('La ves en 1 memo')
    expect(deleteLabelBody(2, 'Maru')).toContain('La ves en 2 memos')
  })

  it('arma errores propios de etiquetas', () => {
    expect(memoLabelAttachError('Finde')).toBe('No pude poner «Finde». Revisá la conexión y probá de nuevo.')
    expect(duplicateLabelNameError('Casa')).toBe('Ya hay una etiqueta «Casa».')
    expect(memoLabelCreateError('Ya hay una etiqueta «Súper»')).toBe('Ya hay una etiqueta «Súper».')
    expect(memoLabelCreateError()).toBe('No pude crear la etiqueta. Revisá la conexión y probá de nuevo.')
  })
})
