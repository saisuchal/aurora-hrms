import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PayslipsPage() {
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: payslipData, isLoading } = useQuery<any>({
    queryKey: [`/api/payslips?page=${page}`],
  });

  const downloadPayslip = async (payslipId: number) => {
    try {
      const res = await fetch(`/api/payslips/${payslipId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download payslip");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${payslipId}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payslips</h1>
        <p className="text-muted-foreground">View and download your monthly payslips</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Payslips
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : payslipData?.records?.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Working Days</TableHead>
                    <TableHead>Days Present</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Payable</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslipData.records.map((payslip: any) => (
                    <TableRow key={payslip.id} data-testid={`row-payslip-${payslip.id}`}>
                      <TableCell className="font-medium">
                        {monthNames[payslip.month]} {payslip.year}
                      </TableCell>
                      <TableCell>{payslip.workingDays}</TableCell>
                      <TableCell>{payslip.daysPresent}</TableCell>
                      <TableCell>${payslip.monthlySalary?.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">
                        ${payslip.payableAmount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadPayslip(payslip.payslipId || payslip.id)}
                          data-testid={`button-download-${payslip.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Page {page} of {payslipData.totalPages || 1}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= (payslipData.totalPages || 1)} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No payslips available yet</p>
              <p className="text-xs">Payslips will appear here once payroll is processed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
