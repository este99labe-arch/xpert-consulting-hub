# Handoff: rediseño "Midnight" — XpertConsulting ERP

## Overview

Rediseño completo de la capa visual del ERP multi-tenant XpertConsulting
(`xpert-consulting-hub`), nombre en clave **Midnight**: interfaz oscura,
un único acento azul, color estrictamente semántico y cifras en tipografía
monoespaciada tabular.

El objetivo del rediseño fue eliminar el aspecto genérico de la UI actual
(ocho tarjetas KPI idénticas con borde superior de color, gráficos Recharts
por defecto, botones en cuatro colores distintos, sidebar oscuro sobre
lienzo claro) y sustituirlo por un sistema en el que la jerarquía la marcan
la superficie, el borde y el tamaño del número, no el color.

**Idioma de la interfaz: español.** Todos los textos del diseño están en
español y deben implementarse literalmente tal y como aparecen.

## About the design files

Los archivos `.dc.html` de este paquete son **referencias de diseño**:
prototipos en HTML estático que muestran el aspecto y el comportamiento
esperados. **No son código de producción y no deben copiarse ni importarse
en la app.** No contienen lógica, datos reales ni accesibilidad completa;
sus estilos son `style=""` en línea precisamente para que sean fáciles de
leer valor a valor.

La tarea es **recrear estos diseños dentro del entorno ya existente de la
aplicación**: React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui sobre
Radix, Recharts, lucide-react, react-router-dom. Todo debe expresarse como
utilidades de Tailwind y variantes de los componentes de
`src/components/ui/`, consumiendo las variables CSS de `src/index.css`.
Nunca con estilos en línea ni con hexadecimales sueltos en los `.tsx`.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios y estados
son definitivos. Reprodúcelos con exactitud usando los componentes y
utilidades ya presentes en el repositorio.

Las dos excepciones, donde el diseño es orientativo y debes seguir lo que
ya haga el código: los datos (todos los importes, nombres de cliente y
fechas de los mockups son de ejemplo) y las rutas y permisos de navegación.

---

## Cómo aplicar el rediseño

### Paso 1 — Tokens

Sustituye el bloque `.dark { … }` de `src/index.css` por el contenido de
`tokens.css` (incluido en este paquete). El bloque `:root` (modo claro) se
deja intacto: Midnight es el tema oscuro y se activa añadiendo
`class="dark"` al `<html>`.

Los tokens nuevos que no existían (`--figure`, `--subtle`, `--faint`,
`--border-subtle`, `--border-strong`, `--primary-hover`, `--row-selected`,
`--destructive-text`, `--destructive-surface`, `--warning-text`,
`--warning-surface`, `--chart-grid`, `--chart-track`, `--chart-peak`)
hay que declararlos también en `tailwind.config.ts` dentro de
`theme.extend.colors`, con el mismo patrón `hsl(var(--token))` que ya usan
los existentes, para poder escribir `text-figure`, `border-subtle`,
`bg-warning-surface`, etc.

Añade además la utilidad `.tnum` (al final de `tokens.css`) al bloque
`@layer utilities` de `index.css`.

### Paso 2 — Componentes base

Antes de tocar ninguna pantalla, ajusta las variantes de los componentes de
`src/components/ui/`. Cada pantalla depende de que estos ya estén bien.
Ver la sección **Componentes** más abajo.

### Paso 3 — Pantallas

En este orden, por dependencia:

