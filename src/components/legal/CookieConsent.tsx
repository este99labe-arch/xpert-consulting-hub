import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredConsent, saveConsent } from "@/lib/consent";

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      // Pequeño delay para no romper el primer render
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    } else {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
    }
  }, []);

  const handleSave = async (choice: { analytics: boolean; marketing: boolean }) => {
    setSaving(true);
    try {
      await saveConsent({ necessary: true, ...choice });
      setVisible(false);
      setCustomizing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Banner inferior */}
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Aviso de cookies"
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-background/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom duration-500"
      >
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  Tu privacidad nos importa
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Usamos cookies técnicas necesarias para que la aplicación funcione, y
                  cookies opcionales para mejorar tu experiencia. Puedes aceptar todas,
                  rechazar las opcionales o personalizarlas.{" "}
                  <Link
                    to="/legal/cookies"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Más información
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomizing(true)}
                disabled={saving}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Personalizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave({ analytics: false, marketing: false })}
                disabled={saving}
              >
                Solo necesarias
              </Button>
              <Button
                size="sm"
                onClick={() => handleSave({ analytics: true, marketing: true })}
                disabled={saving}
              >
                Aceptar todas
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo personalización */}
      <Dialog open={customizing} onOpenChange={setCustomizing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferencias de cookies</DialogTitle>
            <DialogDescription>
              Elige qué tipos de cookies quieres permitir. Puedes cambiar esta
              configuración en cualquier momento desde tu perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Necesarias</Label>
                <p className="text-xs text-muted-foreground">
                  Imprescindibles para la sesión, autenticación y seguridad. No
                  pueden desactivarse.
                </p>
              </div>
              <Switch checked disabled />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="analytics" className="text-sm font-semibold">
                  Analíticas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Nos ayudan a entender cómo usas la app para mejorarla.
                </p>
              </div>
              <Switch
                id="analytics"
                checked={analytics}
                onCheckedChange={setAnalytics}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="marketing" className="text-sm font-semibold">
                  Marketing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permiten mostrar contenido o comunicaciones más relevantes.
                </p>
              </div>
              <Switch
                id="marketing"
                checked={marketing}
                onCheckedChange={setMarketing}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave({ analytics: false, marketing: false })}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Rechazar opcionales
            </Button>
            <Button
              onClick={() => handleSave({ analytics, marketing })}
              disabled={saving}
            >
              Guardar preferencias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsent;
