"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Eye, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AdminOrder,
  AdminOrderDetail,
  AdminPrescription,
  getAdminOrder,
  getAdminOrders,
  getAdminPrescriptions,
  Staff,
  updateAdminOrderStatus,
} from "@/services/api";
import { AdminOrderAssignment } from "@/components/admin-order-assignment";
import { AdminShell } from "@/components/admin-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNepalDate, formatNepalDateTime } from "@/lib/date-time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNPR } from "@/lib/catalog";

const nextStatuses: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  PRESCRIPTION_VERIFICATION: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["ASSIGNED_FOR_DELIVERY"],
  ASSIGNED_FOR_DELIVERY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["FAILED", "DELIVERED"],
};

function canManageOrderAssignments(superAdmin: boolean) {
  if (superAdmin || typeof window === "undefined") return superAdmin;
  try {
    const raw = window.localStorage.getItem("anhh-staff");
    const staff = raw ? JSON.parse(raw) as Staff : null;
    if (!staff) return false;
    const role = staff.role.toUpperCase();
    if (role === "SUPERADMIN") return true;
    if (role === "ADMIN") return !staff.permissions || staff.permissions.includes("orders.manage");
    return role === "SUPERVISOR" && Boolean(staff.permissions?.includes("orders.manage"));
  } catch {
    return false;
  }
}

