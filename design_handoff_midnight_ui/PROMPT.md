# Prompt de arranque para Claude Code

Copia y pega esto en Claude Code, con el repositorio `xpert-consulting-hub`
abierto y esta carpeta de handoff dentro del proyecto o accesible.

---

Voy a aplicar un rediseño completo de la interfaz de este ERP. En la carpeta
`design_handoff_midnight_ui/` tienes el paquete de entrega:

- `README.md` — la especificación completa. Léela entera antes de escribir
  código.
- `Xpert ERP - Midnight Dossier.dc.html` — la referencia visual: hoja de
  sistema más las 12 pantallas. Ábrela en el navegador para verla.
- `tokens.css` — el bloque `.dark` listo para pegar.

Los `.dc.html` son prototipos de referencia, no código a copiar. El trabajo
es recrear ese diseño con lo que ya usa el repositorio: React + TypeScript,
Tailwind, shadcn/ui, Recharts, lucide-react. Sin estilos en línea y sin
hexadecimales sueltos en los `.tsx`: todo por variables CSS y utilidades de
Tailwind.

Empieza solo por los dos primeros pasos y para ahí para que lo revise:

1. Sustituir el bloque `.dark` de `src/index.css` por `tokens.css`, y
   declarar en `tailwind.config.ts` los tokens nuevos (`--figure`,
   `--subtle`, `--faint`, `--border-subtle`, `--border-strong`,
   `--primary-hover`, `--row-selected`, `--destructive-text`,
   `--destructive-surface`, `--warning-text`, `--warning-surface`,
   `--chart-grid`, `--chart-track`, `--chart-peak`) siguiendo el patrón
   `hsl(var(--token))` ya existente. Añadir también la utilidad `.tnum`.

2. Ajustar las variantes de los componentes de `src/components/ui/` según la
   sección **Componentes** del README: button, input, select, textarea,
   badge, card, tabs, table, checkbox, switch, sidebar y chart.

Cuando eso esté, seguimos pantalla a pantalla en el orden de la tabla del
README, empezando por `src/layouts/ClientLayout.tsx`.

Antes de empezar, dime qué has entendido y señala cualquier punto donde la
especificación choque con una convención que ya siga el repositorio.
