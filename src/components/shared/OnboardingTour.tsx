import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "onboarding_completed";

const steps = [
  {
    title: "¡Bienvenido a XpertConsulting!",
    description: "Te guiaremos por las funciones principales de la plataforma.",
  },
  {
    title: "Barra lateral",
    description: "Navega entre módulos desde el menú lateral: Facturación, Contabilidad, RRHH, Inventario y más.",
  },
  {
    title: "Dashboard",
    description: "Consulta tus KPIs principales, gráficas de actividad y últimos movimientos en un vistazo.",
  },
  {
    title: "Facturación",
    description: "Crea facturas y gastos, programa facturas recurrentes y envía por email a tus clientes.",
  },
  {
    title: "Configuración",
    description: "Gestiona API keys, webhooks, auditoría, y preferencias de tu cuenta desde Ajustes.",
  },
  {
    title: "¡Listo para empezar!",
    description: "Si necesitas ayuda, consulta la documentación o contacta a soporte. ¡Éxito!",
  },
];

const OnboardingTour = () => {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const next = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const step = steps[current];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in-0 zoom-in-95">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= current ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{step.description}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {current + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Omitir
            </Button>
            <Button size="sm" onClick={next}>
              {current < steps.length - 1 ? "Siguiente" : "Comenzar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
