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
import { Check, X, Loader2, AlertCircle, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default function LeaveApprovalsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("PENDING");
  const [page, setPage] = useState(1);

  const { data: leaveData, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/leaves?status=${tab}&page=${page}`],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", `/api/leave/${id}/review`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Leave request updated" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/admin/leaves") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Approvals</h1>
        <p className="text-muted-foreground">Review and manage employee leave requests</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="PENDING" data-testid="tab-pending">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED" data-testid="tab-approved">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED" data-testid="tab-rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {tab} Leave Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : leaveData?.records?.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        {tab === "PENDING" && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveData.records.map((leave: any) => (
                        <TableRow key={leave.id} data-testid={`row-leave-approval-${leave.id}`}>
                          <TableCell className="font-medium">{leave.firstName} {leave.lastName}</TableCell>
                          <TableCell><Badge variant="outline">{leave.leaveType}</Badge></TableCell>
                          <TableCell>{format(new Date(leave.startDate), "MMM d, yyyy")}</TableCell>
                          <TableCell>{format(new Date(leave.endDate), "MMM d, yyyy")}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor[leave.status]}>{leave.status}</Badge>
                          </TableCell>
                          {tab === "PENDING" && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => reviewMutation.mutate({ id: leave.id, status: "APPROVED" })}
                                  disabled={reviewMutation.isPending}
                                  data-testid={`button-approve-${leave.id}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => reviewMutation.mutate({ id: leave.id, status: "REJECTED" })}
                                  disabled={reviewMutation.isPending}
                                  data-testid={`button-reject-${leave.id}`}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">Page {page} of {leaveData.totalPages || 1}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" disabled={page >= (leaveData.totalPages || 1)} onClick={() => setPage(page + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">No {tab.toLowerCase()} leave requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
