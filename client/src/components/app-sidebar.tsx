import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Users,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Building2,
  Shield,
  ClipboardList,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const role = user?.role;

  const employeeItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Attendance", url: "/attendance", icon: Clock },
    { title: "Leave", url: "/leave", icon: CalendarDays },
    { title: "Payslips", url: "/payslips", icon: FileText },
  ];

  const managerItems = [
    { title: "Team", url: "/team", icon: Users },
  ];

  const hrItems = [
    { title: "Employees", url: "/employees", icon: Users },
    { title: "Leave Approvals", url: "/leave-approvals", icon: ClipboardList },
    { title: "Corrections", url: "/corrections", icon: FileText },
    { title: "Payroll", url: "/payroll", icon: DollarSign },
    { title: "Audit Logs", url: "/audit-logs", icon: Shield },
  ];

  const adminItems = [
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const initials = user?.employee
    ? `${user.employee.firstName[0]}${user.employee.lastName[0]}`
    : user?.username?.slice(0, 2).toUpperCase() || "??";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">HRMS</span>
        </div>
      </SidebarHeader>

      

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    data-testid={`nav-${item.title.toLowerCase()}`}
                    onClick={() => navigate(item.url)}
                    data-active={isActive(item.url)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(role === "MANAGER" || role === "HR" || role === "SUPER_ADMIN") && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managerItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      data-testid={`nav-${item.title.toLowerCase()}`}
                      onClick={() => navigate(item.url)}
                      data-active={isActive(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(role === "HR" || role === "SUPER_ADMIN") && (
          <SidebarGroup>
            <SidebarGroupLabel>HR Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hrItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                      onClick={() => navigate(item.url)}
                      data-active={isActive(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {role === "SUPER_ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      data-testid={`nav-${item.title.toLowerCase()}`}
                      onClick={() => navigate(item.url)}
                      data-active={isActive(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.username}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-user-role">{role}</p>
          </div>
          <Button
            data-testid="button-logout"
            size="icon"
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
