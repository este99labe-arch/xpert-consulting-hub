import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthRedirect } from "@/components/AuthRedirect";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import MasterLayout from "@/layouts/MasterLayout";
import MasterDashboard from "@/pages/master/MasterDashboard";
import MasterClients from "@/pages/master/MasterClients";
import MasterSettings from "@/pages/master/MasterSettings";
import ClientLayout from "@/layouts/ClientLayout";
import AppDashboard from "@/pages/app/AppDashboard";
import AppPlaceholder from "@/pages/app/AppPlaceholder";
import AppInvoices from "@/pages/app/AppInvoices";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* Master Admin routes */}
            <Route
              path="/master"
              element={
                <ProtectedRoute allowedRoles={["MASTER_ADMIN"]}>
                  <MasterLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<MasterDashboard />} />
              <Route path="clients" element={<MasterClients />} />
              <Route path="settings" element={<MasterSettings />} />
            </Route>

            {/* Client routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute allowedRoles={["MANAGER", "EMPLOYEE"]}>
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AppDashboard />} />
              <Route path="clients" element={<AppPlaceholder />} />
              <Route path="invoices" element={<AppInvoices />} />
              <Route path="accounting" element={<AppPlaceholder />} />
              <Route path="hr" element={<AppPlaceholder />} />
              <Route path="attendance" element={<AppPlaceholder />} />
              <Route path="settings" element={<AppPlaceholder />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
