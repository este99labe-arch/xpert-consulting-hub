import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MasterSettings = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ajustes generales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Configuraciones avanzadas del sistema estarán disponibles en futuras versiones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterSettings;
