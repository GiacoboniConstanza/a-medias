import { AppIcon } from './AppIcon.tsx'
import { Card } from './ui.tsx'
import type { SplitNotice as SplitNoticeItem } from '../lib/api.ts'
import { monthName } from '../lib/month.ts'

export function SplitNotice({ notice }: { notice: SplitNoticeItem | null }) {
  if (!notice) return null
  return (
    <Card className="bg-sand">
      <p className="flex items-start gap-2 text-sm font-semibold text-text">
        <AppIcon name="chart-pie" className="mt-0.5 shrink-0 text-primary" />
        <span>
          Desde {monthName(notice.effectiveFrom)} el reparto queda {notice.myPercent}% / {notice.partnerPercent}%
        </span>
      </p>
    </Card>
  )
}