| # | Diseño | Archivo del repo |
|---|--------|------------------|
| 1 | Chrome de la app (rail + navegación + topbar) | `src/layouts/ClientLayout.tsx` |
| 2 | Dashboard | `src/pages/app/AppDashboard.tsx` + `src/components/dashboard/*` |
| 3 | Facturas (lista) | `src/pages/app/AppInvoices.tsx` |
| 4 | Detalle de factura | `src/pages/app/AppInvoices.tsx` (vista de detalle) |
| 5 | Clientes + estado vacío | `src/pages/app/AppClients.tsx`, `AppClientDetail.tsx` |
| 6 | Contabilidad | `src/pages/app/AppAccounting.tsx` |
| 7 | Inventario | `src/pages/app/AppInventory.tsx` |
| 8 | Recursos Humanos | `src/pages/app/AppHR.tsx` |
| 9 | Control horario | `src/pages/app/AppAttendance.tsx` |
| 10 | Tareas | `src/pages/app/AppTasks.tsx` |
| 11 | Informes | `src/pages/app/AppReports.tsx` |
| 12 | Chat interno | `src/pages/app/AppChat.tsx` |
| 13 | Configuración | `src/pages/app/AppSettings.tsx` |

`AppXpertRed.tsx` y `AppPlaceholder.tsx` no tienen diseño propio: aplícales
el chrome y los componentes base y déjalos funcionalmente como están.
El panel maestro (`src/layouts/MasterLayout.tsx`) tampoco está cubierto por
este dossier.

---

## Reglas del sistema

Estas siete reglas son la parte importante del rediseño. Si una pantalla
concreta no está documentada al detalle, resuélvela aplicándolas.

**1. El color es semántica, nunca decoración.**
Rojo (`destructive`) solo para lo vencido o destructivo. Ámbar (`warning`)
solo para lo que vence pronto o está pendiente. Verde (`success`) solo para
lo cobrado o conciliado. Azul (`primary`) solo para la acción principal y
la selección. Todo lo demás es neutro. Está prohibido usar color para
distinguir categorías sin significado de estado.

**2. Cuatro niveles de superficie y ni uno más.**
`sidebar-background` (rail) → `background` (lienzo) → `card` (tarjeta) →
`popover` / `secondary` (elevado, activo, hover). La jerarquía se construye
con estos niveles y con `border`, nunca con sombra.

**3. Sin sombras.** Solo los diálogos y popovers llevan
`0 24px 60px rgb(0 0 0 / .5)`. Las tarjetas se separan del fondo por su
color y su borde de 1 px.

**4. Todo número va en mono tabular.** Importes, fechas cortas, horas,
porcentajes, cantidades, códigos de factura y números de cuenta: clase
`.tnum` (`font-mono` + `tabular-nums`). Las columnas numéricas de las
tablas van alineadas a la derecha. El texto corrido va en Inter.

**5. Escala tipográfica.**
Cifra protagonista 44 px / 600 mono · cifra de tarjeta 20–26 px / 600 mono ·
cifra de tabla 12 px / 500 mono · título de pantalla 17 px / 600 Inter Tight ·
título de tarjeta 12,5 px / 600 Inter · interfaz 12–12,5 px / 500 Inter ·
texto de apoyo 11,5 px / 400 Inter con `line-height: 1.6` ·
etiqueta de columna 9,5 px / 600 mono, mayúsculas, `letter-spacing: .06em`.

**6. Densidad.** Rejilla de 4 px. Alturas fijas: topbar 54 px, botón 30 px
(32 px en formularios), campo 32 px, item de navegación 30–31 px, fila de
tabla 11 px de padding vertical. Márgenes de página 22 px arriba / 24 px a
los lados. Separación entre tarjetas 16 px (14 px en rejillas de KPI).
Relleno de tarjeta 16 px vertical / 18 px horizontal.

**7. Radios.** 14 px tarjeta · 10–12 px contenedor interior y tarjeta de
tablero · 8 px control (botón, campo, item de navegación) · 5–6 px chip,
badge y celda de mapa de calor · 50 % avatar.

---

## Componentes

Ajustes a hacer en `src/components/ui/` antes de tocar pantallas.

### button.tsx
| Variante | Fondo | Borde | Texto |
|---|---|---|---|
| `default` (primario) | `primary` #4A7BD4 | — | blanco |
| `secondary` | `secondary` #151A25 | `border-strong` #262C3A | `foreground` |
| `ghost` | transparente | — | `muted-foreground`; hover → fondo `muted` |
| `outline` | transparente | `input` #212736 | `muted-foreground` |
| `destructive` | `destructive` #E0563C | — | blanco |
| deshabilitado | `secondary` | `border-strong` | `faint` #4A5162 |

