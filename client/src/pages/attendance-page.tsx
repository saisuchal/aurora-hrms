// import { useState } from "react";
// import { useAuth } from "@/hooks/use-auth";
// import { useQuery, useMutation } from "@tanstack/react-query";
// import { apiRequest, queryClient } from "@/lib/queryClient";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Skeleton } from "@/components/ui/skeleton";
// import { useToast } from "@/hooks/use-toast";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import {
//   AlertCircle,
//   ChevronLeft,
//   ChevronRight,
//   FileEdit,
//   Loader2,
// } from "lucide-react";
// import { format } from "date-fns";

// const correctionSchema = z
//   .object({
//     date: z.string().min(1),
//     reason: z.string().min(5),
//     requestedClockIn: z.string().optional(),
//     requestedClockOut: z.string().optional(),
//   })
//   .superRefine((data, ctx) => {
//     if (data.requestedClockIn && data.requestedClockOut) {
//       if (
//         new Date(data.requestedClockOut) <=
//         new Date(data.requestedClockIn)
//       ) {
//         ctx.addIssue({
//           code: z.ZodIssueCode.custom,
//           message: "Clock-out must be after clock-in",
//           path: ["requestedClockOut"],
//         });
//       }
//     }
//   });

// export default function AttendancePage() {
//   const { toast } = useToast();
//   const { user } = useAuth();

//   const [page, setPage] = useState(1);
//   const [correctionOpen, setCorrectionOpen] = useState(false);
//   const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
//   const [dateBounds, setDateBounds] = useState<{
//     min: string;
//     max: string;
//   } | null>(null);

//   /* =========================
//      MONTHLY SUMMARY
//   ========================= */

//   const today = new Date();
//   const currentMonth = today.getMonth() + 1;
//   const currentYear = today.getFullYear();

//   const { data: summaryData, isLoading: summaryLoading } =
//     useQuery<any>({
//       queryKey: [
//         "/api/attendance/summary",
//         user?.id,
//         currentMonth,
//         currentYear,
//       ],
//       queryFn: async () => {
//         const res = await fetch(
//           `/api/attendance/summary?month=${currentMonth}&year=${currentYear}`
//         );
//         return res.json();
//       },
//       enabled: !!user,
//     });

//   /* =========================
//      ATTENDANCE HISTORY
//   ========================= */

//   const { data: historyData, isLoading: historyLoading } =
//   useQuery<any>({
//     queryKey: ["/api/attendance/history", user?.id, page],
//     queryFn: async () => {
//       const res = await apiRequest(
//         "GET",
//         `/api/attendance/history?page=${page}`
//       );
//       return res.json();
//     },
//     enabled: !!user,
//     placeholderData: (previousData: any) => previousData,
//   });



//   /* =========================
//      CORRECTION FORM
//   ========================= */

//   const correctionForm = useForm({
//     resolver: zodResolver(correctionSchema),
//     defaultValues: {
//       date: "",
//       reason: "",
//       requestedClockIn: "",
//       requestedClockOut: "",
//     },
//   });

//   const openCorrectionForRecord = (record: any) => {
//     setSelectedRecord(record);

//     const baseDate = new Date(record.date);
//     const formattedDate = format(baseDate, "yyyy-MM-dd");

//     setDateBounds({
//       min: `${formattedDate}T00:00`,
//       max: `${formattedDate}T23:59`,
//     });

//     correctionForm.reset({
//       date: formattedDate,
//       reason: "",
//       requestedClockIn: record.clockIn
//         ? format(new Date(record.clockIn), "yyyy-MM-dd'T'HH:mm")
//         : "",
//       requestedClockOut: record.clockOut
//         ? format(new Date(record.clockOut), "yyyy-MM-dd'T'HH:mm")
//         : "",
//     });

//     setCorrectionOpen(true);
//   };

//   const correctionMutation = useMutation({
//     mutationFn: async (data: z.infer<typeof correctionSchema>) => {
//       const payload = {
//         date: selectedRecord
//           ? format(new Date(selectedRecord.date), "yyyy-MM-dd")
//           : data.date,
//         reason: data.reason,
//         requestedClockIn: data.requestedClockIn
//           ? new Date(data.requestedClockIn).toISOString()
//           : null,
//         requestedClockOut: data.requestedClockOut
//           ? new Date(data.requestedClockOut).toISOString()
//           : null,
//       };

//       const res = await apiRequest(
//         "POST",
//         "/api/attendance/correction",
//         payload
//       );

//       return res.json();
//     },

//     onSuccess: () => {
//       toast({ title: "Correction request submitted" });

//       setCorrectionOpen(false);
//       correctionForm.reset();
//       setSelectedRecord(null);
//       setDateBounds(null);

