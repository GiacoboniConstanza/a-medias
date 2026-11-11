# A Medias · Especificación de pantallas con la identidad nueva

> **Desactualizado** tras las reestructuras del 10–11/11/2026 (Movimientos, formulario único, Ahorros unificados). No usar como criterio hasta que diseño lo actualice.

Fecha: 5/11/2026 (ronda 8: 09f–09h aprobadas). Fuentes: manual de marca (láminas 04 a 09c), `manual/entrega/tokens.css`, muestras aprobadas `muestras-v3/inicio.html` y `muestras-v3/finanzas.html` (lámina 09b), la guía de diseño anterior y las 9 capturas de la app publicada (01 a 09).

Cómo leer este documento:
- Los valores son exactos y se miden en px CSS sobre una pantalla de 390 × 844. El comportamiento a 360 está en 2.15.
- Cada color va con su token y su valor: `--color-azul-ink` #4C5A80.
- **Nuevo** marca un token o valor que hoy no está en `tokens.css` ni en el manual. Es una propuesta de diseño.
- **Nuevo, a aprobar** marca un color que no está en la paleta y que Coty tiene que aprobar antes de usarse.
- Los contrastes están medidos con la fórmula de WCAG 2.1. El mínimo es 4,5 para texto y 3 para bordes, íconos y gráficos.
- Las preguntas abiertas están todas juntas en la sección 8.

---

## 1. Resumen

La app publicada se aleja del manual por dos razones distintas.

La primera es el error de variables que ya encontró el equipo. Con eso arreglado vuelven los colores de las burbujas, el círculo de «¿Gastaste algo hoy?» y los círculos de Avisos.

La segunda es de diseño, y es la que cubre este documento:
- Las listas no siguen una sola regla: unas van en tarjeta sin borde y otras con borde.
- Hay pesos y tamaños fuera de la escala: Fraunces 500 y 700, y textos de 15,5, 16, 20, 24, 29 y 38 px.
- Faltan piezas de la guía: el botón de filtros con número, la línea «Mostrando», el «?» de ayuda, el estado «Mes saldado», el «+» en Gastos y otras (sección 3).
- Hay colores que significan dos cosas en la misma pantalla.
- Los desactivados usan transparencia al 50 % y no llegan al contraste.

Decisiones principales:
1. **Un color, un significado por pantalla.** Rosa es Coty, salvia es Maru, mostaza es la acción principal y ciruela es préstamos y lo privado va en ciruela claro (corrección 25). El azul es la estructura neutra.
2. **Listas:** Gastos (los dos modos) y cada grupo de Avisos van en una tarjeta con líneas de 1 px. Compartidos sigue como en 09b, sin tarjeta y con línea punteada. Memos va sin tarjeta.
3. **Tres tamaños de letra por pantalla como máximo**, siempre de esta escala: 36 o 34, 18 y 14. Fraunces va solo en 600 y se usa para títulos y montos.
4. **Festón solo en los navegadores** (corrección 14): la barra inferior y el bloque de arriba de Inicio. El Total de Compartidos va liso (corrección 22).
5. **Amigable muestra «Quién pagó» y Contable muestra «Cómo se reparte»**, como dice la guía. Que la app muestre «Cómo se reparte» en Amigable es un error de la app.
6. **Todas las barras miden 12 px.**
7. **Los desactivados no usan transparencia:** fondo crema apagado, borde gris claro punteado y texto gris (2.13, **cambiado en la ronda 6**).

---

## 2. Reglas generales

### 2.1 Colores y qué significa cada uno

| Token | Valor | Significado (uno solo por pantalla) |
|---|---|---|
| `--color-crema` | #FEF4E8 | Fondo de pantalla |
| `--color-tarjeta` | #FFFAF3 | Fondo de tarjetas, selectores, píldoras sin elegir y desactivados |
| `--color-tinta` | #1B242E | Texto principal, bordes de botón y contorno de barras |
| `--color-gris` | #5F6266 | Texto secundario y desactivados |
| `--color-azul` / `-ink` / `-claro` | #7D8BB2 / #4C5A80 / #DFE2EC | Estructura neutra: bloque de arriba, barra inferior, bordes de selector y de tarjeta, chips neutros, píldora elegida. En una barra, el tramo azul siempre lleva leyenda |
| `--color-mostaza` / `-ink` | #E6A940 / #7E5611 | Mostaza lleno: solo la acción principal (botón principal y «+»). Mostaza-ink: enlaces de acción |
| `--color-rosa` / `-hondo` / `-claro` / `-texto` | #E8A198 / #B96D64 / #F6D9D5 / #A25B53 | Coty («vos»). Solo Coty |
| `--color-salvia` / `-ink` / `-claro` | #A6A066 / #5A5735 / #E3E1CF | Maru. Solo Maru |
| `--color-ciruela` / `-ink` / `-claro` | #9C7092 / #86607F / #E6D8DB | Ciruela e ink: préstamos (Compartidos, Préstamos). Ciruela-claro: además, todo lo privado en Gastos y Ahorros (chip, tramo de la barra y punto de la leyenda), por la corrección 25 |
| `--color-linea-fila` | rgba(27,36,46,.3) | Línea entre filas (1 px sólida en tarjeta, 1,5 punteada sin tarjeta) |
| `--color-linea-punteada-total` | rgba(27,36,46,.45) | Separador dentro del Total |

**Excepciones, ya aprobadas en 09b:**
- El círculo del módulo Finanzas en el selector de módulo va en mostaza lleno. Es el color del módulo, no una acción.
- Las estrellas chicas del selector de mes van en mostaza, como en 09b. Son adorno, no una acción. 09g (Avisos) las lleva así (**nota agregada en la ronda 5**).

**Colores de categoría (aprobados por Coty el 4/11, corrección 27).** Ya están en tokens.css y tokens.json; se ven en la lámina `muestras/tonos-categorias.png`. Las burbujas y los círculos de categoría no pueden usar rosa, salvia, mostaza ni ciruela, porque ya significan otra cosa.

Ajuste del 4/11, segunda ronda. La ronda anterior tenía tres problemas: cielo se confundía con el azul de la marca (que en la barra significa compartidos, corrección 23) y con agua; menta, piedra y salvia se leían como tres verdes, y piedra se veía apagado; lila parecía más saturado que el resto. Ahora:
- **Un solo verde** (menta). Los otros cuatro quedan lejos del azul: agua (turquesa, 204°), durazno y avellana (cálidos, 60° y 76°, sin rojo) y lila (304°).
- **Misma saturación en los cinco:** C* entre 18,1 y 20,2 (OKLCH entre 0,050 y 0,058). La paleta va de 5 a 22.
- **ΔE2000 de 10 o más** contra los cinco claros de la marca (azul, mostaza, rosa, salvia y ciruela), contra el azul #7D8BB2 y entre los cinco tonos. El matiz más cercano al azul es lila, a 23° y ΔE2000 23,5.
- **Ink sobre su claro de 4,79 o más** en los cinco (menta 4,79) y de 6,34 o más sobre tarjeta y crema.
- Medido con coloraide (ΔE2000 y contraste WCAG 2.1) en `tonos/verifica_r2.py`.

**Cambios de nombre:**
- **Cielo → Durazno.** Cielo se sacó porque cualquier celeste queda en la familia del azul de la marca. Su lugar lo toma un durazno cálido (60°, entre rosa-claro a 31° y mostaza-claro a 82°, a ΔE2000 10,1 y 10,5 de cada uno). Conserva los íconos de transporte.
- **Piedra → Avellana.** Piedra era un gris verdoso, el tercer verde. Avellana es un marrón claro cálido (76°), más hondo que los otros (L* 70) para separarse de mostaza-claro y de crema. Conserva «Ropa», «Gatos» y todo lo que no tiene tono propio.
- **Agua** sigue con su nombre: se movió poco (de 212° a 204°) y es el único turquesa.
- **Menta** y **Lila** siguen con su nombre. Menta baja a L* 86 para separarse de agua; lila baja la saturación a la de los demás.

| Tono | Claro (fondo) | Ink (borde e ícono) | Matiz (LCh) | Tinta sobre claro | Ink sobre claro | Ink sobre tarjeta / crema | ΔE2000 mínimo contra la paleta | ΔE2000 mínimo entre tonos | Íconos |
|---|---|---|---|---|---|---|---|---|---|
| menta | #BBE0C7 | #386348 | 154° | 10,91 | 4,79 | 6,64 / 6,34 | 13,4 (salvia-claro) | 11,9 (agua) | `pizza-slice`, `utensils`, `bowl-food`, `mug-hot`, `burger` |
| agua | #A8E1E5 | #08646A | 204° | 10,88 | 4,79 | 6,65 / 6,35 | 17,4 (azul-claro) | 11,9 (menta) | `cart-shopping`, `basket-shopping`, `house`, `lightbulb`, `bolt`, `fire`, `wifi`, `laptop` |
| durazno | #E6C3AA | #6B4A2F | 60° | 9,53 | 4,82 | 7,64 / 7,30 | 10,1 (rosa-claro) | 10,2 (avellana) | `gas-pump`, `car`, `bus`, `taxi`, `plane` |
| lila | #E0D1F4 | #625379 | 304° | 10,91 | 4,81 | 6,67 / 6,37 | 11,7 (ciruela-claro) | 23,8 (durazno) | `champagne-glasses`, `music`, `star`, `gift`, `book`, `graduation-cap`, `film` |
| avellana | #BEA889 | #4C3918 | 76° | 6,84 | 4,80 | 10,61 / 10,14 | 14,2 (mostaza-claro) | 10,2 (durazno) | `shirt`, `scissors`, `heart`, `pills`, `stethoscope`, `paw` y todos los demás |

ΔE2000 contra el azul #7D8BB2: entre 23,5 (lila) y 34,3 (menta). El ícono va en el ink del tono y la burbuja lleva borde de 2 px en el mismo ink. En la lámina, los textos grises «Claro» e «Ink» van en gris #5F6266 sobre tarjeta (5,90) y el rótulo «Claros de la marca» sobre crema (5,64): pasan AA.

De los tonos de la referencia 3 (celeste, salvia clara, oliva, lavanda, durazno) entran durazno y una lavanda (lila). Celeste, salvia clara y oliva quedan afuera porque caen sobre el azul y la salvia de la marca.

