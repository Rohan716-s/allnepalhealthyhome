"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { AdminPrescriptionDetailDialog } from "@/components/admin-prescription-detail-dialog";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminPrescriptions, type AdminPrescription, type StaffPrescription } from "@/services/api";
import { formatPlatformDate } from "@/lib/date-time";

export function AdminPrescriptionQueue({ superAdmin = false }: { superAdmin?: boolean }) {
  const [rows, setRows] = useState<AdminPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = window.localStorage.getItem("anhh-staff-access-token");
      if (!token) {
        setLoading(false);
        setError("Secure staff access is required.");
        return;
      }
      getAdminPrescriptions(token, superAdmin)
        .then(response => setRows(response.items))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Prescription queue could not be loaded."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [superAdmin]);

  function handleUpdated(detail: StaffPrescription) {
    setRows(current => current.map(row => row.id === detail.id ? { ...row, status: detail.status } : row));
  }

  return <AdminShell superAdmin={superAdmin}>
    <h1 className="text-3xl font-extrabold tracking-tight">Prescription oversight</h1>
    <p className="mt-2 text-sm text-slate-500">Review status and audit context without bypassing pharmacist decisions.</p>
    <Card className="mt-7">
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18} className="text-[#DC143C]" />Prescription queue</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading…</div> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Prescription</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>OCR confidence</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map(row => <TableRow key={row.id}>
              <TableCell className="font-bold">{row.prescriptionNumber}</TableCell>
              <TableCell>{row.customerName}</TableCell>
              <TableCell><Badge>{row.status}</Badge></TableCell>
              <TableCell>{row.itemCount}</TableCell>
              <TableCell>{row.ocrConfidence.toFixed(0)}%</TableCell>
              <TableCell>{formatPlatformDate(row.createdAt)}</TableCell>
              <TableCell className="text-right"><AdminPrescriptionDetailDialog row={row} superAdmin={superAdmin} onUpdated={handleUpdated} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No prescriptions found.</p>}
        </div>}
      </CardContent>
    </Card>
  </AdminShell>;
}
