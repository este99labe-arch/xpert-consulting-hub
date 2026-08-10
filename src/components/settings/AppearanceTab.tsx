import { Moon, Sun, Check } from "lucide-react";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: Theme;
  label: string;
  desc: string;
  icon: typeof Moon;
  /** Miniatura del tema, con sus propios colores fijos para que se vea la
   *  diferencia sin tener que aplicarlo. */
  preview: { canvas: string; panel: string; card: string; text: string; line: string };
}[] = [
  {
    value: "dark",
    label: "Oscuro",
    desc: "Midnight. Menos fatiga visual con poca luz ambiente.",
    icon: Moon,
    preview: { canvas: "#0C0F16", panel: "#0A0D14", card: "#0F131C", text: "#EEF1F6", line: "#1E2431" },
  },
  {
    value: "light",
    label: "Claro",
    desc: "Daylight. Más contraste con luz directa o al imprimir.",
    icon: Sun,
    preview: { canvas: "#FFFFFF", panel: "#F5F6F9", card: "#FFFFFF", text: "#161A23", line: "#E4E7EC" },
  },
];

/**
 * Selector de tema.
 *
 * La elección se guarda en el navegador y se aplica al instante; no hay botón
 * de guardar porque el propio cambio ya es la confirmación.
 */
const AppearanceTab = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-[620px] space-y-4">
      <div role="radiogroup" aria-label="Tema de la aplicación" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
                active
                  ? "border-primary bg-row-selected"
                  : "border-border bg-card hover:bg-popover",
              )}
            >
              {/* Miniatura: rail, tarjeta y una línea de texto */}
              <div
                className="mb-3 flex h-[84px] gap-1.5 overflow-hidden rounded-control border p-1.5"
                style={{ background: opt.preview.canvas, borderColor: opt.preview.line }}
                aria-hidden
              >
                <div
                  className="h-full w-[22%] rounded-[4px]"
                  style={{ background: opt.preview.panel, border: `1px solid ${opt.preview.line}` }}
                />
                <div
                  className="flex h-full flex-1 flex-col gap-1.5 rounded-[4px] p-2"
                  style={{ background: opt.preview.card, border: `1px solid ${opt.preview.line}` }}
                >
                  <div className="h-1.5 w-2/3 rounded-full" style={{ background: opt.preview.text, opacity: 0.85 }} />
                  <div className="h-1 w-full rounded-full" style={{ background: opt.preview.line }} />
                  <div className="h-1 w-4/5 rounded-full" style={{ background: opt.preview.line }} />
                  <div className="mt-auto h-2.5 w-1/3 rounded-[3px]" style={{ background: "#4A7BD4" }} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <opt.icon className={cn("h-3.5 w-3.5 stroke-[1.8]", active ? "text-accent-foreground" : "text-faint")} />
                <span className="text-[12.5px] font-semibold text-foreground">{opt.label}</span>
                {active && <Check className="ml-auto h-3.5 w-3.5 stroke-[2.4] text-accent-foreground" />}
              </div>
              <p className="mt-1 text-[11.5px] leading-[1.6] text-muted-foreground">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <p className="text-[11.5px] leading-[1.6] text-muted-foreground">
        La preferencia se guarda en este navegador y se aplica de inmediato, también la próxima vez
        que entres. Si usas la aplicación en otro dispositivo, tendrás que elegirlo allí también.
      </p>
    </div>
  );
};

export default AppearanceTab;
