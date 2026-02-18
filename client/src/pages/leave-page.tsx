import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leaveApplicationSchema } from "@shared/schema";
import { z } from "zod";
import {
  CalendarDays,
  Plus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<
  string,
  "default" | "secondary" | "destructive"
> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default function LeavePage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [applyOpen, setApplyOpen] = useState(false);

  /* ---------------- LEAVE REQUESTS ---------------- */

  const { data: leaveData, isLoading } = useQuery<any>({
    queryKey: [`/api/leave?page=${page}`],
  });

  /* ---------------- LEAVE BALANCE ---------------- */

  const { data: balanceData, isLoading: balanceLoading } = useQuery<any>({
    queryKey: ["/api/leave/balance"],
  });

  /* ---------------- FORM ---------------- */

  const form = useForm({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      leaveType: "CASUAL" as const,
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  /* ---------------- APPLY MUTATION ---------------- */

  const applyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof leaveApplicationSchema>) => {
      const res = await apiRequest("POST", "/api/leave", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Leave application submitted" });
      setApplyOpen(false);
      form.reset();

      // Refresh leave list
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          q.queryKey[0].startsWith("/api/leave"),
      });

      // Refresh balance
      queryClient.invalidateQueries({
        queryKey: ["/api/leave/balance"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to apply for leave",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">
            Apply for leave and track your requests
          </p>
        </div>

        <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Apply Leave
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) =>
                  applyMutation.mutate(d)
                )}
                className="space-y-4"
              >
                {/* Leave Type */}
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem
                            value="CASUAL"
                            disabled={(balanceData?.casual ?? 0) <= 0}
                          >
                            Casual Leave
                          </SelectItem>

                          <SelectItem
                            value="MEDICAL"
                            disabled={(balanceData?.medical ?? 0) <= 0}
                          >
                            Medical Leave
                          </SelectItem>

                          <SelectItem value="EARNED">
                            Earned Leave
                          </SelectItem>

                          <SelectItem value="UNPAID">
                            Unpaid Leave
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Reason */}
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a reason..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={applyMutation.isPending}
                >
                  {applyMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Application
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* LEAVE BALANCE CARD */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Casual Leave
                </p>
                <p className="text-lg font-semibold">
                  {balanceData?.casual ?? 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Medical Leave
                </p>
                <p className="text-lg font-semibold">
                  {balanceData?.medical ?? 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Earned Leave
                </p>
                <p className="text-lg font-semibold">
                  {balanceData?.earned ?? 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Unpaid Leave
                </p>
                <p className="text-lg font-semibold">-</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LEAVE TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            My Leave Requests
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
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveData.records.map((leave: any) => (
                    <TableRow key={leave.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {leave.leaveType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(leave.startDate),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(leave.endDate),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {leave.reason}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            statusColor[leave.status] || "secondary"
                          }
                        >
                          {leave.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {leaveData.totalPages || 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={
                      page >= (leaveData.totalPages || 1)
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">
                No leave requests found
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
