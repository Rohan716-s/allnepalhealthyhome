"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Search, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  AdminCustomer,
  AdminCustomerDetail,
  getAdminCustomer,
  getAdminCustomers,
} from "@/services/api";
import { setAdminEntityStatus } from "@/services/api";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { formatNepalDate } from "@/lib/date-time";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNPR } from "@/lib/catalog";

const date = (value: string) => formatNepalDate(value);

function stateVariant(value: string) {
  const normalized = value.toLowerCase();
  if (
    ["delivered", "approved", "completed", "resolved", "active"].some((item) =>
      normalized.includes(item),
    )
  )
    return "default" as const;
  if (
    ["cancelled", "rejected", "closed", "inactive"].some((item) =>
      normalized.includes(item),
    )
  )
    return "destructive" as const;
  return "secondary" as const;
}

function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        <Badge variant="outline">{count}</Badge>
      </div>
      {children}
    </section>
  );
}

function CustomerDetail({ detail }: { detail: AdminCustomerDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Contact
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {detail.email}
          </p>
          <p className="text-xs text-slate-500">{detail.phone}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Account status
          </p>
          <div className="mt-2">
            <ActiveStatusToggle
              checked={detail.isActive}
              onChange={() => undefined}
              disabled
              label={`customer ${detail.fullName}`}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Joined
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {date(detail.createdAt)}
          </p>
        </div>
      </div>

      <DetailSection title="Saved addresses" count={detail.addresses.length}>
        {detail.addresses.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {detail.addresses.map((address) => (
              <div
                className="rounded-xl border border-slate-200 bg-white p-3 text-xs"
                key={address.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-slate-900">
                    {address.label}
                  </p>
                  {address.isDefault && <Badge>Default</Badge>}
                </div>
                <p className="mt-1 text-slate-600">
                  {address.streetTole}, Ward {address.ward},{" "}
                  {address.municipality}, {address.district}, {address.province}
                </p>
                {address.landmark && (
                  <p className="mt-1 text-slate-400">
                    Landmark: {address.landmark}
                  </p>
                )}
                <p className="mt-1 text-slate-500">Phone: {address.phone}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No saved addresses.</p>
        )}
      </DetailSection>

      <DetailSection title="Order history" count={detail.orders.length}>
        {detail.orders.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <p className="font-bold">{order.orderNumber}</p>
                    <p className="text-[11px] text-slate-400">
                      {date(order.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {order.paymentStatus}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {order.branchName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatNPR(order.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-slate-500">No orders found.</p>
        )}
      </DetailSection>

      <DetailSection title="Prescriptions" count={detail.prescriptions.length}>
        {detail.prescriptions.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.prescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="max-w-[240px] truncate font-bold">
                    {prescription.originalFileName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(prescription.status)}>
                      {prescription.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{prescription.itemCount}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {date(prescription.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-slate-500">No prescriptions found.</p>
        )}
      </DetailSection>

      <DetailSection title="Product reviews" count={detail.reviews.length}>
        {detail.reviews.length ? (
          <div className="space-y-3">
            {detail.reviews.map((review) => (
              <div
                className="rounded-xl border border-slate-200 bg-white p-3"
                key={review.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-slate-900">
                    {review.productName}
                  </p>
                  <div
                    className="flex items-center gap-1 text-amber-500"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={13}
                        className={
                          index < review.rating
                            ? "fill-current"
                            : "text-slate-200"
                        }
                      />
                    ))}
                  </div>
                </div>
                {review.title && (
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    {review.title}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-600">{review.comment}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={stateVariant(review.status)}>
                    {review.status}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {date(review.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No reviews found.</p>
        )}
      </DetailSection>

      <DetailSection
        title="Support tickets"
        count={detail.supportTickets.length}
      >
        {detail.supportTickets.length ? (
          <div className="space-y-3">
            {detail.supportTickets.map((ticket) => (
              <div
                className="rounded-xl border border-slate-200 bg-white p-3"
                key={ticket.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-slate-900">
                    {ticket.ticketNumber} · {ticket.subject}
                  </p>
                  <Badge variant={stateVariant(ticket.status)}>
                    {ticket.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {ticket.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span>{ticket.priority}</span>
                  <span>•</span>
                  <span>{ticket.category ?? "General"}</span>
                  <span>•</span>
                  <span>{date(ticket.createdAt)}</span>
                  {ticket.assignedStaff && (
                    <>
                      <span>•</span>
                      <span>Assigned to {ticket.assignedStaff}</span>
                    </>
                  )}
                </div>
                {ticket.resolution && (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
                    Resolution: {ticket.resolution}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No support tickets found.</p>
        )}
      </DetailSection>
    </div>
  );
}

export function AdminCustomerManagementPage({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const token = () =>
    window.localStorage.getItem("anhh-staff-access-token") ?? "";
  const load = useCallback(
    (term: string) => {
      setLoading(true);
      setError("");
      getAdminCustomers(token(), term, superAdmin)
        .then((response) => setRows(response.items))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [superAdmin],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function toggle(row: AdminCustomer, isActive: boolean) {
    try {
      await setAdminEntityStatus(
        "customer",
        row.id,
        isActive,
        token(),
        superAdmin,
      );
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, isActive } : item,
        ),
      );
      toast.success(
        `${row.fullName} is now ${isActive ? "active" : "inactive"}`,
      );
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Customer status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }
  async function openDetails(row: AdminCustomer) {
    setSelected(row);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await getAdminCustomer(row.id, token(), superAdmin));
    } catch (e) {
      setDetailError(
        e instanceof Error
          ? e.message
          : "Customer details could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }
  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
          Users
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Customers
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Search real customer accounts and control access without deleting
          order history.
        </p>
      </div>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound size={18} className="text-[#DC143C]" />
            Customer directory
          </CardTitle>
          <CardDescription>
            Open a customer to review their profile, orders, addresses,
            prescriptions, reviews and support history.
          </CardDescription>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              load(search);
            }}
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                aria-label="Search customers"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email or phone"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
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
              Loading customers…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Prescriptions</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-extrabold">
                        {row.fullName}
                      </TableCell>
                      <TableCell>
                        {row.email}
                        <div className="text-xs text-slate-400">
                          {row.phone}
                        </div>
                      </TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>{row.prescriptions}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {date(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ActiveStatusToggle
                          checked={row.isActive}
                          onChange={(isActive) => toggle(row, isActive)}
                          label={`customer ${row.fullName}`}
                          confirmOnDeactivate
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View ${row.fullName}`}
                          title="View customer details"
                          onClick={() => openDetails(row)}
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
                  No customers match this search.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setDetail(null);
            setDetailError("");
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.fullName ?? "Customer details"}
            </DialogTitle>
            <DialogDescription>
              Account activity and customer-owned records.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading customer details…
            </div>
          ) : detailError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {detailError}
            </p>
          ) : detail ? (
            <CustomerDetail detail={detail} />
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
