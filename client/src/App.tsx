import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Loader2 } from "lucide-react";

import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import AttendancePage from "@/pages/attendance-page";
import LeavePage from "@/pages/leave-page";
import PayslipsPage from "@/pages/payslips-page";
import TeamPage from "@/pages/team-page";
import EmployeesPage from "@/pages/employees-page";
import LeaveApprovalsPage from "@/pages/leave-approvals-page";
import CorrectionsPage from "@/pages/corrections-page";
import PayrollPage from "@/pages/payroll-page";
import AuditLogsPage from "@/pages/audit-logs-page";
import SettingsPage from "@/pages/settings-page";
import NotFound from "@/pages/not-found";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();
  const role = user?.role;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/attendance" component={AttendancePage} />
              <Route path="/leave" component={LeavePage} />
              <Route path="/payslips" component={PayslipsPage} />
              {(role === "MANAGER" || role === "HR" || role === "SUPER_ADMIN") && (
                <Route path="/team" component={TeamPage} />
              )}
              {(role === "HR" || role === "SUPER_ADMIN") && (
                <>
                  <Route path="/employees" component={EmployeesPage} />
                  <Route path="/leave-approvals" component={LeaveApprovalsPage} />
                  <Route path="/corrections" component={CorrectionsPage} />
                  <Route path="/payroll" component={PayrollPage} />
                  <Route path="/audit-logs" component={AuditLogsPage} />
                </>
              )}
              {role === "SUPER_ADMIN" && (
                <Route path="/settings" component={SettingsPage} />
              )}
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (location === "/auth") {
    return <AuthenticatedLayout />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AppRouter />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
