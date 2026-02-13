import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileEdit,
} from "lucide-react";
import { format } from "date-fns";

const correctionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
});

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string>("");

  const { data: todayAttendance, isLoading: todayLoading } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<any>({
    queryKey: [`/api/attendance/history?page=${page}`],
  });

  const correctionForm = useForm({
    resolver: zodResolver(correctionSchema),
    defaultValues: { date: "", reason: "", requestedClockIn: "", requestedClockOut: "" },
  });

  const getLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      setGeoStatus("Getting your location...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoStatus("");
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          setGeoStatus("");
          reject(new Error("Location permission denied. Please enable location access to clock in."));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      const res = await apiRequest("POST", "/api/attendance/clock-in", coords);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Clocked in successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/attendance/history") });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Clock-in failed", description: error.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      const res = await apiRequest("POST", "/api/attendance/clock-out", coords);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Clocked out successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/attendance/history") });
    },
    onError: (error: Error) => {
      toast({ title: "Clock-out failed", description: error.message, variant: "destructive" });
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof correctionSchema>) => {
      const res = await apiRequest("POST", "/api/attendance/correction", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Correction request submitted" });
      setCorrectionOpen(false);
      correctionForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit correction", description: error.message, variant: "destructive" });
    },
  });

  const canClockIn = !todayAttendance?.clockIn;
  const canClockOut = todayAttendance?.clockIn && !todayAttendance?.clockOut;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track your daily attendance</p>
        </div>
        <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-request-correction">
              <FileEdit className="h-4 w-4 mr-2" />
              Request Correction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Attendance Correction</DialogTitle>
            </DialogHeader>
            <Form {...correctionForm}>
              <form onSubmit={correctionForm.handleSubmit((d) => correctionMutation.mutate(d))} className="space-y-4">
                <FormField control={correctionForm.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input data-testid="input-correction-date" type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={correctionForm.control} name="reason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Textarea data-testid="input-correction-reason" placeholder="Explain why correction is needed..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={correctionForm.control} name="requestedClockIn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corrected Clock In (optional)</FormLabel>
                    <FormControl><Input data-testid="input-correction-clockin" type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={correctionForm.control} name="requestedClockOut" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corrected Clock Out (optional)</FormLabel>
                    <FormControl><Input data-testid="input-correction-clockout" type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button data-testid="button-submit-correction" type="submit" className="w-full" disabled={correctionMutation.isPending}>
                  {correctionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), "EEEE, MMMM d, yyyy")}
                  </p>
                  {todayAttendance?.clockIn && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Clocked in at: </span>
                      <span className="font-medium">{new Date(todayAttendance.clockIn).toLocaleTimeString()}</span>
                    </p>
                  )}
                  {todayAttendance?.clockOut && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Clocked out at: </span>
                      <span className="font-medium">{new Date(todayAttendance.clockOut).toLocaleTimeString()}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {canClockIn && (
                    <Button
                      data-testid="button-clock-in"
                      onClick={() => clockInMutation.mutate()}
                      disabled={clockInMutation.isPending}
                    >
                      {clockInMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="mr-2 h-4 w-4" />
                      )}
                      Clock In
                    </Button>
                  )}
                  {canClockOut && (
                    <Button
                      data-testid="button-clock-out"
                      variant="outline"
                      onClick={() => clockOutMutation.mutate()}
                      disabled={clockOutMutation.isPending}
                    >
                      {clockOutMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      Clock Out
                    </Button>
                  )}
                  {!canClockIn && !canClockOut && todayAttendance && (
                    <Badge variant="default">Day Complete</Badge>
                  )}
                </div>
              </div>
              {geoStatus && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 animate-pulse" />
                  {geoStatus}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.records.map((record: any) => (
                    <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell>
                        {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.status === "PRESENT" ? "default" : "secondary"}>
                          {record.status}
                        </Badge>
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
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= (historyData.totalPages || 1)}
                    onClick={() => setPage(page + 1)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No attendance records found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
