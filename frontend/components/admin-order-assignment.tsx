"use client";

/* eslint-disable react-hooks/set-state-in-effect -- synchronize the assignment form with the selected order. */

import { FormEvent, useEffect, useState } from "react";
import { Download, Loader2, MapPin, Save, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatNepalDateTime } from "@/lib/date-time";
import {
  AdminBranch,
  AdminOrderDetail,
  downloadAdminInvoice,
  getAdminBranches,
  getAdminStaff,
  getNearbyDeliveryRiders,
  NearbyDeliveryRider,
  Staff,
  updateAdminOrderAssignment,
} from "@/services/api";

export function AdminOrderAssignment({ order, onSaved, superAdmin = true, assignmentOnly = false }: {
  order: AdminOrderDetail;
  onSaved: (order: AdminOrderDetail) => void;
  superAdmin?: boolean;
  assignmentOnly?: boolean;
}) {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branchId, setBranchId] = useState(order.branchId ?? "");
  const [pharmacistId, setPharmacistId] = useState(order.pharmacistId ?? "");
  const [deliveryStaffId, setDeliveryStaffId] = useState(order.deliveryStaffId ?? "");
  const [supervisorId, setSupervisorId] = useState(order.supervisorId ?? "");
  const [assignedStaffUserId, setAssignedStaffUserId] = useState(order.assignedStaffUserId ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [nearbyRiders, setNearbyRiders] = useState<NearbyDeliveryRider[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyMessage, setNearbyMessage] = useState("");

  useEffect(() => {
    setBranchId(order.branchId ?? "");
    setPharmacistId(order.pharmacistId ?? "");
    setDeliveryStaffId(order.deliveryStaffId ?? "");
    setSupervisorId(order.supervisorId ?? "");
    setAssignedStaffUserId(order.assignedStaffUserId ?? "");
    if (assignmentOnly) {
      setLoading(false);
      return;
    }
    const token = window.localStorage.getItem("anhh-staff-access-token") ?? "";
    let cancelled = false;
    Promise.all([
      getAdminBranches(token, superAdmin, true),
      getAdminStaff(token, true, superAdmin),
    ]).then(([loadedBranches, loadedStaff]) => {
      if (cancelled) return;
      setBranches(loadedBranches);
      setStaff(loadedStaff);
    }).catch((caught: Error) => {
      if (!cancelled) setError(caught.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [order.id, order.branchId, order.deliveryStaffId, order.pharmacistId, order.supervisorId, order.assignedStaffUserId, superAdmin, assignmentOnly]);

  useEffect(() => {
    let cancelled = false;
    setNearbyRiders([]);
    setNearbyError("");
    setNearbyMessage("");
    if (loading) return () => { cancelled = true; };
    if (!order.branchId) {
      setNearbyMessage("Assign a pickup branch before requesting rider suggestions.");
      return () => { cancelled = true; };
    }
    if (branchId !== order.branchId) {
      setNearbyMessage("Save the branch change before requesting distance-based suggestions.");
      return () => { cancelled = true; };
    }
    if (assignmentOnly) {
      setNearbyLoading(true);
      getNearbyDeliveryRiders(order.id, window.localStorage.getItem("anhh-staff-access-token") ?? "", superAdmin)
        .then(rows => { if (!cancelled) setNearbyRiders(rows); })
        .catch((caught: Error) => { if (!cancelled) setNearbyError(caught.message); })
        .finally(() => { if (!cancelled) setNearbyLoading(false); });
      return () => { cancelled = true; };
    }
    const branch = branches.find(item => item.id === order.branchId);
    if (!branch) {
      setNearbyMessage("The assigned branch could not be loaded.");
      return () => { cancelled = true; };
    }
    if (branch.latitude == null || branch.longitude == null) {
      setNearbyMessage("Configure the real pickup coordinates in branch settings to see nearby riders.");
      return () => { cancelled = true; };
    }
    setNearbyLoading(true);
    getNearbyDeliveryRiders(order.id, window.localStorage.getItem("anhh-staff-access-token") ?? "", superAdmin)
      .then(rows => { if (!cancelled) setNearbyRiders(rows); })
      .catch((caught: Error) => { if (!cancelled) setNearbyError(caught.message); })
      .finally(() => { if (!cancelled) setNearbyLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentOnly, branches, branchId, loading, order.branchId, order.id, superAdmin]);

  async function saveAssignment() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminOrderAssignment(order.id, {
        branchId: branchId || undefined,
        pharmacistId: pharmacistId || undefined,
        deliveryStaffId: deliveryStaffId || undefined,
        supervisorId: supervisorId || undefined,
        assignedStaffUserId: assignedStaffUserId || undefined,
        note: note.trim() || undefined,
      }, window.localStorage.getItem("anhh-staff-access-token") ?? "", superAdmin);
      onSaved(updated);
      setNote("");
      toast.success("Order assignment saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assignment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await saveAssignment();
  }

  async function downloadInvoice() {
    setDownloading(true);
    setError("");
    try {
      await downloadAdminInvoice(order.id, window.localStorage.getItem("anhh-staff-access-token") ?? "", superAdmin);
      toast.success(order.invoiceNumber ? "Invoice downloaded" : "Invoice generated and downloaded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  const pharmacists = staff.filter(item => item.role === "PHARMACIST" && item.isActive);
  const deliveryStaff = staff.filter(item => item.role === "DELIVERY" && item.isActive);
  const supervisors = staff.filter(item => item.role === "SUPERVISOR" && item.isActive);
  const otherAssignees = staff.filter(item => ["ADMIN", "SUPERVISOR", "ACCOUNTANT", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER"].includes(item.role) && item.isActive);
  const selectedNearbyRider = nearbyRiders.some(rider => rider.riderId === deliveryStaffId);

  if (assignmentOnly) return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-start gap-3">
      <MapPin className="mt-0.5 text-teal-700" size={18} />
      <div><h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Assign a nearby rider</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Eligible riders are ranked by distance from this order’s configured pickup branch. Assignment remains a manual action.</p></div>
    </div>
    {nearbyMessage && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{nearbyMessage}</p>}
    {nearbyLoading && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={14} />Finding eligible riders…</p>}
    {nearbyError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{nearbyError}</p>}
    {!nearbyLoading && !nearbyError && !nearbyMessage && nearbyRiders.length === 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No available riders with a recent location were found.</p>}
    {nearbyRiders.length > 0 && <ol className="mt-3 grid gap-2">{nearbyRiders.map((rider, index) => <li key={rider.riderId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{index + 1}. {rider.riderName} · {formatDistance(rider.distanceMeters)}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Location updated {formatNepalDateTime(rider.lastUpdatedAt)}</p></div>
      <Button type="button" variant="outline" size="sm" aria-pressed={deliveryStaffId === rider.riderId} onClick={() => setDeliveryStaffId(rider.riderId)}>{deliveryStaffId === rider.riderId ? "Selected" : "Select"}</Button>
    </li>)}</ol>}
    {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
    <Button type="button" disabled={saving || !selectedNearbyRider} onClick={() => void saveAssignment()} className="mt-4 min-h-11">
      {saving ? <Loader2 className="animate-spin" /> : <Save />}Assign rider
    </Button>
  </section>;

  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100"><UsersRound size={16} className="text-[#003893]" />Operational assignment</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use existing live staff records to assign this order. Rider suggestions are distance-ranked and never auto-assigned.</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void downloadInvoice()} disabled={downloading}>
        {downloading ? <Loader2 className="animate-spin" /> : <Download />} {order.invoiceNumber ? "Download invoice" : "Generate invoice"}
      </Button>
    </div>
    {loading ? <div className="p-6 text-center text-xs text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={15} />Loading assignment options…</div> : <form onSubmit={save} className="mt-4 grid gap-3">
      <div className="grid gap-2"><Label htmlFor="order-branch">Branch</Label><Select id="order-branch" value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">Unassigned</option>{branches.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="order-pharmacist">Pharmacist</Label><Select id="order-pharmacist" value={pharmacistId} onChange={event => setPharmacistId(event.target.value)}><option value="">Unassigned</option>{pharmacists.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.branchName ? ` · ${item.branchName}` : ""}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="order-delivery-staff">Delivery rider</Label><Select id="order-delivery-staff" value={deliveryStaffId} onChange={event => setDeliveryStaffId(event.target.value)}><option value="">Unassigned</option>{deliveryStaff.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.branchName ? ` · ${item.branchName}` : ""}</option>)}</Select></div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100"><MapPin size={15} className="text-teal-700" />Nearest available riders</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Measured from the order’s configured branch pickup point. Select a suggestion, then save the assignment.</p>
        {nearbyMessage && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{nearbyMessage}</p>}
        {nearbyLoading && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={14} />Finding eligible riders…</p>}
        {nearbyError && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">{nearbyError}</p>}
        {!nearbyLoading && !nearbyError && !nearbyMessage && nearbyRiders.length === 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No available riders with a recent location were found for this pickup.</p>}
        {nearbyRiders.length > 0 && <ol className="mt-3 grid gap-2">{nearbyRiders.map((rider, index) => <li key={rider.riderId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{index + 1}. {rider.riderName} <span className="font-semibold text-slate-500 dark:text-slate-400">· {formatDistance(rider.distanceMeters)}</span></p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Location updated {formatNepalDateTime(rider.lastUpdatedAt)}</p></div>
          <Button type="button" variant="outline" size="sm" aria-pressed={deliveryStaffId === rider.riderId} onClick={() => setDeliveryStaffId(rider.riderId)}>{deliveryStaffId === rider.riderId ? "Selected" : "Select rider"}</Button>
        </li>)}</ol>}
      </section>
      <div className="grid gap-2"><Label htmlFor="order-supervisor">Supervisor</Label><Select id="order-supervisor" value={supervisorId} onChange={event => setSupervisorId(event.target.value)}><option value="">Unassigned</option>{supervisors.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.branchName ? ` · ${item.branchName}` : ""}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="order-other-assignee">Other permitted operations user</Label><Select id="order-other-assignee" value={assignedStaffUserId} onChange={event => setAssignedStaffUserId(event.target.value)}><option value="">Unassigned</option>{otherAssignees.map(item => <option key={item.id} value={item.id}>{item.fullName} · {item.role.replaceAll("_", " ")}{item.branchName ? ` · ${item.branchName}` : ""}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="order-assignment-note">Internal note</Label><Input id="order-assignment-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Optional handoff note" /></div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save assignment</Button>
    </form>}
  </section>;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