Altura por defecto 30 px (`h-[30px]`), padding horizontal 13–14 px, radio
8 px, texto 12 px / 600. Hover del primario: `primary-hover` #5B90E4.
Nunca dos botones primarios en la misma barra.

### input.tsx / select.tsx / textarea.tsx
Altura 32 px, radio 8 px, fondo `muted` #12161F, borde `input` #212736,
texto 12 px `foreground`, placeholder #535B6E.
Foco: borde `primary` + `ring` de 3 px a `rgb(74 123 212 / .16)`.
Error: borde `#5A2E24` y mensaje debajo en 10,5 px `destructive-text`.
Etiqueta encima, 11 px / 500 `muted-foreground`, 6 px de separación.

### badge.tsx
Radio 5 px, padding 3 px / 8 px, texto 10 px / 600 Inter. Cinco estados:

| Estado | Texto | Fondo | Borde |
|---|---|---|---|
| Pagada / Conciliado / Activo | #7DD6AE | #12241D | #1C3A2C |
| Vencida | #F0A08C | #2A1714 | #40211B |
| Pendiente / Vacaciones | #E8C27A | #241C10 | #3A2D18 |
| Enviada | #A8C3F7 | #141C2C | #22314C |
| Borrador | #8A93A6 | #151A25 | #232A38 |

### card.tsx
Fondo `card` #0F131C, borde 1 px `border` #1E2431, radio 14 px, sin sombra,
padding 16 px / 18 px. La tarjeta de alerta usa borde `destructive-border` y
fondo `linear-gradient(140deg, #1C1210, #12161F 70%)`; la de aviso, borde
`warning-border` y `linear-gradient(140deg, #1C1810, #0F131C 70%)`.

### tabs.tsx
Contenedor: fondo `muted` #12161F, borde `input`, radio 9 px, padding 3 px.
Trigger activo: fondo #232A3A, radio 6 px, texto 11,5 px / 600 `foreground`.
Inactivo: 11,5 px / 500 `subtle`, sin fondo. Los contadores dentro del
trigger van en mono y toman el color del estado que cuentan.

### table.tsx
Cabecera: fondo `muted`, borde inferior `border`, etiquetas 9,5 px / 600
mono en mayúsculas con `tracking-[.06em]` en `faint`.
Fila: padding 11 px / 16 px, separador `border-subtle` #191D27, texto 12 px.
Hover: fondo `muted`. Seleccionada: fondo `row-selected` #151E30 más
`box-shadow: inset 2px 0 0 var(--primary)`.
Pie de totales fijo: fondo `muted`, borde superior `border`, cifras 11,5 px
/ 600 mono.

### checkbox.tsx
13 px, radio 4 px. Sin marcar: borde 1,5 px #2E364A, sin fondo.
Marcado: fondo `primary`, check blanco de 9 px, trazo 3,4.

### switch.tsx
34 × 19 px, radio 10 px, pulgar de 15 px blanco.
Activado `primary`; desactivado fondo #232A38 y pulgar #6C7488.

### sidebar.tsx
Dos columnas. Rail de 56 px: fondo `sidebar-background` #080A10, borde
derecho `border-subtle`, iconos lucide de 16 px con `stroke-width: 1.7` en
`faint`; el activo va en #7FA6F0 dentro de una caja de 34 px con fondo
`sidebar-accent` y borde `border-strong`, radio 9 px. El punto de
notificación es un círculo de 6 px `destructive` con borde de 1,5 px del
color del rail.
Panel de 194 px: fondo `sidebar` #0A0D14. Items de 31 px, radio 8 px, texto
12,5 px; activo en fondo `sidebar-accent` y 600; inactivo en
`sidebar-foreground` y 500. Encabezados de grupo 9,5 px / 600 mono en
mayúsculas `tracking-[.07em]` color #3C4354.

