import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useModuleTab } from "@/lib/moduleTabs";
import { Users, CalendarIcon, FileText, CalendarDays } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

import EmployeesTab from "@/components/hr/EmployeesTab";
import LeaveTab from "@/components/hr/LeaveTab";
import VacationCalendarTab from "@/components/hr/VacationCalendarTab";
import DocumentsTab from "@/components/hr/DocumentsTab";

const AppHR = () => {
  const [tab, setTab] = useModuleTab("employees");
  const { role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recursos Humanos"
        description="Gestiona empleados, ausencias, calendario y documentación"
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">

        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="calendar"><VacationCalendarTab /></TabsContent>
        <TabsContent value="documents"><DocumentsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AppHR;