//       queryClient.invalidateQueries({
//         queryKey: ["/api/attendance/history", user?.id],
//       });

//       queryClient.invalidateQueries({
//         queryKey: [
//           "/api/attendance/summary",
//           user?.id,
//         ],
//       });
//     },

//     onError: () => {
//       toast({
//         title: "Failed to submit correction",
//         description:
//           "You already submitted a correction for this date.",
//         variant: "destructive",
//       });
//     },
//   });

//   /* =========================
//      UI
//   ========================= */

//   return (
//     <div className="p-6 space-y-6">

//       {/* =========================
//          MONTHLY SUMMARY CARD
//       ========================= */}

//       <Card>
//         <CardHeader>
//           <CardTitle>
//             {format(
//               new Date(currentYear, currentMonth - 1),
//               "MMMM yyyy"
//             )}{" "}
//             Summary
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {summaryLoading ? (
//             <Skeleton className="h-20" />
//           ) : summaryData ? (
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="p-4 rounded-xl bg-muted">
//                 <p className="text-sm text-muted-foreground">
//                   Working Days
//                 </p>
//                 <p className="text-2xl font-bold">
//                   {summaryData.workingDays}
//                 </p>
//               </div>

//               <div className="p-4 rounded-xl bg-green-50">
//                 <p className="text-sm text-muted-foreground">
//                   Present
//                 </p>
//                 <p className="text-2xl font-bold text-green-600">
//                   {summaryData.presentDays}
//                 </p>
//               </div>

//               <div className="p-4 rounded-xl bg-red-50">
//                 <p className="text-sm text-muted-foreground">
//                   Absent
//                 </p>
//                 <p className="text-2xl font-bold text-red-600">
//                   {summaryData.absentDays}
//                 </p>
//               </div>
//             </div>
//           ) : (
//             <p className="text-muted-foreground text-sm">
//               No summary available
//             </p>
//           )}
//         </CardContent>
//       </Card>

//       {/* =========================
//          ATTENDANCE HISTORY
//       ========================= */}

//       <Card>
//         <CardHeader>
//           <CardTitle>Attendance History</CardTitle>
//         </CardHeader>
//         <CardContent>
//           {historyLoading ? (
//             <Skeleton className="h-48" />
//           ) : historyData?.records?.length > 0 ? (
//             <>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Date</TableHead>
//                     <TableHead>Clock In</TableHead>
//                     <TableHead>Clock Out</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead>Action</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {historyData.records.map((record: any) => (
//                     <TableRow key={record.id}>
//                       <TableCell>
//                         {format(
//                           new Date(record.date),
//                           "MMM d, yyyy"
//                         )}
//                       </TableCell>

//                       <TableCell>
//                         {record.clockIn
//                           ? new Date(
//                               record.clockIn
//                             ).toLocaleTimeString()
//                           : "-"}
//                       </TableCell>

//                       <TableCell>
//                         {record.clockOut
//                           ? new Date(
//                               record.clockOut
//                             ).toLocaleTimeString()
//                           : "-"}
//                       </TableCell>

//                       <TableCell>
//                         <Badge>
//                           {record.correctionStatus ??
//                             record.status}
//                         </Badge>
//                       </TableCell>

//                       <TableCell>
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           onClick={() =>
//                             openCorrectionForRecord(record)
//                           }
//                         >
//                           <FileEdit className="h-4 w-4 mr-1" />
//                           Correct
//                         </Button>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>

//               <div className="flex items-center justify-between mt-4">
//                 <p className="text-sm text-muted-foreground">
//                   Page {page} of {historyData.totalPages || 1}
//                 </p>
//                 <div className="flex gap-2">
//                   <Button
//                     variant="outline"
//                     size="icon"
//                     disabled={page <= 1}
//                     onClick={() => setPage(page - 1)}
//                   >
//                     <ChevronLeft className="h-4 w-4" />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="icon"
//                     disabled={
//                       page >= (historyData.totalPages || 1)
//                     }
//                     onClick={() => setPage(page + 1)}
//                   >
//                     <ChevronRight className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </div>
//             </>
//           ) : (
//             <div className="flex flex-col items-center py-8 text-muted-foreground">
//               <AlertCircle className="h-8 w-8 mb-2" />
//               No attendance records found
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* =========================
//          CORRECTION DIALOG
//       ========================= */}

//       <Dialog
//         open={correctionOpen}
//         onOpenChange={setCorrectionOpen}
//       >
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>
//               Request Attendance Correction
//             </DialogTitle>
//           </DialogHeader>

//           <Form {...correctionForm}>
//             <form
//               onSubmit={correctionForm.handleSubmit((d) =>
//                 correctionMutation.mutate(d)
//               )}
//               className="space-y-4"
//             >
//               <FormField
//                 control={correctionForm.control}
//                 name="reason"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Reason</FormLabel>
//                     <FormControl>
//                       <Textarea {...field} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <Button
//                 type="submit"
//                 className="w-full"
//                 disabled={correctionMutation.isPending}
//               >
//                 {correctionMutation.isPending && (
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                 )}
//                 Submit Request
//               </Button>
//             </form>
//           </Form>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }


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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
    reason: z.string().min(5),
    requestedClockIn: z.string().optional(),
    requestedClockOut: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestedClockIn && data.requestedClockOut) {
      if (
        new Date(data.requestedClockOut) <=
        new Date(data.requestedClockIn)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Clock-out must be after clock-in",
          path: ["requestedClockOut"],
        });
      }
    }
  });

