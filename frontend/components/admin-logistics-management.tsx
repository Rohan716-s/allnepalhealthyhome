"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Boxes, Building2, Loader2, Pencil, Truck, X } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBranch,
  AdminDeliveryZone,
  AdminSupplier,
  createAdminDeliveryZone,
  createAdminSupplier,
  getAdminBranches,
  getAdminDeliveryZones,
  getAdminSuppliers,
  setAdminEntityStatus,
  updateAdminDeliveryZone,
  updateAdminSupplier,
} from "@/services/api";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const blankSupplier = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxNumber: "",
  isActive: true,
};
const blankZone = {
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

export function AdminLogisticsManagement({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [zones, setZones] = useState<AdminDeliveryZone[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [supplier, setSupplier] = useState(blankSupplier);
  const [zone, setZone] = useState(blankZone);
  const [editing, setEditing] = useState<{
    type: "supplier" | "zone";
    id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const token = () =>
    window.localStorage.getItem("anhh-staff-access-token") ?? "";
  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([
        getAdminSuppliers(token(), superAdmin),
        getAdminDeliveryZones(token(), superAdmin),
        getAdminBranches(token(), superAdmin, true),
      ])
        .then(([supplierRows, zoneRows, branchRows]) => {
          setSuppliers(supplierRows);
          setZones(zoneRows);
          setBranches(branchRows);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [superAdmin]);
  function reset() {
    setEditing(null);
    setSupplier(blankSupplier);
    setZone(blankZone);
  }
  function editSupplier(id: string) {
    const row = suppliers.find((item) => item.id === id);
    if (row) {
      setEditing({ type: "supplier", id });
      setSupplier({
        name: row.name,
        contactPerson: row.contactPerson ?? "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        address: row.address ?? "",
        taxNumber: row.taxNumber ?? "",
        isActive: row.isActive,
      });
    }
  }
  function editZone(id: string) {
    const row = zones.find((item) => item.id === id);
    if (row) {
      setEditing({ type: "zone", id });
      setZone({
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
  }
  async function saveSupplier(event: FormEvent) {
    event.preventDefault();
    await persistSupplier();
  }
  async function persistSupplier() {
    setSaving("supplier");
    setError("");
    try {
      const result =
        editing?.type === "supplier"
          ? await updateAdminSupplier(editing.id, supplier, token(), superAdmin)
          : await createAdminSupplier(supplier, token(), superAdmin);
      setSuppliers((rows) =>
        editing?.type === "supplier"
          ? rows.map((row) => (row.id === result.id ? result : row))
          : [result, ...rows],
      );
      toast.success("Supplier saved");
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supplier could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveZone(event: FormEvent) {
    event.preventDefault();
    await persistZone();
  }
  async function persistZone() {
    setSaving("zone");
    setError("");
    const input = {
      ...zone,
      branchId: zone.branchId || undefined,
      deliveryFee: Number(zone.deliveryFee),
      freeDeliveryThreshold: Number(zone.freeDeliveryThreshold),
      minimumOrder: Number(zone.minimumOrder),
    };
    try {
      const result =
        editing?.type === "zone"
          ? await updateAdminDeliveryZone(
              editing.id,
              input,
              token(),
              superAdmin,
            )
          : await createAdminDeliveryZone(input, token(), superAdmin);
      setZones((rows) =>
        editing?.type === "zone"
          ? rows.map((row) => (row.id === result.id ? result : row))
          : [result, ...rows],
      );
      toast.success("Delivery zone saved");
      reset();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Delivery zone could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function toggleStatus(
    entity: "supplier" | "delivery-zone",
    id: string,
    isActive: boolean,
    name: string,
  ) {
    try {
      await setAdminEntityStatus(entity, id, isActive, token(), superAdmin);
      if (entity === "supplier")
        setSuppliers((rows) =>
          rows.map((row) => (row.id === id ? { ...row, isActive } : row)),
        );
      else
        setZones((rows) =>
          rows.map((row) =>
            row.id === id ? { ...row, enabled: isActive } : row,
          ),
        );
      toast.success(`${name} is now ${isActive ? "active" : "inactive"}`);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }
  return (
    <section className="mt-10 border-t border-slate-200 pt-10">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
          Operations
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          Suppliers and delivery zones
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Keep purchasing contacts and Nepal delivery rules aligned with the
          branch network.
        </p>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      {loading ? (
        <div className="flex items-center justify-center p-10 text-sm text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Loading operations data…
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2 text-[#003893]">
                  <Boxes size={18} />
                  {editing?.type === "supplier"
                    ? "Edit supplier"
                    : "Add supplier"}
                </span>
                {editing?.type === "supplier" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancel supplier editing"
                    title="Cancel editing"
                    onClick={reset}
                  >
                    <X size={16} />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={saveSupplier}
                className="grid gap-3 sm:grid-cols-2"
              >
                <Field
                  label="Supplier name"
                  value={supplier.name}
                  required
                  onChange={(value) =>
                    setSupplier({ ...supplier, name: value })
                  }
                />
                <Field
                  label="Contact person"
                  value={supplier.contactPerson}
                  onChange={(value) =>
                    setSupplier({ ...supplier, contactPerson: value })
                  }
                />
                <Field
                  label="Phone"
                  value={supplier.phone}
                  onChange={(value) =>
                    setSupplier({ ...supplier, phone: value })
                  }
                />
                <Field
                  label="Email"
                  value={supplier.email}
                  onChange={(value) =>
                    setSupplier({ ...supplier, email: value })
                  }
                />
                <Field
                  label="Address"
                  value={supplier.address}
                  onChange={(value) =>
                    setSupplier({ ...supplier, address: value })
                  }
                />
                <Field
                  label="Tax number"
                  value={supplier.taxNumber}
                  onChange={(value) =>
                    setSupplier({ ...supplier, taxNumber: value })
                  }
                />
                <Toggle
                  label="Active"
                  checked={supplier.isActive}
                  onChange={(value) =>
                    setSupplier({ ...supplier, isActive: value })
                  }
                />
                <SaveButton
                  busy={saving === "supplier"}
                  editing={editing?.type === "supplier"}
                  onCancel={reset}
                  onSaveAndAnother={() => void persistSupplier()}
                />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2 text-[#003893]">
                  <Truck size={18} />
                  {editing?.type === "zone"
                    ? "Edit delivery zone"
                    : "Add delivery zone"}
                </span>
                {editing?.type === "zone" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancel delivery zone editing"
                    title="Cancel editing"
                    onClick={reset}
                  >
                    <X size={16} />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveZone} className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Zone name"
                  value={zone.name}
                  required
                  onChange={(value) => setZone({ ...zone, name: value })}
                />
                <SelectField
                  label="Branch"
                  value={zone.branchId}
                  options={branches.filter((row) => row.isActive).map((row) => [row.id, row.name])}
                  onChange={(value) => setZone({ ...zone, branchId: value })}
                />
                <Field
                  label="Province"
                  value={zone.province}
                  onChange={(value) => setZone({ ...zone, province: value })}
                />
                <Field
                  label="District"
                  value={zone.district}
                  onChange={(value) => setZone({ ...zone, district: value })}
                />
                <Field
                  label="Municipality"
                  value={zone.municipality}
                  onChange={(value) =>
                    setZone({ ...zone, municipality: value })
                  }
                />
                <Field
                  label="Ward"
                  value={zone.ward}
                  onChange={(value) => setZone({ ...zone, ward: value })}
                />
                <Field
                  label="Delivery fee"
                  value={zone.deliveryFee}
                  type="number"
                  onChange={(value) => setZone({ ...zone, deliveryFee: value })}
                />
                <Field
                  label="Free delivery above"
                  value={zone.freeDeliveryThreshold}
                  type="number"
                  onChange={(value) =>
                    setZone({ ...zone, freeDeliveryThreshold: value })
                  }
                />
                <Field
                  label="Minimum order"
                  value={zone.minimumOrder}
                  type="number"
                  onChange={(value) =>
                    setZone({ ...zone, minimumOrder: value })
                  }
                />
                <Toggle
                  label="Same-day delivery"
                  checked={zone.sameDayDelivery}
                  onChange={(value) =>
                    setZone({ ...zone, sameDayDelivery: value })
                  }
                />
                <Toggle
                  label="Enabled"
                  checked={zone.enabled}
                  onChange={(value) => setZone({ ...zone, enabled: value })}
                />
                <SaveButton
                  busy={saving === "zone"}
                  editing={editing?.type === "zone"}
                  onCancel={reset}
                  onSaveAndAnother={() => void persistZone()}
                />
              </form>
            </CardContent>
          </Card>
          <ListCard
            title="Supplier directory"
            icon={<Building2 size={17} />}
            headers={["Supplier", "Contact", "Status"]}
            rows={suppliers.map((row) => [
              <span key="name">
                {row.name}
                <small className="block text-slate-400">
                  {row.email || row.phone || "No contact"}
                </small>
              </span>,
              row.contactPerson || "—",
              <ActiveStatusToggle
                key="status"
                checked={row.isActive}
                onChange={(isActive) =>
                  toggleStatus("supplier", row.id, isActive, row.name)
                }
                label={`supplier ${row.name}`}
                confirmOnDeactivate
              />,
            ])}
            ids={suppliers.map((row) => row.id)}
            onEdit={editSupplier}
          />
          <ListCard
            title="Delivery zones"
            icon={<Truck size={17} />}
            headers={["Zone", "Branch", "Rules", "Status"]}
            rows={zones.map((row) => [
              row.name,
              row.branch?.name || "All branches",
              `NPR ${row.deliveryFee} · free over NPR ${row.freeDeliveryThreshold}`,
              <ActiveStatusToggle
                key="status"
                checked={row.enabled}
                onChange={(enabled) =>
                  toggleStatus("delivery-zone", row.id, enabled, row.name)
                }
                label={`delivery zone ${row.name}`}
                confirmOnDeactivate
              />,
            ])}
            ids={zones.map((row) => row.id)}
            onEdit={editZone}
          />
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  const id = `logistics-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  const id = `logistics-${label.toLowerCase()}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
      >
        <option value="">All branches</option>
        {options.map(([optionId, name]) => (
          <option key={optionId} value={optionId}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
function SaveButton({
  busy,
  editing,
  onCancel,
  onSaveAndAnother,
}: {
  busy: boolean;
  editing: boolean;
  onCancel: () => void;
  onSaveAndAnother: () => void;
}) {
  return (
    <FormSaveActions
      mode={editing ? "edit" : "create"}
      busy={busy}
      onCancel={onCancel}
      onSaveAndAnother={!editing ? onSaveAndAnother : undefined}
      saveLabel={editing ? "Save changes" : "Save & list"}
    />
  );
}
function ListCard({
  title,
  icon,
  headers,
  rows,
  ids,
  onEdit,
}: {
  title: string;
  icon: ReactNode;
  headers: string[];
  rows: ReactNode[][];
  ids: string[];
  onEdit: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#003893]">
          {icon}
          {title}
          <Badge variant="outline" className="ml-auto">
            {rows.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={ids[index]}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${ids[index]}-${cellIndex}`}>
                      {cell}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${title} record`}
                      title={`Edit ${title} record`}
                      onClick={() => onEdit(ids[index])}
                    >
                      <Pencil size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length + 1}
                    className="text-center text-sm text-slate-500"
                  >
                    No records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
