import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Compass, MessageCircle, Network, UserCircle, Shield } from "lucide-react";
import XredDiscoverTab from "@/components/xpertred/DiscoverTab";
import XredMatchesTab from "@/components/xpertred/MatchesTab";
import XredNetworkTab from "@/components/xpertred/NetworkTab";
import XredProfileTab from "@/components/xpertred/ProfileTab";
import XredAdminTab from "@/components/xpertred/AdminTab";
import PageHeader from "@/components/shared/PageHeader";

const AppXpertRed = () => {
  const { role } = useAuth();
  const [tab, setTab] = useState("discover");

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Xpert<span className="text-destructive">Red</span></>}
        description="Red empresarial B2B — Conecta con otras empresas del ecosistema"
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="discover" className="gap-1.5">
            <Compass className="h-4 w-4" />
            Descubrir
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Matches
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1.5">
            <Network className="h-4 w-4" />
            Mi Red
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5">
            <UserCircle className="h-4 w-4" />
            Mi Perfil
          </TabsTrigger>
          {role === "MASTER_ADMIN" && (
            <TabsTrigger value="admin" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="discover"><XredDiscoverTab /></TabsContent>
        <TabsContent value="matches"><XredMatchesTab /></TabsContent>
        <TabsContent value="network"><XredNetworkTab /></TabsContent>
        <TabsContent value="profile"><XredProfileTab /></TabsContent>
        {role === "MASTER_ADMIN" && (
          <TabsContent value="admin"><XredAdminTab /></TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AppXpertRed;