### 2.2 Contrastes medidos

| Texto o gráfico | Fondo | Contraste | Uso |
|---|---|---|---|
| tinta #1B242E | azul #7D8BB2 | 4,64 | Texto dentro del bloque azul y de la barra inferior |
| tinta | crema / tarjeta | 14,43 / 15,11 | Texto general |
| gris #5F6266 | crema / tarjeta | 5,64 / 5,90 | Texto secundario y desactivados |
| gris | azul-claro #DFE2EC | **4,74** | Segundo renglón de una fila apretada. Es el mínimo del gris en esta especificación |
| gris | ciruela-claro #E6D8DB | **4,44, no pasa** | Sobre ciruela-claro el texto va en tinta |
| tinta | ciruela-claro | 11,36 | Resumen de Préstamos, chips «Privado» y «Parcial» |
| ciruela-ink #86607F | tarjeta / crema | 5,06 / 4,84 | Montos y bordes de Préstamos |
| azul-ink #4C5A80 | azul-claro / tarjeta / crema | 5,27 / 6,56 / 6,27 | Chips neutros y bordes de tarjeta |
| mostaza-ink #7E5611 | tarjeta / crema | 6,27 / 5,99 | Enlaces de acción |
| salvia-ink #5A5735 | tarjeta / crema / ciruela-claro / azul-claro | 7,10 / 6,78 / 5,34 / 5,69 | Nombre de Maru |
| rosa-texto #A25B53 | tarjeta / crema | 4,86 / 4,65 | Nombre de Coty y «vos» |
| salvia-ink / rosa-texto | azul | **2,18 / 1,49, no pasan** | Sobre el bloque azul los nombres van en tinta con punto de color (2.8) |
| rosa-texto | ciruela-claro / azul-claro | **3,66 / 3,90, no pasan** | No se escribe «vos» en rosa sobre ciruela-claro ni sobre azul-claro |
| tinta | mostaza #E6A940 | 7,56 | Texto del botón principal y del «+» |
| tinta | tonos claros de categoría | 11,75 a 12,06 | Texto e íconos dentro de burbujas y círculos |
| azul (borde) | crema / tarjeta | 3,11 / 3,26 | Borde de selectores y píldoras |
| azul / ciruela | entre sí | 1,21 | **No alcanza solo.** Por eso la barra del Total lleva contorno y separación de 2 px en tinta (ciruela/tinta 3,85) |
| azul / ciruela-claro | entre sí | 2,45 | Barra de Gastos (compartidos / privados). También lleva contorno y separación de 2 px en tinta (azul/tinta 4,64, ciruela-claro/tinta 11,36) |

### 2.3 Letra

- Fraunces va **solo en 600**, con `font-variation-settings: "SOFT" 100, "WONK" 0` (lámina 05). Se usa para títulos y montos.
- DM Sans va de 500 a 700 (lámina 05). El 400 no se usa, tampoco en las filas del Total (3.1).
- La escala de la app tiene cuatro tamaños: 34 (título de pantalla), 36 (monto grande), 18 (títulos, nombres, montos de fila y botones) y 14 (texto).
- **Tres tamaños por pantalla como máximo** (lámina 05). Los de cada pantalla están en su sección.
- Los montos van siempre en Fraunces 600, también dentro de una frase («Gastaste **$ 599.575,00** este mes»). Llevan `white-space: nowrap` y un espacio duro (`&nbsp;`) entre «$» y el número.
- El alto de línea es 1,35 (`--texto-alto-de-linea`), y 1,05 en el monto de 36.
- El **aviso flotante** («toast», el mensaje que aparece abajo unos segundos) usa 14/600 para el texto y 14/700 para su acción («Deshacer», «Reintentar»). Así no suma un cuarto tamaño a ninguna pantalla.
- Quedan fuera los tamaños que hoy usa la app: 15,5; 16; 20; 24; 29; 30 y 38.

### 2.4 Columna, bloque superior y barra inferior

- El contenido va en una columna de máximo **430 px** (`--ancho-columna`, **nuevo**), centrada, con margen de 16 px a cada lado (`--espacio-margen-de-pantalla`).
- El **bloque azul** y la **barra inferior** van de borde a borde (`width: 100vw`) en cualquier ancho. Su contenido queda alineado con la columna:
  `padding-inline: max(16px, calc((100vw - 430px) / 2 + 16px))`.
- **Festón** (borde ondulado de círculos de 26 × 13 px, `--feston-*`): solo en los navegadores, por la corrección 14.
  - La barra inferior lleva festón arriba (`.scallop-t`).
  - El bloque de arriba de Inicio lleva festón abajo (`.scallop-b`), como en la muestra aprobada.
  - El Total de Compartidos va **liso** (corrección 22: «El Total va liso, el festón solo en las barras que navegan»).
  - Tarjetas, burbujas y botones van lisos.
- **Barra inferior:**
  - 76 px de alto (`--alto-barra-inferior`) más `env(safe-area-inset-bottom)`, con padding 0 6 6. Con el festón, ocupa 89 px desde abajo.
  - Ítems de 48 × 56 como mínimo, con ícono de 18 y etiqueta de 14/500 en tinta. El elegido va en 700, con una píldora de 52 × 30 en crema detrás del ícono.
  - **Menú de Finanzas** (Resumen · Gastos · Compartidos · Préstamos · Ahorros): en esas cinco pantallas y en Avisos, que marca Resumen.
  - **Menú general** (Inicio · Finanzas · Hábitos · Comidas · Memos): en Hábitos, Comidas y Memos, con su propio ítem marcado.
- **La lista termina antes de la barra.** La zona que se desplaza termina en la cresta del festón (89 px desde abajo, más el área segura), así ninguna fila pasa por detrás de la barra. Al final lleva 16 px de aire, o un `padding-bottom` de 84 px si la pantalla tiene «+» (`--espacio-final-con-fab`: 16 abajo + 52 del botón + 16 arriba), así al terminar de desplazar la última fila queda libre. En Avisos la lista pasa por debajo de la franja del «+» y el aire final es de 116 (2.14, **cambiado en la ronda 7**).

### 2.5 Encabezado (58 px, padding 8 16 0)

**Selector de módulo** (en la lámina se lo llama «crumb», miga de pan):
- 46 px de alto, borde 1,5 px azul #7D8BB2, fondo tarjeta y radio 999.
- Adentro, en este orden: botón Inicio de 44 con ícono de 18; separador de 1,5 × 20 en azul; círculo del módulo de 26 px lleno, con ícono de 14 (Finanzas en mostaza, Hábitos en salvia, Comidas en rosa, Memos en azul); nombre en Fraunces 18/600; flecha de 14 en gris.
- Gap 7, padding 0 12 0 8.

**A la derecha**, cada botón con área de 44 × 44:
- **Campana:** ícono de 18. Contador de 24 × 24 como mínimo, fondo tinta, número crema 14/700 y borde de 2 px crema, en **top −7 y right −6** (**cambiado en la ronda 6**, antes top 0 y right −2 como en la lámina 08). En la posición anterior el contador quedaba encima del ícono: la tinta de la campana va de x 290,3 a 305,7 e y 23,3 a 41, y el contador iba de 298 a 322 y de 11 a 35. Ahora va de 302 a 326 y de 4 a 28: unos 6 px CSS de aire en diagonal hasta la tinta de la campana, 4 px hasta el área del «?» (330) y 17 px hasta su ícono (343). Medido en 09f. La 09e sigue con la posición anterior (ver la nota que sigue).
- **Nuevo, agregado al dibujar 09f:** entre la campana y el botón que le sigue («?» o selector de vista) van **10 px** (`gap: 10px`; **cambiado en la ronda 5**, antes 4), así el contador, que sobresale 2 px a la derecha, deja aire visible hasta el otro botón también en el celular chico de las láminas. Medido en 09f: contador de 298 a 322 y «?» desde 330 (8 px CSS, 4,4 px en el celular de 213), con el ícono del «?» desde 343 (21 px CSS, 11,5 px en el celular de 213). Las láminas 09d y 09e, ya aprobadas, siguen dibujadas con 4. **Ronda 6:** se intentó pasarlas a 10 sin cambiar nada más. **09d** y `gastos-amigable-vs-app.png`: rehechas con 10 en una copia aparte, salen **idénticas píxel por píxel** a las aprobadas, porque las dos muestran la pantalla desplazada y el encabezado no se ve; no se reemplazó nada. Además, en Gastos arriba del todo el encabezado no entra con 10: el selector «Amigable» terminaría en 393,1, fuera de la pantalla de 390 (con 4 ya termina en 383, pasado el margen de 374). Hay que resolverlo antes de dibujar el encabezado de Gastos. **09e** y `prestamos-vs-app.png`: no hay scripts que la reproduzcan igual (los de `_previo/` dan una 09e anterior y distinta), así que **no se tocaron**.
- **«?» de ayuda:** ícono `circle-question` de 18 en tinta. Va en Préstamos, Ahorros, Avisos, Hábitos, Comidas y Memos.
- **Selector de vista** (Amigable / Contable): 44 de alto, borde 1,5 azul, fondo tarjeta, radio 999, padding 0 10 y gap 6. Ícono de 18 en azul-ink, texto en 14/600 y puntos suspensivos en gris. Solo en Resumen, Gastos y Compartidos.

**Selector de mes** (48 de alto):
- Mes en Fraunces 18/600 y flechas de 44 con ícono de 14 en azul-ink.
- Estrella chica de **30 × 33 px** a cada lado, a **10 px** de las flechas (`--ancho-estrella-mes: 30px`, `--alto-estrella-mes: 33px`, `--espacio-estrella-mes: 10px`, **nuevos**).
- Va en Resumen, Gastos, Compartidos y Avisos. No va en Préstamos ni en Ahorros.

### 2.6 Píldoras de filtro y botón de filtros

