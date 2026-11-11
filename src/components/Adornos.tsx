import estrellaChica from '../assets/adornos/estrella-chica.png'
import estrellaGrande from '../assets/adornos/estrella-grande.png'
import ondita from '../assets/adornos/ondita-mostaza.png'
import pajaroCrema from '../assets/adornos/pajaro-crema.png'
import plantita from '../assets/marca/plantita.svg'

export function Plantita({
  width,
  height,
  className = '',
  label,
}: {
  width: number
  height: number
  className?: string
  label?: string
}) {
  return (
    <img
      src={plantita}
      alt=""
      width={width}
      height={height}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}

export function Bird() {
  return (
    <img
      src={pajaroCrema}
      alt=""
      width={96}
      aria-hidden="true"
      className="pointer-events-none h-auto w-24 -scale-x-100"
    />
  )
}

export function SheetStar() {
  return <img src={estrellaChica} alt="" width={20} height={22} aria-hidden="true" className="h-[22px] w-5 shrink-0" />
}

export function EstrellaGouache({
  width = 40,
  height = 37,
  className = '',
}: {
  width?: number
  height?: number
  className?: string
}) {
  return (
    <img
      src={estrellaChica}
      alt=""
      width={width}
      height={height}
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  )
}

export function MonthStar() {
  return <img src={estrellaChica} alt="" width={10} height={11} aria-hidden="true" className="h-[11px] w-2.5 shrink-0" />
}
export function OrnamentDivider() {
  return (
    <div className="mb-4 mt-1 flex items-center justify-center gap-[18px]" aria-hidden="true">
      <img src={estrellaGrande} alt="" width={30} height={33} className="h-[33px] w-[30px]" />
      <img src={ondita} alt="" width={140} height={43} className="h-[43px] w-[140px]" />
      <img src={estrellaGrande} alt="" width={30} height={33} className="h-[33px] w-[30px]" />
    </div>
  )
}
