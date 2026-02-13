import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CalendarDays, Check, X, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default function TeamPage() {
  const { toast } = useToast();

  const { data: teamAttendance, isLoading: attendanceLoading } = useQuery<any>({
    queryKey: ["/api/team/attendance"],
  });

  const { data: teamLeaves, isLoading: leavesLoading } = useQuery<any>({
    queryKey: ["/api/team/leaves"],
  });

  const reviewLeaveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", `/api/leave/${id}/review`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Leave request updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/team/leaves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update leave", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">View your team's attendance and manage leave requests</p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance" data-testid="tab-team-attendance">Team Attendance</TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-team-leaves">Leave Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Today's Team Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <Skeleton className="h-48" />
              ) : teamAttendance?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamAttendance.map((record: any) => (
                      <TableRow key={record.employeeId} data-testid={`row-team-att-${record.employeeId}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {record.firstName?.[0]}{record.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{record.firstName} {record.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{record.department}</TableCell>
                        <TableCell>
                          {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : "-"}
                        </TableCell>
                        <TableCell>
                          {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.clockIn ? "default" : "secondary"}>
                            {record.clockIn ? (record.clockOut ? "Completed" : "Working") : "Absent"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">No team members found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Pending Leave Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leavesLoading ? (
                <Skeleton className="h-48" />
              ) : teamLeaves?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamLeaves.map((leave: any) => (
                      <TableRow key={leave.id} data-testid={`row-team-leave-${leave.id}`}>
                        <TableCell className="font-medium">{leave.firstName} {leave.lastName}</TableCell>
                        <TableCell><Badge variant="outline">{leave.leaveType}</Badge></TableCell>
                        <TableCell>{format(new Date(leave.startDate), "MMM d")}</TableCell>
                        <TableCell>{format(new Date(leave.endDate), "MMM d")}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{leave.reason}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor[leave.status]}>{leave.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {leave.status === "PENDING" && (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => reviewLeaveMutation.mutate({ id: leave.id, status: "APPROVED" })}
                                disabled={reviewLeaveMutation.isPending}
                                data-testid={`button-approve-leave-${leave.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => reviewLeaveMutation.mutate({ id: leave.id, status: "REJECTED" })}
                                disabled={reviewLeaveMutation.isPending}
                                data-testid={`button-reject-leave-${leave.id}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">No leave requests found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
