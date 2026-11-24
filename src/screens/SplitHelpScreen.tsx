import type { ReactNode } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Card } from '../components/ui.tsx'

function ExampleBox({ children }: { children: ReactNode }) {
  return <div className="mt-3 rounded-2xl bg-sand p-3 text-sm font-semibold leading-[1.45] text-title">{children}</div>
}

export function SplitHelpScreen() {
  return (
    <>
      <SectionHeader lead="back" backTo="/reparto" title="¿Cómo funciona?" screenTitle />

      <Card>
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-title">
          <AppIcon name="chart-pie" className="text-mostaza-ink" />
          El reparto
        </h2>
        <p className="mt-3 text-sm font-semibold leading-[1.45] text-title">
          El reparto dice qué parte de los gastos compartidos te toca a vos y qué parte a Maru. No se usa para tus gastos
          personales ni para la plata que se pasan de una a la otra. Hay tres modos: según los sueldos (se suman los
          sueldos del mes y se parte en esa proporción; si este mes cargaste $ 600.000,00 y Maru $ 400.000,00, te toca el
          60 % de cada gasto compartido); en partes iguales (siempre 50 y 50, aunque una cobre más); porcentaje a mano
          (ustedes eligen, por ejemplo 70 % y 30 %, y queda así hasta que lo cambien). Si un mes falta el sueldo de una o
          de las dos y eligieron «según los sueldos», se reparte en partes iguales hasta que lo carguen. Si eligieron
          partes iguales o un porcentaje a mano, se respeta eso aunque falte el sueldo.
        </p>
      </Card>

      <Card>
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-title">
          <AppIcon name="right-left" className="text-mostaza-ink" />
          Las transferencias
        </h2>
        <p className="mt-3 text-sm font-semibold leading-[1.45] text-title">
          Una transferencia es plata que una le pasa a la otra, por ejemplo por Mercado Pago. Se carga en Cargar, como «Le
          pasé a Maru» o «Maru me pasó». Ejemplo: si le pasaste $ 20.000,00 a Maru, en tu «Te quedan» se descuentan $
          20.000,00 y en el de ella se suman. «Te quedan» es lo que cobraste, menos lo que gastaste (lo tuyo y lo
          compartido que pagaste vos), más o menos lo que se pasaron en el mes. También entra lo que pusiste o sacaste de
          ahorros. El porcentaje del reparto no entra en esa cuenta.
        </p>
      </Card>

      <Card>
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-title">
          <AppIcon name="receipt" className="text-mostaza-ink" />
          Un gasto con plata de la otra
        </h2>
        <p className="text-sm font-semibold leading-[1.45] text-title">
          Son dos cargas distintas: primero la transferencia, después el gasto. La app no las une sola. No hay un tipo de
          movimiento «gasto pagado con la transferencia».
        </p>
        <ExampleBox>
          <p className="text-sm font-bold text-azul-ink">Ejemplo, un gasto personal</p>
          <p className="mt-2">
            Coty le pasó $ 15.000,00 a Maru. Maru se compró un libro de $ 15.000,00, que es de ella. 1) Coty (o Maru)
            carga una transferencia: «Le pasé a Maru», $ 15.000,00. 2) Maru carga un gasto que no es compartido, de $
            15.000,00. El reparto no se mueve. En «Te quedan», a Coty se le descontaron $ 15.000,00 y a Maru le quedó
            igual: recibió la plata y la gastó.
          </p>
        </ExampleBox>
        <ExampleBox>
          <p className="text-sm font-bold text-azul-ink">Ejemplo, un gasto compartido</p>
          <p className="mt-2">
            Coty le pasó $ 108.000,00 a Maru para el alquiler. Maru pagó el alquiler compartido de $ 180.000,00. El
            reparto de este mes es 60 / 40, así que a Coty le tocan $ 108.000,00 y a Maru $ 72.000,00. 1) Se carga la
            transferencia de $ 108.000,00. 2) Maru carga el alquiler como gasto compartido y en «¿Quién pagó?» pone que
            pagó ella. El saldo de compartidos le va a decir a Coty que todavía le debe $ 108.000,00 a Maru, aunque ya se
            los haya pasado. No es un error. El reparto no mira las transferencias: solo mira quién pagó cada gasto
            compartido y qué porcentaje le toca a cada una. Cuando vayan a saldar el mes, si esa plata ya se pasó, hay que
            dejar sin marcar el registro de una transferencia nueva. Si se registra otra vez, «Te quedan» la cuenta dos
            veces. Si prefieren no adelantar la plata, Maru carga el alquiler como lo pagó ella y, al saldar, la app puede
            registrar ahí la transferencia de la parte de Coty.
          </p>
        </ExampleBox>
        <p className="mt-3 inline-flex gap-2 text-sm font-semibold leading-[1.45] text-title">
          <AppIcon name="circle-info" className="mt-0.5 shrink-0 text-mostaza-ink" />
          <span>
            Si Coty ya le pasó su parte y Maru anota el gasto compartido como pagado por ella, el saldo puede decir que
            Coty todavía debe su parte. Eso no es un error: el reparto mira quién pagó cada gasto, no las transferencias.
          </span>
        </p>
      </Card>
    </>
  )
}