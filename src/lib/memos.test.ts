import { describe, expect, it } from 'vitest'
import {
  checkedThisWeek,
  isMemoGoneMessage,
  memoCharHint,
  memoDeleteError,
  memoSaveError,
  memoShareDetail,
  type MemoItem,
} from './memos.ts'

const memo = (patch: Partial<MemoItem> & Pick<MemoItem, 'id' | 'ownerId'>): MemoItem => ({
  text: 'Anotar',
  done: false,
  shared: false,
  updatedAt: '2026-10-27T15:00:00.000Z',
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
