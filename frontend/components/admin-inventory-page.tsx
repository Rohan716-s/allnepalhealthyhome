"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Boxes,
  Check,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { formatNepalDate } from "@/lib/date-time";
import {
  AdminBranch,
  AdminInventory,
  adjustAdminInventory,
  getAdminBranches,
  getAdminInventory,
  transferAdminInventory,
} from "@/services/api";
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
import { formatNPR } from "@/lib/catalog";

export function AdminInventoryPage({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [rows, setRows] = useState<AdminInventory[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<AdminInventory | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [transferMode, setTransferMode] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [delta, setDelta] = useState("10");
  const [note, setNote] = useState("");
  const [type, setType] = useState("ADJUSTMENT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmNegative, setConfirmNegative] = useState(false);

  useEffect(() => {
    const accessToken = window.localStorage.getItem("anhh-staff-access-token");
    if (!accessToken) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getAdminInventory(accessToken, filter || undefined, superAdmin)
        .then((response) => setRows(response.items))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
      if (!supervisor) {
        getAdminBranches(accessToken, superAdmin, true)
          .then(setBranches)
          .catch((e: Error) => setError((current) => current || e.message));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filter, superAdmin, supervisor]);

  function openAdjustment(row: AdminInventory) {
    setSelected(row);
    setTransferMode(false);
    setTargetBranchId("");
    setDelta("10");
    setNote("");
    setType("ADJUSTMENT");
  }
  function openTransfer(row: AdminInventory) {
    setSelected(row);
    setTransferMode(true);
    setTargetBranchId("");
    setDelta("1");
    setNote("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const quantityDelta = Number(delta);
    if (!selected || !Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setError(
        transferMode
          ? "Enter a whole-number transfer quantity."
          : "Enter a non-zero whole-number adjustment.",
      );
      return;
    }
    if (transferMode) {
      if (!targetBranchId) {
        setError("Choose a target branch.");
        return;
      }
      void saveTransfer(quantityDelta);
      return;
    }
    if (quantityDelta < 0) {
      setConfirmNegative(true);
      return;
    }
    void saveAdjustment(quantityDelta);
  }
  async function saveTransfer(quantity: number) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const result = await transferAdminInventory(
        selected.id,
        targetBranchId,
        quantity,
        note,
        window.localStorage.getItem("anhh-staff-access-token") ?? "",
        superAdmin,
      );
      setRows((current) => {
        const updated = current.map((row) =>
          row.id === result.source.id
            ? result.source
            : row.id === result.target.id
              ? result.target
              : row,
        );
        return updated.some((row) => row.id === result.target.id)
          ? updated
          : [...updated, result.target];
      });
      setSelected(null);
      setTransferMode(false);
      toast.success(`${quantity} units transferred to ${result.target.branch}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Stock could not be transferred.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveAdjustment(quantityDelta: number) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const accessToken =
        window.localStorage.getItem("anhh-staff-access-token") ?? "";
      const updated = await adjustAdminInventory(
        selected.id,
        quantityDelta,
        note,
        type,
        accessToken,
        superAdmin,
      );
      setRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setSelected(null);
      setConfirmNegative(false);
      toast.success(`${updated.productName} stock updated`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stock could not be adjusted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
          Inventory
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Stock control
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Branch-aware batches, reservations, expiry, and safe transactional
          stock adjustments.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          ["", "All"],
          ["low-stock", "Low stock"],
          ["out-of-stock", "Out of stock"],
          ["expiry", "Expiring soon"],
          ["expired", "Expired"],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {selected && (
        <Card className="mt-5 border-[#003893]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {transferMode ? (
                <ArrowRightLeft size={18} className="text-[#003893]" />
              ) : (
                <PackagePlus size={18} className="text-[#003893]" />
              )}
              {transferMode ? "Transfer" : "Adjust"} {selected.productName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={submit}
              className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end"
            >
              <div className="grid gap-2">
                <Label htmlFor="stock-delta">
                  {transferMode ? "Quantity" : "Quantity delta"}
                </Label>
                <Input
                  id="stock-delta"
                  type="number"
                  min={transferMode ? "1" : undefined}
                  step="1"
                  value={delta}
                  onChange={(event) => setDelta(event.target.value)}
                  aria-describedby="stock-help"
                />
              </div>
              {transferMode ? (
                <div className="grid gap-2">
                  <Label htmlFor="stock-target-branch">Target branch</Label>
                  <Select
                    id="stock-target-branch"
                    required
                    value={targetBranchId}
                    onChange={(event) => setTargetBranchId(event.target.value)}
                  >
                    <option value="">Choose branch</option>
                    {branches
                      .filter(
                        (branch) =>
                          branch.isActive && branch.id !== selected.branchId,
                      )
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="stock-type">Transaction type</Label>
                  <Select
                    id="stock-type"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="DAMAGE">Damage</option>
                    <option value="RETURN">Return</option>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="stock-note">Reason</Label>
                <Input
                  id="stock-note"
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    transferMode
                      ? "Branch handoff reference"
                      : "Count correction, purchase receipt, expiry…"
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : transferMode ? (
                    <ArrowRightLeft />
                  ) : (
                    <Check />
                  )}
                  {transferMode ? "Transfer" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelected(null);
                    setTransferMode(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <p
                id="stock-help"
                className="text-xs text-slate-500 md:col-span-4"
              >
                {transferMode
                  ? "The same batch is preserved at the target branch and both movements are recorded."
                  : "Positive values add stock. Negative values require confirmation and cannot reduce stock below reserved units."}
              </p>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes size={18} className="text-[#003893]" />
            Inventory batches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="mr-2 inline animate-spin" size={18} />
              Loading inventory…
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
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold">
                        {row.productName}
                        <div className="text-xs font-normal text-slate-400">
                          {row.sku}
                        </div>
                      </TableCell>
                      <TableCell>{row.batchNumber}</TableCell>
                      <TableCell>{row.branch}</TableCell>
                      <TableCell>
                        {row.availableQuantity}{" "}
                        <span className="text-xs text-slate-400">
                          / {row.stockQuantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.expiryDate ? formatNepalDate(row.expiryDate) : "—"}
                      </TableCell>
                      <TableCell>{formatNPR(row.sellingPrice)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "IN_STOCK" ? "default" : "secondary"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Adjust ${row.productName}`}
                          title={`Adjust ${row.productName}`}
                          onClick={() => openAdjustment(row)}
                        >
                          <Plus size={16} />
                        </Button>
                        {!supervisor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Transfer ${row.productName}`}
                            title={`Transfer ${row.productName}`}
                            onClick={() => openTransfer(row)}
                          >
                            <ArrowRightLeft size={16} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rows.length && (
                <div className="p-10 text-center text-sm text-slate-500">
                  <Minus className="mx-auto mb-2" size={20} />
                  No inventory batches match this filter.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={confirmNegative} onOpenChange={setConfirmNegative}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm stock reduction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reduce {selected?.productName} by{" "}
              {Math.abs(Number(delta) || 0)} units and write an auditable
              inventory transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep stock</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void saveAdjustment(Number(delta))}
              disabled={saving}
            >
              {saving ? "Saving…" : "Confirm reduction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