- Píldora de 44 de alto, radio 999, borde 1,5 px azul y fondo tarjeta. Texto en 14/600 tinta, padding 0 14 y 6 px entre píldoras. Van a 8 px debajo del mes, o del encabezado si no hay mes.
- **Elegida:** fondo azul-claro #DFE2EC, borde 1,5 azul-ink, texto en 14/700 y tilde (`check`) de 14 a la izquierda con gap 6. Lleva `aria-pressed="true"`. No va en mostaza, porque mostaza es solo la acción principal.
- **Apretada:** sombra interna `inset 0 2px 0 rgba(27,36,46,.25)`.
- **Botón de filtros:** círculo de 44, borde 1,5 azul, fondo tarjeta e ícono `sliders` de 18 en mostaza-ink, pegado a la derecha. Con filtros activos lleva un contador igual al de la campana (24 × 24, tinta, número crema 14/700, borde 2 crema) en top −4 y right −4, con `aria-label="Filtros, 2 activos"`.
- **Línea «Mostrando»** (solo con filtros activos): «Mostrando: Comida, Pagó Maru» en 14/500 gris + enlace de acción «Limpiar» de 44, con margin 4 16 0.
- **Foco:** contorno de 2 px azul-ink a 2 px de distancia, en todos los elementos tocables.

### 2.7 Chips

Todos miden **27 px de alto** (`--alto-chip`, **nuevo**; sale de «estado: 27» de la lámina 08), con padding 0 10, radio 999 y texto en 14/600. Si llevan ícono, mide 14 y va con gap 6.

| Chip | Fondo | Texto e ícono | Dónde |
|---|---|---|---|
| «Sin saldar» | crema | tinta, con un anillo vacío de 12 px (borde 1,5 tinta, relleno crema) | Total de Compartidos |
| **«Saldado»** (uno solo para toda la app) | azul-claro | azul-ink, con tilde de 14 | Total de Compartidos y tarjeta de préstamo |
| «Nov» (mes del gasto) | azul-claro | azul-ink | Filas de gasto |
| «Privado» | ciruela-claro | tinta (11,36) | Gastos y Ahorros |
| «Compartido» | azul-claro | azul-ink | Ahorros |
| «Parcial» | ciruela-claro | tinta | Tarjeta de préstamo con devolución parcial |
| «Debe $ X» | azul-claro | azul-ink, con `arrow-right-from-bracket` de 14 | Cómo se reparte |
| «A favor $ X» | azul-claro | azul-ink, con `arrow-right-to-bracket` de 14 | Cómo se reparte |
| «Las dos» / «De Maru» | azul-claro | azul-ink; «Maru» en salvia-ink 700 (5,69 sobre azul-claro) | Memos |

**Regla de la flecha de «Debe» y «A favor»:** la flecha sigue al dinero, mirado desde la persona de esa fila. «Debe» es plata que sale de la persona: flecha que sale del corchete. «A favor» es plata que le entra: flecha que entra al corchete. La flecha nunca es la única pista, porque el chip dice «Debe» o «A favor».

En el bloque azul, los chips llevan además un borde de 1,5 px tinta para separarse del fondo.

### 2.8 Nombres en su color

- Maru va en **salvia-ink #5A5735, 700**. Coty y «vos» van en **rosa-texto #A25B53, 700**. Vale para «Pagó Maru», «Pagaste vos», «Le prestaste a Maru», el subtítulo de Cómo se reparte, el segmentado de Compartidos y los chips de Memos.
- **Excepción, sobre azul o azul-claro:** en el bloque azul no llega ninguno de los dos colores (2,18 y 1,49), y sobre azul-claro no llega el rosa-texto (3,90). Ahí el nombre va en tinta 700 con un punto de 12 px del color de la persona al lado (anillo 1,5 tinta, gap 6). Pasa en el Total, en el segmento elegido de Compartidos y en una fila de Compartidos mientras está apretada.

### 2.9 Tarjetas

- Radio 16 (`--radio-tarjeta`), borde 2 px (`--borde-tarjeta`), **sin sombra** y lisas.
- Fondo tarjeta #FFFAF3 y padding 14 18, salvo que la sección diga otra cosa. Entre tarjetas van 16 px.
- **Borde:** azul-ink en las neutras (Quién pagó, Cómo se reparte, Ahorros, caja de gustos, «¿Gastaste algo hoy?», listas). Ciruela-ink en Préstamos.

### 2.10 Listas y fila de gasto

**Cuándo va tarjeta:**
- **Gastos** (Amigable y Contable) y **cada grupo de Avisos**: una sola tarjeta por lista, con padding 0 14. Las filas se separan con una línea **sólida de 1 px** en rgba(27,36,46,.3). La primera fila no lleva línea arriba.
- **Compartidos:** sin tarjeta, sobre crema, con línea punteada de 1,5 px, como en 09b aprobada.
- **Memos:** sin tarjeta, con línea punteada de 1,5 px.

**Encabezado de lista**, cuando lo hay: 48 de alto, con ícono de 18 y título en Fraunces 18/600. A la derecha va la cantidad («16 gastos») en 14/500 gris.

**Fila de gasto** (Gastos, Compartidos y Avisos). Es una grilla de tres columnas: `52px minmax(0, 1fr) auto` (el círculo de 40 más 12 de aire). El monto lleva 8 px de aire a la izquierda.
- Alto mínimo de 62 (`--alto-fila-de-gasto`) y padding 10 0.
- **Círculo de categoría** de 40 px (`--alto-circulo-icono-lista`), ícono de 18 en tinta y fondo del tono claro de su categoría (2.1). Ocupa los dos renglones y va centrado.
- **Primer renglón:** nombre en Fraunces 18/600 tinta, después el chip «Nov» y, si es privado, el chip «Privado», con gap 6. Alto mínimo 26. Si los chips no entran, pasan abajo del nombre, con 4 px entre renglones.
- **Medido a 390:** con un monto de cinco cifras («$ 13.000,00», 104 px), nombre y «Nov» entran en un renglón si el nombre mide hasta 110 px («Sanguchitos» mide 107,4). Así las filas con un solo chip miden 66 como las demás. Con «Privado» el segundo chip pasa abajo (98 de alto), como en el recorte de la lámina 09d.
- **Monto** en la tercera columna, arriba, en Fraunces 18/600 tinta con alto de línea 26. Nunca se corta.
- **Segundo renglón:** ocupa el ancho del nombre y el del monto, en 14/500 gris. Puede ocupar dos renglones; **no se corta con «…»**. En este orden:
  - quién pagó, con el nombre en su color (2.8): «Pagó Maru» o «Pagaste vos»;
  - « · » + fecha (dd/mm);
  - « · » + categoría.
  - En Gastos, «Pagaste vos» no se escribe porque es lo normal: solo se marca cuando pagó la otra persona.
- **Privado:** el círculo conserva el ícono y el color de su categoría. Se saca el candado de 36 px de la app, que tapaba la categoría.
- **Apretada:** fondo azul-claro en toda la fila, con radio 12.

### 2.11 Barras

Todas las barras miden **12 px** (`--alto-barra-reparto`), con radio 99, contorno de 1,5 px tinta y 2 px de separación en tinta entre tramos. Cada tramo es proporcional a su monto. Toda barra lleva leyenda con punto de 12 px, anillo de 1,5 tinta y texto, para que el color no sea la única pista.

| Barra | Tramos |
|---|---|
| Total de Compartidos | gastos en azul #7D8BB2, préstamos en ciruela #9C7092 (corrección 23) |
| Gastaste este mes (Gastos) | compartidos en azul #7D8BB2, privados en ciruela-claro #E6D8DB (corrección 25) |
| Quién pagó (Compartidos, Amigable) | Coty en rosa #E8A198, Maru en salvia #A6A066 |
| Pagó y Su parte (Cómo se reparte) | el color de la persona: lleno en «Pagó», rayado a 45° en «Su parte» (`repeating-linear-gradient(45deg, color 0 3px, tarjeta 3px 6px)`) |

Ahorros **no lleva barra** de progreso: la guía la sacó y la reemplazó por la maceta que crece.

### 2.12 Botones y enlaces

| Pieza | Alto | Fondo | Borde | Texto | Otros |
|---|---|---|---|---|---|
| Principal («Saldar mes», «Nuevo préstamo», «Nuevo ahorro») | 52 | mostaza | 1,5 tinta | 18/600 tinta | Radio 999, ancho de la columna |
| Principal compacto («Anotar») | 44 | mostaza | 1,5 tinta | 18/600 tinta | Radio 999, padding 0 18 |
| Secundario («Deshacer saldo», «Restaurar», «Listo») | 52 | tarjeta | 1,5 azul-ink | 18/600 tinta | Radio 999 |
| Enlace grande («Exportar a planilla») | 52 | sin fondo | sin borde | 18/600 mostaza-ink | Ícono `file-export` de 18 y gap 8 |
| Enlace de acción («Sumar», «Ver aportes», «Registrar devolución», «No gasté nada», «Pagué», «Limpiar», «Ver todo el mes») | 44 | sin fondo | sin borde | 14/700 mostaza-ink | Padding 0 10 y 8 px entre enlaces. El primero de la fila arranca en 0 |
| «Más acciones» («…») | 44 × 44 | sin fondo | sin borde | ícono `ellipsis` de 18 en tinta | `aria-label="Más acciones de <nombre>"` |

**Apretado:** el principal lleva sombra interna `inset 0 2px 0 rgba(27,36,46,.25)`; el secundario y los enlaces, fondo azul-claro con radio 999.

**Cargando:** el texto cambia por «Guardando…», con `aria-busy="true"`, y el botón no responde.

### 2.13 Desactivado

- **No se usa `opacity`.** Tiene que seguir leyéndose como botón.
- **Botón desactivado** (**cambiado en la ronda 6**; antes fondo tarjeta y borde sólido gris, que se confundía con un botón secundario activo): fondo **crema apagado #F1E8DC** (`--color-fondo-desactivado`, **nuevo**), borde **punteado** (`dashed`) de 1,5 px en **gris claro #A9A49D** (`--color-gris-claro`, **nuevo**; `--borde-desactivado: 1.5px dashed var(--color-gris-claro)`) y texto en 18/600 gris #5F6266. **Contraste del texto: 5,06** sobre #F1E8DC (pasa AA). El borde mide 2,04 contra su fondo y 2,38 contra la tarjeta: queda a propósito por debajo de 3, porque marca que no se puede usar, y WCAG 1.4.11 exceptúa los componentes inactivos. Mismo alto y radio que el botón activo. Se distingue del secundario activo por tres cosas a la vez: fondo apagado en vez de tarjeta, borde punteado y claro en vez de sólido azul, y texto gris en vez de tinta.
- **Enlace desactivado:** texto en 14/700 gris, sin fondo (5,90 sobre tarjeta, 5,64 sobre crema).
- Siempre con `aria-disabled="true"` y no `disabled`, así el lector de pantalla lo anuncia y lee el motivo.
- El **motivo va escrito debajo**, en 14/500 gris, a 6 px. Los textos de cada motivo son de negocio (preguntas 1 y 8).

