import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { iconByName } from '../lib/icons.ts'

export function AppIcon({ name, className = '' }: { name: string; className?: string }) {
  return <FontAwesomeIcon icon={iconByName(name)} className={className} />
}
