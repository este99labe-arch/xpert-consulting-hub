import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthRedirect } from "@/components/AuthRedirect";
import Login from "@/pages/Login";
import ClientLayout from "@/layouts/ClientLayout";
import MasterLayout from "@/layouts/MasterLayout";
import AppDashboard from "@/pages/app/AppDashboard";
import CookieConsent from "@/components/legal/CookieConsent";

// Rutas cargadas bajo demanda (code-splitting): reducen el bundle inicial.
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const MasterDashboard = lazy(() => import("@/pages/master/MasterDashboard"));
const MasterClients = lazy(() => import("@/pages/master/MasterClients"));
const MasterSettings = lazy(() => import("@/pages/master/MasterSettings"));
const MasterApiDocs = lazy(() => import("@/pages/master/MasterApiDocs"));
const AppAccounting = lazy(() => import("@/pages/app/AppAccounting"));
const AppAttendance = lazy(() => import("@/pages/app/AppAttendance"));
const AppHR = lazy(() => import("@/pages/app/AppHR"));
const AppInvoices = lazy(() => import("@/pages/app/AppInvoices"));
const AppClients = lazy(() => import("@/pages/app/AppClients"));
const AppClientDetail = lazy(() => import("@/pages/app/AppClientDetail"));
const AppSettings = lazy(() => import("@/pages/app/AppSettings"));
const AppInventory = lazy(() => import("@/pages/app/AppInventory"));
const AppReports = lazy(() => import("@/pages/app/AppReports"));
const AppTasks = lazy(() => import("@/pages/app/AppTasks"));
const AppXpertRed = lazy(() => import("@/pages/app/AppXpertRed"));
const AppChat = lazy(() => import("@/pages/app/AppChat"));
const CookiePolicy = lazy(() => import("@/pages/legal/CookiePolicy"));

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Cargando página">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CookieConsent />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/legal/cookies" element={<CookiePolicy />} />

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
              <Route path="api-docs" element={<MasterApiDocs />} />
            </Route>

            {/* Client routes */}
            <Route
              path="/app"
              element={
            <ProtectedRoute allowedRoles={["MASTER_ADMIN", "MANAGER", "EMPLOYEE"]}>
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AppDashboard />} />
              <Route path="clients" element={<AppClients />} />
              <Route path="clients/:id" element={<AppClientDetail />} />
              <Route path="invoices" element={<AppInvoices />} />
              <Route path="accounting" element={<AppAccounting />} />
              <Route path="hr" element={<AppHR />} />
              <Route path="attendance" element={<AppAttendance />} />
              <Route path="inventory" element={<AppInventory />} />
              <Route path="reports" element={<AppReports />} />
              <Route path="tasks" element={<AppTasks />} />
              <Route path="xpertred" element={<AppXpertRed />} />
              <Route path="chat" element={<AppChat />} />
              <Route path="settings" element={<AppSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