### 2.14 Botón «+» flotante

- Círculo de **52 px** (`--alto-fab: 52px`, **nuevo**), en mostaza, con borde 1,5 tinta y «+» (`plus`) de 18 en tinta. Lleva `aria-label` con la acción: «Nuevo gasto», «Nuevo gasto fijo» o «Nuevo memo».
- **Abajo:** a 105 px del borde (`--espacio-fab-abajo`, **nuevo**) más `env(safe-area-inset-bottom)`: 76 de la barra, 13 del festón y 16 de aire. Siempre visible, sin animación.
- **De qué lado va:** un solo «+» por pantalla y **siempre a la derecha**, en Resumen, Gastos, Avisos y Memos (corrección 26 y regla 4.16 de la guía): `right: max(16px, calc((100vw - 430px) / 2 + 16px))`.
- **Para que no tape montos:** la zona que se desplaza termina con `padding-bottom: 84px` (`--espacio-final-con-fab`), igual al alto del botón más sus márgenes (16 + 52 + 16). Al llegar al final, lo último de la pantalla queda 16 px por encima del botón y el botón queda sobre aire.
- **En muestras, láminas y capturas** el «+» **no tapa nada**: en Gastos la pantalla se muestra desplazada hasta el final, con el botón sobre esos 84 px de aire. En la 09d y en `gastos-amigable-vs-app.png`, la línea de dato termina en y = 671 y el botón ocupa de 687 a 739 (a 390 × 844). Las burbujas se ven en el recorte de la derecha de la 09d. En Avisos se usa la franja que sigue.
- **Franja del «+» en Avisos** (**nuevo en la ronda 6, cambiado en la ronda 7**, solo en Avisos): la zona que se desplaza llega hasta la barra, como en las demás pantallas, y **la lista pasa por debajo de una franja** que va de y = 655 a 755 (100 px, `bottom: 89px`, `--alto-franja-fab: 100px`). Arriba tiene un **desvanecido de 24 px**, de crema transparente a crema #FEF4E8 (655 a 679), y desde ahí es **crema lisa** hasta la cresta del festón (679 a 755). El «+» va encima (z-index 6 sobre 5), de 687 a 739: 8 px de crema lisa arriba y 16 abajo. Así el corte de la lista es un borde suave y limpio, como cualquier lista que se desplaza bajo una barra, y **ningún monto queda debajo del «+»**: lo que entra en la franja se desvanece antes de llegar al botón. Al final de la lista el aire es de **116 px** (100 de la franja + 16), así la última fila termina 16 px arriba del desvanecido y se lee entera. No captura toques (`pointer-events: none`). **No cambia la regla**: el botón sigue en el mismo lugar y del mismo tamaño (right 16, bottom 105, 52 px). Antes (ronda 6) la lista se cortaba en seco en 679 y la fila de Osde quedaba partida al medio.
- **Gastos no lleva franja** (corrección 31, 5/11): con la pantalla en reposo arriba el botón (322 a 374, 687 a 739) queda sobre «$ 13.000,00» de Sanguchitos y sobre «Pagó Maru · 29/10 · Comida». Coty decidió dejarlo así; la muestra 09d sigue mostrando la lista al final, con el «+» sobre aire. La franja queda **solo en Avisos**. Resumen y Memos tampoco la llevan.
- Mientras se desplaza en la app, el botón puede pasar sobre el monto de una fila, como en cualquier botón flotante. No se muestra así en ninguna muestra.
- Se descartó esconderlo al desplazar: la acción principal desaparecería justo cuando se la busca.
- **Dónde va:** Resumen, Gastos, Avisos y Memos. No va en Préstamos ni en Ahorros, que tienen su botón principal en la lista.

### 2.15 Pantalla de 360 px

Los márgenes siguen en 16. A 360 quedan 328 px de contenido. Cambia solo esto:
- **Selector de módulo:** se esconde el círculo del módulo y queda el nombre (regla N8 de la guía).
- **Selector de mes:** estrellas de **22 × 24**, a **6 px** de las flechas. Las flechas siguen en 44 y el mes en 18.
- **Píldoras:** padding 0 8 (el resto igual). Medido: Todos 77, Compartidos 107, Privados 76 y filtros 44, con gaps de 6: suman 328.
- **Burbujas:** ver 3.2.
- **Fila de gasto:** sin cambios de tamaño. Los chips pasan abajo del nombre cuando no entran, y el segundo renglón puede ocupar dos.
- La prueba está en `muestras/prueba-gastos-360.png`.

### 2.16 Plantita y maceta

- Fuera de Inicio, la plantita mide **46 × 60 px** (`--ancho-plantita` y `--alto-plantita`, **nuevos**; es la medida del Total en 09b).
- En el Total de Compartidos va a la derecha del monto, como en 09b. En el resumen de Préstamos va **a la izquierda** del texto, como en la guía y en la app.
- En Memos, la frase lleva el brote de 46 × 60 a la izquierda.
- En Ahorros, cada fondo lleva su maceta de 44 × 44 (`--alto-maceta-fila`, **nuevo**), que crece con el ahorro.

### 2.17 Estados comunes

- **Cargando:** rectángulos de radio 8 en azul-claro, del tamaño de lo que reemplazan (renglones de 14 y 18, círculos de 40). Pulso de opacidad entre 1 y 0,6 cada 1,2 s, sin pulso con `prefers-reduced-motion`. Es decorativo y no lleva texto.
- **Vacío:** plantita de 46 × 60 centrada y debajo la frase de la pantalla en 14/500 gris, con su acción si la tiene. Los textos son los de la guía y están en cada pantalla.
- **Error:** el aviso flotante de 2.3, con «Reintentar» si corresponde.

---

## 3. Pantalla por pantalla

### 3.1 Compartidos

**Tamaños:** 36 (monto del Total), 18 y 14. Las dos vistas comparten encabezado, mes, Total, lista y «Exportar a planilla». Cambia la tarjeta del medio.

**Total a saldar** (lámina 09b, liso):
- Bloque azul de borde a borde, **liso, sin festón** (corrección 22). Margin-top 19 y padding 8 34 6 dentro de la columna.
- **Título:** ícono de 18 + «Total a saldar» en Fraunces 18/600, con el chip «Sin saldar» o «Saldado» a la derecha (2.7).
- **Frase:** «Maru te debe» en 18/500 tinta, con «Maru» en tinta 700 y su punto salvia (2.8).
- **Monto:** Fraunces 36/600, alto de línea 1,05, sin cortar. La plantita de 46 × 60 va a la derecha.
- **Barra** de 12 px: gastos en azul y préstamos en ciruela (2.11, corrección 23). Sobre el fondo azul, el tramo de gastos se separa por el contorno tinta.
- **Filas** «Por gastos» y «Por préstamos»: 34 de alto, punto de 12 del color del tramo con anillo de 1,5 tinta, etiqueta en 14/500 tinta y monto en Fraunces 14/600 a la derecha. Separadas con línea punteada de 1,5 px en rgba(27,36,46,.45).
- **Botón** «Saldar mes» principal de 52, a 10 px.

**Mes saldado** (de la guía):
- El chip pasa a «Saldado».
- La frase pasa a «Maru te pasó $ X», con el monto en Fraunces 36.
- Debajo de la barra, una caja «Mes saldado por **$ X**»: fondo azul-claro, radio 16, padding 10 18, borde 1,5 tinta, texto en 14/500 tinta y monto en Fraunces 14/600.
- «Saldar mes» pasa a «Deshacer saldo», secundario.

#### 3.1.a Compartidos · Amigable: «Quién pagó»

Tarjeta neutra lisa, con las medidas de 09b: margin 31 16 0, padding 10 18 8, borde 2 azul-ink.
- **Título:** ícono `wallet` de 18 + «Quién pagó» en Fraunces 18/600. A la derecha, el total del mes en Fraunces 18/600.
- **Barra** de 12 px a 8 px: Coty en rosa y Maru en salvia, proporcional a lo que pagó cada una.
- **Filas** de 34, separadas con línea punteada de 1,5: punto de 12 del color de la persona + «Pagaste vos» (rosa-texto 700) o «Pagó Maru» (salvia-ink 700) en 14, y el monto en Fraunces 14/600 a la derecha.
- **Vacío:** «Este mes no hay gastos compartidos.» (2.17). No se muestran el Total ni la tarjeta.

#### 3.1.b Compartidos · Contable: «Cómo se reparte»

Tarjeta neutra, margin 31 16 0, padding 10 18 8, borde 2 azul-ink.
- **Título:** Fraunces 18/600 tinta.
- **Subtítulo:** «Según sueldo base: **Maru 40 %** · **Coty 60 %**» en 14/500 gris, cada nombre en 14/700 de su color.
- **Bloque por persona:**
  - Nombre en Fraunces 18/600 de su color y chip «Debe $ X» o «A favor $ X» a la derecha (2.7), con el monto del chip en Fraunces 14/600.
  - Dos métricas, cada una con etiqueta en 14/500 gris a la izquierda y monto en Fraunces 14/600 tinta a la derecha, con una barra de 12 px debajo (2.11): «Pagó» llena y «Su parte (40 %)» rayada. Las dos barras usan la misma escala: el 100 % es el mayor de los cuatro montos. Van separadas por 6 px.
  - Las personas se separan con línea punteada de 1,5 px, con 10 px arriba y abajo.

**Lista en Contable:**
- **Caja «Total del mes»** arriba de la lista: fondo azul-claro, radio 16, padding 10 18, 52 de alto. «Total del mes» en 14/500 tinta y el monto en Fraunces 18/600 a la derecha.
- **Segmentado** («segmented control», tres botones pegados que filtran): «Todos (16) · Pagó Maru (9) · Pagaste vos (7)», 44 de alto, radio 999, borde 1,5 azul, texto 14/600 y los nombres en su color. El elegido va con fondo azul-claro y texto tinta 700, con el punto de 12 de la persona al lado (rosa-texto no llega sobre azul-claro), y con `aria-pressed`.

