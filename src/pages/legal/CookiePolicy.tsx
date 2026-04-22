import { Link } from "react-router-dom";
import { ArrowLeft, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearStoredConsent } from "@/lib/consent";
import { useToast } from "@/hooks/use-toast";

const CookiePolicy = () => {
  const { toast } = useToast();

  const handleResetConsent = () => {
    clearStoredConsent();
    toast({
      title: "Preferencias borradas",
      description: "Recarga la página para volver a configurar tus cookies.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Política de Cookies</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Política de Cookies
          </h1>
          <p className="text-sm text-muted-foreground">
            Última actualización: 22 de abril de 2026 · Versión 1.0
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>¿Qué son las cookies?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Las cookies son pequeños archivos de texto que los sitios web guardan en
                tu dispositivo cuando los visitas. Permiten recordar información sobre tu
                visita, como tu idioma preferido, tu sesión iniciada y otras opciones, lo
                que facilita y mejora la experiencia de navegación.
              </p>
              <p>
                En XpertConsulting utilizamos cookies y tecnologías similares (como{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code>
                ) tanto para garantizar el funcionamiento del servicio como, opcionalmente,
                para entender cómo lo usas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de cookies que utilizamos</CardTitle>
              <CardDescription>
                Clasificadas según su finalidad y necesidad para el funcionamiento del
                servicio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Finalidad</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Base legal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Necesarias</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Sesión de usuario, autenticación, seguridad CSRF, preferencias
                        de interfaz (sidebar, tema).
                      </TableCell>
                      <TableCell className="text-sm">Sesión / 1 año</TableCell>
                      <TableCell className="text-sm">Interés legítimo</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Analíticas</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Medir uso de funcionalidades, detectar errores y mejorar el
                        rendimiento (datos agregados y anónimos).
                      </TableCell>
                      <TableCell className="text-sm">Hasta 1 año</TableCell>
                      <TableCell className="text-sm">Consentimiento</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Marketing</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Personalización de contenidos y comunicaciones promocionales
                        (no se usan actualmente para terceros).
                      </TableCell>
                      <TableCell className="text-sm">Hasta 1 año</TableCell>
                      <TableCell className="text-sm">Consentimiento</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gestión y revocación del consentimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Tu consentimiento queda registrado de forma fehaciente conforme al
                artículo 7 del RGPD, incluyendo la versión de esta política, la fecha y un
                hash anonimizado de tu IP. Puedes consultarlo en cualquier momento desde
                el panel de tu cuenta.
              </p>
              <p>
                Puedes retirar o modificar tu consentimiento en cualquier momento. Al
                hacerlo, las cookies opcionales dejarán de utilizarse, sin que ello afecte
                a la licitud del tratamiento previo.
              </p>
              <div className="pt-2">
                <Button variant="outline" onClick={handleResetConsent}>
                  Restablecer mis preferencias
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cookies de terceros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Actualmente XpertConsulting no comparte datos con servicios analíticos o
                publicitarios de terceros. Si en el futuro se incorporara alguno (por
                ejemplo, un proveedor de analítica), se actualizaría esta política y se
                solicitaría de nuevo tu consentimiento explícito.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Más información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                Para más información sobre cómo tratamos tus datos personales, consulta
                nuestra{" "}
                <Link
                  to="/legal/privacy"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Política de Privacidad
                </Link>
                .
              </p>
              <p>
                Si tienes cualquier pregunta, puedes escribirnos a{" "}
                <a
                  href="mailto:privacidad@xpertconsulting.es"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  privacidad@xpertconsulting.es
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CookiePolicy;
