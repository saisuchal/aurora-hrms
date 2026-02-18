import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEmployeeSchema } from "@shared/schema";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserPlus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  Search,
  KeyRound,
  UserX,
  UserCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function EmployeesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [resetConfirm, setResetConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ id: number; name: string; isActive: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);


  const { data: employeeData, isLoading } = useQuery<any>({
    queryKey: [`/api/employees?page=${page}&search=${encodeURIComponent(search)}`],
  });

  const { data: managers } = useQuery<any>({
    queryKey: ["/api/employees/managers"],
  });

  const form = useForm<z.infer<typeof createEmployeeSchema>>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      managerId: 0,
      monthlySalary: 0,
      dateOfJoining: "",
      role: "EMPLOYEE",
    },
  });


  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createEmployeeSchema>) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee added successfully", description: "Login credentials have been sent to their email." });
      setAddOpen(false);
      form.reset();
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/employees") });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add employee", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await apiRequest("POST", "/api/admin/password/reset", { employeeId });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully", description: "A new temporary password has been sent to the employee's email." });
      setResetConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await apiRequest("POST", `/api/employees/${employeeId}/toggle-active`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.isActive ? "Employee activated" : "Employee deactivated", description: data.isActive ? "The employee can now access the system." : "The employee's access has been revoked." });
      setDeactivateConfirm(null);
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/employees") });
    },
    onError: (error: Error) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground">Add and manage employees</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                A user account will be created automatically. Login credentials will be sent to the employee's email.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input data-testid="input-first-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input data-testid="input-last-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input data-testid="input-email" type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl><Input data-testid="input-phone" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl><Input data-testid="input-department" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl><Input data-testid="input-designation" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {managers?.length > 0 && (
                  <FormField control={form.control} name="managerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-manager">
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {managers.map((m: any) => (
                            <SelectItem key={m.id} value={m.id.toString()}>
                              {m.firstName} {m.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Salary</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-salary"
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl><Input data-testid="input-doj" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button data-testid="button-submit-employee" type="submit" className="w-full" disabled={addMutation.isPending}>
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Employee
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Employees
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-employees"
              placeholder="Search employees..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : employeeData?.records?.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
  {employeeData.records.map((emp: any) => (
    <React.Fragment key={emp.id}>
      
      <TableRow
        data-testid={`row-employee-${emp.id}`}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() =>
          setExpandedId(expandedId === emp.id ? null : emp.id)
        }
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {emp.firstName[0]}{emp.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {emp.firstName} {emp.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {emp.email}
              </p>
            </div>
          </div>
        </TableCell>

        <TableCell>{emp.employeeCode}</TableCell>
        <TableCell>{emp.department}</TableCell>
        <TableCell>{emp.designation}</TableCell>

        <TableCell>
          <Badge variant="outline">
            {emp.role || "EMPLOYEE"}
          </Badge>
        </TableCell>

        <TableCell>
          <Badge
            variant={
              emp.isActive
                ? emp.userId
                  ? "default"
                  : "secondary"
                : "destructive"
            }
          >
            {emp.isActive
              ? emp.userId
                ? "Active"
                : "Pending"
              : "Deactivated"}
          </Badge>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1">

            {user?.role === "SUPER_ADMIN" &&
              emp.userId &&
              emp.isActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation(); // 🔥 prevent row toggle
                        setResetConfirm({
                          id: emp.id,
                          name: `${emp.firstName} ${emp.lastName}`,
                        });
                      }}
                      data-testid={`button-reset-password-${emp.id}`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Reset Password
                  </TooltipContent>
                </Tooltip>
              )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation(); // 🔥 prevent row toggle
                    setDeactivateConfirm({
                      id: emp.id,
                      name: `${emp.firstName} ${emp.lastName}`,
                      isActive: emp.isActive,
                    });
                  }}
                  data-testid={`button-toggle-active-${emp.id}`}
                >
                  {emp.isActive ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {emp.isActive ? "Deactivate" : "Activate"}
              </TooltipContent>
            </Tooltip>

          </div>
        </TableCell>
      </TableRow>

      {expandedId === emp.id && (
        <TableRow>
          <TableCell colSpan={7}>
            <EmployeeExpandedDetails employee={emp} />
          </TableCell>
        </TableRow>
      )}

    </React.Fragment>
  ))}
</TableBody>

              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Page {page} of {employeeData.totalPages || 1}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= (employeeData.totalPages || 1)} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No employees found</p>
              <p className="text-xs">Click "Add Employee" to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetConfirm} onOpenChange={(open) => { if (!open) setResetConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-destructive" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reset the password for <span className="font-medium text-foreground">{resetConfirm?.name}</span>? A new temporary password will be generated and sent to their email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setResetConfirm(null)} data-testid="button-cancel-reset">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetConfirm && resetPasswordMutation.mutate(resetConfirm.id)}
              disabled={resetPasswordMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateConfirm} onOpenChange={(open) => { if (!open) setDeactivateConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deactivateConfirm?.isActive ? (
                <UserX className="h-5 w-5 text-destructive" />
              ) : (
                <UserCheck className="h-5 w-5 text-primary" />
              )}
              {deactivateConfirm?.isActive ? "Deactivate Employee" : "Activate Employee"}
            </DialogTitle>
            <DialogDescription>
              {deactivateConfirm?.isActive
                ? <>Are you sure you want to deactivate <span className="font-medium text-foreground">{deactivateConfirm?.name}</span>? They will lose access to the system.</>
                : <>Are you sure you want to reactivate <span className="font-medium text-foreground">{deactivateConfirm?.name}</span>? Their access will be restored.</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeactivateConfirm(null)} data-testid="button-cancel-toggle">
              Cancel
            </Button>
            <Button
              variant={deactivateConfirm?.isActive ? "destructive" : "default"}
              onClick={() => deactivateConfirm && toggleActiveMutation.mutate(deactivateConfirm.id)}
              disabled={toggleActiveMutation.isPending}
              data-testid="button-confirm-toggle"
            >
              {toggleActiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deactivateConfirm?.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeExpandedDetails({ employee }: { employee: any }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/attendance/summary", employee.id],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/attendance/summary?month=${month}&year=${year}&employeeId=${employee.id}`
      );
      return res.json();
    },
  });

  return (
    <div className="p-4 bg-muted/40 rounded-md space-y-4">

      {/* Basic Info */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="font-medium">Phone</p>
          <p>{employee.phone || "-"}</p>
        </div>
        <div>
          <p className="font-medium">Date of Joining</p>
          <p>{employee.dateOfJoining}</p>
        </div>
        <div>
          <p className="font-medium">Salary</p>
          <p>₹ {employee.monthlySalary}</p>
        </div>
      </div>

      {/* Leave Balance */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="font-medium">Casual Leave</p>
          <p>{employee.casualLeaveBalance}</p>
        </div>
        <div>
          <p className="font-medium">Medical Leave</p>
          <p>{employee.medicalLeaveBalance}</p>
        </div>
        <div>
          <p className="font-medium">Earned Leave</p>
          <p>{employee.earnedLeaveBalance}</p>
        </div>
      </div>

      {/* Attendance Summary */}
      <div>
        <p className="font-semibold mb-2">Attendance (This Month)</p>

        {isLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Working Days
                </p>
                <p className="text-xl font-bold">
                  {data?.workingDays ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Present
                </p>
                <p className="text-xl font-bold text-green-600">
                  {data?.presentDays ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Absent
                </p>
                <p className="text-xl font-bold text-red-600">
                  {data?.absentDays ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