**Lista** (las dos vistas):
- **Encabezado:** ícono `receipt` de 18, «Gastos compartidos» en Fraunces 18/600 y la flor de 5 pétalos de 30 × 29 a 8 px. A la derecha, «N gastos» en 14/500 gris. Margin 18 16 0.
- Sin tarjeta, con línea punteada, como en 09b (2.10). Siempre dice quién pagó. Hoy la app dice «Pagó Coty» y tiene que decir «Pagaste vos».

**Exportar a planilla:** enlace grande de 52, centrado, a 16 px de la última fila.

### 3.2 Gastos · Amigable (muestra en la lámina 09d)

**Tamaños:** 18 y 14.

**Orden:**
1. Encabezado con «Amigable».
2. Mes.
3. Píldoras «Todos · Compartidos · Privados» + botón de filtros, y la línea «Mostrando» si hay filtros (2.6).
4. Burbujas.
5. «Gastaste $ X este mes» con barra y leyenda.
6. Lista.
7. Línea de dato: «Este mes, Súper fue tu gasto más grande.» en 14/500 gris, sin tarjeta, margin 12 16 0. La categoría sale de los datos.
8. «+» a la derecha con «Nuevo gasto» (2.14).
9. Barra inferior con Gastos marcado.

**Burbujas por categoría:**
- **Zona:** margin 4 16 0, ancho W = columna − 32 (358 a 390). Va con `display:flex; flex-wrap:wrap; justify-content:center; align-items:flex-start; gap:8px`, y alto 2 × d_max + 8. Tres por renglón.
- **Orden:** de mayor a menor monto. No se enciman nunca.
- **Diámetro:**
  - d_max = ⌊(W − 2 × gap) / 3⌋ = **114** a 390. d_min = d_max − 6 = **108**.
  - d = d_min + (d_max − d_min) × √((monto − mínimo) / (máximo − mínimo)).
  - **Con todos los montos iguales, o con una sola categoría, todas miden d_max** (la fórmula no se aplica porque divide por cero).
  - Las diferencias son chicas a propósito: con tres por renglón no entra más, y el monto escrito es el dato.
- **Relleno y borde:** tono claro de su categoría y borde 2 px del tono ink (2.1).
- **Adentro**, centrado y con alto de línea 1,2: ícono de 18 en tinta con 2 px abajo, nombre en 14/600 tinta y monto en Fraunces 14/600 tinta. Lleva padding-bottom 26 para que el renglón del monto quede en el centro del círculo, donde hay más ancho.
- **Medido a 390:** el texto queda a 5 px del borde como mínimo, con «$ 303.560,00» (89,9 px). Un monto de millones, «$ 1.303.560,00» (100,25 px), entra en 114 con 4 px de aire.
- **Elegida** (al tocarla filtra la lista): borde de 3 px tinta y `aria-pressed="true"`. No se rellena de otro color.
- **A 360:** W = 328, gap 6, d_max = **105** y d_min = **103**. Se saca el ícono y quedan nombre y monto, con alto de línea 1,1. Medido: el texto queda a 3 px del borde como mínimo. Si el monto más ancho no entra (los millones, 100,25 px, no entran en 105), pasan a **dos por renglón**, de ⌊(328 − 6) / 2⌋ = 161.
- **Primer monto:** a 390 × 844 arranca en y = 218 (renglón de 218 a 235).
- Entran seis burbujas. Con más categorías, ver pregunta 5.

**Gastaste este mes:**
- Margin 12 16 0. «Gastaste **$ 599.575,00** este mes» en 14/500 tinta, con el monto en Fraunces 14/600.
- Barra de 12 px a 8 px: compartidos en azul, privados en ciruela-claro (2.11, corrección 25).
- Leyenda a 8 px: «Compartidos» y «Privados» en 14/500 gris, con 16 px entre las dos.

**Lista:** una tarjeta con líneas de 1 px (2.10), margin 12 16 0. Después va la línea de dato y al final los 84 px de aire del «+» (2.14). Las filas de la muestra son reales (capturas 03 y 04):
- Alimento · Pagó Maru · 29/10 · Gatos · $ 34.000,00
- Axion · Pagó Maru · 29/10 · Combustible · $ 40.000,00
- Helado · Pagó Maru · 29/10 · Comida · $ 20.000,00
- Sanguchitos · Pagó Maru · 29/10 · Comida · $ 13.000,00
- Alfajor · Privado · 29/10 · Comida · $ 3.600,00
- Tomate · Privado · 29/10 · Comida · $ 2.500,00

**Lista `BagPaidList`** (así la nombra la guía): va solo en Amigable, debajo de la lista, con el mismo estilo de tarjeta. El título y lo que muestra son de negocio (pregunta 9).

**Filtro «Privados»:** solo filas privadas, y las burbujas recalculadas con esos montos.

**Vacío** (la guía lo llama «SoftEmpty», vacío suave): plantita, «Nada por acá» en Fraunces 18/600, el motivo en 14/500 gris («No hay gastos con estos filtros.») y el enlace «Ver todo el mes». Sin burbujas ni barra.

### 3.3 Gastos · Contable

**Tamaños:** 36, 18 y 14.

**Orden:** encabezado con «Contable», mes, píldoras con «Mostrando», resumen, lista, «+» a la derecha y barra inferior.

**Resumen**, sin tarjeta y con margin 16 16 0:
- «Gastaste en noviembre» en Fraunces 18/600.
- «$ 599.575,00» en Fraunces **36**/600 (hoy mide 38), alto de línea 1,05.
- La barra de 3.2, a 8 px.
- **Leyenda con montos**, una fila de 34 por tipo: punto de 12 + «Compartidos» en 14/500 tinta y «$ 475.173,00» en Fraunces 14/600 a la derecha; después «Privados» y «$ 124.402,00».
- «Suma solo lo que pagaste vos.» en 14/500 gris, a 8 px.
- «Tu parte de los compartidos es 60 % · **$ 467.731,80**» en **un solo renglón** de 14/500 tinta, con el monto en Fraunces 14/600. A 360, si no entra, el monto pasa abajo entero.

**Lista:** la misma tarjeta con líneas de 1 px que en Amigable. Hoy Contable va con borde y Amigable sin borde: las dos van con borde.

### 3.4 Préstamos (muestra en la lámina 09e)

**Tamaños:** 36, 18 y 14.

**Orden:**
1. Encabezado: selector de módulo, campana y «?». Sin mes ni selector de vista.
2. Píldoras «Todos · Pendientes · Saldados».
3. Resumen.
4. Tarjetas de préstamo.
5. «Nuevo préstamo».
6. Barra inferior con Préstamos marcado.

**Resumen:**
- Tarjeta con fondo ciruela-claro #E6D8DB y borde 2 ciruela-ink, radio 16, padding 18 y margin 16 16 0.
- **Plantita de 46 × 60 a la izquierda**, como en la guía y en la app, con gap 14.
- Tres renglones, todos en tinta salvo el nombre:
  - «**Maru** te debe» en 18/500, con «Maru» en salvia-ink 700 (5,34);
  - «$ 275.000,00» en Fraunces 36/600, alto de línea 1,05, a 4 px;
  - «en préstamos» en 14/500, a 6 px.
- Las otras frases dependen del saldo (pregunta 3).

**Tarjeta de préstamo:**
- Fondo tarjeta, borde 2 ciruela-ink, radio 16, padding 16 18 2 y 16 px entre tarjetas.
- **Primer renglón:** «Le prestaste a **Maru**» o «**Maru** te prestó» a la izquierda, en 14/600 gris con el nombre en salvia-ink 700, y la fecha «01/11» a la derecha.
- **Monto:** Fraunces 18/600 ciruela-ink (5,06), a 6 px.
- **Nota**, si la hay: «Peluquería» en 14/500 tinta, a 4 px.
- **Devolución:** «Devuelto **$ 0,00** · falta **$ 200.000,00**» en 14/500 gris, con los montos en Fraunces 14/600 tinta, a 4 px.
- **Parcial:** si ya se devolvió una parte, va el chip «Parcial» al lado de la fecha.
- **Acciones:** línea punteada de 1,5 a 12 px y debajo el enlace «Registrar devolución» de 44.
- **Saldado:** el chip «Saldado» reemplaza al enlace, al final de la tarjeta. El monto sigue en ciruela-ink.
- Sin barras de progreso, como dice la guía.

**«Nuevo préstamo»:** botón principal de 52, a 24 px de la última tarjeta. No lleva «+» flotante. Sin pareja cargada va desactivado (2.13), con el motivo debajo (pregunta 8).

**Vacío:** con el filtro «Saldados», «No hay préstamos saldados.»; sin ningún préstamo, «Todavía no hay préstamos para ver.». Con la plantita y «Nuevo préstamo» debajo.

### 3.5 Ahorros

**Tamaños:** 18 y 14.

**Orden:** encabezado (selector de módulo, campana y «?», sin mes), píldoras de filtro, tarjetas de fondo, «Archivados (n)», «Nuevo ahorro», caja de gustos y barra inferior.

**Píldoras** (**nuevo, agregado al dibujar 09f**; faltaba en esta sección y lo pide la guía, S7): «Todos · Compartidos · Privados» como en 2.6, a 8 px del encabezado. **Cambio respecto de la app** (nota de la ronda 5): la píldora activa, «Todos», va en azul-claro con borde azul-ink y tilde (2.6), **no en mostaza** como hoy. La mostaza queda solo para la acción principal. **Sin botón de filtros**: Ahorros no tiene hoja de filtros. La tarjeta del primer fondo va a 16 px de las píldoras.

