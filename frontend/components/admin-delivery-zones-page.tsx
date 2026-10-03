"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Loader2, MapPin, Plus, Trash2, Truck } from "lucide-react";
import {
  getDistricts,
  getLocalLevelTypeById,
  getLocalLevels,
  getProvinces,
} from "@itzsa/nepal-geo-data";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  createAdminDeliveryZone,
  getAdminBranches,
  getAdminDeliveryZones,
  setAdminEntityStatus,
  updateAdminDeliveryZone,
  type AdminBranch,
  type AdminDeliveryZone,
} from "@/services/api";

type ZoneForm = {
  name: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  branchId: string;
  deliveryFee: string;
  freeDeliveryThreshold: string;
  minimumOrder: string;
  sameDayDelivery: boolean;
  enabled: boolean;
};
const blank: ZoneForm = {
  name: "",
  province: "Bagmati",
  district: "Kathmandu",
  municipality: "",
  ward: "",
  branchId: "",
  deliveryFee: "0",
  freeDeliveryThreshold: "0",
  minimumOrder: "0",
  sameDayDelivery: false,
  enabled: true,
};
const token = () =>
  typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");

type LocationOption = {
  value: string;
  label: string;
  meta?: string;
  id?: number;
};

const provinceOptions: LocationOption[] = getProvinces().map((province) => ({
  value: province.nameEn.replace(/ Pradesh$/, ""),
  label: province.nameEn.replace(/ Pradesh$/, ""),
  meta: province.nameNe,
  id: province.id,
}));

function provinceIdFor(value: string) {
  return provinceOptions.find((item) => item.value === value)?.id;
}

function districtOptionsFor(province: string): LocationOption[] {
  const provinceId = provinceIdFor(province);
  return getDistricts(provinceId).map((district) => ({
    value: district.nameEn,
    label: district.nameEn,
    meta: district.nameNe,
    id: district.id,
  }));
}

function localOptionsFor(district: string): LocationOption[] {
  const districtOption = districtOptionsFor("").find(
    (item) => item.value === district,
  );
  const districtId =
    districtOption?.id ??
    getDistricts().find((item) => item.nameEn === district)?.id;
  return getLocalLevels(districtId).map((local) => {
    const type = getLocalLevelTypeById(local.typeId);
    return {
      value: local.nameEn,
      label: local.nameEn,
      meta: `${type?.nameEn ?? "Local level"} · ${type?.nameNe ?? "स्थानीय तह"}`,
      id: local.id,
    };
  });
}

function wardOptionsFor(municipality: string): LocationOption[] {
  const local = getLocalLevels().find((item) => item.nameEn === municipality);
  return local
    ? Array.from({ length: local.wardCount }, (_, index) => ({
        value: String(index + 1),
        label: `Ward ${index + 1}`,
        id: index + 1,
      }))
    : [];
}

function LocationCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: LocationOption[];
  placeholder: string;
  required?: boolean;
}) {
  const query = value;
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return options
      .filter(
        (option) =>
          !normalized ||
          `${option.label} ${option.meta ?? ""}`
            .toLocaleLowerCase()
            .includes(normalized),
      )
      .sort((a, b) => {
        if (!normalized) return a.label.localeCompare(b.label);
        return (
          Number(!a.label.toLocaleLowerCase().startsWith(normalized)) -
            Number(!b.label.toLocaleLowerCase().startsWith(normalized)) ||
          a.label.localeCompare(b.label)
        );
      })
      .slice(0, 100);
  }, [options, query]);
  return (
    <div className="relative">
      <Input
        id={id}
        required={required}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && options.length > 0 && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          role="listbox"
        >
          {filtered.length ? (
            filtered.map((option) => (
              <button
                type="button"
                key={`${option.id ?? option.value}-${option.value}`}
                className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#EAF1FF]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={option.value === value}
              >
                <span className="font-semibold text-slate-800">
                  {option.label}
                </span>
                {option.meta && (
                  <span className="text-right text-xs text-slate-500">
                    {option.meta}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-xs text-slate-500">
              No matching locations.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminDeliveryZonesPage({
  view = "list",
  zoneId,
  superAdmin = true,
}: {
  view?: "list" | "form";
  zoneId?: string;
  superAdmin?: boolean;
}) {
  const router = useRouter();
  const listPath = `${superAdmin ? "/superadmin" : "/admin"}/zones`;
  const editing = Boolean(zoneId);
  const [rows, setRows] = useState<AdminDeliveryZone[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [form, setForm] = useState<ZoneForm>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminDeliveryZone | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminDeliveryZones(token(), superAdmin),
      getAdminBranches(token(), superAdmin, true),
    ])
      .then(([zones, activeBranches]) => {
        if (cancelled) return;
        setRows(zones);
        setBranches(activeBranches);
        if (zoneId) {
          const row = zones.find((item) => item.id === zoneId);
          if (!row) throw new Error("Delivery zone could not be found.");
          setForm({
            name: row.name,
            province: row.province ?? "",
            district: row.district ?? "",
            municipality: row.municipality ?? "",
            ward: row.ward ?? "",
            branchId: row.branchId ?? "",
            deliveryFee: String(row.deliveryFee),
            freeDeliveryThreshold: String(row.freeDeliveryThreshold),
            minimumOrder: String(row.minimumOrder),
            sameDayDelivery: row.sameDayDelivery,
            enabled: row.enabled,
          });
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Delivery zones could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [superAdmin, zoneId]);

  const field = (key: keyof ZoneForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const districtOptions = districtOptionsFor(form.province);
  const localOptions = localOptionsFor(form.district);
  const wardOptions = wardOptionsFor(form.municipality);
  const updateProvince = (value: string) =>
    setForm((current) => ({
      ...current,
      province: value,
      district: "",
      municipality: "",
      ward: "",
    }));
  const updateDistrict = (value: string) =>
    setForm((current) => ({
      ...current,
      district: value,
      municipality: "",
      ward: "",
    }));
  const updateMunicipality = (value: string) =>
    setForm((current) => ({ ...current, municipality: value, ward: "" }));
  async function save(saveAndAnother = false) {
    setError("");
    if (!form.name.trim()) {
      setError("Zone name is required.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        ...form,
        name: form.name.trim(),
        branchId: form.branchId || undefined,
        deliveryFee: Number(form.deliveryFee),
        freeDeliveryThreshold: Number(form.freeDeliveryThreshold),
        minimumOrder: Number(form.minimumOrder),
      };
      const saved = editing
        ? await updateAdminDeliveryZone(zoneId!, input, token(), superAdmin)
        : await createAdminDeliveryZone(input, token(), superAdmin);
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
      else setForm(blank);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Delivery zone could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    try {
      await setAdminEntityStatus(
        "delivery-zone",
        deleteTarget.id,
        false,
        token(),
        superAdmin,
      );
      setRows((current) =>
        current.map((row) =>
          row.id === deleteTarget.id ? { ...row, enabled: false } : row,
        ),
      );
      toast.success(`${deleteTarget.name} Deactivated`);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Delivery zone could not be removed.";
      setError(message);
      toast.error(message);
    } finally {
      setDeleteTarget(null);
    }
  }
  return (
    <AdminShell superAdmin={superAdmin}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
            Delivery configuration
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {view === "form"
              ? editing
                ? "Edit delivery zone"
                : "Add delivery zone"
              : "Delivery zones"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Keep delivery fees and coverage rules in one place.
          </p>
        </div>
        {view === "list" && (
          <Button onClick={() => router.push(`${listPath}/create`)}>
            <Plus size={16} />
            Add zone
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
        >
          {error}
        </p>
      )}
      {view === "form" ? (
        <Card className="mt-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck size={18} className="text-[#003893]" />
              Zone details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Loader2 className="mr-2 inline animate-spin" size={18} />
                Loading zone…
              </div>
            ) : (
              <form
                className="grid gap-5 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="zone-name">Zone name</Label>
                  <Input
                    id="zone-name"
                    required
                    value={form.name}
                    onChange={(event) => field("name", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-province">Province</Label>
                  <LocationCombobox
                    id="zone-province"
                    value={form.province}
                    onChange={updateProvince}
                    options={provinceOptions}
                    placeholder="Search province"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    7 provinces available.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-district">District</Label>
                  <LocationCombobox
                    id="zone-district"
                    value={form.district}
                    onChange={updateDistrict}
                    options={districtOptions}
                    placeholder="Search district"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Choose from Nepal&apos;s 77 districts.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-municipality">
                    Municipality / Gaupalika
                  </Label>
                  <LocationCombobox
                    id="zone-municipality"
                    value={form.municipality}
                    onChange={updateMunicipality}
                    options={localOptions}
                    placeholder="Type a municipality name"
                  />
                  <p className="text-xs text-slate-500">
                    Municipality, metropolitan, sub-metropolitan and rural
                    municipality (gaupalika) are shown.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-ward">Ward</Label>
                  <LocationCombobox
                    id="zone-ward"
                    value={form.ward}
                    onChange={(value) => field("ward", value)}
                    options={wardOptions}
                    placeholder={
                      form.municipality ? "Search ward" : "Optional ward"
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Ward list follows the selected local level.
                  </p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="zone-branch">Branch</Label>
                  <Select
                    id="zone-branch"
                    value={form.branchId}
                    onChange={(event) => field("branchId", event.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-fee">Delivery fee</Label>
                  <Input
                    id="zone-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.deliveryFee}
                    onChange={(event) =>
                      field("deliveryFee", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-free">Free delivery above</Label>
                  <Input
                    id="zone-free"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.freeDeliveryThreshold}
                    onChange={(event) =>
                      field("freeDeliveryThreshold", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zone-minimum">Minimum order</Label>
                  <Input
                    id="zone-minimum"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minimumOrder}
                    onChange={(event) =>
                      field("minimumOrder", event.target.value)
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.sameDayDelivery}
                    onChange={(event) =>
                      field("sameDayDelivery", event.target.checked)
                    }
                  />
                  Same-day delivery
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => field("enabled", event.target.checked)}
                  />
                  Zone active
                </label>
                <div className="md:col-span-2">
                  <FormSaveActions
                    mode={editing ? "edit" : "create"}
                    busy={saving}
                    onCancel={() => router.push(listPath)}
                    onSaveAndAnother={() => void save(true)}
                    saveLabel={editing ? "Save changes" : "Save & list"}
                  />
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-[#003893]" />
              Zone directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Loader2 className="mr-2 inline animate-spin" size={18} />
                Loading zones…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-bold">
                          {row.name}
                          <span className="block text-xs font-normal text-slate-500">
                            {[row.municipality, row.district, row.province]
                              .filter(Boolean)
                              .join(", ") || "All locations"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.branch?.name ?? "All branches"}
                        </TableCell>
                        <TableCell>
                          {row.sameDayDelivery ? "Same day" : "Standard"}
                        </TableCell>
                        <TableCell>
                          NPR {row.deliveryFee} · free over NPR{" "}
                          {row.freeDeliveryThreshold}
                        </TableCell>
                        <TableCell>
                          <ActiveStatusToggle
                            checked={row.enabled}
                            onChange={(isActive) =>
                              void (async () => {
                                try {
                                  await setAdminEntityStatus(
                                    "delivery-zone",
                                    row.id,
                                    isActive,
                                    token(),
                                    superAdmin,
                                  );
                                  setRows((current) =>
                                    current.map((item) =>
                                      item.id === row.id
                                        ? { ...item, enabled: isActive }
                                        : item,
                                    ),
                                  );
                                  toast.success(
                                    `${row.name} is now ${isActive ? "active" : "inactive"}`,
                                  );
                                } catch (reason) {
                                  const message =
                                    reason instanceof Error
                                      ? reason.message
                                      : "Status could not be updated.";
                                  setError(message);
                                  toast.error(message);
                                }
                              })()
                            }
                            label={`delivery zone ${row.name}`}
                            confirmOnDeactivate
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
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
                    {!rows.length && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-sm text-slate-500"
                        >
                          No delivery zones have been configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This keeps historical orders safe and removes the zone from active
              delivery choices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => void remove()}
            >
              Deactivate zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
