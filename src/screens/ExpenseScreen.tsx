import { useNavigate } from 'react-router-dom'
import { ExpenseEditor, type ExpensePrefill } from '../components/ExpenseEditor.tsx'

export type { ExpensePrefill }

export function ExpenseScreen({ prefill, onCancel, onDone }: { prefill?: ExpensePrefill; onCancel?: () => void; onDone?: () => void } = {}) {
  const navigate = useNavigate()
  return (
    <ExpenseEditor
      presentation="page"
      prefill={prefill}
      onClose={() => {
        if (onCancel) onCancel()
        else navigate(-1)
      }}
      onDone={async (notice) => {
        await onDone?.()
        navigate('/', { state: { notice } })
      }}
    />
  )
}