**Tarjeta de fondo:** neutra, borde 2 azul-ink y padding 14 18 0.
- **Primer renglón:** maceta de 44 a la izquierda, nombre «Vacaciones juntas» en Fraunces 18/600 con gap 12, y chip «Compartido» o «Privado» a la derecha.
- **Montos:** «**$ 0,00** de $ 3.000.000,00»: el ahorrado en Fraunces 18/600 tinta, « de » en 14/500 gris y la meta en Fraunces 14/600 gris. A 8 px.
- **Sin barra de progreso.** El avance lo muestra la maceta.
- **Frase de meta:** la de la guía, en 14/500 tinta, a 8 px. En los privados, «Vas por el N %.».
- **Ritmo:** «Abril 2027 · faltan 5 meses · Si cada una suma **$ 300.000,00** por mes, llegan» en 14/500 gris.
- **Privacidad** (solo compartidos): «Maru ve tu aporte, no tus ahorros privados.» en 14/500 gris, con `eye-slash` de 14 y gap 6.
- **Acciones**, debajo de una línea punteada a 10 px, todas como enlaces de 44 con 8 px entre ellos:
  - Compartido: «Sumar», «Ver aportes» y «…» pegado a la derecha.
  - Privado: «Editar», «Usar» y «A gustos».

**Medidas que faltaban, agregadas al dibujar 09f (nuevo):**
- **Columnas:** la maceta ocupa una columna de 44 + 12 de aire a lo largo de nombre, montos y frase. El ritmo y la privacidad van a todo el ancho de la tarjeta, como en la app.
- **Nombre y chip:** 4 px como mínimo entre los dos, centrados en el alto. Si no entran en un renglón, el nombre pasa a dos y el chip sigue a la derecha. «Vacaciones juntas» (155,7) y «Compartido» (101,4) entran en los 262 px de la columna a 390.
- **Ritmo** a 8 px de la frase, con el monto en Fraunces 14/600 tinta (como «Devuelto» en Préstamos). **Privacidad** a 4 px del ritmo, con «Maru» en salvia-ink 700 (7,10 sobre tarjeta, 2.8).
- **«…»:** área de 44 × 44 con el ícono de 18 en tinta. Se corre 10 px hacia el padding de la tarjeta para que el ícono quede alineado con el borde del texto.
- **Maceta:** la muestra usa la plantita de la marca (`muestras-v3/plant.svg`) en 44 × 44. **Las etapas de crecimiento no están dibujadas**: con $ 0,00 ahorrado la maceta tendría que mostrar la primera etapa. Queda abierto (sección 8, de diseño).

**«Archivados (n)»:** fila de 48, cerrada por defecto, con «Archivados (2)» en 14/700 tinta y flecha `chevron-down` de 14. Lleva `aria-expanded`. **No está en la muestra 09f**: aparece solo si hay algún archivado (N15 de la guía) y la captura 07 no tiene.

**«Nuevo ahorro»:** botón principal de 52, a 16 px. Es la única acción principal de la pantalla.

**Caja de gustos:** tarjeta neutra (tarjeta, borde 2 azul-ink), padding 14 18 4.
- **Texto:** «Para gustos te quedan **$ X**.» en 14/500 tinta (pregunta 2).
- **Enlaces:** «Me di un gusto», «Pasar a un fondo» y «Cargar un extra».
- **Desactivados** según 2.13, con el motivo debajo (pregunta 1).
- **Aviso de pocos gustos** (de la guía): renglón en 14/500 tinta con ícono `circle-exclamation` de 14, a 8 px del texto.

**Cómo está dibujada la caja en 09f (nuevo):**
- **Texto:** el de la app hoy, «Cuando un extra no va a un fondo, queda para gustos.», porque la pregunta 2 sigue abierta. El monto de «Para gustos te quedan $ X.» no está en la captura.
- **Orden de la app:** primero el enlace «Cargar un extra» (14/700 mostaza-ink, 44 de alto, a 2 px del texto) y después «Me di un gusto» y «Pasar a un fondo».
- «Me di un gusto» y «Pasar a un fondo» van **desactivados**, como hoy en la app, con **forma de botón desactivado** (2.13; ronda 5 pasaron de enlace a botón; **cambiado en la ronda 6** el estilo): fondo crema apagado #F1E8DC, borde punteado de 1,5 gris claro #A9A49D, texto 18/600 gris (5,06), 44 de alto como el principal compacto, radio 999, ancho completo, apilados con 8 px entre ellos y a 4 px del enlace. Sin transparencia y con `aria-disabled="true"`. **Sin motivo escrito**, porque el texto es de negocio (pregunta 1).
- Con los botones al final, la caja lleva padding **14 18 18** (antes 14 18 4, pensado para terminar en un enlace de 44).
- **Ojo y línea punteada de la tarjeta de fondo:** se mantienen, porque esta sección los pide de forma explícita: «con `eye-slash` de 14 y gap 6» en Privacidad y «debajo de una línea punteada a 10 px» en Acciones.
- El aviso de pocos gustos no se dibuja: la captura no lo muestra.
- A 16 px de «Nuevo ahorro».

### 3.6 Avisos

**Tamaños:** 18 y 14.

**Encabezado:**
- Volver: botón de ícono de 44 (`chevron-left` de 18), **sin texto visible**, con `aria-label="Volver a Resumen"`.
- Ícono `bell` de 18 + «Avisos» en Fraunces 18/600 (hoy va en 500 de 20).
- A la derecha, el engranaje de 44 con `aria-label="Mis recordatorios"` y el «?» de 44.
- Después van el mes, las píldoras con el botón de filtros con número y la línea «Mostrando» (2.6).

**«¿Gastaste algo hoy?»:**
- Tarjeta neutra con borde 2 azul-ink.
- **Primer renglón:** círculo de 44 en azul-claro con ícono `pen` de 18 tinta, título en Fraunces 18/600 y la X de cerrar de 48 × 48 arriba a la derecha.
- **Acciones**, a 10 px: «Anotar» (principal compacto) y el enlace «No gasté nada», con 8 px entre los dos.
- **Racha:** «0 días seguidos anotando» en 14/500 gris, a 4 px.

**Grupos** «Hoy», «Esta semana» y «Más adelante»:
- Título del grupo en 14/700 gris, margin 18 16 8 (en la guía es un h2 de 14).
- **Cada grupo es una tarjeta** con líneas de 1 px (2.10). Hoy no tienen borde: lo llevan.
- **Filas** de 2.10 con alto mínimo de **72** (`--alto-fila-aviso`, **nuevo**), para que entre «Pagué»:
  - Nombre y monto en Fraunces 18/600.
  - Debajo del monto, el enlace «Pagué» de 44, alineado a la derecha.
  - **Segundo renglón:** «con **Maru** · en 2 días» en 14, con Maru en su color y el plazo con su tono:
    - **Vence hoy:** tinta 700.
    - **Pronto** (1 a 7 días): gris 500.
    - **Vencido:** tinta 700, con `circle-exclamation` de 14. Sin rojos ni mostaza.
  - Círculo de categoría de 40 con su tono (2.1).

**«Ya pagados (n)» y «En pausa (n)»:** filas de 48 cerradas por defecto, como «Archivados» de Ahorros.

**Resto:** «+» a la derecha con «Nuevo gasto fijo», sobre la franja del «+» y con aire final de 116 (2.14, **cambiado en la ronda 7**; 84 en la ronda 5 y 16 en la 6). Barra de Finanzas con **Resumen** marcado.

**Cómo está dibujada la muestra 09g (nuevo, agregado al dibujar):**
- **Sin «Pagué»**, como hoy en la app, porque la pregunta 7 sigue abierta. Las filas mantienen su alto mínimo de 72: nombre y monto en el primer renglón y «con **Maru** · en N días» en el segundo. Si se suma «Pagué», va debajo del monto como dice arriba.
- **Encabezado:** volver de 44 desde x = 16 (el margen de 16 vale también para el área tocable). Entre la campana y «Avisos» van 8 px. El engranaje y el «?» van juntos, sin espacio, porque ninguno lleva contador.
- **«¿Gastaste algo hoy?»:** margin 16 16 0 y padding 14 18. La X de 48 va en top 6 y right 6, y el título deja 40 px libres a la derecha para no pasar por debajo. «Anotar» va sin ícono: el lápiz ya está en el círculo.
- **Cambio respecto de la app** (nota de la ronda 5): el ícono del recordatorio pasa del **círculo negro** de hoy a un **lápiz** (`pen` de 18 tinta en un círculo de 44 azul-claro).
- **Estrellas del mes en mostaza:** excepción ya aprobada en 09b (ver 2.1).
- **Tonos de los círculos** (2.1): `lightbulb` y `wifi` en agua, `car` en durazno y `stethoscope` en avellana.
- **Datos:** los seis gastos fijos de la captura 08. La captura no llega al final de la lista, así que la muestra termina en «Cubiertas» y no dibuja «Ya pagados» ni «En pausa». Todos vencen «pronto», así que los tonos de «hoy» y «vencido» no se ven.
- **El «+» con la pantalla arriba** (**cambiado en las rondas 6 y 7**): antes, en reposo arriba, el botón (687 a 739) quedaba sobre el monto de «Vallenet» (727 a 753). Ahora Avisos usa la **franja del «+»** de 2.14. En reposo arriba, la fila de Osde (641 a 713, monto de 655 a 681) entra en el desvanecido y se apaga hasta el crema en 679; Vallenet y Cubiertas quedan debajo de la crema lisa. La 09g y `avisos-vs-app.png` muestran la pantalla **en reposo arriba, con el «+» y la franja**.

### 3.7 Memos

**Tamaños:** 34, 18 y 14.

**Encabezado** (reglas N4 y R30 de la guía):
- Título del módulo: círculo de 30 px en azul #7D8BB2 con `note-sticky` de 14 en tinta, y «Memos» en Fraunces 18/600 con gap 8. **Sin botón y sin flecha**: no es un selector. El menú general está en la barra de abajo.
- A la derecha, solo el «?» de 44. Sin campana.

**Título:** «Mis memos» en Fraunces **34**/600 (hoy unos 29 en 700), margin 8 16 0.

**Frase:** brote de 46 × 60 + «Cuando taches uno, tu plantita florece.» en 14/500 gris, gap 12, a 8 px del título.

**Grupos** «Con Maru» y «Solo vos»:
- Título del grupo en 14/700 gris (h2 de 14), margin 18 16 8.
- **Filas sin tarjeta**, separadas con línea punteada de 1,5. Se sacan el fondo azul-claro, el radio de 22 y la sombra.

