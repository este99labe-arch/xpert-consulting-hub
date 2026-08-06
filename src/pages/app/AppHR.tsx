import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarIcon, FileText, CalendarDays } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

import EmployeesTab from "@/components/hr/EmployeesTab";
import LeaveTab from "@/components/hr/LeaveTab";
import VacationCalendarTab from "@/components/hr/VacationCalendarTab";
import DocumentsTab from "@/components/hr/DocumentsTab";

const AppHR = () => {
  const { role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recursos Humanos"
        description="Gestiona empleados, ausencias, calendario y documentación"
      />
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-1" /> Empleados
          </TabsTrigger>
          <TabsTrigger value="leave">
            <CalendarDays className="h-4 w-4 mr-1" /> Ausencias
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-4 w-4 mr-1" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-1" /> Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="calendar"><VacationCalendarTab /></TabsContent>
        <TabsContent value="documents"><DocumentsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AppHR;