### chart.tsx (Recharts)
Rejilla `chart-grid` #191D27, sin ejes visibles, etiquetas 9–11 px mono en
`faint`. Series con `chart-1..5` como escala secuencial azul.
Área bajo la línea: degradado vertical de `primary` al 45 % a 0 %.
Barra "esperado" `chart-track` #242B3A, barra "real" `chart-1`, barra de la
semana en curso `chart-peak` #5B90E4. Radio de barra 2–3 px.
Tooltip: fondo `popover`, borde `border-strong`, radio 8 px.

---

## Pantallas

Todas comparten el mismo chrome: rail de 56 px + panel de navegación de
194 px + topbar de 54 px con el título de la pantalla a la izquierda,
buscador `⌘K` opcional, y las acciones a la derecha (la principal en
`primary`, el resto en `secondary` u `outline`).

### 1. Dashboard  (`AppDashboard.tsx`)

Sustituye las ocho tarjetas KPI por una jerarquía en dos filas.

Fila superior, rejilla `1.55fr 1fr`, 16 px de separación:
- **Tarjeta protagonista "Caja disponible"** — fondo
  `linear-gradient(160deg, #141A26 0%, #0F131C 60%)`. Etiqueta 11 px
  `muted-foreground`, badge de variación en `success`, cifra de **44 px /
  600 mono** con `letter-spacing: -.03em` y el símbolo € a 22 px en
  `subtle`. Debajo, una línea de contexto ("Runway estimado 4,2 meses…") y
  un área-línea de 132 px pegada al borde inferior de la tarjeta.
- **Dos tarjetas pequeñas** (Ingresos, Gastos): etiqueta 10,5 px, cifra
  22 px mono, variación 10,5 px mono (`success` si mejora, `muted-foreground`
  si es neutra).
- **Tarjeta de atención**: borde `destructive-border`, fondo degradado rojo,
  punto de 6 px, cifra 26 px, y dos botones al pie (`destructive` +
  `outline`).

Fila inferior, misma rejilla:
- **Mapa de calor de cohortes** — rejilla `70px repeat(7, 1fr)`, celdas de
  28 px con radio 4 px, valor centrado en 9,5 px mono. Escala `chart-1..5`;
  celdas futuras en `chart-5` vacías. Leyenda de cinco muestras de 14 × 9 px
  en la cabecera. Al pie, una frase con la lectura del dato y un enlace.
- **Próximos vencimientos** — filas con la fecha en bloque de 36 px (día
  13 px mono coloreado por urgencia, mes 9 px), título 12 px, subtítulo
  10,5 px, importe a la derecha 12 px mono. Pie con el saldo neto en
  `success`.

Elimina `CustomDashboard`/widgets sueltos que dupliquen estos datos y
mantén solo un origen por métrica.

### 2. Facturas  (`AppInvoices.tsx`)

Barra de filtros bajo el topbar: pestañas con contador por estado + buscador
de 220 px + selector de cliente + chip de rango de fechas descartable
(`accent` con × en `primary`).

Cuando hay filas seleccionadas aparece, a la derecha de esa misma barra, una
**barra de acciones por lote**: fondo `row-selected`, borde
`row-selected-border`, altura 30 px, con el recuento en `accent-foreground`,
un separador vertical y las acciones ("Enviar recordatorio" en
`foreground`, "Anular" en `destructive-text`).

Tabla de siete columnas:
`34px | 118px | 1fr | 116px | 108px | 100px | 106px` →
checkbox, nº, cliente, base, total, vence, estado.
Nº y base en `muted-foreground`; total en 12 px / 500 mono; la fecha de
vencimiento toma el color del estado. **Pie de totales fijo** con la suma de
la página.

### 3. Detalle de factura