**Fila de memo:**
- **Todas las filas del mismo alto, hechas y pendientes: 86** (**cambiado en la ronda 5**, antes un mínimo de 62 que dejaba filas de 84, 85 y 70). El contenido va centrado en ese alto. 86 es lo que ocupa una fila hecha con chips más la línea punteada. **Ronda 7:** las filas hechas con y sin el chip «De Maru» quedan iguales también por dentro. Todas llevan un borde superior punteado de 1,5, transparente en la primera fila, así la línea no corre el contenido de la segunda. Medido: 86 de alto, casilla a 9,5 del borde superior, texto a 10,5 y chips a 49,5 (27 de alto), en «Chota» y en «Comprar comida negros».
- **Casilla:** 28 × 28 (`--alto-casilla`, **nuevo**), radio 8 (`--radio-casilla`, **nuevo**), **borde de 2 azul-ink y sin relleno** (**cambiado en la ronda 5**, antes borde 1,5 tinta y fondo tarjeta), dentro de un área de 44. Hecha: el mismo borde de 2 azul-ink, fondo azul-claro y tilde de 14 en azul-ink.
- **Texto:** DM Sans **18/500** tinta (hoy 15,5), hasta tres renglones. Hecho: tachado y en gris (5,64 sobre crema).
- **Datos**, a 4 px, en el orden de la app: chip «Las dos» (2.7), «Hecho» en 14/500 gris y chip «De **Maru**».

**Vacío:** «Todavía no hay memos.» con el brote (2.17).

**Cómo está dibujada la muestra 09h (nuevo, agregado al dibujar):**
- **Títulos de grupo con el nombre en su color** (2.8): «Con **Maru**» con Maru en salvia-ink 700 (6,78 sobre crema) y «Solo **vos**» con vos en rosa-texto 700 (4,65 sobre crema). El resto del título sigue en gris 700.
- **Casilla:** área de 44 a la izquierda y 8 px hasta el texto. La casilla de 28 queda centrada en el primer renglón del texto (alto de línea 26). Padding de la fila 9 0.
- **Chips:** «Las dos» lleva el ícono `user-group` de 14, como en la app. En un memo compartido que cargó Maru van en el orden de la app: «Las dos», «Hecho» y «De **Maru**» (**cambiado en la ronda 5**, antes «Hecho» iba al final). «De» va en azul-ink y «Maru» en salvia-ink 700 (5,69 sobre azul-claro).
- **Brote de la frase:** la plantita de la marca (`muestras-v3/plant.svg`) en 46 × 60, la misma de Préstamos.
- **Datos:** los tres memos de la captura 09, con el texto tal cual.

**Resto:** «+» de 52 **a la derecha** (2.14), con borde tinta y «Nuevo memo» (hoy mide 58 y no tiene borde). Aire final de 84. **Barra general** con Memos marcado: hoy no hay barra.

---

## 4. Las 15 respuestas

1. **Pantallas con festón.** Solo los navegadores: la barra inferior y el bloque de arriba de Inicio (corrección 14). El Total de Compartidos va liso (corrección 22). Ver 2.4.
2. **Festón arriba o abajo.** La barra inferior, arriba. El bloque de Inicio, abajo.
3. **Borde a borde en más de 430 px.** Sí: el bloque y la barra van a `100vw`, y su contenido sigue en la columna de 430 (2.4).
4. **Colores de la barra del Total.** Gastos en azul y préstamos en ciruela, con contorno y separación de 2 px en tinta, para que el rosa siga siendo solo de Coty (corrección 23). Los puntos son de 12 px con anillo tinta.
5. **Estrellas del selector de mes.** Miden 30 × 33 px. El «10 px» de la lámina 08 es la distancia a las flechas, no el tamaño. A 360 miden 22 × 24, a 6 px.
6. **Cómo se reparte.** Va en Contable; en Amigable va «Quién pagó». Ver 3.1.a y 3.1.b.
7. **Fila de gasto.** Círculo de 40 con el tono de la categoría, chips de 27 detrás del nombre, monto arriba a la derecha y segundo renglón que puede ocupar dos. Se saca el candado. Ver 2.10.
8. **Botón secundario y enlaces.** «Deshacer saldo» es secundario; «Exportar a planilla» es un enlace grande sin borde; los enlaces de acción miden 44, en 14/700 mostaza-ink, con 8 px entre ellos. Ver 2.12.
9. **Desactivado.** Sin transparencia: fondo tarjeta, borde sólido gris de 1,5 y texto gris (5,90; el gris nunca baja de 4,74 en esta especificación), con `aria-disabled` y el motivo escrito. Ver 2.13.
10. **Burbujas.** Tono claro de la categoría con borde ink de 2 px, de 108 a 114 px a 390, tres por renglón y nunca encimadas. Ver 3.2.
11. **Encabezado de módulo y barra inferior.** Memos lleva el título del módulo sin botón ni flecha, con «?», y la barra general. Avisos es de segundo nivel: volver, campana, «Avisos», engranaje y «?», con la barra de Finanzas y Resumen marcado.
12. **Borde de las tarjetas fuera de Inicio.** Azul-ink en las neutras y las listas; ciruela-ink en Préstamos.
13. **Tres tamaños.** Préstamos: 36, 18 y 14. Ahorros: 18 y 14. Compartidos, con Cómo se reparte adentro: 36, 18 y 14.
14. **Botón «+».** Mostaza, 52 px, borde y «+» en tinta, a 105 px del borde de abajo. Un solo «+», siempre a la derecha (corrección 26), siempre visible y con 84 px de `padding-bottom` en la lista. Ver 2.14.
15. **Plantita fuera de Inicio.** 46 × 60: a la derecha en el Total, a la izquierda en Préstamos, y como brote en Memos. En Ahorros, la maceta de 44.

---

## 5. Comparación con la lista de Jinx

Son 29 diferencias: **22 confirmadas, 6 corregidas y 1 descartada**.

| # | Diferencia de Jinx | Resultado | Por qué y valor correcto | Lámina |
|---|---|---|---|---|
| G1 | El bloque y la barra no llegan al borde en más de 430 px | Confirmada | Van a `100vw`, con el contenido en la columna (2.4) | 06, 09a, 09b |
| G2 | Píldoras de filtro rectangulares con borde azul claro, cuando en 06 son píldoras completas con borde azul-ink | **Corregida** | La 06 no dibuja píldoras de filtro. Las de 09b usan radio 999 y borde de 1,5 px en azul #7D8BB2. La elegida va en azul-claro con borde azul-ink (2.6) | 06, 09b |
| G3 | El contador de la campana es mostaza con número tinta, y en 08 es tinta con borde crema | Confirmada | Fondo tinta, número crema 14/700 y borde de 2 px crema, de 24 px | 08 |
| G4 | Las estrellas del mes miden 10 px, como dice 08 | **Corregida** | En 09b miden 30 × 33 con `margin: 0 10px`. El «10 px» de 08 es la distancia | 08, 09b |
| G5 | Hay pesos de Fraunces que no son 600 | Confirmada | Fraunces va solo en 600 | 05 |
| G6 | Casi ninguna pantalla respeta los tres tamaños | Confirmada | Los tamaños de cada pantalla están en la sección 3 | 05 |
| C1 | «Maru te debe» y las filas en 16 semibold, cuando en 09b se ven de 14 | **Corregida** | En el código de 09b, «Maru te debe» va en 18/500. Las filas van en 14, y en 09b pesan 400, que la 05 no permite: van en 14/500 | 09b, 05 |
| C2 | El chip «Sin saldar» es mostaza, y en 09b es claro con punto mostaza-ink | Confirmada | Fondo crema y texto tinta. El punto pasa a un anillo vacío, porque mostaza es solo la acción principal (sección 6) | 09b |
| C3 | La barra del Total es rosa y ciruela, y en 09b es tinta y tarjeta | **Corregida** | Ninguna de las dos: gastos en azul y préstamos en ciruela, para que el rosa sea solo de Coty (corrección 23) | 09b |
| C4 | La app muestra «Cómo se reparte» en lugar de «Quién pagó» | Confirmada | Es un error de la app: Amigable lleva «Quién pagó» y Contable «Cómo se reparte», como dice la guía (3.1) | 09b |
| C5 | Fila sin círculo de 40, nombre en DM Sans bold, lista en tarjeta y encabezado con el total en vez de «16 gastos» | Confirmada | Círculo de 40, nombre en Fraunces 18/600, sin tarjeta como en 09b y «N gastos» | 09b |
| Ga1 | En Amigable la lista va en tarjeta sin borde, y en Contable con borde | Confirmada | Las dos van en tarjeta con borde 2 azul-ink y líneas de 1 px, como dice la guía (2.10) | — |
| Ga2 | El monto grande de Contable mide 38, y la 05 dice 36 | Confirmada | Fraunces 36/600 | 05 |
| P1 | No hay selector de mes ni de vista | **Descartada** | Préstamos no lleva mes ni vista. Lo que falta es el «?» de 44 | — |
| P2 | El resumen va en 24, en tres renglones, y el «$» queda separado | Confirmada | «Maru te debe» en 18/500, el monto en Fraunces 36 con espacio duro y «en préstamos» en 14 (3.4) | 05 |
| P3 | Tarjetas con borde azul-ink y no ciruela-ink | Confirmada | Borde 2 ciruela-ink y montos en ciruela-ink | 04 |
| A1 | Montos y nombre del fondo en DM Sans 16 | Confirmada | Nombre y ahorrado en Fraunces 18/600; «de $X» en 14 | 05 |
| A2 | El chip «Compartido» mide 16 | Confirmada | Chip de 27, en 14/600 azul-ink sobre azul-claro | 08 |
| A3 | Desactivados al 50 %, sin contraste | Confirmada | Sin transparencia, con borde gris sólido y el motivo (2.13) | — |
| A4 | «Sumar», «Ver aportes» y «…» pegados | Confirmada | 44 de alto, padding 0 10 y 8 px entre enlaces | — |
| Av1 | La lista agrupada no tiene borde | Confirmada | Cada grupo va en una tarjeta con borde 2 azul-ink y líneas de 1 px (2.10) | — |
| Av2 | «Anotar» no es píldora completa ni tiene borde tinta | Confirmada | Principal compacto: 44, radio 999, mostaza y borde 1,5 tinta | 06 |
| Av3 | Encabezado en Fraunces 500 de 20 | Confirmada | Fraunces 18/600 | 05, 08 |
| M1 | El encabezado es distinto: módulo arriba y «Mis memos» de unos 29 debajo | **Corregida** | La estructura está bien. El título del módulo va sin botón ni flecha (N4, R30) y «Mis memos» en 34/600 | 05 |
| M2 | Tarjetas con radio de 22 y sombra | **Corregida** | No van tarjetas: filas sueltas con línea punteada | 06, 09b |
| M3 | El texto del memo mide 15,5 | Confirmada | DM Sans 18/500 | 05 |
| M4 | El «+» mide 58 y no tiene borde tinta | Confirmada | 52 px con borde 1,5 tinta (2.14) | 06 |
| M5 | La plantita de 30 px al lado de la frase | Confirmada | Mide 46 × 60 | 09b |
| M6 | No hay barra inferior | Confirmada | Barra general con Memos marcado | — |

