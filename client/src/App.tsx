import { useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Loader2, LogIn, LogOut, Clock, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/reset-password-page";
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
import ForgotPasswordPage from "@/pages/forgot-password-page";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

function QuickAttendance() {
  const { toast } = useToast();
  const [geoStatus, setGeoStatus] = useState("");

  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeLeaveId, setRevokeLeaveId] = useState<number | null>(null);

  const { data: todayAttendance, isLoading } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
  });

  const getLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      setGeoStatus("Locating...");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoStatus("");
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          setGeoStatus("");
          reject(new Error("Location permission denied"));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  /* ================= CLOCK IN ================= */

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      const res = await apiRequest(
        "POST",
        "/api/attendance/clock-in",
        coords
      );

      const json = await res.json();

      if (!res.ok) {
        const error: any = new Error(json.message || "Clock-in failed");
        error.status = res.status;
        error.code = json.code;
        error.leaveId = json.leaveId;
        throw error;
      }

      return json;
    },

    onSuccess: () => {
      toast({ title: "Clocked in successfully" });

      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },

    // onError: (error: any) => {
    //   console.log("Clock-in error object:", error);
    //   if (error.status === 409 && error.code === "LEAVE_APPROVED") {
    //     setRevokeLeaveId(error.leaveId);
    //     setRevokeDialogOpen(true);
    //     return;
    //   }

    //   toast({
    //     title: "Clock-in failed",
    //     description: error.message,
    //     variant: "destructive",
    //   });
    // },
    onError: (error: any) => {
      if (error.status === 409 && error.code === "LEAVE_APPROVED") {
        setRevokeLeaveId(error.meta?.leaveId);
        setRevokeDialogOpen(true);
        return;
      }

      toast({
        title: "Clock-in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  /* ================= CLOCK OUT ================= */

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      const res = await apiRequest(
        "POST",
        "/api/attendance/clock-out",
        coords
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Clock-out failed");
      }

      return json;
    },

    onSuccess: () => {
      toast({ title: "Clocked out successfully" });

      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },

    onError: (error: any) => {
      toast({
        title: "Clock-out failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /* ================= REVOKE ================= */

  const revokeMutation = useMutation({
    mutationFn: async (leaveId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/leave/${leaveId}/revoke`
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to send revoke request");
      }

      return json;
    },

    onSuccess: () => {
      toast({ title: "Revoke request sent to manager" });

      setRevokeDialogOpen(false);

      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
    },

    onError: (error: any) => {
      toast({
        title: "Failed to send revoke request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /* ================= UI LOGIC ================= */

  const canClockIn = !todayAttendance?.clockIn;
  const canClockOut =
    todayAttendance?.clockIn && !todayAttendance?.clockOut;
  const dayComplete =
    todayAttendance?.clockIn && todayAttendance?.clockOut;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">

      {geoStatus && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 animate-pulse" />
          {geoStatus}
        </span>
      )}

      {canClockIn && (
        <Button
          size="sm"
          onClick={() => clockInMutation.mutate()}
          disabled={clockInMutation.isPending}
          data-testid="button-quick-clock-in"
        >
          {clockInMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogIn className="mr-1.5 h-3.5 w-3.5" />
          )}
          Clock In
        </Button>
      )}

      {canClockOut && (
        <>
          <span className="text-xs text-muted-foreground">
            In:{" "}
            {new Date(todayAttendance.clockIn).toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" }
            )}
          </span>

          <Button
            size="sm"
            variant="outline"
            onClick={() => clockOutMutation.mutate()}
            disabled={clockOutMutation.isPending}
          >
            {clockOutMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
            )}
            Clock Out
          </Button>
        </>
      )}

      {dayComplete && (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          Day Complete
        </Badge>
      )}

      {/* ================= REVOKE DIALOG ================= */}

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Approved</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your leave is already approved for today.
              Do you want to send a revoke request to your manager?
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRevokeDialogOpen(false)}
              >
                Cancel
              </Button>

              <Button
                onClick={() => {
                  if (!revokeLeaveId) return;
                  revokeMutation.mutate(revokeLeaveId);
                }}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Revoke Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
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
            <div className="flex items-center gap-2">
              <QuickAttendance />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/attendance" component={AttendancePage} />
              <Route path="/leave" component={LeavePage} />
              <Route path="/payslips" component={PayslipsPage} />
              {(role === "MANAGER" || role === "HR" || role === "SUPER_ADMIN") && (
                <>
                  <Route path="/team" component={TeamPage} />
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
              <Route>{() => <Redirect to="/" />}</Route>
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
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route component={AuthPage} />
      </Switch>
    );
  }

  if (user.mustResetPassword) {
    return <ResetPasswordPage />;
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
