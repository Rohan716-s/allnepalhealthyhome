"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock3, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBranch,
  AdminDeliverySlot,
  createAdminDeliverySlot,
  getAdminBranches,
  getAdminDeliverySlots,
  setAdminEntityStatus,
  updateAdminDeliverySlot,
} from "@/services/api";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { FormSaveActions } from "@/components/form-save-actions";
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

const blank = {
  label: "",
  startTime: "09:00",
  endTime: "12:00",
  branchId: "",
  maxOrders: "20",
  displayOrder: "10",
  enabled: true,
};

export function AdminDeliverySlots({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const [rows, setRows] = useState<AdminDeliverySlot[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = () =>
    window.localStorage.getItem("anhh-staff-access-token") ?? "";

  useEffect(() => {
    Promise.all([
      getAdminDeliverySlots(token(), superAdmin),
      getAdminBranches(token(), superAdmin, true),
    ])
      .then(([slots, branchRows]) => {
        setRows(slots);
        setBranches(branchRows);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [superAdmin]);

  function reset() {
    setEditing(null);
    setForm(blank);
  }
  function edit(row: AdminDeliverySlot) {
    setEditing(row.id);
    setForm({
      label: row.label,
      startTime: row.startTime,
      endTime: row.endTime,
      branchId: row.branchId ?? "",
      maxOrders: row.maxOrders ? String(row.maxOrders) : "",
      displayOrder: String(row.displayOrder),
      enabled: row.enabled,
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await persist(false);
  }
  async function persist(saveAndAnother: boolean) {
    setSaving(true);
    setError("");
    const input = {
      label: form.label,
      startTime: form.startTime,
      endTime: form.endTime,
      branchId: form.branchId || undefined,
      maxOrders: form.maxOrders ? Number(form.maxOrders) : undefined,
      displayOrder: Number(form.displayOrder),
      enabled: form.enabled,
    };
    try {
      const saved = editing
        ? await updateAdminDeliverySlot(editing, input, token(), superAdmin)
        : await createAdminDeliverySlot(input, token(), superAdmin);
      setRows((current) =>
        editing
          ? current.map((row) => (row.id === saved.id ? saved : row))
          : [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder),
      );
      toast.success(
        saveAndAnother
          ? "Delivery time slot saved. Add another window."
          : "Delivery time slot saved",
      );
      reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Delivery time slot could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function toggleStatus(row: AdminDeliverySlot, enabled: boolean) {
    try {
      await setAdminEntityStatus(
        "delivery-slot",
        row.id,
        enabled,
        token(),
        superAdmin,
      );
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, enabled } : item,
        ),
      );
      toast.success(`${row.label} ${enabled ? "Activated" : "Deactivated"}`);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Delivery slot status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <section className="mt-10 border-t border-slate-200 pt-10">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
          Delivery scheduling
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          Delivery time slots
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Give customers dependable delivery windows and cap how many orders
          each window can accept.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2 text-[#003893]">
                <Clock3 size={18} />
                {editing ? "Edit time slot" : "Add time slot"}
              </span>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Cancel time slot editing"
                  title="Cancel editing"
                  onClick={reset}
                >
                  <X size={16} />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="slot-label">Label</Label>
                <Input
                  id="slot-label"
                  required
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                  placeholder="Morning delivery"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="slot-start">Starts</Label>
                  <Input
                    id="slot-start"
                    required
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm({ ...form, startTime: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot-end">Ends</Label>
                  <Input
                    id="slot-end"
                    required
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm({ ...form, endTime: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slot-branch">Branch</Label>
                <Select
                  id="slot-branch"
                  value={form.branchId}
                  onChange={(event) =>
                    setForm({ ...form, branchId: event.target.value })
                  }
                >
                  <option value="">All active branches</option>
                  {branches
                    .filter((branch) => branch.isActive)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="slot-limit">Max orders</Label>
                  <Input
                    id="slot-limit"
                    type="number"
                    min="1"
                    value={form.maxOrders}
                    onChange={(event) =>
                      setForm({ ...form, maxOrders: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slot-order">Display order</Label>
                  <Input
                    id="slot-order"
                    type="number"
                    min="0"
                    value={form.displayOrder}
                    onChange={(event) =>
                      setForm({ ...form, displayOrder: event.target.value })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                />{" "}
                Available at checkout
              </label>
              <FormSaveActions
                mode={editing ? "edit" : "create"}
                busy={saving}
                onCancel={reset}
                onSaveAndAnother={
                  !editing ? () => void persist(true) : undefined
                }
                saveLabel={editing ? "Save changes" : "Save & list"}
              />
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured windows</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Loader2 className="mr-2 inline animate-spin" size={18} />
                Loading delivery slots…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Window</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-bold">{row.label}</p>
                          <p className="text-xs text-slate-500">
                            {row.startTime}–{row.endTime}
                          </p>
                        </TableCell>
                        <TableCell>
                          {row.branchName ?? "All active branches"}
                        </TableCell>
                        <TableCell>{row.maxOrders ?? "Unlimited"}</TableCell>
                        <TableCell>
                          <ActiveStatusToggle
                            checked={row.enabled}
                            onChange={(enabled) => toggleStatus(row, enabled)}
                            label={`delivery slot ${row.label}`}
                            confirmOnDeactivate
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${row.label}`}
                            title={`Edit ${row.label}`}
                            onClick={() => edit(row)}
                          >
                            <Pencil size={15} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-slate-500"
                        >
                          No delivery windows configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
