"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminDashboardView } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AdminBranch,
  AdminReportFilters,
  AdminReportType,
  AdminProduct,
  CatalogBrand,
  CatalogCategory,
  Staff,
  downloadAdminReport,
  getAdminBranches,
  getAdminProducts,
  getAdminStaff,
  getCatalogBrands,
  getCatalogCategories,
} from "@/services/api";

const reportTypes: [AdminReportType, string][] = [
  ["orders", "Orders"],
  ["payments", "Payments"],
  ["customers", "Customers"],
  ["inventory", "Inventory"],
  ["products", "Products"],
  ["categories", "Categories"],
  ["prescriptions", "Prescriptions"],
  ["delivery", "Delivery"],
  ["branches", "Branches"],
  ["staff", "Staff"],
  ["coupons", "Coupons"],
  ["tax", "Tax"],
];
const statusOptions = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "UPLOADED",
  "OPEN",
  "RESOLVED",
  "PAID",
  "REFUNDED",
];
const paymentOptions = [
  "CASH_ON_DELIVERY",
  "ESEWA",
  "KHALTI",
  "BANK_TRANSFER",
  "CARD",
  "WALLET",
];

type ReportOptions = {
  branches: AdminBranch[];
  products: AdminProduct[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  staff: Staff[];
};
const emptyOptions: ReportOptions = {
  branches: [],
  products: [],
  categories: [],
  brands: [],
  staff: [],
};

export function AdminReportsView({
  superAdmin = false,
  supervisor = false,
}: {
  superAdmin?: boolean;
  supervisor?: boolean;
}) {
  const [type, setType] = useState<AdminReportType>("orders");
  const [format, setFormat] = useState<"csv" | "pdf">("pdf");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState<AdminReportFilters>({});
  const [options, setOptions] = useState(emptyOptions);
  const [busy, setBusy] = useState(false);
  const visibleReportTypes = supervisor
    ? reportTypes.filter(([value]) => !["coupons", "tax"].includes(value))
    : reportTypes;
  useEffect(() => {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return;
    let active = true;
    Promise.all([
      getAdminBranches(token, superAdmin, true).catch(() => [] as AdminBranch[]),
      getAdminProducts(token, { pageSize: 100 }, superAdmin, true)
        .then((response) => response.items)
        .catch(() => [] as AdminProduct[]),
      getCatalogCategories().catch(() => [] as CatalogCategory[]),
      getCatalogBrands().catch(() => [] as CatalogBrand[]),
      superAdmin
        ? getAdminStaff(token, true).catch(() => [] as Staff[])
        : Promise.resolve([] as Staff[]),
    ]).then(([branches, products, categories, brands, staff]) => {
      if (active) setOptions({ branches, products, categories, brands, staff });
    });
    return () => {
      active = false;
    };
  }, [superAdmin]);
  function setFilter(key: keyof AdminReportFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }
  async function exportReport() {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) {
      toast.error("Sign in again to export a report.");
      return;
    }
    setBusy(true);
    try {
      await downloadAdminReport(
        type,
        token,
        superAdmin,
        from || undefined,
        to || undefined,
        format,
        filters,
      );
      toast.success(`${type} ${format.toUpperCase()} report downloaded.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The report could not be exported.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminShell superAdmin={superAdmin} supervisor={supervisor}>
      <div className="mb-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
          Reports and analytics
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Business reporting
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Use database-backed filters and exports for operational reporting.
        </p>
      </div>
      <Card className="mb-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} className="text-[#DC143C]" />
            Export a report
          </CardTitle>
          <CardDescription>
            Choose a report, date range, and optional operational filters. PDF
            exports are formatted for sharing; CSV exports are ready for
            analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Report
              <select
                aria-label="Report type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as AdminReportType)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                {visibleReportTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Format
              <select
                aria-label="Report format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as "csv" | "pdf")
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              From
              <input
                aria-label="Report start date"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              />
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              To
              <input
                aria-label="Report end date"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              />
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Branch
              <select
                aria-label="Report branch"
                value={filters.branchId ?? ""}
                onChange={(event) => setFilter("branchId", event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All branches</option>
                {options.branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Product
              <select
                aria-label="Report product"
                value={filters.productId ?? ""}
                onChange={(event) => setFilter("productId", event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All products</option>
                {options.products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.sku}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Category
              <select
                aria-label="Report category"
                value={filters.categoryId ?? ""}
                onChange={(event) =>
                  setFilter("categoryId", event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All categories</option>
                {options.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Brand
              <select
                aria-label="Report brand"
                value={filters.brandId ?? ""}
                onChange={(event) => setFilter("brandId", event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All brands</option>
                {options.brands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Status
              <select
                aria-label="Report status"
                value={filters.status ?? ""}
                onChange={(event) => setFilter("status", event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All statuses</option>
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-600">
              Payment method
              <select
                aria-label="Report payment method"
                value={filters.paymentMethod ?? ""}
                onChange={(event) =>
                  setFilter("paymentMethod", event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                <option value="">All methods</option>
                {paymentOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            {superAdmin && (
              <label className="grid gap-2 text-xs font-bold text-slate-600">
                Staff
                <select
                  aria-label="Report staff member"
                  value={filters.staffId ?? ""}
                  onChange={(event) => setFilter("staffId", event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
                >
                  <option value="">All staff</option>
                  {options.staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName} · {item.role}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void exportReport()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              Download {format.toUpperCase()} report
            </Button>
            <p className="text-xs text-slate-500">
              Filters apply to the report datasets where the selected field is
              relevant.
            </p>
          </div>
        </CardContent>
      </Card>
      <AdminDashboardView superAdmin={superAdmin} />
    </AdminShell>
  );
}
