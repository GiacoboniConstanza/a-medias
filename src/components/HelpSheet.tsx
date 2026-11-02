import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { Sheet } from './Sheet.tsx'
import { Button } from './ui.tsx'

export type HelpBlock = {
  title: string
  titleClass: string
  icon: string
  iconWrapClass: string
  body: ReactNode
}

export function HelpSheet({
  open,
  onClose,
  kicker,
  intro,
  blocks,
}: {
  open: boolean
  onClose: () => void
  kicker: string
  intro: string
  blocks: HelpBlock[]
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2 text-alert-ink">
          <AppIcon name="circle-question" />
          {kicker}
        </span>
      }
      footer={
        <Button type="button" onClick={onClose}>
          Entendido
        </Button>
      }
    >
      <p className="text-base font-semibold text-muted">{intro}</p>
      <ul>
        {blocks.map((block) => (
          <li key={block.title} className="border-t border-dashed border-line py-4 first:border-t-0 first:pt-4">
            <h3 className={`flex items-center gap-2 font-display text-base font-semibold ${block.titleClass}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${block.iconWrapClass}`}>
                <AppIcon name={block.icon} />
              </span>
              {block.title}
            </h3>
            <div className="mt-2 text-base font-semibold text-title">{block.body}</div>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