export function AdminOrdersPage({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const canManageAssignment = canManageOrderAssignments(superAdmin);
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pendingCancel, setPendingCancel] = useState<AdminOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = window.localStorage.getItem("anhh-staff-access-token");
      if (token) {
        setLoading(true);
        getAdminOrders(
          token,
          { search: search || undefined, status: status || undefined },
          superAdmin,
        )
          .then((x) => setRows(x.items))
          .catch((e: Error) => setError(e.message))
          .finally(() => setLoading(false));
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, status, superAdmin]);
  async function change(row: AdminOrder, status: string) {
    if (status === "CANCELLED") {
      setPendingCancel(row);
      return;
    }
    await saveStatus(row, status);
  }
  async function saveStatus(row: AdminOrder, status: string) {
    setBusy(row.id);
    setError("");
    try {
      const updated = await updateAdminOrderStatus(
        row.id,
        status,
        "Updated from SuperAdmin order control.",
        window.localStorage.getItem("anhh-staff-access-token") ?? "",
        superAdmin,
      );
      setRows((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setPendingCancel(null);
      toast.success(
        `${row.orderNumber} moved to ${status.replaceAll("_", " ")}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Order status could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }
  async function viewOrder(row: AdminOrder) {
    setDetailLoading(true);
    setDetailError("");
    try {
      setSelectedOrder(
        await getAdminOrder(
          row.id,
          window.localStorage.getItem("anhh-staff-access-token") ?? "",
          superAdmin,
        ),
      );
    } catch (e) {
      setDetailError(
        e instanceof Error ? e.message : "Order details could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }
  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <h1 className="text-3xl font-extrabold tracking-tight">Orders</h1>
      <p className="mt-2 text-sm text-slate-500">
        Operational order oversight with controlled transitions, customer
        notifications, and stock release on cancellation.
      </p>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[#DC143C]" />
            All orders
          </CardTitle>
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                aria-label="Search orders"
                className="pl-9"
                placeholder="Order number or customer"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              aria-label="Filter orders by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {Object.keys(nextStatuses)
                .concat("DELIVERED", "CANCELLED", "REJECTED", "FAILED")
                .filter(
                  (value, index, values) => values.indexOf(value) === index,
                )
                .map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Move to</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold">
                        {row.orderNumber}
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">{row.orderMode === "BULK" ? "Bulk order" : "Single order"}</div>
                      </TableCell>
                      <TableCell>
                        {row.customerName}
                        <div className="text-xs text-slate-400">
                          {row.customerPhone}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {row.branch ?? "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "CANCELLED"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {row.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.paymentStatus}</TableCell>
                      <TableCell className="font-bold">
                        {formatNPR(row.total)}
                      </TableCell>
                      <TableCell>{formatNepalDate(row.createdAt)}</TableCell>
                      <TableCell>
                        {!supervisor && nextStatuses[row.status]?.length ? (
                          <Select
                            aria-label={`Change status for ${row.orderNumber}`}
                            value=""
                            disabled={busy === row.id}
                            onChange={(event) =>
                              void change(row, event.target.value)
                            }
                          >
                            <option value="">Select</option>
                            {nextStatuses[row.status].map((status) => (
                              <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No next step
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`View ${row.orderNumber}`}
                          title={`View ${row.orderNumber}`}
                          onClick={() => void viewOrder(row)}
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rows.length && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No orders found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={!!pendingCancel}
        onOpenChange={(open) => !open && setPendingCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {pendingCancel?.orderNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This releases its reserved inventory, records the transition in
              the audit trail, and notifies the customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingCancel && void saveStatus(pendingCancel, "CANCELLED")
              }
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!selectedOrder || detailLoading}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailLoading
                ? "Loading order…"
                : (selectedOrder?.orderNumber ?? "Order details")}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder
                ? `${selectedOrder.customerName} · ${selectedOrder.customerPhone}`
                : "Full operational order context"}
            </DialogDescription>
          </DialogHeader>
          {detailError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {detailError}
            </p>
          ) : detailLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="animate-spin text-[#DC143C]" />
            </div>
          ) : (
            selectedOrder && (
              <>
                <OrderDetailContent order={selectedOrder} />
                <span className="border-t border-slate-200 pt-5">
                  {canManageAssignment && (
                    <AdminOrderAssignment
                      order={selectedOrder}
                      onSaved={setSelectedOrder}
                      superAdmin={superAdmin}
                      assignmentOnly={!superAdmin}
                    />
                  )}
                </span>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

export function AdminPrescriptionsPage({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [rows, setRows] = useState<AdminPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = window.localStorage.getItem("anhh-staff-access-token");
      if (token)
        getAdminPrescriptions(token, superAdmin)
          .then((x) => setRows(x.items))
          .catch((e: Error) => setError(e.message))
          .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [superAdmin]);
  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <h1 className="text-3xl font-extrabold tracking-tight">
        Prescription oversight
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Review status and audit context without bypassing pharmacist decisions.
      </p>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} className="text-[#DC143C]" />
            Prescription queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading…
            </div>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prescription</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>OCR confidence</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold">
                        {row.prescriptionNumber}
                      </TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>
                        <Badge>{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.itemCount}</TableCell>
                      <TableCell>{row.ocrConfidence.toFixed(0)}%</TableCell>
                      <TableCell>{formatNepalDate(row.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rows.length && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No prescriptions found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function OrderDetailContent({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info
          title="Customer"
          value={`${order.customerName}\n${order.customerEmail}\n${order.customerPhone}`}
        />
        <Info
          title="Payment"
          value={`${order.paymentMethod} · ${order.paymentStatus}`}
        />
        <Info title="Status" value={order.status.replaceAll("_", " ")} />
        <Info title="Order type" value={order.orderMode === "BULK" ? "Bulk order" : "Single order"} />
        <Info title="Total" value={formatNPR(order.total)} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">Items</h3>
        <div className="mt-2 divide-y rounded-xl border border-slate-200">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span>
                {item.productName}
                <small className="block text-xs text-slate-400">
                  {item.sku || "No SKU"} · qty {item.quantity}
                </small>
              </span>
              <b>{formatNPR(item.unitPrice * item.quantity)}</b>
            </div>
          ))}
        </div>
      </div>
      {order.address && (
        <Info
          title="Delivery address"
          value={`${order.address.label}\n${order.address.streetTole}, ${order.address.municipality}\n${order.address.district}, ${order.address.province} · Ward ${order.address.ward}`}
        />
      )}
      {order.customerNotes && <Info title="Customer notes" value={order.customerNotes} />}
      {order.discountAmount > 0 && (
        <Info
          title="Discount"
          value={`${order.couponCode ?? "Coupon"} · -${formatNPR(order.discountAmount)}`}
        />
      )}
      {order.prescription && (
        <Info
          title="Prescription"
          value={`${order.prescription.status}\n${order.prescription.notes ?? "No notes"}`}
        />
      )}
      {order.delivery && (
        <Info
          title="Delivery"
          value={`${order.delivery.deliveryStaff || "Unassigned"} · ${order.delivery.status}`}
        />
      )}
      {order.timeline.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-900">Timeline</h3>
          <div className="mt-2 grid gap-2">
            {order.timeline.map((item) => (
              <div
                key={`${item.status}-${item.createdAt}`}
                className="flex gap-3 rounded-lg bg-slate-50 p-3 text-xs"
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#DC143C]" />
                <span>
                  <b className="block text-slate-800">
                    {item.status.replaceAll("_", " ")}
                  </b>
                  <span className="text-slate-500">
                    {formatNepalDateTime(item.createdAt)}
                    {item.note ? ` · ${item.note}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
