import type { SproutStage } from '../lib/habits.ts'
import type { ModuleId } from '../lib/modules.ts'

const BACK: Record<ModuleId, string> = {
  finanzas: '#FFF1C2',
  habitos: '#E3EED4',
  comidas: '#FCE6EA',
  memos: '#ECE8F6',
}

export function Sprout({ module, muted = false, size = 44 }: { module: ModuleId; muted?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      aria-hidden="true"
      className={muted ? 'shrink-0 opacity-55 grayscale' : 'shrink-0'}
    >
      <circle cx="22" cy="22" r="22" fill={BACK[module]} />
      <path d="M22 31 C22 25 22 21 21.5 15" stroke="#6A784D" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M22 27 C16 27 13 23 13.5 19 C19 19 22 22.5 22 27Z" fill="#C7DDAE" />
      <path d="M22 22 C27 21 30 17 29.5 13.5 C25 14 21.5 17.5 22 22Z" fill="#6A784D" />
      {module === 'finanzas' ? <circle cx="21.5" cy="11" r="4.2" fill="#F4C542" /> : null}
      {module === 'habitos' ? <path d="M21.6 16 C17.5 15 15.5 12 16 9.5 C20 10 22 13 21.6 16Z" fill="#C7DDAE" /> : null}
      {module === 'comidas' ? <circle cx="29" cy="21" r="4.2" fill="#E98C9E" /> : null}
      {module === 'memos' ? (
        <g fill="#A79BCB">
          <circle cx="21.5" cy="8.6" r="2.5" />
          <circle cx="24.7" cy="11" r="2.5" />
          <circle cx="23.5" cy="14.6" r="2.5" />
          <circle cx="19.5" cy="14.6" r="2.5" />
          <circle cx="18.3" cy="11" r="2.5" />
          <circle cx="21.5" cy="12" r="1.6" fill="#F4C542" />
        </g>
      ) : null}
      <path d="M15 31 h14 l-2 7 h-10z" fill="#C4866D" />
      <rect x="14" y="29" width="16" height="4" rx="2" fill="#DEC59E" />
    </svg>
  )
}

const LEAVES = [
  { d: 'M77 100 C62 100 52 90 53 80 C67 80 77 88 77 100Z', fill: '#C7DDAE' },
  { d: 'M78 88 C93 87 103 77 102 66 C88 67 78 75 78 88Z', fill: '#6A784D' },
  { d: 'M77 74 C63 72 56 62 58 52 C71 54 77 62 77 74Z', fill: '#C7DDAE' },
  { d: 'M78 62 C92 60 100 51 99 42 C87 44 78 51 78 62Z', fill: '#6A784D' },
  { d: 'M76 50 C66 48 60 41 61 33 C71 35 76 42 76 50Z', fill: '#C7DDAE' },
]

export function HubPlant({ bloom, solid = 3, dashed = 0 }: { bloom: boolean; solid?: number; dashed?: number }) {
  const shownSolid = Math.max(0, Math.min(solid, LEAVES.length))
  const shownDashed = Math.max(0, Math.min(dashed, LEAVES.length - shownSolid))
  return (
    <svg width="168" height="156" viewBox="0 0 160 150" aria-hidden="true" className="shrink-0">
      <circle cx="126" cy="28" r="14" fill="#F4C542" />
      <g stroke="#F4C542" strokeWidth="3" strokeLinecap="round">
        <path d="M126 8 v6 M126 42 v6 M106 28 h6 M140 28 h6" />
      </g>
      <path d="M78 112 C78 92 77 66 76 40" stroke="#6A784D" strokeWidth="4" fill="none" strokeLinecap="round" />
      {LEAVES.map((leaf, index) => {
        if (index < shownSolid) return <path key={index} d={leaf.d} fill={leaf.fill} />
        if (index < shownSolid + shownDashed) {
          return <path key={index} d={leaf.d} fill="none" stroke="#C7DDAE" strokeWidth="2.2" strokeDasharray="4 3" />
        }
        return null
      })}
      {bloom ? (
        <g>
          <g fill="#A79BCB">
            <circle cx="76" cy="26" r="5" />
            <circle cx="82.5" cy="31" r="5" />
            <circle cx="80" cy="38" r="5" />
            <circle cx="72" cy="38" r="5" />
            <circle cx="69.5" cy="31" r="5" />
          </g>
          <circle cx="76" cy="32.5" r="3.4" fill="#F4C542" />
        </g>
      ) : (
        <circle cx="76" cy="34" r="5" fill="#F4C542" />
      )}
      <path d="M48 118 h64 l-7 26 h-50z" fill="#C4866D" />
      <rect x="44" y="110" width="72" height="11" rx="5.5" fill="#DEC59E" />
    </svg>
  )
}

export function DaySprout({ stage }: { stage: SproutStage }) {
  const stem = stage === 'grown' ? 'M18 46 C18 38 18 18 18 12' : stage === 'medium' ? 'M18 46 C18 38 18 26 18 20' : 'M18 46 C18 40 18 34 18 30'
  return (
    <svg width="36" height="54" viewBox="0 0 36 54" aria-hidden="true">
      {stage === 'sprout' || stage === 'medium' || stage === 'grown' ? (
        <path d={stem} stroke="#6A784D" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : null}
      {stage === 'sprout' || stage === 'medium' || stage === 'grown' ? (
        <path d="M18 32 C12 32 9.5 28 10 25 C15 25 18 28 18 32Z" fill="#C7DDAE" />
      ) : null}
      {stage === 'medium' || stage === 'grown' ? <path d="M18 26 C24 25 27 21 26.5 17 C21 18 18 21 18 26Z" fill="#6A784D" /> : null}
      {stage === 'grown' ? <path d="M18 18 C12 18 9.5 14 10 11 C15 11 18 14 18 18Z" fill="#C7DDAE" /> : null}
      {stage === 'seed' ? <ellipse cx="18" cy="44" rx="4" ry="3" fill="#DEC59E" /> : null}
      <rect x="6" y="46" width="24" height="6" rx="3" fill="#E8DCCB" />
    </svg>
  )
}

export function Planter() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true" className="shrink-0">
      <path d="M26 38 C26 28 25 20 24 12" stroke="#6A784D" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M25 28 C17 28 12 22 13 16 C21 16 25 21 25 28Z" fill="#C7DDAE" />
      <path d="M25 22 C32 21 36 15 35 9 C28 10 24.5 15 25 22Z" fill="#6A784D" />
      <circle cx="24" cy="8" r="4" fill="#F4C542" />
      <path d="M8 42 h80 l-6 24 h-68z" fill="#C4866D" />
      <rect x="4" y="36" width="88" height="9" rx="4.5" fill="#DEC59E" />
      <ellipse cx="48" cy="35" rx="3.5" ry="2.6" fill="#A07F5A" />
      <ellipse cx="62" cy="35" rx="3.5" ry="2.6" fill="#A07F5A" />
      <ellipse cx="76" cy="35" rx="3.5" ry="2.6" fill="#A07F5A" />
    </svg>
  )
}