Rejilla `1fr 330px`.
Izquierda, tarjeta-documento con 24/26 px de padding: emisor arriba a la
izquierda, número y fechas arriba a la derecha, separador, dos bloques
(facturar a / forma de pago), tabla de líneas
(`1fr | 64px | 96px | 64px | 104px`) y bloque de totales de 260 px alineado
a la derecha con el total en **24 px mono**.
Derecha: tarjeta de alerta de vencimiento, tarjeta de cliente con dos
métricas, y **línea de tiempo de trazabilidad** (punto de 7 px + línea
vertical de 1 px `border`; el evento más reciente en `destructive`, el
resto en #2E364A).

### 4. Clientes  (`AppClients.tsx`)

Rejilla de tres columnas, tarjetas de 16/18 px. Cada una: avatar de 32 px
con iniciales, razón social 12,5 px / 600, NIF 10,5 px mono, badge de estado
de cobro a la derecha; tres métricas en fila (Facturado, Pendiente, Pago
medio) en 14 px mono; y al pie una **barra de salud de 4 px** partida en
tramos al corriente / por vencer / vencido (`chart-1` / `warning` /
`destructive`). Última celda: tarjeta con borde discontinuo `border-strong`
para añadir cliente.

**Estado vacío** (dos columnas, 44 px de separación):
izquierda, título 21 px Inter Tight, párrafo 12,5 px, dos botones, y un
checklist "Puesta en marcha · 1 de 4" con barra de progreso de cuatro
segmentos y cuatro filas con círculo de 15 px (el activo con borde
`primary`).
Derecha, **vista previa de la tabla real** sobre fondo `sidebar` con el
rótulo "ASÍ SE VERÁ" y tres filas esqueleto con opacidad decreciente
(.7 / .45 / .22). No uses ilustraciones ni iconos grandes.

### 5. Contabilidad  (`AppAccounting.tsx`)

Pestañas en el topbar (Libro diario / Cuentas / Impuestos / Balance).
Cuatro tarjetas de resumen: Debe, Haber, **Descuadre** (tarjeta verde si es
0,00 €) y **Sin conciliar** (tarjeta ámbar con el recuento y el importe).
Tabla de siete columnas
`96px | 88px | 1fr | 108px | 118px | 118px | 96px`: fecha, asiento,
concepto, cuenta, debe, haber, estado. El código de cuenta va en mono
`accent-foreground`; las líneas secundarias de un mismo asiento llevan
14 px de sangría y texto `muted-foreground`; las celdas sin valor, un guion
largo en `faint`. Pie con las sumas del periodo.

### 6. Inventario  (`AppInventory.tsx`)

Cuatro tarjetas: **Bajo mínimos** (roja, con botón "Generar pedido" a la
derecha dentro de la propia tarjeta), Valor total, Rotación media, Sin
movimiento 90 d.
Tabla `104px | 1fr | 200px | 96px | 96px | 108px`. La columna
"stock vs. mínimo" es una **barra de 6 px con marca de punto de pedido**:
pista `#1A202C`, relleno coloreado por gravedad
(`destructive` / `warning` / `chart-1`) y una marca vertical de
1,5 × 10 px en `subtle` sobre la posición del mínimo, con el par
"actual / mínimo" a la derecha en 10,5 px mono.

### 7. Recursos Humanos  (`AppHR.tsx`)

Pestañas (Plantilla / Nóminas / Ausencias con contador / Documentos).
Rejilla `1fr 340px`.
Izquierda: cuatro KPIs (Plantilla, Coste mensual, Antigüedad media,
Absentismo) y tabla de empleados
`1fr | 150px | 110px | 104px | 100px` con avatar de 28 px, nombre y correo
apilados, puesto, alta, salario y badge de estado.
Derecha: tarjeta ámbar de **solicitud pendiente** con Aprobar/Rechazar, y
**calendario mensual** de celdas de 30 px con radio 5 px — laborable
`muted`, fin de semana `card` con borde `chart-5`, hoy `row-selected` con
borde `row-selected-border`, ausencia `warning-surface` con borde
`warning-border` y número en `warning-text`. Leyenda al pie.

### 8. Control horario  (`AppAttendance.tsx`)

Rejilla `340px 1fr`.
Izquierda: tarjeta de fichaje con fondo `linear-gradient(160deg, #141A26,
#0F131C)`, fecha en 10 px mono con `tracking-[.08em]`, **anillo de progreso
SVG** de 180 px (pista `#1B2130`, trazo `primary` de 12 px con
`stroke-linecap: round`, girado −90°), tiempo transcurrido en 34 px mono en
el centro y objetivo debajo en 11 px, botón de 38 px `destructive`
("Pausar jornada") y la línea de entrada y pausa.
Derecha: tres KPIs (Fichadas, Esperadas, **Balance** en `destructive-text`
con barra de progreso si es negativo) y gráfico de **barras superpuestas**
por semana: esperado `chart-track` detrás, trabajado `chart-1` delante,
semana en curso `chart-peak`. Leyenda arriba a la derecha.

### 9. Tareas  (`AppTasks.tsx`)

Tablero de cuatro columnas (Por hacer / En curso / En revisión / Hecho).
Cabecera de columna: punto de 6 px con el color del estado, título 11,5 px /
600, recuento en mono `subtle`.
Tarjeta de 12 px de radio, padding 13/14 px: título 12 px con
`line-height: 1.45`, y una fila inferior con el chip de fecha (mono 9,5 px,
coloreado por urgencia; "SIN FECHA" en neutro), etiqueta opcional y avatar
de 20 px a la derecha. Las tareas vencidas llevan borde
`destructive-border` y fondo degradado rojo. Las hechas van a opacidad .75,
fondo `#0D1017` y título tachado en `muted-foreground`.

### 10. Informes  (`AppReports.tsx`)

Topbar con selector de ejercicio y chip de comparativa ("vs. 2025").
Rejilla `380px 1fr`.
Izquierda, **cuenta de resultados**: filas `1fr | 96px | 72px`
(partida, importe, variación). Las partidas de detalle van sangradas 12 px y
en `muted-foreground`; los subtotales (EBITDA) en 600 con borde superior
`border`; la variación en `success` o `destructive-text` según convenga.
Resultado del ejercicio al pie en **22 px mono** `success`.
Derecha, **cascada de tesorería**: siete barras (inicial, dos entradas, tres
salidas, proyectada), conectadas por líneas discontinuas de 1 px `#2E364A`.
Inicial en `chart-3`, entradas en `chart-1`, salidas en `destructive`,
proyectada en `figure` #F4F6FA. Valor sobre cada barra en 12 px mono.

### 11. Chat interno  (`AppChat.tsx`)

Tres zonas: lista de conversaciones de 260 px sobre `sidebar`, hilo, y
compositor.
Item de lista: cuadrado de 26 px con radio 8 px (`#` para canal) o avatar
redondo (directo), nombre, hora en 9,5 px mono, y una línea de vista previa
truncada; el activo con fondo `popover` y borde `border-strong`; contador
de no leídos como píldora `primary`.
Mensajes: burbuja 12 px de radio con la esquina superior del lado del emisor
a 4 px. Entrante: `popover` con borde `#232A38`. Propio: fondo `#1B3059`,
borde `#26406F`, texto `#EAF0FB`, alineado a la derecha.
Los mensajes pueden llevar una **tarjeta de contexto enlazada** (factura,
cliente): fondo `card`, borde `border`, icono en caja de 28 px, dos líneas
de texto y enlace "Abrir" en `accent-foreground`.
Separador de día: línea + etiqueta 10 px mono centrada. Indicador de
escritura: tres puntos de 5 px dentro de una burbuja.
Compositor: 42 px de alto, radio 11 px, botón de envío cuadrado de 28 px
`primary`.

### 12. Configuración  (`AppSettings.tsx`)

Navegación secundaria de 212 px a la izquierda con grupos (EMPRESA /
ACCESO / SISTEMA) y los mismos items de 30 px que el sidebar principal.
Contenido en **una sola columna de 620 px máximo**: título 17 px Inter
Tight, descripción 11,5 px, y formulario en rejilla de dos columnas de
16 px de separación (los campos largos ocupan las dos).
Debajo, separador y bloque de **preferencias con switch**: cada fila es
título 12 px + descripción 11 px a la izquierda y el switch a la derecha,
separadas por `border-subtle`.
Las acciones Guardar/Descartar van en el topbar, no al pie del formulario.

---

## Interacciones y estados

- **Hover de fila**: fondo `muted`, sin transición de más de 120 ms.
- **Selección de fila**: checkbox + fondo `row-selected` + barra interior de
  2 px `primary` a la izquierda. Al haber ≥1 selección aparece la barra de
  acciones por lote en la barra de filtros.
- **Foco**: siempre visible — borde `primary` y anillo de 3 px
  `rgb(74 123 212 / .16)`. No lo elimines en ningún control.
- **Carga**: usa `skeleton.tsx` con fondo `#1A202C` y el mismo radio que el
  elemento que sustituye. Nada de spinners a pantalla completa.
- **Vacío**: cada lista necesita su estado vacío con una acción primaria y,
  cuando aporte, la vista previa esqueleto de la tabla real (patrón de
  Clientes).
- **Error de formulario**: borde `#5A2E24` y mensaje de 10,5 px en
  `destructive-text` debajo del campo.
- **Transiciones**: 120–160 ms `ease-out` en color y fondo. Sin animaciones
  de entrada en las tarjetas del dashboard (framer-motion en
  `AppDashboard.tsx` puede retirarse).

## Accesibilidad

Contraste mínimo AA sobre `background` #0C0F16: `foreground` #EEF1F6 y
`muted-foreground` #8A93A6 cumplen para texto normal; `subtle` #6C7488 solo
para texto de 11 px o mayor no esencial; `faint` #4A5162 solo para
decoración, iconos inactivos y etiquetas de eje — **nunca** para contenido
que haya que leer.
El estado nunca se comunica solo por color: los badges siempre llevan
texto ("Vencida", "Pagada"), y los puntos de color siempre acompañan a una
etiqueta.

## Tipografía

Ya cargada en `index.css`: **Inter** (300–800) y **JetBrains Mono**
(400/500/700).
El diseño añade **Inter Tight** (500/600/700) para los títulos de pantalla y
de sección. Añádela al `@import` de Google Fonts y como
`fontFamily.display` en `tailwind.config.ts`. Si prefieres no sumar una
familia, usa Inter 600 con `letter-spacing: -.01em` en su lugar: el diseño
funciona igual.

## Iconos

**lucide-react**, ya en el proyecto. Tamaño 14–16 px, `stroke-width` 1,7 en
el rail y 1,8 en línea. Inactivo `faint` #4A5162, activo #7FA6F0. No mezcles
familias de iconos ni uses emoji.

## Assets

Ninguno nuevo. Todos los gráficos del diseño son SVG generados a partir de
datos y deben implementarse con Recharts. Los avatares son iniciales sobre
`#1D2331` en `accent-foreground`, no imágenes.

## Datos de los mockups

Todos los nombres de cliente, importes, fechas y códigos que aparecen en el
diseño son **de ejemplo** y sirven para dimensionar las columnas y validar
la jerarquía. No los introduzcas en el código. Conserva únicamente los
textos de interfaz: etiquetas, títulos, botones, estados vacíos y mensajes.

## Files

| Archivo | Qué contiene |
|---|---|
| `Xpert ERP - Midnight Dossier.dc.html` | **Referencia principal.** Hoja de sistema (sección 00) + las 12 pantallas. |
| `Xpert ERP - Mockups UI.dc.html` | Las tres direcciones exploradas (Ledger / Midnight / Canvas). Solo contexto: la elegida es **1b Midnight**. |
| `tokens.css` | Bloque `.dark` listo para pegar en `src/index.css`. |
| `support.js` | Runtime necesario para abrir los `.dc.html` en el navegador. No se migra. |
| `PROMPT.md` | Texto de arranque para pegar en Claude Code. |

Para ver las referencias, abre los `.dc.html` en un navegador; los tres
archivos deben estar en la misma carpeta.
