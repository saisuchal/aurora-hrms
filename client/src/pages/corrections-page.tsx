import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, AlertCircle, FileEdit, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default function CorrectionsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data: correctionData, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/corrections?page=${page}`],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", `/api/attendance/correction/${id}/review`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Correction request updated" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/admin/corrections") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Corrections</h1>
        <p className="text-muted-foreground">Review employee attendance correction requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            Correction Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : correctionData?.records?.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested Clock In</TableHead>
                    <TableHead>Requested Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctionData.records.map((corr: any) => (
                    <TableRow key={corr.id} data-testid={`row-correction-${corr.id}`}>
                      <TableCell className="font-medium">{corr.firstName} {corr.lastName}</TableCell>
                      <TableCell>{format(new Date(corr.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{corr.reason}</TableCell>
                      <TableCell>
                        {corr.requestedClockIn ? new Date(corr.requestedClockIn).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell>
                        {corr.requestedClockOut ? new Date(corr.requestedClockOut).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor[corr.status]}>{corr.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {corr.status === "PENDING" && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reviewMutation.mutate({ id: corr.id, status: "APPROVED" })}
                              disabled={reviewMutation.isPending}
                              data-testid={`button-approve-corr-${corr.id}`}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reviewMutation.mutate({ id: corr.id, status: "REJECTED" })}
                              disabled={reviewMutation.isPending}
                              data-testid={`button-reject-corr-${corr.id}`}
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
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Page {page} of {correctionData.totalPages || 1}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= (correctionData.totalPages || 1)} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No correction requests found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
