import { useNavigate } from 'react-router'
import { MovementForm, type MovementPrefill } from '../components/MovementForm.tsx'

export type { MovementPrefill as ExpensePrefill }

export function ExpenseScreen({
  prefill,
  onCancel,
  onDone,
}: {
  prefill?: MovementPrefill
  onCancel?: () => void
  onDone?: () => void
} = {}) {
  const navigate = useNavigate()
  return (
    <MovementForm
      prefill={prefill}
      onClose={() => {
        if (onCancel) onCancel()
        else navigate(-1)
      }}
      onDone={onDone}
    />
  )
}
