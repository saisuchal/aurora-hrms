import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, CalendarOff, ClipboardList, AlertCircle, Clock, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const isHrOrAdmin = user?.role === "HR" || user?.role === "SUPER_ADMIN";

  const { data: dashboardData, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
  });

  const { data: myAttendance } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const displayName = user?.employee
    ? `${user.employee.firstName}`
    : user?.username;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-greeting">
          {greeting()}, {displayName}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening today
        </p>
      </div>

      {isHrOrAdmin && dashboardData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-employees">
                {dashboardData.totalEmployees ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Active workforce</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-present-today">
                {dashboardData.presentToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.totalEmployees > 0
                  ? `${Math.round((dashboardData.presentToday / dashboardData.totalEmployees) * 100)}% attendance rate`
                  : "No employees"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Leave Today</CardTitle>
              <CalendarOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-on-leave">
                {dashboardData.onLeaveToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Approved leaves</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-requests">
                {(dashboardData.pendingLeaves ?? 0) + (dashboardData.pendingCorrections ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.pendingLeaves ?? 0} leave, {dashboardData.pendingCorrections ?? 0} corrections
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myAttendance ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={myAttendance.clockOut ? "default" : "secondary"}>
                    {myAttendance.clockOut ? "Completed" : myAttendance.clockIn ? "Clocked In" : "Not Clocked In"}
                  </Badge>
                </div>
                {myAttendance.clockIn && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Clock In</span>
                    <span className="text-sm font-medium" data-testid="text-clock-in-time">
                      {new Date(myAttendance.clockIn).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {myAttendance.clockOut && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Clock Out</span>
                    <span className="text-sm font-medium" data-testid="text-clock-out-time">
                      {new Date(myAttendance.clockOut).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm">No attendance record for today</p>
                <p className="text-xs">Clock in from the Attendance page</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant="outline" data-testid="text-role-badge">{user?.role}</Badge>
              </div>
              {user?.employee && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <span className="text-sm font-medium" data-testid="text-department">{user.employee.department}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Designation</span>
                    <span className="text-sm font-medium" data-testid="text-designation">{user.employee.designation}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Employee ID</span>
                    <span className="text-sm font-medium" data-testid="text-employee-code">{user.employee.employeeCode}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
