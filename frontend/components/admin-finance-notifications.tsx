"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CreditCard, Loader2, RefreshCw, Search } from "lucide-react";
import {
  AdminNotification,
  AdminPayment,
  getAdminNotifications,
  getAdminPayments,
} from "@/services/api";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatNepalDateTime } from "@/lib/date-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNPR } from "@/lib/catalog";
import { AdminPaymentStatusDialog } from "@/components/admin-payment-status-dialog";

const token = () =>
  typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");

export function AdminPaymentsPage({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getAdminPayments(
      token(),
      {
        search: search || undefined,
        status: status || undefined,
        method: method || undefined,
      },
      superAdmin,
    )
      .then((response) => setRows(response.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [method, search, status, superAdmin]);
  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <AdminShell superAdmin={superAdmin}>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
        Finance
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
        Payment ledger
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Review payment method, amount and backend-recorded status from real
        orders.
      </p>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-[#DC143C]" />
            Transactions{" "}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Refresh payment ledger"
              title="Refresh"
              onClick={load}
            >
              <RefreshCw size={16} />
            </Button>
          </CardTitle>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                aria-label="Search payments"
                className="pl-9"
                placeholder="Order or customer"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              aria-label="Payment status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </Select>
            <Select
              aria-label="Payment method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="">All methods</option>
              <option value="CASH_ON_DELIVERY">Cash on delivery</option>
              <option value="ONLINE">Online</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading payments…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold">
                        {row.orderNumber}
                      </TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{row.method.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "FAILED" || row.status === "REFUNDED"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {row.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatNPR(row.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatNepalDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AdminPaymentStatusDialog
                          row={row}
                          superAdmin={superAdmin}
                          onSaved={(updated) =>
                            setRows((current) =>
                              current.map((item) =>
                                item.id === updated.id ? updated : item,
                              ),
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rows.length && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No payments match these filters.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

export function AdminNotificationsPage({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getAdminNotifications(
      token(),
      { search: search || undefined, unread: unread || undefined },
      superAdmin,
    )
      .then((response) => setRows(response.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, superAdmin, unread]);
  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
        Operations
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
        Notification center
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Audit order, prescription and delivery notifications generated by the
        application.
      </p>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={18} className="text-[#DC143C]" />
            Notification history{" "}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Refresh notifications"
              title="Refresh"
              onClick={load}
            >
              <RefreshCw size={16} />
            </Button>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                aria-label="Search notifications"
                className="pl-9"
                placeholder="Title, message or type"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant={unread ? "default" : "outline"}
              onClick={() => setUnread((value) => !value)}
            >
              {unread ? "Unread only" : "All notifications"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading notifications…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold">
                        {row.recipient}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.type.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{row.title}</p>
                        <p className="max-w-xl text-xs text-slate-500">
                          {row.body}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isRead ? "secondary" : "default"}>
                          {row.isRead ? "Read" : "Unread"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatNepalDateTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rows.length && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No notifications match these filters.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
