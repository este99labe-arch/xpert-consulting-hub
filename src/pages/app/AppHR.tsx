import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarIcon, FileText, CalendarDays } from "lucide-react";

import EmployeesTab from "@/components/hr/EmployeesTab";
import LeaveTab from "@/components/hr/LeaveTab";
import VacationCalendarTab from "@/components/hr/VacationCalendarTab";
import DocumentsTab from "@/components/hr/DocumentsTab";

const AppHR = () => {
  const { role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recursos Humanos</h1>
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Empleados</span><span className="sm:hidden">Emp.</span>
          </TabsTrigger>
          <TabsTrigger value="leave">
            <CalendarDays className="h-4 w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Ausencias</span><span className="sm:hidden">Aus.</span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-4 w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Calendario</span><span className="sm:hidden">Cal.</span>
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Documentación</span><span className="sm:hidden">Docs</span>
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