export default function AttendancePage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [page, setPage] = useState(1);
  const thisYear = today.getFullYear();

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [dateBounds, setDateBounds] = useState<{ min: string; max: string } | null>(null);

  /* =========================
     SUMMARY
  ========================= */

  const { data: summaryData, isLoading: summaryLoading } =
    useQuery({
      queryKey: ["attendance-summary", user?.id, month, year],
      queryFn: async () => {
        const res = await apiRequest(
          "GET",
          `/api/attendance/summary?month=${month}&year=${year}`
        );
        return res.json();
      },
      enabled: !!user,
    });

  /* =========================
     HISTORY
  ========================= */

  const { data: historyData, isLoading: historyLoading } =
    useQuery({
      queryKey: ["attendance-history", user?.id, month, year, page],
      queryFn: async () => {
        const res = await apiRequest(
          "GET",
          `/api/attendance/history?page=${page}&month=${month}&year=${year}`
        );
        return res.json();
      },
      enabled: !!user,
      placeholderData: (prev) => prev,
    });

  /* =========================
     CORRECTION FORM
  ========================= */

  const correctionForm = useForm({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      reason: "",
      requestedClockIn: "",
      requestedClockOut: "",
    },
  });

  const openCorrectionForRecord = (record: any) => {
    setSelectedRecord(record);

    const formattedDate = format(new Date(record.date), "yyyy-MM-dd");

    setDateBounds({
      min: `${formattedDate}T00:00`,
      max: `${formattedDate}T23:59`,
    });

    correctionForm.reset({
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
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST",
        "/api/attendance/correction",
        {
          date: selectedRecord.date,
          reason: data.reason,
          requestedClockIn: data.requestedClockIn
            ? new Date(data.requestedClockIn).toISOString()
            : null,
          requestedClockOut: data.requestedClockOut
            ? new Date(data.requestedClockOut).toISOString()
            : null,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Correction submitted successfully" });
      setCorrectionOpen(false);
      correctionForm.reset();
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: () => {
      toast({
        title: "Correction failed",
        variant: "destructive",
      });
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [thisYear, thisYear - 1, thisYear - 2];

  /* =========================
     UI
  ========================= */

  return (
    <div className="p-6 space-y-6">

      {/* FILTER BAR */}
      <div className="flex gap-4">
        <select
          value={month}
          onChange={(e) => {
            setMonth(Number(e.target.value));
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {format(new Date(2000, m - 1), "MMMM")}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* SUMMARY */}
      <Card>
        <CardHeader>
          <CardTitle>
            {format(new Date(year, month - 1), "MMMM yyyy")} Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-xl">
                <p>Working Days</p>
                <p className="text-2xl font-bold">
                  {summaryData?.workingDays ?? 0}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-xl">
                <p>Present</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryData?.presentDays ?? 0}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-xl">
                <p>On Leave</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {summaryData?.leaveDays ?? 0}
                </p>
              </div>

              <div className="p-4 bg-red-50 rounded-xl">
                <p>Absent</p>
                <p className="text-2xl font-bold text-red-600">
                  {summaryData?.absentDays ?? 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTORY */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-48" />
          ) : historyData?.records?.length ? (
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
                        <Badge>
                          {record.correctionStatus ?? record.status}
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

              <div className="flex justify-between mt-4">
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
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              No attendance records found
            </div>
          )}
        </CardContent>
      </Card>

      {/* CORRECTION DIALOG */}
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
                name="requestedClockIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requested Clock In</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        min={dateBounds?.min}
                        max={dateBounds?.max}
                        {...field}
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
                    <FormLabel>Requested Clock Out</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        min={dateBounds?.min}
                        max={dateBounds?.max}
                        {...field}
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

              <Button
                type="submit"
                className="w-full"
                disabled={correctionMutation.isPending}
              >
                {correctionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Correction
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

