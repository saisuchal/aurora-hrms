import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

const correctionSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    requestedClockIn: z.string().optional(),
    requestedClockOut: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestedClockIn && data.requestedClockOut) {
      const clockIn = new Date(data.requestedClockIn);
      const clockOut = new Date(data.requestedClockOut);

      if (clockOut <= clockIn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Clock-out time must be greater than clock-in time",
          path: ["requestedClockOut"],
        });
      }
    }
  });

export default function AttendancePage() {
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [dateBounds, setDateBounds] = useState<{
    min: string;
    max: string;
  } | null>(null);

  // const { data: historyData, isLoading: historyLoading } = useQuery<any>({
  //   queryKey: ["/api/attendance/history", page],
  // });

  const { user } = useAuth();

  const { data: historyData, isLoading: historyLoading } = useQuery<any>({
  queryKey: ["/api/attendance/history", user?.id, page],
  enabled: !!user, // prevents query before auth loads
});


  const correctionForm = useForm({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      date: "",
      reason: "",
      requestedClockIn: "",
      requestedClockOut: "",
    },
  });

  const openCorrectionForRecord = (record: any) => {
    setSelectedRecord(record);

    const baseDate = new Date(record.date);
    const formattedDate = format(baseDate, "yyyy-MM-dd");

    setDateBounds({
      min: `${formattedDate}T00:00`,
      max: `${formattedDate}T23:59`,
    });

    correctionForm.reset({
      date: formattedDate,
      reason: "",
      requestedClockIn: record.clockIn
        ? format(new Date(record.clockIn), "yyyy-MM-dd'T'HH:mm")
        : "",
      requestedClockOut: record.clockOut
        ? format(new Date(record.clockOut), "yyyy-MM-dd'T'HH:mm")
        : "",
    });

    setCorrectionOpen(true);
  };

  const correctionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof correctionSchema>) => {
      const payload = {
        date: selectedRecord
          ? format(new Date(selectedRecord.date), "yyyy-MM-dd")
          : format(new Date(data.date), "yyyy-MM-dd"),
        reason: data.reason,
        requestedClockIn: data.requestedClockIn
          ? new Date(data.requestedClockIn).toISOString()
          : null,
        requestedClockOut: data.requestedClockOut
          ? new Date(data.requestedClockOut).toISOString()
          : null,
      };

      const res = await apiRequest(
        "POST",
        "/api/attendance/correction",
        payload
      );

      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Correction request submitted" });
      setCorrectionOpen(false);
      correctionForm.reset();
      setSelectedRecord(null);
      setDateBounds(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit correction",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-48" />
          ) : historyData?.records?.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.records.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </TableCell>

                      <TableCell>
                        {record.clockIn
                          ? new Date(record.clockIn).toLocaleTimeString()
                          : "-"}
                      </TableCell>

                      <TableCell>
                        {record.clockOut
                          ? new Date(record.clockOut).toLocaleTimeString()
                          : "-"}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            record.status === "PRESENT"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCorrectionForRecord(record)}
                        >
                          <FileEdit className="h-4 w-4 mr-1" />
                          Correct
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {historyData.totalPages || 1}
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
                    disabled={page >= (historyData.totalPages || 1)}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              No attendance records found
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Attendance Correction</DialogTitle>
          </DialogHeader>

          <Form {...correctionForm}>
            <form
              onSubmit={correctionForm.handleSubmit((d) =>
                correctionMutation.mutate(d)
              )}
              className="space-y-4"
            >
              <FormField
                control={correctionForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        readOnly
                        className="pointer-events-none bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={correctionForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={correctionForm.control}
                name="requestedClockIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corrected Clock In</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        min={dateBounds?.min}
                        max={dateBounds?.max}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={correctionForm.control}
                name="requestedClockOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corrected Clock Out</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        min={dateBounds?.min}
                        max={dateBounds?.max}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={correctionMutation.isPending}
              >
                {correctionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
