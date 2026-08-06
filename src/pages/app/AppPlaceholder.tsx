import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const AppPlaceholder = () => {
  const location = useLocation();
  const section = location.pathname.split("/").pop() || "módulo";

  return (
    <div className="space-y-6">
      <h1 className="tnum text-[22px] font-semibold tracking-[-.02em] text-foreground capitalize">{section}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg">Módulo en desarrollo</p>
          <p className="text-sm">Esta sección estará disponible en Phase 2</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppPlaceholder;
