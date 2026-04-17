import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const MyDocumentsWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: docs = [] } = useQuery({
    queryKey: ["my-recent-docs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("id, name, category, created_at, file_type")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Mis documentos
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate("/app/hr")}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin documentos</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(d.created_at), "dd MMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyDocumentsWidget;
