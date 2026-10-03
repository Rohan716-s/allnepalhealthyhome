"use client";

import { useEffect, useState } from "react";
import { Check, CheckSquare, Edit3, Filter, Loader2, Mail, MapPin, Phone, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ApiError,
  bulkDeleteSalesExecutiveAssignments,
  bulkUpdateSalesExecutiveAssignments,
  createBulkSalesExecutiveAssignments,
  getSalesExecutiveAssignmentBranches,
  getSalesExecutiveAssignmentProducts,
  getSalesExecutiveAssignmentStaff,
  getSalesExecutiveAssignments,
  updateSalesExecutiveAssignment,
  type AdminProduct,
  type SalesAssignmentBranchOption,
  type SalesExecutiveAssignment,
  type SalesExecutiveOption,
} from "@/services/api";

const accessToken = () => typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
const inputClass = "flex h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#003893] focus:ring-2 focus:ring-blue-100";
const PAGE_SIZE = 25;
const MAX_BULK_ASSIGNMENTS = 10_000;
type ProductChoice = Pick<AdminProduct, "id" | "name" | "sku" | "brand" | "category" | "sellingPrice">;

export function SalesExecutiveAssignmentsPage({ superAdmin = true }: { superAdmin?: boolean }) {
  const [staff, setStaff] = useState<SalesExecutiveOption[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [rows, setRows] = useState<SalesExecutiveAssignment[]>([]);
  const [branches, setBranches] = useState<SalesAssignmentBranchOption[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedStaffById, setSelectedStaffById] = useState<Record<string, SalesExecutiveOption>>({});
  const [selectedProductById, setSelectedProductById] = useState<Record<string, ProductChoice>>({});
  const [staffSearch, setStaffSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffPage, setStaffPage] = useState(1);
  const [staffTotalPages, setStaffTotalPages] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(0);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentTotal, setAssignmentTotal] = useState(0);
  const [assignmentTotalPages, setAssignmentTotalPages] = useState(0);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkExecutiveId, setBulkExecutiveId] = useState("");
  const [bulkProductId, setBulkProductId] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getSalesExecutiveAssignmentBranches(accessToken(), superAdmin).then(setBranches)
      .catch(reason => setError(reason instanceof ApiError ? reason.message : "Branches could not be loaded."));
  }, [superAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getSalesExecutiveAssignmentStaff(accessToken(), { search: staffSearch.trim() || undefined, branchId: branchFilter === "all" ? undefined : branchFilter, page: staffPage, pageSize: PAGE_SIZE }, superAdmin)
        .then(result => { if (!controller.signal.aborted) { setStaff(result.items); setStaffTotalPages(result.totalPages); } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "Sales Executives could not be loaded."); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [branchFilter, staffPage, staffSearch, superAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getSalesExecutiveAssignmentProducts(accessToken(), { search: productSearch.trim() || undefined, page: productPage, pageSize: PAGE_SIZE }, superAdmin)
        .then(result => { if (!controller.signal.aborted) { setProducts(result.items); setProductTotalPages(result.totalPages); } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "Products could not be loaded."); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [productPage, productSearch, superAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      getSalesExecutiveAssignments(accessToken(), { search: assignmentSearch.trim() || undefined, branchId: branchFilter === "all" ? undefined : branchFilter, activeOnly: statusFilter === "all" ? undefined : statusFilter === "active", page: assignmentPage, pageSize: PAGE_SIZE }, superAdmin)
        .then(result => { if (!controller.signal.aborted) { setRows(result.items); setAssignmentTotal(result.totalItems); setAssignmentTotalPages(result.totalPages); } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "Saved assignments could not be loaded."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [assignmentPage, assignmentSearch, branchFilter, refreshVersion, statusFilter, superAdmin]);

  const selectedStaff = selectedStaffIds.map(id => selectedStaffById[id]).filter((user): user is SalesExecutiveOption => Boolean(user));
  const selectedProducts = selectedProductIds.map(id => selectedProductById[id]).filter((product): product is ProductChoice => Boolean(product));
  const plannedAssignments = selectedStaffIds.length * selectedProductIds.length;
  const canSaveAssignments = editingId
    ? selectedStaffIds.length === 1 && (selectedProductIds.length === 1 || Boolean(editingCategoryId))
    : selectedStaffIds.length > 0 && selectedProductIds.length > 0;

  function toggleStaff(id: string) {
    const option = staff.find(user => user.id === id);
    if (option && !selectedStaffIds.includes(id) && selectedStaffIds.length >= 200) { setError("A bulk assignment can include up to 200 Sales Executives."); return; }
    if (option && !selectedStaffIds.includes(id)) setSelectedStaffById(current => ({ ...current, [id]: option }));
    setSelectedStaffIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    setSuccess("");
  }
  function toggleProduct(id: string) {
    const option = products.find(product => product.id === id);
    if (option && !selectedProductIds.includes(id) && selectedProductIds.length >= 500) { setError("A bulk assignment can include up to 500 products."); return; }
    if (option && !selectedProductIds.includes(id)) setSelectedProductById(current => ({ ...current, [id]: { id: option.id, name: option.name, sku: option.sku, brand: option.brand, category: option.category, sellingPrice: option.sellingPrice } }));
    setSelectedProductIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setSuccess("");
  }
  function selectAllStaff() {
    const newOptions = staff.filter(user => !selectedStaffIds.includes(user.id));
    if (selectedStaffIds.length + newOptions.length > 200) { setError("A bulk assignment can include up to 200 Sales Executives."); return; }
    setSelectedStaffById(current => ({ ...current, ...Object.fromEntries(staff.map(user => [user.id, user])) }));
    setSelectedStaffIds(current => Array.from(new Set([...current, ...staff.map(user => user.id)])));
  }
  function deselectAllStaff() { setSelectedStaffIds(current => current.filter(id => !staff.some(user => user.id === id))); }
  function selectAllProducts() {
    const newOptions = products.filter(product => !selectedProductIds.includes(product.id));
    if (selectedProductIds.length + newOptions.length > 500) { setError("A bulk assignment can include up to 500 products."); return; }
    setSelectedProductById(current => ({ ...current, ...Object.fromEntries(products.map(product => [product.id, { id: product.id, name: product.name, sku: product.sku, brand: product.brand, category: product.category, sellingPrice: product.sellingPrice }])) }));
    setSelectedProductIds(current => Array.from(new Set([...current, ...products.map(product => product.id)])));
  }
  function deselectAllProducts() { setSelectedProductIds(current => current.filter(id => !products.some(product => product.id === id))); }
  function clearSelection() {
    setSelectedStaffIds([]); setSelectedProductIds([]); setSelectedStaffById({}); setSelectedProductById({}); setEditingId(null); setEditingCategoryId(null); setEditingCategoryName(""); setSuccess(""); setError("");
  }
  function startEdit(row: SalesExecutiveAssignment) {
    setEditingId(row.id);
    setSelectedStaffIds([row.salesExecutiveUserId]);
    setSelectedStaffById(current => ({ ...current, [row.salesExecutiveUserId]: { id: row.salesExecutiveUserId, fullName: row.salesExecutiveName, email: row.email ?? "", phone: row.phone ?? "", branchId: row.branchId, branchName: row.branchName, territory: row.territory } }));
    setSelectedProductIds(row.productId ? [row.productId] : []);
    if (row.productId) setSelectedProductById(current => ({ ...current, [row.productId!]: { id: row.productId!, name: row.productName ?? "Product", sku: row.productSku ?? "", brand: row.productBrand ?? "", category: row.productCategory ?? "", sellingPrice: row.productSellingPrice ?? 0 } }));
    setEditingCategoryId(row.categoryId ?? null);
    setEditingCategoryName(row.categoryName ?? "");
    setSuccess(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveAssignments() {
    setError(""); setSuccess("");
    if (selectedStaffIds.length === 0) { setError("Select at least one Sales Executive."); return; }
    if (editingId) {
      if (selectedStaffIds.length !== 1 || (selectedProductIds.length !== 1 && !editingCategoryId)) { setError("Edit one executive with one product at a time."); return; }
      setSaving(true);
      try {
        const row = await updateSalesExecutiveAssignment(editingId, { salesExecutiveUserId: selectedStaffIds[0], ...(editingCategoryId ? { categoryId: editingCategoryId } : { productId: selectedProductIds[0] }) }, accessToken(), superAdmin);
        setRows(current => current.map(item => item.id === row.id ? row : item));
        clearSelection(); setSuccess(`${row.salesExecutiveName} assignment updated successfully.`); toast.success(`${row.salesExecutiveName} assignment updated successfully.`); setRefreshVersion(version => version + 1);
      } catch (reason) { const message = reason instanceof ApiError ? reason.message : "The assignment could not be updated."; setError(message); toast.error(message); }
      finally { setSaving(false); }
      return;
    }
    if (selectedProductIds.length === 0) { setError("Select at least one product."); return; }
    if (plannedAssignments > MAX_BULK_ASSIGNMENTS) { setError(`A single action can create at most ${MAX_BULK_ASSIGNMENTS.toLocaleString()} assignments. Split this selection into smaller batches.`); return; }
    setSaving(true);
    try {
      const result = await createBulkSalesExecutiveAssignments({ salesExecutiveUserIds: selectedStaffIds, productIds: selectedProductIds }, accessToken(), superAdmin);
      const message = result.created.length === 0 ? `No new assignments were added. ${result.skippedDuplicates} duplicate selection${result.skippedDuplicates === 1 ? " was" : "s were"} skipped.` : `${result.created.length} assignment${result.created.length === 1 ? "" : "s"} saved${result.skippedDuplicates ? `; ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped` : ""}.`;
      setSuccess(message); toast.success(message);
      setSelectedStaffIds([]); setSelectedProductIds([]); setSelectedStaffById({}); setSelectedProductById({});
      setAssignmentPage(1); setRefreshVersion(version => version + 1);
    } catch (reason) { const message = reason instanceof ApiError ? reason.message : "The assignments could not be saved."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }
  function remove(id: string, label: string) {
    requestSiteConfirmation({ title: "Delete this assignment?", message: `${label} will no longer be assigned to this product. This action cannot be undone.`, confirmLabel: "Delete assignment", tone: "danger", onConfirm: async () => {
      setDeletingId(id); setError(""); setSuccess("");
      try { await bulkDeleteSalesExecutiveAssignments([id], accessToken(), superAdmin); setSelectedAssignmentIds(current => current.filter(value => value !== id)); const message = "Assignment deleted successfully."; setSuccess(message); toast.success(message); setRefreshVersion(version => version + 1); }
      catch (reason) { const message = reason instanceof ApiError ? reason.message : "The assignment could not be deleted."; setError(message); toast.error(message); }
      finally { setDeletingId(null); }
    } });
  }
  function toggleAllVisibleAssignments() {
    const ids = rows.map(row => row.id);
    if (ids.every(id => selectedAssignmentIds.includes(id))) {
      setSelectedAssignmentIds(current => current.filter(id => !ids.includes(id)));
      return;
    }
    const additions = ids.filter(id => !selectedAssignmentIds.includes(id));
    if (selectedAssignmentIds.length + additions.length > 500) { setError("Bulk actions support up to 500 assignments. Clear some selections first."); return; }
    setSelectedAssignmentIds(current => Array.from(new Set([...current, ...ids])));
  }
  function toggleAssignmentSelection(id: string) {
    if (selectedAssignmentIds.includes(id)) { setSelectedAssignmentIds(current => current.filter(value => value !== id)); return; }
    if (selectedAssignmentIds.length >= 500) { setError("Bulk actions support up to 500 assignments. Clear some selections first."); return; }
    setSelectedAssignmentIds(current => [...current, id]);
  }
  async function applyBulkEdit() {
    if (!selectedAssignmentIds.length || (!bulkStatus && !bulkExecutiveId && !bulkProductId)) return;
    setBulkSaving(true); setError(""); setSuccess("");
    try {
      const result = await bulkUpdateSalesExecutiveAssignments({ assignmentIds: selectedAssignmentIds, ...(bulkStatus ? { isActive: bulkStatus === "active" } : {}), ...(bulkExecutiveId ? { salesExecutiveUserId: bulkExecutiveId } : {}), ...(bulkProductId ? { productId: bulkProductId } : {}) }, accessToken(), superAdmin);
      const message = `${result.updated} assignment${result.updated === 1 ? "" : "s"} updated successfully.`;
      setSuccess(message); toast.success(message); setSelectedAssignmentIds([]); setBulkStatus(""); setBulkExecutiveId(""); setBulkProductId(""); setRefreshVersion(version => version + 1);
    } catch (reason) { const message = reason instanceof ApiError ? reason.message : "The selected assignments could not be updated."; setError(message); toast.error(message); }
    finally { setBulkSaving(false); }
  }
  function deleteSelectedAssignments() {
    if (!selectedAssignmentIds.length) return;
    requestSiteConfirmation({ title: `Delete ${selectedAssignmentIds.length} assignments?`, message: "All selected assignment records will be permanently deleted. This cannot be undone.", confirmLabel: "Delete selected", tone: "danger", onConfirm: async () => {
      setBulkSaving(true); setError(""); setSuccess("");
      try {
        const result = await bulkDeleteSalesExecutiveAssignments(selectedAssignmentIds, accessToken(), superAdmin);
        const message = `${result.deleted} assignment${result.deleted === 1 ? "" : "s"} deleted successfully.`;
        setSuccess(message); toast.success(message); setSelectedAssignmentIds([]); setRefreshVersion(version => version + 1);
      } catch (reason) { const message = reason instanceof ApiError ? reason.message : "The selected assignments could not be deleted."; setError(message); toast.error(message); }
      finally { setBulkSaving(false); }
    } });
  }

  return <AdminShell superAdmin={superAdmin}>
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Sales operations</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Sales Executive Assignment</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Select people and products together. Branch and contact details are filled automatically from each staff account.</p></div>
        <Badge variant="secondary">{assignmentTotal} matching assignment{assignmentTotal === 1 ? "" : "s"}</Badge>
      </div>
      {error && <div role="alert" className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
      {success && <div role="status" className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><span className="flex items-center gap-2"><Check size={16} />{success}</span><button type="button" aria-label="Dismiss success" onClick={() => setSuccess("")}><X size={16} /></button></div>}

      <Card className="mt-7 overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{editingId ? "Edit assignment" : "Create assignments"}</CardTitle><p className="mt-1 text-sm text-slate-500">{editingId ? "Update this saved pairing, then return to bulk assignment mode." : "One save assigns every selected product to every selected executive."}</p></div>{(selectedStaffIds.length > 0 || selectedProductIds.length > 0 || editingId) && <Button type="button" variant="ghost" size="sm" onClick={clearSelection}><X size={14} />Clear selection</Button>}</div></CardHeader>
        <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
          <SelectionPanel title="1. Sales Executives" count={selectedStaffIds.length} search={staffSearch} onSearch={value => { setStaffSearch(value); setStaffPage(1); }} placeholder="Search name, phone, email, branch" onSelectAll={selectAllStaff} onDeselectAll={deselectAllStaff} page={staffPage} totalPages={staffTotalPages} onPageChange={setStaffPage}>
            <div className="mb-3 flex items-center gap-2"><Filter size={14} className="text-slate-400" /><Select value={branchFilter} onChange={event => { setBranchFilter(event.target.value); setStaffPage(1); setAssignmentPage(1); }} aria-label="Filter Sales Executives by branch" className="h-9"><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">{staff.map(user => <label key={user.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedStaffIds.includes(user.id) ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:border-blue-200"}`}><Checkbox checked={selectedStaffIds.includes(user.id)} onChange={() => toggleStaff(user.id)} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900"><UserRound size={15} className="text-[#003893]" />{user.fullName}<Badge variant="outline">Active</Badge></span><span className="mt-1 block truncate text-xs text-slate-500">{user.email} · {user.phone}</span><span className="mt-1 block text-xs font-medium text-slate-500">Branch: {user.branchName ?? "Not assigned"} · Territory: {user.territory ?? "Not set"}</span></span></label>)}{!staff.length && <Empty message="No Sales Executives match this search." />}</div>
          </SelectionPanel>
          <SelectionPanel title="2. Products" count={selectedProductIds.length} search={productSearch} onSearch={value => { setProductSearch(value); setProductPage(1); }} placeholder="Search product, SKU, brand, category" onSelectAll={selectAllProducts} onDeselectAll={deselectAllProducts} page={productPage} totalPages={productTotalPages} onPageChange={setProductPage}>
            <div className="max-h-[414px] space-y-2 overflow-y-auto pr-1">{products.map(product => <label key={product.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedProductIds.includes(product.id) ? "border-teal-300 bg-teal-50/60" : "border-slate-200 hover:border-teal-200"}`}><Checkbox checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{product.name}</span><span className="mt-1 block truncate text-xs text-slate-500">SKU {product.sku} · {product.brand} · {product.category}</span><span className="mt-1 block text-xs font-semibold text-slate-600">NPR {product.sellingPrice.toLocaleString()}</span></span></label>)}{!products.length && <Empty message="No active products match this search." />}</div>
          </SelectionPanel>
        </CardContent>
      </Card>

      <Card className="mt-5 border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Preview</CardTitle><p className="mt-1 text-sm text-slate-500">Review the people and products before saving.</p></div><Button type="button" disabled={saving || loading || !canSaveAssignments || plannedAssignments > MAX_BULK_ASSIGNMENTS} onClick={() => void saveAssignments()}>{saving && <Loader2 size={15} className="animate-spin" />}{editingId ? "Save changes" : "Assign Products"}</Button></div></CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
            <span className="font-bold text-slate-800">{selectedStaff.length} executives × {selectedProducts.length || (editingCategoryId ? 1 : 0)} products</span>
            <span className="text-slate-600">{editingId ? "One saved assignment will be updated." : `${plannedAssignments.toLocaleString()} assignment${plannedAssignments === 1 ? "" : "s"} planned · existing duplicates are skipped.`}</span>
          </div>
          {!editingId && plannedAssignments > MAX_BULK_ASSIGNMENTS && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">This selection exceeds the {MAX_BULK_ASSIGNMENTS.toLocaleString()}-assignment limit per save. Split it into smaller batches.</p>}
          {editingCategoryId && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Legacy category assignment: {editingCategoryName}. Choose a product above to replace the category.</p>}
          {selectedStaff.length > 0 && selectedProducts.length > 0 ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Executive · branch</th>{selectedProducts.slice(0, 8).map(product => <th key={product.id} className="max-w-40 px-4 py-3"><span className="block truncate">{product.name}</span><span className="font-normal normal-case">{product.sku}</span></th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{selectedStaff.slice(0, 8).map(user => <tr key={user.id}><th className="px-4 py-3 font-semibold text-slate-800"><span className="block">{user.fullName}</span><span className="text-xs font-normal text-slate-500">{user.branchName ?? "Branch not assigned"} · {user.phone}</span></th>{selectedProducts.slice(0, 8).map(product => <td key={product.id} className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-[#003893]"><Check size={13} /> Assign</span></td>)}</tr>)}</tbody>
            </table>
            {(selectedStaff.length > 8 || selectedProducts.length > 8) && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Showing the first 8 of {selectedStaff.length} executives and first 8 of {selectedProducts.length} products. The save applies the full selection.</p>}
          </div> : <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Select at least one executive and product to preview the assignment matrix.</p>}
        </CardContent>
      </Card>

      <Card className="mt-7">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle>Saved assignments ({assignmentTotal})</CardTitle><p className="mt-1 text-sm text-slate-500">Search, filter and page through saved records; the server only loads this page.</p></div>
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(220px,320px)_160px_170px]">
              <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><Input value={assignmentSearch} onChange={event => { setAssignmentSearch(event.target.value); setAssignmentPage(1); }} placeholder="Search executive or product" className="pl-9" /></div>
              <Select aria-label="Filter assignments by branch" value={branchFilter} onChange={event => { setBranchFilter(event.target.value); setAssignmentPage(1); setStaffPage(1); }}><option value="all">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>
              <Select aria-label="Filter assignments by status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setAssignmentPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
            </div>
          </div>
          {selectedAssignmentIds.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <span className="mr-auto text-sm font-bold text-slate-800">{selectedAssignmentIds.length} selected across pages</span>
            <Select aria-label="Bulk edit assignment status" value={bulkStatus} onChange={event => setBulkStatus(event.target.value)} className="w-full sm:w-44"><option value="">Keep current status</option><option value="active">Set active</option><option value="inactive">Set inactive</option></Select>
            <Select aria-label="Bulk reassign executive" value={bulkExecutiveId} onChange={event => setBulkExecutiveId(event.target.value)} className="w-full sm:w-56"><option value="">Keep current executive</option>{selectedStaff.map(user => <option key={user.id} value={user.id}>{user.fullName}{user.branchName ? ` · ${user.branchName}` : ""}</option>)}</Select>
            <Select aria-label="Bulk reassign product" value={bulkProductId} onChange={event => setBulkProductId(event.target.value)} className="w-full sm:w-56"><option value="">Keep current product</option>{selectedProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</Select>
            <Button type="button" variant="secondary" disabled={bulkSaving || (!bulkStatus && !bulkExecutiveId && !bulkProductId) || selectedAssignmentIds.length > 500} onClick={() => void applyBulkEdit()}>{bulkSaving && <Loader2 size={14} className="animate-spin" />}Update selected</Button>
            <Button type="button" variant="destructive" disabled={bulkSaving || selectedAssignmentIds.length > 500} onClick={deleteSelectedAssignments}><Trash2 size={14} />Delete selected</Button>
            <Button type="button" variant="ghost" onClick={() => setSelectedAssignmentIds([])}>Clear selection</Button>
            <p className="w-full text-xs text-slate-600">Optional replacements come from the searchable selectors above. If a change creates a duplicate pairing, the server rejects it without saving.</p>
          </div>}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-12 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading this page of assignments…</div> : <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3"><Checkbox aria-label="Select all assignments on this page" checked={rows.length > 0 && rows.every(row => selectedAssignmentIds.includes(row.id))} onChange={toggleAllVisibleAssignments} /></th><th className="px-4 py-3">Sales Executive</th><th className="px-4 py-3">Contact / branch</th><th className="px-4 py-3">Assigned product</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Saved</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><Checkbox aria-label={`Select ${row.salesExecutiveName} assignment`} checked={selectedAssignmentIds.includes(row.id)} onChange={() => toggleAssignmentSelection(row.id)} /></td><td className="px-4 py-4"><p className="font-bold text-slate-900">{row.salesExecutiveName}</p><p className="mt-1 text-xs text-slate-500">{row.territory ?? row.branchName ?? "Territory not set"}</p></td><td className="px-4 py-4 text-xs text-slate-600"><p className="flex items-center gap-1.5"><Phone size={13} />{row.phone ?? "—"}</p><p className="mt-1 flex items-center gap-1.5"><Mail size={13} />{row.email ?? "—"}</p><p className="mt-1 flex items-center gap-1.5"><MapPin size={13} />{row.branchName ?? "Branch not assigned"}</p></td><td className="px-4 py-4">{row.productName ? <><p className="font-semibold text-slate-800">{row.productName}</p><p className="mt-1 text-xs text-slate-500">SKU {row.productSku ?? "—"}</p></> : <><p className="font-semibold text-slate-800">{row.categoryName}</p><p className="mt-1 text-xs text-amber-700">Legacy category</p></>}</td><td className="px-4 py-4"><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${row.salesExecutiveName} assignment`} onClick={() => startEdit(row)}><Edit3 size={15} /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${row.salesExecutiveName} assignment`} disabled={deletingId === row.id} onClick={() => remove(row.id, `${row.salesExecutiveName} · ${row.productName ?? row.categoryName ?? "assignment"}`)}>{deletingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</Button></div></td></tr>)}</tbody>
              </table>
              {!rows.length && <p className="px-5 py-12 text-center text-sm text-slate-500">No saved assignments match these filters.</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>Page {assignmentPage} of {Math.max(assignmentTotalPages, 1)} · {assignmentTotal} total</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={assignmentPage <= 1 || loading} onClick={() => setAssignmentPage(page => Math.max(1, page - 1))}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={assignmentPage >= assignmentTotalPages || loading} onClick={() => setAssignmentPage(page => page + 1)}>Next</Button></div></div>
          </>}
        </CardContent>
      </Card>
    </div>
  </AdminShell>;
}

function SelectionPanel({ title, count, search, onSearch, placeholder, onSelectAll, onDeselectAll, page, totalPages, onPageChange, children }: { title: string; count: number; search: string; onSearch: (value: string) => void; placeholder: string; onSelectAll: () => void; onDeselectAll: () => void; page: number; totalPages: number; onPageChange: (page: number) => void; children: React.ReactNode }) {
  return <section><div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-sm font-extrabold text-slate-900">{title} <span className="text-[#003893]">({count} selected)</span></h2><div className="flex w-full flex-wrap gap-1 sm:w-auto"><Button type="button" variant="ghost" size="xs" onClick={onSelectAll}><CheckSquare size={13} />Select page</Button><Button type="button" variant="ghost" size="xs" onClick={onDeselectAll}>Deselect page</Button></div></div><div className="relative mb-3"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={event => onSearch(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-9`} /></div>{children}<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Page {page} of {Math.max(1, totalPages)} · {PAGE_SIZE} per request</span><div className="flex gap-1"><Button type="button" variant="outline" size="xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button><Button type="button" variant="outline" size="xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button></div></div></section>;
}
function Empty({ message }: { message: string }) { return <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{message}</p>; }