### Diferencias que no estaban en la lista

1. **Falta el «?» de 44** en Préstamos, Ahorros y Avisos.
2. **Compartidos dice «Pagó Coty»** cuando pagaste vos: tiene que decir «Pagaste vos», en rosa-texto 700.
3. **«Exportar a planilla» es un botón con borde**, y tiene que ser un enlace grande sin borde.
4. **No hay «+» en Gastos** («Nuevo gasto»).
5. **La fila privada cambia el ícono de categoría por un candado de 36 px**, y se pierde la categoría.
6. **Los chips «Debe» y «A favor» usan rosa-claro y salvia-claro**, cruzados con los colores de las personas. Pasan a azul-claro, con flechas que siguen al dinero (2.7).
7. **El círculo del módulo** va en mostaza-claro, y en 09b es mostaza lleno.
8. **«Pagué» no se ve en Avisos**, aunque es una acción de la guía.
9. **La caja de gustos** no tiene el texto de la guía.
10. **En Avisos, el «+» tapa un monto.** Se resuelve con 2.14.
11. **En Gastos aparece «Comida» dos veces**, con montos distintos (pregunta 4).
12. **Faltan piezas de la guía:** el número del botón de filtros, la línea «Mostrando», el estado «Mes saldado», la caja «Total del mes» y el segmentado de Contable, «Parcial» en Préstamos, «Archivados», «Ya pagados» y «En pausa», y la línea de dato de Gastos.

---

## 6. Qué habría que actualizar si Coty aprueba

Esta especificación cambia algunas cosas de láminas aprobadas. **No se tocó ninguna.** Si Coty aprueba, habría que actualizar:

| Dónde | Qué cambiaría | Depende de |
|---|---|---|
| 09b Finanzas | El Total sin festón | Corrección 22 |
| 09b Finanzas | La barra del Total: gastos en azul y préstamos en ciruela, con sus puntos | Corrección 23 |
| 09b Finanzas | La tarjeta «Quién pagó» lisa (hoy tiene festón) | Corrección 14 |
| 09b Finanzas | El punto del chip «Sin saldar»: anillo vacío en vez de mostaza-ink | Regla de 2.1 |
| 09b Finanzas | Las filas «Por gastos» y «Por préstamos» en 14/500 (hoy 14/400) | Lámina 05 |
| 06 Formas | El pie del festón: solo en los navegadores | Corrección 22 |
| `tokens.css` | `--alto-progreso: 10px` pasa a 12; `--texto-aviso: 16px` pasa a 14 | 2.11 y 2.3 |
| `tokens.css` | Los tokens nuevos de la sección 7 y los cinco tonos de categoría | Aprobación de los tonos |

**Único error real, que hay que corregir igual:** la lámina 08 dice «Estrellas a 10 px», y se lee como tamaño. Las estrellas miden 30 × 33 y los 10 px son la distancia a las flechas. Tiene que decir «Estrellas de 30 × 33, a 10 px de las flechas».

Coty aprobó 09d y 09e (corrección 28). La 09d lleva el «+» a la derecha, los tonos de categoría ajustados y los privados en ciruela-claro. La lámina `tonos-categorias.png` muestra los cinco tonos, aprobados (corrección 27).

Coty aprobó **09f (Ahorros), 09g (Avisos) y 09h (Memos)** (corrección 30, 5/11), con sus comparaciones `ahorros-vs-app.png`, `avisos-vs-app.png` y `memos-vs-app.png`. En estas tres comparaciones, muestra y captura van **al mismo ancho visible: 780 px de pantalla, 786 con el marco** (**cambiado en la ronda 5**). Antes iban a 2 px por px CSS y la muestra se veía 7 a 13 % más angosta, porque las capturas miden 446, 419 y 423 px CSS de ancho y la muestra 390. Medido en los PNG: Ahorros 786 contra 898, Avisos 786 contra 844 y Memos 786 contra 852; ahora las seis miden 786. El contenido de la captura se ve, por eso, un poco más chico que en la app.

**Grilla común de 09f, 09g y 09h** (**cambiado en la ronda 7**; en la ronda 6 eran dos recortes al 110 % lado a lado): **la misma de 09d y 09e**, con la función `pantalla()` de `build.py`. Medida en 09d, en la lámina de 1920 × 1080: paneles de 544 y 1112 de ancho y 602 de alto, desde y = 300, con 24 entre ellos. El celular mide 213 × 460, en x = 286 e y = 371. A la derecha, **recortes al 125 % (488 px de ancho)** apilados desde x = 736 (padding de 48), con **32 px entre ellos** y centrados en alto. El **rótulo va a la derecha** de cada recorte, a 40 px (x = 1264), en 28 px y centrado en alto con su recorte. Los recortes de la lámina comparten bordes izquierdo y derecho, y los rótulos, el borde izquierdo. Cada recorte tiene su alto natural, con 12 px de aire alrededor del contenido, sin relleno crema agregado. En 09d van 305 + 144 (de 361 a 842). **Ahorros:** la tarjeta de fondo completa (315) y los dos botones desactivados de la caja de gustos (151), de 352 a 850. La caja entera (unos 300 al 125 %) no entra junto a la tarjeta, así que se tomó el tramo más chico completo, y la caja entera se ve en el celular. **Avisos:** dos grupos de avisos, contenido equivalente. «Esta semana» tiene título y Edersa (160). «Más adelante» tiene título, Seguro y Movistar (248), con la tarjeta abierta abajo como la fila de 09d. Van de 381 a 821. **Memos:** «Con **Maru**», con los dos memos hechos y sus chips (280), y «Solo **vos**», con el pendiente (173), de 359 a 844. Entre los dos están los tres memos con sus títulos de grupo. El aire del celular de Memos es el estado real: la captura 09 tiene tres memos y no se inventaron más.

---

## 7. Tokens nuevos para `tokens.css`

Son **nuevos** y son propuestas de diseño:

```css
--ancho-columna: 430px;
--alto-chip: 27px;
--alto-fab: 52px;
--espacio-fab-abajo: 105px;          /* 76 barra + 13 festón + 16 aire, más env(safe-area-inset-bottom) */
--espacio-final-con-fab: 84px;
--ancho-plantita: 46px; --alto-plantita: 60px;
--alto-maceta-fila: 44px;
--ancho-estrella-mes: 30px; --alto-estrella-mes: 33px; --espacio-estrella-mes: 10px;
--burbuja-espacio: 8px;              /* el diámetro sale de la fórmula de 3.2 */
--alto-enlace-accion: 44px;
--alto-fila-aviso: 72px;
--alto-casilla: 28px; --radio-casilla: 8px;
--color-fondo-desactivado: #F1E8DC;   /* ronda 6 */
--color-gris-claro: #A9A49D;          /* ronda 6, solo bordes de desactivado */
--borde-desactivado: 1.5px dashed var(--color-gris-claro);   /* ronda 6, antes 1.5px solid gris */
--alto-franja-fab: 100px;             /* ronda 7, solo Avisos: 24 de desvanecido + 76 de crema lisa, en bottom 89 */
--color-linea-fila: rgba(27,36,46,.3);
```

**Colores de categoría, aprobados** (tonos de 2.1, corrección 27; ya están en tokens.css y tokens.json):

```css
--color-cat-menta: #BBE0C7;    --color-cat-menta-ink: #386348;
--color-cat-agua: #A8E1E5;     --color-cat-agua-ink: #08646A;
--color-cat-durazno: #E6C3AA;  --color-cat-durazno-ink: #6B4A2F;   /* reemplaza a cielo */
--color-cat-lila: #E0D1F4;     --color-cat-lila-ink: #625379;
--color-cat-avellana: #BEA889; --color-cat-avellana-ink: #4C3918;  /* reemplaza a piedra */
```

---

## 8. Preguntas abiertas

### De negocio

1. ¿Cuándo se desactivan «Me di un gusto» y «Pasar a un fondo», y qué motivo se lee? *(En 09f van desactivados y sin motivo, como hoy en la app.)*
2. Caja de gustos: ¿«Para gustos te quedan $X.» o «Cuando un extra no va a un fondo, queda para gustos.»? *(En 09f va el texto de hoy: «Cuando un extra no va a un fondo, queda para gustos.»)*
3. Resumen de Préstamos: ¿qué frase va cuando le debés vos o cuando no hay saldo?
4. «Comida» aparece dos veces en noviembre: ¿son dos categorías o un error de datos?
5. Con más de seis categorías, ¿cinco burbujas y una «Otras» con la suma?
6. ¿El chip «Nov» va siempre o solo si el gasto es de otro mes?
7. «Pagué» no se ve en Avisos: ¿se sacó a propósito o falta? *(En 09g no está, como hoy en la app.)*
8. «Nuevo préstamo» sin pareja: ¿qué motivo se lee debajo?
9. La guía pide una lista `BagPaidList` en Gastos Amigable: ¿qué título lleva y qué muestra?

### De diseño, agregadas al dibujar 09f a 09h

1. **Etapas de la maceta en Ahorros:** la muestra usa la plantita entera. Con $ 0,00 ahorrado tendría que verse la primera etapa, que no está dibujada en la marca.
2. ~~**Franja del «+»**~~ **Cerrada (corrección 31, 5/11):** la franja queda solo en Avisos. Gastos, Resumen y Memos no la llevan («No, Gastos queda como está»).
3. **Encabezado de Gastos con 10 px entre campana y selector:** no entra en 390 (2.5). ¿Se achica el selector «Amigable» o el espacio de Gastos queda en 4?
4. **09e y la campana:** sin scripts no se pudo pasar a 10 px ni mover el contador sin redibujarla. ¿Se redibuja?

