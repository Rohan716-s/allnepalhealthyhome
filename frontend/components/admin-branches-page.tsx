"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Edit3, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAdminBranch,
  getAdminBranches,
  setAdminEntityStatus,
  updateAdminBranch,
  type AdminBranch,
} from "@/services/api";

type BranchForm = {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  streetTole: string;
  landmark: string;
  latitude: string;
  longitude: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  isActive: boolean;
};
const blank: BranchForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  province: "Bagmati",
  district: "Kathmandu",
  municipality: "",
  ward: "",
  streetTole: "",
  landmark: "",
  latitude: "",
  longitude: "",
  deliveryEnabled: true,
  pickupEnabled: true,
  isActive: true,
};
const token = () =>
  typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");

export function AdminBranchesPage({
  view = "list",
  branchId,
  superAdmin = true,
}: {
  view?: "list" | "form";
  branchId?: string;
  superAdmin?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(branchId);
  const listPath = `${superAdmin ? "/superadmin" : "/admin"}/branches`;
  const [rows, setRows] = useState<AdminBranch[]>([]);
  const [form, setForm] = useState<BranchForm>(blank);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminBranch | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await getAdminBranches(token(), superAdmin);
      setRows(loaded);
      if (branchId) {
        const branch = loaded.find((row) => row.id === branchId);
        if (!branch) throw new Error("Branch could not be found.");
        setForm({
          name: branch.name,
          code: branch.code ?? "",
          address: branch.address,
          phone: branch.phone ?? "",
          email: branch.email ?? "",
          province: branch.province ?? "",
          district: branch.district ?? "",
          municipality: branch.municipality ?? "",
          ward: branch.ward ?? "",
          streetTole: branch.streetTole ?? "",
          landmark: branch.landmark ?? "",
          latitude: branch.latitude?.toString() ?? "",
          longitude: branch.longitude?.toString() ?? "",
          deliveryEnabled: branch.deliveryEnabled,
          pickupEnabled: branch.pickupEnabled,
          isActive: branch.isActive,
        });
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Branches could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, superAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function field(key: keyof BranchForm, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function persist(saveAndAnother = false) {
    setError("");
    if (!form.name.trim() || !form.address.trim()) {
      setError("Branch name and address are required.");
      return;
    }
    if (Boolean(form.latitude) !== Boolean(form.longitude)) {
      setError("Enter both latitude and longitude to configure the branch location.");
      return;
    }
    if ((form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) || (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180))) {
      setError("Enter valid coordinates: latitude -90 to 90 and longitude -180 to 180.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        code: form.code || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        province: form.province || undefined,
        district: form.district || undefined,
        municipality: form.municipality || undefined,
        ward: form.ward || undefined,
        streetTole: form.streetTole || undefined,
        landmark: form.landmark || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      };
      const saved = editing
        ? await updateAdminBranch(branchId!, input, token(), superAdmin)
        : await createAdminBranch(input, token(), superAdmin);
      toast.success(
        editing
          ? `${saved.name} updated successfully.`
          : `${saved.name} created successfully.`,
      );
      setRows((current) =>
        editing
          ? current.map((row) => (row.id === saved.id ? saved : row))
          : [saved, ...current],
      );
      if (!saveAndAnother) router.push(listPath);
      else {
        setForm(blank);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Branch could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: AdminBranch, isActive: boolean) {
    try {
      await setAdminEntityStatus(
        "branch",
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
      toast.success(`${row.name} is now ${isActive ? "active" : "inactive"}`);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Branch status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }

  async function removeBranch() {
    if (!deleteTarget) return;
    try {
      await setAdminEntityStatus("branch", deleteTarget.id, false, token(), superAdmin);
      setRows((current) => current.map((row) => row.id === deleteTarget.id ? { ...row, isActive: false } : row));
      toast.success("Branch deactivated.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Branch could not be removed.";
      setError(message); toast.error(message);
    } finally { setDeleteTarget(null); }
  }

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!search ||
            `${row.name} ${row.code ?? ""} ${row.district ?? ""} ${row.municipality ?? ""}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (status === "all" || row.isActive === (status === "active")),
      ),
    [rows, search, status],
  );
  return (
    <AdminShell superAdmin={superAdmin}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
            Branches
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {view === "form"
              ? editing
                ? "Edit branch"
                : "Create branch"
              : "Branches and fulfilment"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage the locations used by inventory, staff assignment, pickup,
            and delivery operations.
          </p>
        </div>
        {view === "list" && (
          <Button
            type="button"
            onClick={() => router.push(`${listPath}/create`)}
          >
            <Plus size={16} />
            Add branch
          </Button>
        )}
      </div>
      {view === "form" ? (
        <Card className="mt-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={18} className="text-[#003893]" />
              {editing ? "Branch details" : "New branch"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 animate-spin" size={18} />
                Loading branch…
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void persist();
                }}
                className="grid gap-5 md:grid-cols-2"
              >
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="branch-name">Branch name</Label>
                  <Input
                    id="branch-name"
                    required
                    value={form.name}
                    onChange={(event) => field("name", event.target.value)}
                    placeholder="Pokhara health centre"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-code">Code</Label>
                  <Input
                    id="branch-code"
                    value={form.code}
                    onChange={(event) => field("code", event.target.value)}
                    placeholder="PKR-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-phone">Phone</Label>
                  <Input
                    id="branch-phone"
                    value={form.phone}
                    onChange={(event) => field("phone", event.target.value)}
                    placeholder="061-..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-email">Email</Label>
                  <Input
                    id="branch-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => field("email", event.target.value)}
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="branch-address">Address</Label>
                  <Input
                    id="branch-address"
                    required
                    value={form.address}
                    onChange={(event) => field("address", event.target.value)}
                    placeholder="Street and landmark"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-province">Province</Label>
                  <Input
                    id="branch-province"
                    value={form.province}
                    onChange={(event) => field("province", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-district">District</Label>
                  <Input
                    id="branch-district"
                    value={form.district}
                    onChange={(event) => field("district", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-municipality">Municipality</Label>
                  <Input
                    id="branch-municipality"
                    value={form.municipality}
                    onChange={(event) =>
                      field("municipality", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-ward">Ward</Label>
                  <Input
                    id="branch-ward"
                    value={form.ward}
                    onChange={(event) => field("ward", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-street">Street / tole</Label>
                  <Input
                    id="branch-street"
                    value={form.streetTole}
                    onChange={(event) =>
                      field("streetTole", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch-landmark">Landmark</Label>
                  <Input
                    id="branch-landmark"
                    value={form.landmark}
                    onChange={(event) => field("landmark", event.target.value)}
                  />
                </div>
                <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 md:col-span-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-extrabold text-blue-950">Branch pickup and attendance location</p>
                    <p className="mt-1 text-xs leading-5 text-blue-800">Enter the real pharmacy coordinates to enable staff location verification and distance-based rider suggestions. Coordinates are never guessed; suggestions remain unavailable until a pickup location is configured.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="branch-latitude">Latitude</Label>
                    <Input id="branch-latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => field("latitude", event.target.value)} placeholder="27.7091852" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="branch-longitude">Longitude</Label>
                    <Input id="branch-longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => field("longitude", event.target.value)} placeholder="85.3077905" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 text-sm font-semibold text-slate-700 md:col-span-2">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.deliveryEnabled}
                      onChange={(event) =>
                        field("deliveryEnabled", event.target.checked)
                      }
                    />
                    Delivery enabled
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.pickupEnabled}
                      onChange={(event) =>
                        field("pickupEnabled", event.target.checked)
                      }
                    />
                    Pickup enabled
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isActive}
                      onChange={(event) =>
                        field("isActive", event.target.checked)
                      }
                    />
                    Branch active
                  </label>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2"
                  >
                    {error}
                  </p>
                )}
                <div className="md:col-span-2">
                  <FormSaveActions
                    mode={editing ? "edit" : "create"}
                    busy={saving}
                    onCancel={() => router.push(listPath)}
                    onSaveAndAnother={() => void persist(true)}
                    saveLabel={editing ? "Save Changes" : "Save & List"}
                  />
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={18} className="text-[#003893]" />
                Branch directory
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Search branches"
                  placeholder="Search branch, code or location"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  aria-label="Filter branches by status"
                  className="w-[150px]"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  <Loader2 className="mr-2 inline animate-spin" size={18} />
                  Loading branches…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-extrabold">
                            {row.name}
                            <div className="text-xs font-normal text-slate-400">
                              {row.code ?? "No code"}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {row.latitude != null && row.longitude != null ? "Pickup point configured" : "Pickup coordinates needed"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.municipality ||
                              row.district ||
                              row.province ||
                              row.address}
                            <div className="text-xs text-slate-400">
                              {row.address}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.phone ?? "—"}
                            <br />
                            {row.email ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.deliveryEnabled ? "Delivery" : "—"} ·{" "}
                            {row.pickupEnabled ? "Pickup" : "—"}
                          </TableCell>
                          <TableCell>
                            <ActiveStatusToggle
                              checked={row.isActive}
                              onChange={(isActive) =>
                                toggleStatus(row, isActive)
                              }
                              label={`branch ${row.name}`}
                              confirmOnDeactivate
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${row.name}`}
                              title={`Edit ${row.name}`}
                              onClick={() =>
                                router.push(`${listPath}/${row.id}/edit`)
                              }
                            >
                              <Edit3 size={16} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${row.name}`}
                              title={`Delete ${row.name}`}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!visibleRows.length && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-sm text-slate-500"
                          >
                            No branches match these filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This preserves existing orders while removing the branch from active selectors and delivery choices.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => void removeBranch()}>Deactivate branch</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
