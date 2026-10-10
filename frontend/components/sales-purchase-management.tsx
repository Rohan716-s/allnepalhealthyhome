"use client";
import { RecordTable } from "@/components/entity-record-table";
/* This protected workspace hydrates browser auth/filter state and intentionally uses shared form props. */
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { EntityListWorkspace, EntityListPanel, EntityFormPanel, entityListPath, entitySaveComplete, routeEntityEdit, useEntityRecord, useEntityList } from "@/components/entity-list-panel";
import { FormSaveActions } from "@/components/form-save-actions";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Boxes, CircleDollarSign, CreditCard, FileDown, History, PackagePlus, Plus, Printer, Receipt, RefreshCw, RotateCcw, Search, Trash2, Wallet, XCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import { formatNepaliDate } from "@/lib/hrms-date-time";
import { formatPlatformDate, formatPlatformDateTime } from "@/lib/date-time";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { useSiteConfig } from "@/components/site-config-provider";
import { parseWorkspaceLabels, workspaceLabel } from "@/lib/workspace-labels";
import { staffToken, staffUser } from "@/components/staff-shell";
import { InventoryDepartmentPanel, type InventoryDepartmentView } from "@/components/inventory-department-panel";
import { FinancialVoucherPanel } from "@/components/financial-voucher-panel";
import { hasCommercePermission, canUseCommerceAction } from "@/lib/sales-purchase-permissions";
import { AccountSetupPanel } from "@/components/account-setup-panel";
import { PharmacyModuleMenu, PHARMACY_WORKSPACE_ACTIONS, salesReports, salesReturnReports, type PharmacyMenuAction } from "@/components/pharmacy-module-menu";
import { ReferenceReportPanel } from "@/components/reference-report-panel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalesReverseEntryPanel } from "@/components/sales-reverse-entry-panel";
import {
  createCommerceCustomerPayment,
  createCommercePurchase,
  createCommercePurchaseReturn,
  createCommerceSale,
  createCommerceSalesReturn,
  createCommerceSupplierPayment,
  downloadAdminReport,
  getCommerceBranches,
  getAccountingSummary,
  getCommerceCreditLedger,
  getCommerceCustomers,
  getCommerceInventory,
  getCommerceProductHistory,
  getCommerceProducts,
  getCommercePurchaseReturns,
  getCommercePurchases,
  getCommerceSales,
  getCommerceSaleByInvoice,
  getCommerceSalesReturns,
  getCommerceSummary,
  getCommerceSuppliers,
  getPharmacyPartyDiscounts,
  getPharmacySalesTemplates,
  getPharmacySupplierDiscounts,
  logoutSession,
  updateCommerceSale,
  type AdminBranch,
  type AccountingSummary,
  type CommerceCreditLedger,
  type CommerceInventory,
  type CommerceProduct,
  type CommerceProductHistoryRow,
  type CommercePurchase,
  type CommercePurchaseReturn,
  type CommerceSale,
  type CommerceSalesReturn,
  type CommerceSummary,
  type PharmacySalesTemplate,
  voidCommercePurchase,
  voidCommerceSale,
} from "@/services/api";

type Tab = "home" | "sales" | "purchases" | "inventory" | "credit" | "catalogue";
type RegisterFilter = "ALL" | "CASH" | "CREDIT";
type SalesWorkspaceScreen = "entry" | "register" | "return";
type Party = { id: string; name: string; email?: string; phone?: string; accountType?: string; address?: string; panNumber?: string; telephone?: string };
type Supplier = { id: string; name: string; phone?: string; email?: string };
type Line = { productId: string; quantity: string; unit?: string; unitCost?: string; batchNumber?: string; expiryDate?: string; inventoryId?: string; discountPercent?: string; bonusQuantity?: string };
const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function printArea(id: string) {
  const style = document.createElement("style");
  style.dataset.printArea = id;
  style.textContent = `@media print { body * { visibility: hidden !important; } #${id}, #${id} * { visibility: visible !important; } #${id} { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; height: auto !important; max-height: none !important; overflow: visible !important; background: white !important; } #${id} .invoice-copy { break-after: page; page-break-after: always; } #${id} .invoice-copy:last-child { break-after: auto; page-break-after: auto; } }`;
  document.head.append(style);
  window.addEventListener("afterprint", () => style.remove(), { once: true });
  window.print();
}
const roleKey = (role = "") => role.toUpperCase().replace(/[^A-Z]/g, "");
const paymentLabel = (value?: string) => value?.replaceAll("_", " ") || "—";
type UnitPurpose = "purchase" | "sales";
function productUnits(product: CommerceProduct | undefined, purpose: UnitPurpose) {
  if (!product) return [] as { name: string; multiplierToBase: number }[];
  const allowed = (unit: NonNullable<CommerceProduct["units"]>[number]) => purpose === "purchase" ? unit.isPurchaseUnit : unit.isSalesUnit;
  const configured = (product.units ?? []).filter(allowed).map((unit) => ({ name: unit.name, multiplierToBase: Math.max(1, unit.multiplierToBase) }));
  const primaryName = purpose === "purchase" ? product.purchaseUnit : product.salesUnit;
  const primaryMultiplier = purpose === "purchase" ? product.purchaseUnitToBase : product.salesUnitToBase;
  const options = [{ name: product.baseUnit || "piece", multiplierToBase: 1 }, ...configured];
  if (primaryName) {
    const primaryIndex = options.findIndex((unit) => unit.name.toLowerCase() === primaryName.toLowerCase());
    if (primaryIndex < 0) options.push({ name: primaryName, multiplierToBase: Math.max(1, primaryMultiplier || 1) });
    else options[primaryIndex] = { name: primaryName, multiplierToBase: primaryName.toLowerCase() === (product.baseUnit || "piece").toLowerCase() ? 1 : Math.max(1, primaryMultiplier || options[primaryIndex].multiplierToBase) };
  }
  return options.filter((unit, index) => options.findIndex((candidate) => candidate.name.toLowerCase() === unit.name.toLowerCase()) === index);
}
const defaultProductUnit = (product: CommerceProduct | undefined, purpose: UnitPurpose) => purpose === "purchase" ? product?.purchaseUnit || product?.baseUnit || "piece" : product?.salesUnit || product?.baseUnit || "piece";

export function SalesPurchaseManagement({ superAdmin = false, departmentView, workspaceBanner }: { superAdmin?: boolean; departmentView?: "sales" | "purchase"; workspaceBanner?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); const query = useSearchParams(); const routeForm = /\/(create|edit)$/.test(pathname);
  useEffect(() => { const action = PHARMACY_WORKSPACE_ACTIONS.find(x => x.section === query.get("section") && x.mode === query.get("mode") && (!query.get("title") || x.title === query.get("title"))); if (action) handleMenuAction(action, false); }, [query, pathname]);
  const siteConfig = useSiteConfig();
  const workspaceLabels = useMemo(() => parseWorkspaceLabels(siteConfig.settings["workspace.labels"]), [siteConfig.settings]);
  const labelFor = useCallback((label: string) => workspaceLabel(label, workspaceLabels), [workspaceLabels]);
  const user = staffUser();
  const token = staffToken();
  const role = roleKey(user?.role);
  const canSales = hasCommercePermission(user, "sales.view");
  const canSell = hasCommercePermission(user, "sales.manage");
  const canPurchase = hasCommercePermission(user, "purchase.view");
  const canPurchaseWrite = hasCommercePermission(user, "purchase.manage");
  const userPermissions = new Set(user?.permissions ?? []);
  const hasPermission = (key: string, fallbackRoles: string[]) => userPermissions.has(key) || (!user?.permissions?.length && fallbackRoles.includes(role));
  const canInventory = superAdmin || role === "SUPERADMIN" || hasPermission("inventory.view", ["ADMIN", "SUPERVISOR", "ACCOUNTANT", "PHARMACIST"]);
  const canInventoryWrite = superAdmin || role === "SUPERADMIN" || hasPermission("inventory.adjust", ["ADMIN", "SUPERVISOR"]);
  const canManageCatalog = superAdmin || role === "SUPERADMIN" || hasPermission("catalog.manage", ["ADMIN"]);
  const canCreatePurchaseDraft = canPurchase && (superAdmin || role === "SUPERADMIN" || hasPermission("inventory.valuation.view", ["ADMIN", "ACCOUNTANT"]));
  const canLedger = hasCommercePermission(user, "accounts.view");
  const canReadTrialBalance = hasCommercePermission(user, "journal.view");
  // A department route is the Medi Pro-style desktop workspace, not an implicit
  // transaction form. Users choose Cash/Credit Sales (or a Purchase action)
  // from the top menu; this keeps opening the department visually consistent
  // with the reference and avoids silently starting a sale on navigation.
  const [tab, setTab] = useState<Tab>("home");
  const [salesWorkspaceScreen, setSalesWorkspaceScreen] = useState<SalesWorkspaceScreen>("entry");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [branchId, setBranchId] = useState("");
  const [summary, setSummary] = useState<CommerceSummary | null>(null); const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]); const [customers, setCustomers] = useState<Party[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesTemplates, setSalesTemplates] = useState<PharmacySalesTemplate[]>([]);
  const [salesReferenceCode, setSalesReferenceCode] = useState("");
  const [customerCompanyDiscounts, setCustomerCompanyDiscounts] = useState<{ manufacturerId: string; discountPercent: number }[]>([]);
  const [supplierCompanyDiscounts, setSupplierCompanyDiscounts] = useState<{ manufacturerId: string; discountPercent: number }[]>([]);
  const [sales, setSales] = useState<CommerceSale[]>([]); const [purchases, setPurchases] = useState<CommercePurchase[]>([]); const [salesReturns, setSalesReturns] = useState<CommerceSalesReturn[]>([]); const [purchaseReturns, setPurchaseReturns] = useState<CommercePurchaseReturn[]>([]); const [inventory, setInventory] = useState<CommerceInventory[]>([]); const [credit, setCredit] = useState<CommerceCreditLedger | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [productSearch, setProductSearch] = useState(""); const [registerSearch, setRegisterSearch] = useState(""); const [registerProductId, setRegisterProductId] = useState("");
  const [productLookupOpen, setProductLookupOpen] = useState(false); const [productLookupQuery, setProductLookupQuery] = useState(""); const [productLookupRows, setProductLookupRows] = useState<CommerceProduct[]>([]); const [productLookupLoading, setProductLookupLoading] = useState(false); const [productLookupError, setProductLookupError] = useState(""); const [productLookupSelection, setProductLookupSelection] = useState<CommerceProduct | null>(null);
  const [productHistoryRows, setProductHistoryRows] = useState<CommerceProductHistoryRow[]>([]); const [productHistoryLoading, setProductHistoryLoading] = useState(false); const [productHistoryError, setProductHistoryError] = useState("");
  const [salesRegister, setSalesRegister] = useState<RegisterFilter>("ALL"); const [purchaseRegister, setPurchaseRegister] = useState<RegisterFilter>("ALL"); const [salesPaymentStatus, setSalesPaymentStatus] = useState(""); const [purchasePaymentStatus, setPurchasePaymentStatus] = useState(""); const [salesCustomerFilter, setSalesCustomerFilter] = useState(""); const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState("");
  const [salesCustomer, setSalesCustomer] = useState(""); const [walkInName, setWalkInName] = useState(""); const [walkInPhone, setWalkInPhone] = useState(""); const [salesMode, setSalesMode] = useState("CASH"); const [salesPaid, setSalesPaid] = useState(""); const [salesLines, setSalesLines] = useState<Line[]>([]); const [selectedSaleProduct, setSelectedSaleProduct] = useState(""); const [saleUnit, setSaleUnit] = useState(""); const [saleInventoryId, setSaleInventoryId] = useState(""); const [saleQuantity, setSaleQuantity] = useState("1"); const [saleDiscount, setSaleDiscount] = useState(""); const [saleBonus, setSaleBonus] = useState("0"); const [isInsuranceSale, setIsInsuranceSale] = useState(false); const [insuranceProvider, setInsuranceProvider] = useState(""); const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [editingSaleId, setEditingSaleId] = useState(""); const [openedSale, setOpenedSale] = useState<CommerceSale | null>(null);
  const [purchaseSupplier, setPurchaseSupplier] = useState(""); const [purchaseMode, setPurchaseMode] = useState("CASH"); const [purchasePaid, setPurchasePaid] = useState(""); const [purchaseLines, setPurchaseLines] = useState<Line[]>([]); const [selectedPurchaseProduct, setSelectedPurchaseProduct] = useState(""); const [purchaseUnit, setPurchaseUnit] = useState(""); const [purchaseQuantity, setPurchaseQuantity] = useState("1"); const [purchaseCost, setPurchaseCost] = useState(""); const [purchaseBatch, setPurchaseBatch] = useState(""); const [purchaseExpiry, setPurchaseExpiry] = useState(""); const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState(""); const [purchaseNotes, setPurchaseNotes] = useState("");
  const [customerPaymentParty, setCustomerPaymentParty] = useState(""); const [supplierPaymentParty, setSupplierPaymentParty] = useState(""); const [creditAmount, setCreditAmount] = useState(""); const [creditMethod, setCreditMethod] = useState("CASH"); const [creditBusy, setCreditBusy] = useState(false);
  const [saleReturnOrder, setSaleReturnOrder] = useState(""); const [saleReturnProduct, setSaleReturnProduct] = useState(""); const [saleReturnQty, setSaleReturnQty] = useState("1"); const [saleReturnReason, setSaleReturnReason] = useState(""); const [saleReturnRefundMethod, setSaleReturnRefundMethod] = useState<"CASH" | "CREDIT">("CREDIT"); const [purchaseReturnInventory, setPurchaseReturnInventory] = useState(""); const [purchaseReturnSupplier, setPurchaseReturnSupplier] = useState(""); const [purchaseReturnQty, setPurchaseReturnQty] = useState("1"); const [purchaseReturnReason, setPurchaseReturnReason] = useState("");
  const [saleReturnExpired, setSaleReturnExpired] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<CommerceSale | null>(null);
  const [selectedReport, setSelectedReport] = useState<PharmacyMenuAction | null>(null);
  const [salesRegisterDialogOpen, setSalesRegisterDialogOpen] = useState(false);
  const [salesRegisterDialogTab, setSalesRegisterDialogTab] = useState<"sales" | "returns">("sales");
  const [salesRegisterDialogFunction, setSalesRegisterDialogFunction] = useState<"Cash" | "Credit" | "Super" | "Issue" | "CP">("Cash");
  const [salesRegisterDialogReport, setSalesRegisterDialogReport] = useState(salesReports[0]);
  const [salesRegisterAllFirm, setSalesRegisterAllFirm] = useState(false);
  const [reverseEntryOpen, setReverseEntryOpen] = useState(false);
  const [financialAction, setFinancialAction] = useState<PharmacyMenuAction | null>(null);
  const [accountSetupAction, setAccountSetupAction] = useState<PharmacyMenuAction | null>(null);
  const [accountingSummary, setAccountingSummary] = useState<AccountingSummary | null>(null);
  const [inventoryInitialView, setInventoryInitialView] = useState<InventoryDepartmentView>("stock");
  const [inventorySetupTitle, setInventorySetupTitle] = useState("");
  const [inventoryViewRequest, setInventoryViewRequest] = useState(0);

  useEffect(() => { const today = getPlatformDateInput(); setFrom(`${today.slice(0, 8)}01`); setTo(today); if (!superAdmin && user?.branchId) setBranchId(user.branchId); }, [superAdmin, user?.branchId]);
  const load = useCallback(async () => {
    if (!token || !from || !to) return;
    setBusy(true); setError("");
    try {
      const common = { from, to, branchId: branchId || undefined, search: registerSearch || undefined, productId: registerProductId || undefined };
      const [sum, branchRows, productRows, customerRows, supplierRows, saleRows, purchaseRows, saleReturnRows, purchaseReturnRows, inventoryRows, ledger] = await Promise.all([
        getCommerceSummary(token, { from, to, branchId: branchId || undefined }, superAdmin), getCommerceBranches(token, superAdmin), getCommerceProducts(token, productSearch || undefined, branchId || undefined, superAdmin), canSales || canLedger ? getCommerceCustomers(token, undefined, superAdmin) : Promise.resolve([] as Party[]), canPurchase || canLedger ? getCommerceSuppliers(token, undefined, superAdmin) : Promise.resolve([] as Supplier[]),
        canSales ? getCommerceSales(token, { ...common, paymentMethod: salesRegister === "ALL" ? undefined : salesRegister, paymentStatus: salesPaymentStatus || undefined, customerId: salesCustomerFilter || undefined }, superAdmin) : Promise.resolve([] as CommerceSale[]),
        canPurchase ? getCommercePurchases(token, { ...common, paymentMethod: purchaseRegister === "ALL" ? undefined : purchaseRegister, paymentStatus: purchasePaymentStatus || undefined, supplierId: purchaseSupplierFilter || undefined }, superAdmin) : Promise.resolve([] as CommercePurchase[]),
        canSales ? getCommerceSalesReturns(token, { from, to, branchId: branchId || undefined, search: registerSearch || undefined }, superAdmin) : Promise.resolve([] as CommerceSalesReturn[]), canPurchase ? getCommercePurchaseReturns(token, { from, to, branchId: branchId || undefined, supplierId: purchaseSupplierFilter || undefined, search: registerSearch || undefined }, superAdmin) : Promise.resolve([] as CommercePurchaseReturn[]),
        canInventory ? getCommerceInventory(token, branchId || undefined, undefined, superAdmin) : Promise.resolve([] as CommerceInventory[]), canLedger ? getCommerceCreditLedger(token, superAdmin, branchId || undefined) : Promise.resolve(null),
      ]);
      setSummary(sum); setBranches(branchRows); setProducts(productRows); setCustomers(customerRows); setSuppliers(supplierRows); setSales(saleRows); setPurchases(purchaseRows); setSalesReturns(saleReturnRows); setPurchaseReturns(purchaseReturnRows); setInventory(inventoryRows); setCredit(ledger);
    } catch (e) { setError(e instanceof Error ? e.message : "Sales and purchase data could not be loaded."); } finally { setBusy(false); }
  }, [token, from, to, branchId, productSearch, registerSearch, registerProductId, salesRegister, purchaseRegister, salesPaymentStatus, purchasePaymentStatus, salesCustomerFilter, purchaseSupplierFilter, superAdmin, canPurchase, canInventory, canLedger, canSales]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!token || !canReadTrialBalance) { setAccountingSummary(null); return; }
    let current = true;
    void getAccountingSummary(token, from, to).then((result) => { if (current) setAccountingSummary(result); }).catch(() => { if (current) setAccountingSummary(null); });
    return () => { current = false; };
  }, [canReadTrialBalance, departmentView, from, to, token]);
  useEffect(() => {
    if (!token || !canSales) { setSalesTemplates([]); return; }
    let current = true;
    void getPharmacySalesTemplates(token, superAdmin).then((rows) => { if (current) setSalesTemplates(rows); }).catch(() => { if (current) setSalesTemplates([]); });
    return () => { current = false; };
  }, [canSales, departmentView, superAdmin, token]);
  useEffect(() => {
    const canSearchProducts = !selectedReport && !accountSetupAction && !reverseEntryOpen && !openedSale && !lastInvoice && !salesRegisterDialogOpen && (
      tab === "home" || (tab === "sales" && salesWorkspaceScreen === "entry") || tab === "purchases"
    );
    if (!canSearchProducts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F9" || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      setProductLookupQuery("");
      setProductLookupError("");
      setProductLookupOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accountSetupAction, lastInvoice, openedSale, reverseEntryOpen, salesMode, salesRegisterDialogOpen, salesWorkspaceScreen, selectedReport, tab]);
  useEffect(() => {
    if (!productLookupOpen || !token) return;
    let active = true;
    setProductLookupLoading(true);
    setProductLookupError("");
    const timer = window.setTimeout(() => {
      void getCommerceProducts(token, productLookupQuery.trim() || undefined, branchId || undefined, superAdmin)
        .then((rows) => { if (active) setProductLookupRows(rows); })
        .catch((cause: unknown) => {
          if (active) {
            setProductLookupRows([]);
            setProductLookupError(cause instanceof Error ? cause.message : "Product search could not be loaded.");
          }
        })
        .finally(() => { if (active) setProductLookupLoading(false); });
    }, productLookupQuery.trim() ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, productLookupOpen, productLookupQuery, superAdmin, token]);
  useEffect(() => {
    if (!productLookupOpen || !productLookupSelection || !token) {
      setProductHistoryRows([]); setProductHistoryError(""); setProductHistoryLoading(false);
      return;
    }
    let current = true;
    setProductHistoryLoading(true); setProductHistoryError("");
    void getCommerceProductHistory(token, productLookupSelection.id, branchId || undefined, superAdmin)
      .then((rows) => { if (current) setProductHistoryRows(rows); })
      .catch((cause: unknown) => { if (current) { setProductHistoryRows([]); setProductHistoryError(cause instanceof Error ? cause.message : "Product history could not be loaded."); } })
      .finally(() => { if (current) setProductHistoryLoading(false); });
    return () => { current = false; };
  }, [branchId, productLookupOpen, productLookupSelection, superAdmin, token]);
  useEffect(() => {
    if (!token || !salesCustomer) { setCustomerCompanyDiscounts([]); return; }
    let current = true;
    void getPharmacyPartyDiscounts(token, superAdmin, salesCustomer).then((rows) => {
      if (!current) return;
      const today = getPlatformDateInput();
      setCustomerCompanyDiscounts(rows.filter((row) => row.isActive && (!row.startsAt || row.startsAt.slice(0, 10) <= today) && (!row.endsAt || row.endsAt.slice(0, 10) >= today)));
    }).catch(() => { if (current) setCustomerCompanyDiscounts([]); });
    return () => { current = false; };
  }, [salesCustomer, superAdmin, token]);
  useEffect(() => {
    if (!token || !purchaseSupplier) { setSupplierCompanyDiscounts([]); return; }
    let current = true;
    void getPharmacySupplierDiscounts(token, superAdmin, purchaseSupplier).then((rows) => {
      if (!current) return;
      const today = getPlatformDateInput();
      setSupplierCompanyDiscounts(rows.filter((row) => row.isActive && (!row.startsAt || row.startsAt.slice(0, 10) <= today) && (!row.endsAt || row.endsAt.slice(0, 10) >= today)));
    }).catch(() => { if (current) setSupplierCompanyDiscounts([]); });
    return () => { current = false; };
  }, [purchaseSupplier, superAdmin, token]);
  const selectedSale = useMemo(() => products.find((x) => x.id === selectedSaleProduct), [products, selectedSaleProduct]);
  const selectedPurchase = useMemo(() => products.find((x) => x.id === selectedPurchaseProduct), [products, selectedPurchaseProduct]);
  const salesSubtotal = useMemo(() => salesLines.reduce((sum, line) => { const p = products.find((x) => x.id === line.productId); const companyDiscount = customerCompanyDiscounts.find((rule) => rule.manufacturerId === p?.manufacturerId)?.discountPercent ?? 0; const discount = Math.min(100, Number(p?.discountPercent || 0) + Number(line.discountPercent || 0) + companyDiscount); const selectedMultiplier = productUnits(p, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1; const defaultMultiplier = Math.max(1, p?.salesUnitToBase || 1); return sum + Math.max(0, Number(p?.salePrice || 0) * selectedMultiplier / defaultMultiplier * (1 - discount / 100) * Number(line.quantity || 0)); }, 0), [customerCompanyDiscounts, products, salesLines]);
  const salesTaxRate = products[0]?.invoiceTaxRate ?? 13;
  const salesTax = Math.round(salesSubtotal * salesTaxRate) / 100;
  const salesTotal = salesSubtotal + salesTax;
  const purchaseTotal = useMemo(() => purchaseLines.reduce((sum, line) => { const product = products.find((row) => row.id === line.productId); const discount = supplierCompanyDiscounts.find((rule) => rule.manufacturerId === product?.manufacturerId)?.discountPercent ?? 0; return sum + Number(line.quantity || 0) * Number(line.unitCost || 0) * (1 - discount / 100); }, 0), [products, purchaseLines, supplierCompanyDiscounts]);
  function addSaleLine() {
    if (!selectedSaleProduct || Number(saleQuantity) <= 0 || Number(saleBonus) < 0) return toast.error("Choose a product and valid quantity.");
    if (salesLines.some((line) => line.productId === selectedSaleProduct)) return toast.error("This product is already on the bill. Edit its existing line instead.");
    const selectedBatch = selectedSale?.batches?.find((batch) => batch.inventoryId === saleInventoryId) ?? selectedSale?.batches?.find((batch) => !branchId || batch.branchId === branchId);
    const multiplier = productUnits(selectedSale, "sales").find((unit) => unit.name === (saleUnit || defaultProductUnit(selectedSale, "sales")))?.multiplierToBase ?? 1;
    if (!selectedBatch) return toast.error("No saleable batch is available at the selected branch. Refresh the product search or choose another branch.");
    if (selectedBatch && (Number(saleQuantity) + Number(saleBonus)) * multiplier > selectedBatch.availableQuantity) return toast.error(`Selected batch has only ${selectedBatch.availableQuantity} base units available.`);
    if (selectedBatch.branchId && branchId !== selectedBatch.branchId) setBranchId(selectedBatch.branchId);
    setSalesLines((x) => [...x, { productId: selectedSaleProduct, quantity: saleQuantity, unit: saleUnit || defaultProductUnit(selectedSale, "sales"), inventoryId: selectedBatch?.inventoryId, batchNumber: selectedBatch?.batchNumber, expiryDate: selectedBatch?.expiryDate, discountPercent: saleDiscount, bonusQuantity: saleBonus }]); setSelectedSaleProduct(""); setSaleUnit(""); setSaleInventoryId(""); setSaleQuantity("1"); setSaleDiscount(""); setSaleBonus("0");
  }
  function applySalesTemplate(templateId: string) {
    const template = salesTemplates.find((row) => row.id === templateId);
    if (!template) return;
    const available = template.lines.filter((line) => products.some((product) => product.id === line.productId));
    if (!available.length) return toast.error("This template has no products available in your current role or branch.");
    const mapped = available.map((line) => ({ productId: line.productId, quantity: String(line.quantity), unit: line.unit || defaultProductUnit(products.find((product) => product.id === line.productId), "sales"), discountPercent: String(line.discountPercent), bonusQuantity: String(line.bonusQuantity) }));
    setSalesLines(mapped); setSalesCustomer("");
    if (available.length !== template.lines.length) toast.warning("Unavailable template products were skipped for your current role or branch.");
    else toast.success(`Loaded ${template.name} into the bill.`);
  }
  function clearSaleForm() { setEditingSaleId(""); setSalesLines([]); setSalesCustomer(""); setSalesPaid(""); setWalkInName(""); setWalkInPhone(""); setInsuranceProvider(""); setInsurancePolicyNumber(""); setIsInsuranceSale(false); setSalesReferenceCode(""); setSelectedSaleProduct(""); setSaleUnit(""); setSaleInventoryId(""); }
  useEntityRecord(sales,beginSaleEdit);
  async function beginSaleEdit(sale: CommerceSale) {
    if(routeEntityEdit(sale.id))return;
    if (!sale.number.startsWith("ANHH-POS-") || sale.status === "CANCELLED" || sale.paymentStatus === "VOID") return toast.error("Only an active POS invoice can be corrected here.");
    setBusy(true);
    try {
      const missing = sale.items.filter((item) => !products.some((product) => product.id === item.productId));
      const fetched = (await Promise.all(missing.map((item) => getCommerceProducts(token, item.product, sale.branchId, superAdmin).catch(() => [])))).flat();
      const catalog = [...products, ...fetched].filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index);
      if (sale.items.some((item) => !catalog.some((product) => product.id === item.productId))) return toast.error("One or more products on this invoice are no longer available for correction.");
      const companyRules = sale.customerId && !sale.walkIn ? await getPharmacyPartyDiscounts(token, superAdmin, sale.customerId).catch(() => []) : [];
      const today = getPlatformDateInput();
      const activeRules = companyRules.filter((rule) => rule.isActive && (!rule.startsAt || rule.startsAt.slice(0, 10) <= today) && (!rule.endsAt || rule.endsAt.slice(0, 10) >= today));
      setProducts(catalog); setCustomerCompanyDiscounts(activeRules);
      const lines = sale.items.map((item) => {
        const product = catalog.find((row) => row.id === item.productId)!;
        const unit = item.unit || defaultProductUnit(product, "sales");
        const selectedMultiplier = productUnits(product, "sales").find((option) => option.name === unit)?.multiplierToBase ?? 1;
        const defaultMultiplier = Math.max(1, product.salesUnitToBase || 1);
        const undiscounted = Number(product.salePrice || 0) * selectedMultiplier / defaultMultiplier;
        const actualDiscount = undiscounted > 0 ? Math.max(0, (1 - item.unitPrice / undiscounted) * 100) : 0;
        const builtInDiscount = Number(product.discountPercent || 0) + Number(activeRules.find((rule) => rule.manufacturerId === product.manufacturerId)?.discountPercent || 0);
        const editableDiscount = Math.max(0, Math.min(100, actualDiscount - builtInDiscount));
        return { productId: item.productId, quantity: String(item.quantity), unit, bonusQuantity: String(item.bonusQuantity ?? 0), discountPercent: editableDiscount > 0.005 ? editableDiscount.toFixed(2) : "" };
      });
      setEditingSaleId(sale.id); setOpenedSale(null); setTab("sales"); setSalesWorkspaceScreen("entry"); setSelectedReport(null);
      setSalesCustomer(sale.walkIn ? "" : sale.customerId || ""); setWalkInName(sale.walkIn ? sale.customer : ""); setWalkInPhone(sale.walkIn ? sale.customerPhone || "" : "");
      setSalesMode(sale.paymentMethod || "CASH"); setSalesPaid(String(sale.paidAmount ?? 0)); setSalesLines(lines); setSalesReferenceCode(sale.referenceCode || "");
      setIsInsuranceSale(Boolean(sale.insuranceProvider)); setInsuranceProvider(sale.insuranceProvider || ""); setInsurancePolicyNumber(sale.insurancePolicyNumber || "");
      setBranchId(sale.branchId || branchId);
      toast.info(`Invoice ${sale.invoiceNumber || sale.number} opened for correction. Review the live catalog prices before saving.`);
      window.setTimeout(() => document.getElementById("sales-pos-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) { toast.error(error instanceof Error ? error.message : "The invoice could not be opened."); }
    finally { setBusy(false); }
  }
  function changePurchaseUnit(nextUnit: string) { if (selectedPurchase && purchaseUnit && purchaseCost) { const units = productUnits(selectedPurchase, "purchase"); const previousMultiplier = units.find((unit) => unit.name === purchaseUnit)?.multiplierToBase ?? 1; const nextMultiplier = units.find((unit) => unit.name === nextUnit)?.multiplierToBase ?? 1; setPurchaseCost((Number(purchaseCost) / previousMultiplier * nextMultiplier).toFixed(2)); } setPurchaseUnit(nextUnit); }
  function addPurchaseLine() { if (!selectedPurchaseProduct || Number(purchaseQuantity) <= 0 || Number(purchaseCost) < 0) return toast.error("Choose a product, quantity and purchase rate."); const batch = purchaseBatch.trim(); if (purchaseLines.some((line) => line.productId === selectedPurchaseProduct && (line.batchNumber ?? "").trim().toLowerCase() === batch.toLowerCase())) return toast.error("This product and batch are already on the receipt."); setPurchaseLines((x) => [...x, { productId: selectedPurchaseProduct, quantity: purchaseQuantity, unit: purchaseUnit || defaultProductUnit(selectedPurchase, "purchase"), unitCost: purchaseCost, batchNumber: batch, expiryDate: purchaseExpiry || undefined }]); setSelectedPurchaseProduct(""); setPurchaseUnit(""); setPurchaseQuantity("1"); setPurchaseCost(""); setPurchaseBatch(""); setPurchaseExpiry(""); }
  async function submitSale() {
    if (!canSell) { toast.error("Your role cannot save this transaction."); return; }
    if (!salesLines.length) return toast.error("Add products to the bill first.");
    if (isInsuranceSale && !insuranceProvider.trim()) return toast.error("Enter the insurance provider for this sale.");
    const saleInput = { customerId: salesCustomer || undefined, walkInName: walkInName || undefined, walkInPhone: walkInPhone || undefined, branchId: editingSaleId ? openedSale?.branchId || branchId || undefined : branchId || undefined, paymentMode: salesMode, paidAmount: salesPaid ? Number(salesPaid) : undefined, referenceCode: salesReferenceCode.trim() || undefined, insuranceProvider: isInsuranceSale ? insuranceProvider.trim() : undefined, insurancePolicyNumber: isInsuranceSale ? insurancePolicyNumber.trim() || undefined : undefined, items: salesLines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unit: line.unit, inventoryId: line.inventoryId, discountPercent: line.discountPercent ? Number(line.discountPercent) : undefined, bonusQuantity: line.bonusQuantity ? Number(line.bonusQuantity) : 0 })) };
    const invoiceSnapshot = (result: { orderId: string; invoiceNumber: string; total: number; paid: number; paymentStatus: string }): CommerceSale => {
      const party = customers.find((customer) => customer.id === salesCustomer);
      const items = salesLines.flatMap((line) => {
        const product = products.find((item) => item.id === line.productId);
        if (!product) return [];
        const multiplier = productUnits(product, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1;
        const baseMultiplier = Math.max(1, product.salesUnitToBase || 1);
        const discount = Math.min(100, Number(product.discountPercent || 0) + Number(line.discountPercent || 0) + Number(customerCompanyDiscounts.find((rule) => rule.manufacturerId === product.manufacturerId)?.discountPercent || 0));
        return [{ productId: product.id, product: product.name, quantity: Number(line.quantity), bonusQuantity: Number(line.bonusQuantity || 0), unit: line.unit, unitPrice: product.salePrice * multiplier / baseMultiplier * (1 - discount / 100) }];
      });
      const beforeDiscount = salesLines.reduce((sum, line) => {
        const product = products.find((item) => item.id === line.productId);
        const multiplier = productUnits(product, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1;
        return sum + (product?.salePrice ?? 0) * multiplier / Math.max(1, product?.salesUnitToBase || 1) * Number(line.quantity || 0);
      }, 0);
      const totalPaid = result.paid;
      const resolvedBranchId = saleInput.branchId;
      return {
        id: result.orderId, number: result.invoiceNumber, invoiceNumber: result.invoiceNumber, customerId: salesCustomer || undefined,
        customer: party?.name || walkInName.trim() || "Walk-in customer", customerPhone: party?.telephone || party?.phone || walkInPhone || undefined,
        walkIn: !salesCustomer, date: getPlatformDateInput(), branchId: resolvedBranchId,
        branch: branches.find((branch) => branch.id === resolvedBranchId)?.name, status: "POSTED", paymentStatus: result.paymentStatus,
        paymentMethod: salesMode, total: result.total, subtotal: salesSubtotal, taxAmount: salesTax,
        discountAmount: Math.max(0, beforeDiscount - salesSubtotal), paidAmount: totalPaid, items,
      };
    };
    if (editingSaleId) {
      const id = editingSaleId;
      requestSiteConfirmation({ title: "Save sale corrections?", message: "The same invoice will be updated. Stock, batch movements, payments and the customer ledger will be reversed and recalculated. A correction reason is required for the audit record.", inputLabel: "Correction reason", inputPlaceholder: "Explain why this invoice is being corrected", inputRequired: true, confirmLabel: "Save corrections", tone: "danger", onConfirm: async (_checked, reason) => {
        setBusy(true);
        try {
          const r = await updateCommerceSale(token, id, { sale: saleInput, reason: reason?.trim() || "" }, superAdmin);
          const updatedInvoice = await getCommerceSaleByInvoice(token, r.invoiceNumber, superAdmin).catch(() => invoiceSnapshot(r));
          setLastInvoice(updatedInvoice); clearSaleForm(); toast.success(`Invoice ${r.invoiceNumber} corrected.`); await load();
         entitySaveComplete(); } catch (error) { toast.error(error instanceof Error ? error.message : "The sale could not be corrected."); }
        finally { setBusy(false); }
      } });
      return;
    }
    setBusy(true);
    try { const r = await createCommerceSale(token, saleInput, superAdmin); const savedInvoice = await getCommerceSaleByInvoice(token, r.invoiceNumber, superAdmin).catch(() => invoiceSnapshot(r)); setLastInvoice(savedInvoice); toast.success(`Bill ${r.invoiceNumber} saved.`); clearSaleForm(); await load();  entitySaveComplete(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The sale could not be saved."); }
    finally { setBusy(false); }
  }
  function cancelSaleEdit() { clearSaleForm(); toast.info("Sale correction cancelled; the saved invoice is unchanged."); }
  async function submitPurchase() {
    if (!canPurchaseWrite) { toast.error("Your role cannot save this transaction."); return; } if (!purchaseSupplier || !branchId || !purchaseLines.length) return toast.error("Choose supplier, branch and purchase items."); setBusy(true); try { const r = await createCommercePurchase(token, { supplierId: purchaseSupplier, branchId, paymentMode: purchaseMode, paidAmount: purchasePaid ? Number(purchasePaid) : undefined, supplierInvoiceNumber: purchaseInvoiceNumber || undefined, notes: purchaseNotes || undefined, items: purchaseLines.map((x) => ({ productId: x.productId, quantity: Number(x.quantity), unit: x.unit, unitCost: Number(x.unitCost), batchNumber: x.batchNumber || undefined, expiryDate: x.expiryDate })) }, superAdmin); toast.success(`Receipt ${r.invoiceNumber} saved and stock updated.`); setPurchaseLines([]); setPurchasePaid(""); setPurchaseInvoiceNumber(""); setPurchaseNotes(""); await load();  entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : "The purchase could not be saved."); } finally { setBusy(false); } }
  async function submitCreditPayment(kind: "customer" | "supplier") { if (!hasCommercePermission(user, kind === "customer" ? "receipts.manage" : "journal.manage")) return toast.error("Your role cannot record this payment."); const party = kind === "customer" ? customerPaymentParty : supplierPaymentParty; if (!party || Number(creditAmount) <= 0) return toast.error("Choose a party and enter a positive amount."); setCreditBusy(true); try { const input = { amount: Number(creditAmount), method: creditMethod, branchId: branchId || undefined, paymentDate: to || undefined }; if (kind === "customer") await createCommerceCustomerPayment(token, { ...input, customerId: party }, superAdmin); else await createCommerceSupplierPayment(token, { ...input, supplierId: party }, superAdmin); toast.success("Payment recorded and the ledger balance was updated."); setCreditAmount(""); await load();  entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : "The payment could not be recorded."); } finally { setCreditBusy(false); } }
  function selectPurchaseReturnBatch(id: string) { setPurchaseReturnInventory(id); const row = inventory.find((item) => item.id === id); setPurchaseReturnSupplier(row?.supplierId ?? ""); }
  function submitSalesReturn() { const order = sales.find((x) => x.id === saleReturnOrder); const productId = saleReturnProduct || order?.items[0]?.productId; if (!order || !productId || Number(saleReturnQty) <= 0) return toast.error("Choose a sale, product and quantity."); if (!saleReturnReason.trim()) return toast.error("Enter a reason for the sales return."); requestSiteConfirmation({ title: saleReturnExpired ? "Process expired-goods return?" : "Process sales return?", message: saleReturnExpired ? "Returned units will be quarantined and excluded from saleable stock. The sale, return batch, invoice and customer ledger will be updated." : "This will return stock, reduce the invoice and apply the selected refund or credit adjustment.", confirmLabel: saleReturnExpired ? "Quarantine and return" : "Process return", tone: "danger", onConfirm: async () => { try { const r = await createCommerceSalesReturn(token, { orderId: order.id, productId, quantity: Number(saleReturnQty), reason: saleReturnReason.trim(), refundMethod: saleReturnRefundMethod, expiredReturn: saleReturnExpired }, superAdmin); toast.success(`Return ${r.returnNumber} saved.`); setSaleReturnOrder(""); setSaleReturnProduct(""); setSaleReturnReason(""); await load();  entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : "The sales return could not be saved."); } } }); }
  function submitPurchaseReturn() { const row = inventory.find((x) => x.id === purchaseReturnInventory); if (!row || !purchaseReturnSupplier || Number(purchaseReturnQty) <= 0 || !row.branchId) return toast.error("Choose a batch, supplier and quantity."); if (!purchaseReturnReason.trim()) return toast.error("Enter a reason for the purchase return."); requestSiteConfirmation({ title: "Process purchase return?", message: "This will remove the selected batch quantity and adjust the matching supplier payable where applicable.", confirmLabel: "Process return", tone: "danger", onConfirm: async () => { try { const r = await createCommercePurchaseReturn(token, { inventoryId: row.id, supplierId: purchaseReturnSupplier, branchId: row.branchId, quantity: Number(purchaseReturnQty), reason: purchaseReturnReason.trim() }, superAdmin); toast.success(`Return ${r.returnNumber} saved.`); setPurchaseReturnInventory(""); setPurchaseReturnSupplier(""); setPurchaseReturnReason(""); await load();  entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : "The purchase return could not be saved."); } } }); }
  function askVoid(kind: "sale" | "purchase", id: string, number: string) { requestSiteConfirmation({ title: `Void ${kind}?`, message: `Voiding ${number} will reverse its stock movement and remove its balance from the ledger. This cannot be undone.`, inputLabel: "Void reason", inputPlaceholder: "Explain why this transaction is being voided", inputRequired: true, confirmLabel: "Void transaction", tone: "danger", onConfirm: async (_checked, reason) => { try { if (kind === "sale") await voidCommerceSale(token, id, reason || "Operational correction", superAdmin); else await voidCommercePurchase(token, id, reason || "Operational correction", superAdmin); toast.success(`${number} was voided and stock/ledger were refreshed.`); await load();  entitySaveComplete(); } catch (e) { toast.error(e instanceof Error ? e.message : `The ${kind} could not be voided.`); } } }); }
  async function exportReport(format: "csv" | "pdf") { try { await downloadAdminReport(tab === "purchases" ? "inventory" : "orders", token, superAdmin, from, to, format, branchId ? { branchId } : {}); } catch (e) { toast.error(e instanceof Error ? e.message : "The report could not be exported."); } }

  function selectProductFromLookup(product: CommerceProduct) {
    setProducts((current) => current.some((row) => row.id === product.id) ? current : [product, ...current]);
    setProductSearch("");
    if (tab === "sales" && salesWorkspaceScreen === "entry") {
      setSelectedSaleProduct(product.id);
      setSaleUnit(defaultProductUnit(product, "sales"));
      setSaleInventoryId("");
      setProductLookupSelection(product);
      return;
    }
    const destination = tab === "home" ? "CASH" : tab === "purchases" ? "PURCHASE" : salesMode;
    if (destination === "PURCHASE") {
      setSelectedPurchaseProduct(product.id);
      setPurchaseUnit(defaultProductUnit(product, "purchase"));
      if (product.purchasePrice != null) setPurchaseCost(String(product.purchasePrice));
      if (tab === "home") setTab("purchases");
    } else {
      setSelectedSaleProduct(product.id);
      setSaleUnit(defaultProductUnit(product, "sales"));
      if (tab === "home") { setSalesMode(destination); setSalesWorkspaceScreen("entry"); setTab("sales"); }
    }
    setProductLookupOpen(false);
  }

  function chooseSalesProduct(product: CommerceProduct, inventoryId?: string) {
    const pickedBatch = product.batches?.find((batch) => batch.inventoryId === inventoryId);
    setProducts((current) => current.some((row) => row.id === product.id) ? current : [product, ...current]);
    setSelectedSaleProduct(product.id);
    setSaleUnit(defaultProductUnit(product, "sales"));
    setSaleInventoryId(inventoryId || "");
    if (pickedBatch?.branchId) setBranchId(pickedBatch.branchId);
    setProductLookupSelection(null);
    setProductLookupOpen(false);
  }

  function handleMenuAction(action: PharmacyMenuAction, navigate = true) {
    if (!canUseCommerceAction(user, action)) { toast.error("Your role does not have permission for this action."); return; }
    if (navigate) { const params = new URLSearchParams(); params.set("section", action.section); params.set("mode", action.mode); params.set("title", action.title); router.push(`${entityListPath(pathname)}?${params}`); return; }
    setFinancialAction(null);
    setTab("home");
    setReverseEntryOpen(false);
    setOpenedSale(null);
    setSalesRegisterDialogOpen(false);
    if (action.section === "account" || action.section === "journal") { setSelectedReport(null); setAccountSetupAction(null); setFinancialAction(action); return; }
    if (action.mode === "sales-register-picker") {
      setSalesRegisterDialogTab("sales");
      setSalesRegisterDialogFunction("Cash");
      setSalesRegisterDialogReport(salesReports[0]);
      setSalesRegisterAllFirm(false);
      setSalesRegisterDialogOpen(true);
      return;
    }
    if (action.section === "catalogue") { setTab("catalogue"); setSelectedReport(null); setAccountSetupAction(action); return; }
    setAccountSetupAction(null);
    if (["sales-return-cash", "sales-return-credit", "sales-return-cash-expired", "sales-return-credit-expired"].includes(action.mode)) {
      const creditReturn = action.mode.includes("credit");
      setTab("sales"); setSalesRegister(creditReturn ? "CREDIT" : "CASH"); setSalesPaymentStatus("");
      setSalesWorkspaceScreen("return"); setSaleReturnExpired(action.mode.endsWith("expired")); setSelectedReport(null); setSaleReturnOrder(""); setSaleReturnProduct("");
      return;
    }
    if (action.section === "inventory" && ["master", "stock", "movements", "opening-stock", "opening-stock-list"].includes(action.mode)) {
      setInventoryInitialView(action.mode === "opening-stock-list" ? "movements" : action.mode as InventoryDepartmentView); setInventorySetupTitle(action.mode === "master" || action.mode === "opening-stock-list" ? action.title : ""); setInventoryViewRequest((value) => value + 1); setTab("inventory"); setSelectedReport(null); return;
    }
    setTab(action.section);
    if (action.mode === "reverse-entry") {
      setReverseEntryOpen(true);
      return;
    }
    if (["report", "invoice-report", "credit-note-report", "sales-return-cancel", "purchase-return-cancel", "purchase-additional-info-edit", "purchase-modify", "purchase-mrn-report", "purchase-return-slip", "adjustment-slip", "adjustment-cancel", "stock", "analysis", "adjustments"].includes(action.mode)) {
      setSelectedReport(action);
      return;
    }
    setSelectedReport(null);
    if (action.mode === "cash-entry") { setSalesWorkspaceScreen(routeForm ? "entry" : "register"); setSalesMode("CASH"); setSalesRegister("ALL"); }
    if (action.mode === "credit-entry") { setSalesWorkspaceScreen(routeForm ? "entry" : "register"); setSalesMode("CREDIT"); setSalesRegister("ALL"); }
    if (action.mode === "cash-register") { setSalesWorkspaceScreen(routeForm ? "entry" : "register"); setSalesRegister("CASH"); }
    if (action.mode === "credit-register") { setSalesWorkspaceScreen(routeForm ? "entry" : "register"); setSalesRegister("CREDIT"); }
    if (action.mode === "sales-register") { setSalesWorkspaceScreen(routeForm ? "entry" : "register"); setSalesRegister("ALL"); }
    if (["entry", "register", "return"].includes(action.mode)) setPurchaseRegister("ALL");
  }

  function openSelectedSalesRegisterReport() {
    const isReturnReport = salesRegisterDialogTab === "returns";
    const reportTitle = salesRegisterDialogReport;
    const supportedPaymentFilter = salesRegisterDialogFunction === "Cash" || salesRegisterDialogFunction === "Credit";
    const canonicalTitle = !supportedPaymentFilter ? `${salesRegisterDialogFunction} · ${reportTitle}` : isReturnReport && !reportTitle.toLowerCase().includes("return") ? `Sales Return ${reportTitle}` : reportTitle;
    setSalesRegister(supportedPaymentFilter ? salesRegisterDialogFunction.toUpperCase() as RegisterFilter : "ALL");
    if (salesRegisterAllFirm && (superAdmin || role === "SUPERADMIN")) setBranchId("");
    setTab("sales");
    setAccountSetupAction(null);
    setSalesRegisterDialogOpen(false);
    setSelectedReport({
      section: "sales",
      mode: "report",
      title: canonicalTitle,
      displayTitle: labelFor(canonicalTitle),
    });
  }

  function requestExit() {
    if (departmentView) {
      requestSiteConfirmation({
        title: `Leave ${departmentView === "sales" ? "Sales" : "Purchase"} dashboard?`,
        message: "Return to the main management dashboard. Saved records are safe; unsaved form entries will be discarded.",
        confirmLabel: "Return to dashboard",
        onConfirm: () => router.replace(superAdmin || role === "SUPERADMIN" ? "/superadmin" : "/admin"),
      });
      return;
    }
    requestSiteConfirmation({ title: "Exit this workspace?", message: "Your staff session will be signed out on this device.", confirmLabel: "Exit", tone: "danger", onConfirm: async () => {
      try { if (token) await logoutSession(token); } catch { /* Complete local sign-out if the server is unreachable. */ }
      window.localStorage.removeItem("anhh-staff-access-token"); window.localStorage.removeItem("anhh-staff");
      window.dispatchEvent(new Event("anhh-auth-changed")); router.replace("/staff/login");
    } });
  }

  function prepareCorrectedPurchase(purchase: CommercePurchase) {
    const replacementLines = purchase.items.filter((item) => item.unitCost != null).map((item) => {
      return { productId: item.productId, quantity: String(item.quantity), unit: item.unit || "base", unitCost: String(item.unitCost ?? 0), batchNumber: item.batch ?? "", expiryDate: item.expiry?.slice(0, 10) ?? "" };
    });
    setTab("purchases"); setSelectedReport(null); setPurchaseSupplier(purchase.supplierId ?? ""); setPurchaseLines(replacementLines); setPurchaseMode(purchase.paymentMethod || "CASH"); setPurchasePaid("0"); setPurchaseInvoiceNumber(""); setPurchaseNotes(purchase.notes ?? "");
  }

  if (!user || !token) return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading sales and purchase workspace…</div>;
  const dashboardStats: { label: string; value: number | null; Icon: LucideIcon }[] = departmentView === "sales"
    ? [{ label: "Net sales", value: summary?.netSales ?? summary?.sales ?? 0, Icon: Receipt }, { label: "Cash collected", value: summary?.cashCollected ?? 0, Icon: CircleDollarSign }, { label: "Credit issued", value: summary?.creditIssued ?? 0, Icon: Wallet }, { label: "Returns", value: summary?.totalReturns ?? 0, Icon: RotateCcw }, { label: "Gross profit", value: summary?.profit ?? 0, Icon: CircleDollarSign }]
    : departmentView === "purchase"
      ? [{ label: "Purchases", value: summary?.purchases ?? 0, Icon: PackagePlus }, { label: "Payables", value: summary?.payables ?? 0, Icon: CreditCard }, { label: "Stock value", value: summary?.stockValue ?? null, Icon: Boxes }]
      : [{ label: "Net sales", value: summary?.netSales ?? summary?.sales ?? 0, Icon: Receipt }, { label: "Cash collected", value: summary?.cashCollected ?? 0, Icon: CircleDollarSign }, { label: "Credit issued", value: summary?.creditIssued ?? 0, Icon: Wallet }, { label: "Returns", value: summary?.totalReturns ?? 0, Icon: RotateCcw }, { label: "Purchases", value: summary?.purchases ?? 0, Icon: PackagePlus }, { label: "Stock value", value: summary?.stockValue ?? null, Icon: Boxes }, { label: "Gross profit", value: summary?.profit ?? 0, Icon: CircleDollarSign }, { label: "Payables", value: summary?.payables ?? 0, Icon: CreditCard }];
  const workspaceTitle = labelFor(departmentView === "sales" ? "Sales Department" : departmentView === "purchase" ? "Purchase Department" : "Operations Home");
  const workspaceDescription = labelFor(departmentView === "sales" ? "Billing, cash and credit sales, returns, invoices and sales reports." : departmentView === "purchase" ? "Supplier receipts, purchase returns, payment tracking and purchasing reports." : "Billing, procurement, live stock and Udharo in one workspace.");
  const productLookupDialog = <Dialog open={productLookupOpen} onOpenChange={(open) => { setProductLookupOpen(open); if (!open) setProductLookupSelection(null); }}>
    <DialogContent overlayClassName="z-[60] bg-slate-950/35" className="z-[70] max-w-5xl gap-0 overflow-hidden rounded-sm border border-[#888] bg-[#f1f0ee] p-0 text-[#333] shadow-xl [&>button:last-child]:hidden">
      <DialogHeader className="border-b border-[#c9c7c3] px-3 py-2 pr-10">
        <DialogTitle className="text-sm font-normal text-[#333]">{labelFor(productLookupSelection ? "Product History" : "Product Search")}</DialogTitle>
        <DialogDescription className="sr-only">Search products, review invoice history, and select branch stock for this sale.</DialogDescription>
      </DialogHeader>
      <button type="button" className="w-fit px-3 py-1 text-left text-xs text-[#444] hover:bg-[#e3e2df]" onClick={() => { setProductLookupOpen(false); setProductLookupSelection(null); }}>{labelFor("Exit")}</button>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 border border-[#aaa] bg-white px-2"><Search size={15} className="shrink-0 text-[#777]" /><Input autoFocus value={productLookupQuery} onChange={(event) => { setProductLookupQuery(event.target.value); setProductLookupSelection(null); }} placeholder={labelFor("Search product, generic, SKU or barcode")} className="h-8 rounded-none border-0 px-1 text-xs shadow-none focus-visible:ring-0" /></div>
        {productLookupLoading && <p className="text-xs text-[#555]">{labelFor("Searching products…")}</p>}
        {productLookupError && <p role="alert" className="border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">{productLookupError}</p>}
        {productLookupSelection ? <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border border-[#aaa] bg-white px-2 py-1.5 text-xs"><div><strong className="text-sm">{productLookupSelection.name}</strong><span className="ml-3">{productLookupSelection.sku}</span><span className="ml-3">MRP: {money(productLookupSelection.mrp ?? 0)}</span><span className="ml-3">Stock: {productLookupSelection.stock}</span></div><Button type="button" variant="outline" onClick={() => setProductLookupSelection(null)} className="h-7 rounded-none border-[#999] px-2 text-xs">{labelFor("Back to products")}</Button></div>
          {productHistoryError && <p role="alert" className="border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">{productHistoryError}</p>}
          <div className="max-h-[58vh] overflow-auto border border-[#aaa] bg-white">
            <RecordTable className="w-full min-w-[1160px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#e9e8e5]"><tr>{["Ad Date", "Bs Date", "Invoice No.", "Batch", "Expiry", "Qty", "Free", "Rate", "MRP", "Disc %", "Type"].map((heading) => <th key={heading} className="border-b border-r border-[#c4c2be] px-2 py-1.5 font-semibold">{labelFor(heading)}</th>)}</tr></thead>
              <tbody>{productHistoryRows.map((row) => <tr key={row.id} className="odd:bg-white even:bg-[#faf9f7] hover:bg-[#d8e8f6]"><td className="border-b border-r border-[#ddd] px-2 py-1.5">{formatPlatformDate(row.date)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{formatNepaliDate(row.date.slice(0, 10))}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{row.invoiceNumber}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{row.batch || "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{row.expiryDate ? formatPlatformDate(row.expiryDate) : "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{row.quantity}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{row.free}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{money(row.rate)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{money(row.mrp)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{row.discountPercent}</td><td className="border-b border-[#ddd] px-2 py-1.5">{labelFor(row.type)}</td></tr>)}
              {!productHistoryRows.length && !productHistoryLoading && <tr><td colSpan={11} className="px-3 py-8 text-center text-xs text-[#777]">{labelFor("No product history found.")}</td></tr>}{productHistoryLoading && <tr><td colSpan={11} className="px-3 py-8 text-center text-xs text-[#777]">{labelFor("Loading product history…")}</td></tr>}</tbody>
            </RecordTable>
          </div>
          <div className="flex items-center justify-between border border-[#aaa] bg-[#f7f6f3] px-2 py-1.5 text-xs"><span>{labelFor("Selected for the current invoice. Branch stock and expiry are shown in the sales entry.")}</span><Button type="button" variant="outline" onClick={() => chooseSalesProduct(productLookupSelection, undefined)} disabled={productLookupSelection.stock < 1} className="h-7 rounded-none border-[#999] bg-white px-3 text-xs">{labelFor("Return to invoice")}</Button></div>
        </div> : <div className="max-h-[58vh] overflow-auto border border-[#aaa] bg-white">
          <RecordTable className="w-full min-w-[840px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#e9e8e5] text-[#333]"><tr>{["Product", "Generic", "SKU", "Category", "MRP", "Available stock", "Sale price", "Purchase price", ""].map((heading) => <th key={heading} className="border-b border-r border-[#c4c2be] px-2 py-2 font-semibold">{heading ? labelFor(heading) : ""}</th>)}</tr></thead>
            <tbody>{productLookupRows.map((product) => <tr key={product.id} className="odd:bg-white even:bg-[#faf9f7] hover:bg-[#e7effb]"><td className="border-b border-r border-[#ddd] px-2 py-1.5 font-semibold">{product.name}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{product.genericName || "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{product.sku}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{product.category || "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{product.mrp == null ? "—" : money(product.mrp)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{product.stock}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{money(product.salePrice)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{product.purchasePrice == null ? "—" : money(product.purchasePrice)}</td><td className="border-b border-[#ddd] px-2 py-1"><Button type="button" variant="outline" onClick={() => selectProductFromLookup(product)} className="h-7 rounded-none border-[#999] px-2 text-xs">{labelFor("Select")}</Button></td></tr>)}
              {!productLookupRows.length && !productLookupLoading && <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-[#777]">{labelFor("No matching products found.")}</td></tr>}</tbody>
          </RecordTable>
        </div>}
        <div className="flex justify-end border-t border-[#d0ceca] pt-2"><Button type="button" variant="outline" onClick={() => { setProductLookupOpen(false); setProductLookupSelection(null); }} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333]">{labelFor("Close")}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
  return <EntityListWorkspace title={query.get("title") || "Sales and Purchase"}><div className="flex min-h-0 flex-1 flex-col">
    <PharmacyModuleMenu superAdmin={superAdmin || role === "SUPERADMIN"} allowSales={canSales} allowPurchase={canPurchase} canAction={action => canUseCommerceAction(user, action)} allowInventory={canInventory} allowLedger={canLedger} allowCatalog={canManageCatalog} department={departmentView ?? "home"} menuOrder={siteConfig.settings["workspace.menuOrder"]} labelFor={labelFor} onAction={handleMenuAction} onExit={requestExit} />
    {workspaceBanner}
    {financialAction && <FinancialVoucherPanel key={`${financialAction.section}-${financialAction.mode}`} action={financialAction} token={token} superAdmin={superAdmin || role === "SUPERADMIN"} branchId={branchId || undefined} onClose={() => setFinancialAction(null)} onSaved={() => void load()} />}
    {productLookupDialog}
    {tab === "home" ? null : <>
    {tab !== "sales" && <>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">{labelFor(departmentView ? "ANHH · Pharmacy operations" : "Operations workspace")}</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{workspaceTitle}</h1><p className="mt-2 text-sm text-slate-500">{workspaceDescription}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer size={16} /> {labelFor("Print / PDF")}</Button><Button variant="outline" onClick={() => void exportReport("csv")}><FileDown size={16} /> {labelFor("Export")}</Button></div></div>
      <div className={`grid gap-3 sm:grid-cols-2 ${departmentView ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"}`}>{dashboardStats.map(({ label, value, Icon }) => <Card key={label}><CardContent className="p-4"><Icon className="text-[#003893]" size={19} /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold text-slate-950">{value == null ? "Restricted" : money(value)}</p></CardContent></Card>)}</div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><label className="text-xs font-bold text-slate-500">{labelFor("From")}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></label><label className="text-xs font-bold text-slate-500">{labelFor("To")}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" /></label><label className="min-w-56 text-xs font-bold text-slate-500">{labelFor("Branch")}<Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1"><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> {labelFor("Refresh")}</Button></div>
    </>}
    {error && <div role="alert" className="rounded-sm border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
    <Dialog open={salesRegisterDialogOpen} onOpenChange={setSalesRegisterDialogOpen}>
      <DialogContent overlayClassName="bg-slate-950/20" className="max-w-[465px] gap-2 rounded-sm border border-[#888] bg-[#f1f0ee] p-0 shadow-xl [&>button:last-child]:hidden">
        <DialogHeader className="border-b border-[#d0ceca] px-3 py-2 pr-10">
          <DialogTitle className="text-sm font-normal text-[#333]">{labelFor("Sales / Sales-Return Register")}</DialogTitle>
          <DialogDescription className="sr-only">Choose sales function, report type and saved report.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-3">
          <fieldset>
            <legend className="mb-1 text-xs text-[#444]">Function</legend>
            <div role="radiogroup" aria-label="Sales function" className="flex flex-wrap gap-x-5 gap-y-1 border-y border-[#d0ceca] py-1.5">
              {([{ value: "Cash", label: "Cash" }, { value: "Credit", label: "Credit" }, { value: "Super", label: "Super" }, { value: "Issue", label: "Issue" }, { value: "CP", label: "(CP)" }] as const).map(({ value, label }) => <label key={value} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[#444]">
                <input type="radio" name="sales-register-function" value={value} checked={salesRegisterDialogFunction === value} onChange={() => setSalesRegisterDialogFunction(value)} className="h-3.5 w-3.5 accent-[#003893]" />{label}
              </label>)}
            </div>
          </fieldset>
          <div role="tablist" aria-label="Register type" className="flex border-b border-[#d0ceca]">
            {([{ value: "sales", label: "Sales" }, { value: "returns", label: "Sales Return" }] as const).map((tabOption) => <button key={tabOption.value} type="button" role="tab" aria-selected={salesRegisterDialogTab === tabOption.value} onClick={() => { setSalesRegisterDialogTab(tabOption.value); setSalesRegisterDialogReport(tabOption.value === "sales" ? salesReports[0] : salesReturnReports[0]); }} className={`border-b-2 px-2 py-1 text-sm ${salesRegisterDialogTab === tabOption.value ? "border-[#003893] text-[#333]" : "border-transparent text-[#777] hover:text-slate-900"}`}>{labelFor(tabOption.label)}</button>)}
          </div>
          {salesRegisterDialogFunction !== "Cash" && salesRegisterDialogFunction !== "Credit" && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">PMC currently records Cash/Credit by payment method, but does not store a separate {salesRegisterDialogFunction} sale classification. This option will show the selected report from actual saved transactions without claiming it is a distinct filtered function.</p>}
          <fieldset>
            <legend className="sr-only">Select report</legend>
            <div role="radiogroup" aria-label="Sales report" className="max-h-[62vh] space-y-0 overflow-y-auto border border-[#c4c2be] bg-[#f6f5f3] px-1 py-0.5">
              {(salesRegisterDialogTab === "sales" ? salesReports : salesReturnReports).map((name, index) => {
                const reportId = `sales-register-report-${index}`;
                const divider = salesRegisterDialogTab === "sales" && [9, 13, 16, 22].includes(index);
                return <div key={name} className={`flex items-center gap-2 px-2 py-1 text-sm text-[#444] hover:bg-[#dce8f8] ${divider ? "border-t border-[#bcbab6]" : ""}`}>
                  <input id={reportId} type="radio" name="sales-register-report" value={name} checked={salesRegisterDialogReport === name} onChange={() => setSalesRegisterDialogReport(name)} className="h-3.5 w-3.5 accent-[#003893]" />
                  <label htmlFor={reportId} className="min-w-0 flex-1 cursor-pointer">{labelFor(name)}</label>
                  {name === "Sales Summary" && salesRegisterDialogTab === "sales" && <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs"><input type="checkbox" aria-label="All Firm" checked={salesRegisterAllFirm} onChange={(event) => setSalesRegisterAllFirm(event.target.checked)} className="h-4 w-4 accent-[#003893]" />All Firm</label>}
                </div>;
              })}
            </div>
          </fieldset>
        </div>
        <DialogFooter className="border-t border-[#d0ceca] px-3 py-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={openSelectedSalesRegisterReport} className="h-8 rounded-none border-[#aaa] bg-[#f2f1ee] text-sm text-[#333]">Select</Button>
          <Button type="button" variant="outline" onClick={() => setSalesRegisterDialogOpen(false)} className="h-8 rounded-none border-[#aaa] bg-[#f2f1ee] text-sm text-[#333]">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!openedSale} onOpenChange={(open) => { if (!open) setOpenedSale(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Open Sales Invoice</DialogTitle><DialogDescription>Saved invoice, payment and product details from the Sales register.</DialogDescription></DialogHeader>
        {openedSale && <div className="space-y-4 text-sm"><div className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><p><b>Invoice:</b> {openedSale.invoiceNumber || openedSale.number}</p><p><b>Date:</b> {formatPlatformDateTime(openedSale.date)}</p><p><b>Party:</b> {openedSale.customer}</p><p><b>Payment:</b> {paymentLabel(openedSale.paymentMethod)} · {openedSale.paymentStatus}</p><p><b>Subtotal:</b> {money(openedSale.subtotal ?? openedSale.total)}</p><p><b>VAT:</b> {money(openedSale.taxAmount ?? 0)}</p><p><b>Paid:</b> {money(openedSale.paidAmount ?? 0)}</p><p><b>Balance:</b> {money(Math.max(0, openedSale.total - (openedSale.paidAmount ?? 0)))}</p></div><div className="overflow-x-auto rounded-xl border"><RecordTable className="w-full min-w-[480px] text-left"><thead className="bg-slate-50 text-xs uppercase"><tr><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{openedSale.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-t"><td className="p-3">{item.product}</td><td className="p-3">{item.quantity}{item.bonusQuantity ? ` + ${item.bonusQuantity} bonus` : ""} {item.unit}</td><td className="p-3">{money(item.unitPrice)}</td><td className="p-3 text-right">{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody></RecordTable></div><p className="text-xs text-slate-500">{openedSale.insuranceProvider ? `Insurance: ${openedSale.insuranceProvider}${openedSale.insurancePolicyNumber ? ` · ${openedSale.insurancePolicyNumber}` : ""}` : "No insurance claim recorded."}</p></div>}
        <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpenedSale(null)}>Close</Button>{canSell && <Button type="button" disabled={!openedSale?.number.startsWith("ANHH-POS-") || openedSale.status === "CANCELLED" || openedSale.paymentStatus === "VOID"} onClick={() => openedSale && void beginSaleEdit(openedSale)}>Edit sale</Button>}</div></DialogFooter>
      </DialogContent>
    </Dialog>
    {selectedReport && <ReferenceReportPanel key={`${selectedReport.section}-${selectedReport.mode}-${selectedReport.title}`} action={selectedReport} sales={sales} purchases={purchases} salesReturns={selectedReport.title.toLowerCase().includes("return") && salesRegister !== "ALL" ? salesReturns.filter((item) => !!item.orderId && sales.some((sale) => sale.id === item.orderId)) : salesReturns} purchaseReturns={purchaseReturns} inventory={inventory} products={products} credit={credit} accountingSummary={accountingSummary} branchId={branchId} branches={branches} from={from} to={to} setFrom={setFrom} setTo={setTo} token={token} superAdmin={superAdmin} allowAllFirms={superAdmin || role === "SUPERADMIN" || role === "ACCOUNTANT"} companyName={siteConfig.settings["website.name"] || "All Nepal Healthy Home"} labelFor={labelFor} onClose={() => { setSelectedReport(null); if (selectedReport.section === "sales") setTab("home"); }} onSaved={load} onCorrectPurchase={prepareCorrectedPurchase} />}
    {reverseEntryOpen && <SalesReverseEntryPanel sales={sales} token={token} superAdmin={superAdmin} busy={busy} labelFor={labelFor} onClose={() => { setReverseEntryOpen(false); setTab("home"); }} onReverse={async (sale, reason) => { setBusy(true); try { await voidCommerceSale(token, sale.id, reason, superAdmin); toast.success(`Invoice ${sale.invoiceNumber || sale.number} was reversed.`); setReverseEntryOpen(false); setTab("home"); await load();  entitySaveComplete(); } catch (error) { toast.error(error instanceof Error ? error.message : "The sale could not be reversed."); throw error; } finally { setBusy(false); } }} />}
    {accountSetupAction && <AccountSetupPanel action={accountSetupAction} token={token} superAdmin={superAdmin || role === "SUPERADMIN"} branches={branches} onClose={() => setAccountSetupAction(null)} />}
    <div className={selectedReport || accountSetupAction || reverseEntryOpen ? "hidden" : "contents"}>
    {tab === "sales" && !selectedReport && !accountSetupAction && !reverseEntryOpen && salesWorkspaceScreen === "entry" && <EntityFormPanel><SalesDepartmentWindow title={labelFor(salesMode === "CREDIT" ? "CREDIT SALES OPEN (TAX-INVOICE)" : "CASH SALES OPEN (TAX-INVOICE)")} onClose={() => setTab("home")} width="w-[calc(100vw-20px)] max-w-[calc(100vw-20px)] h-[calc(100dvh-20px)] max-h-[calc(100dvh-20px)]">
      <SalesForm products={products} customers={customers} sales={sales} lastInvoice={lastInvoice} creditLedger={credit} companyDiscounts={customerCompanyDiscounts}
        referenceCode={salesReferenceCode} setReferenceCode={setSalesReferenceCode} lines={salesLines} setLines={setSalesLines}
        selected={selectedSaleProduct} setSelected={(value: string) => { setSelectedSaleProduct(value); setSaleUnit(defaultProductUnit(products.find((product) => product.id === value), "sales")); setSaleInventoryId(""); }}
        selectedInventoryId={saleInventoryId} setSelectedInventoryId={setSaleInventoryId} unit={saleUnit} setUnit={setSaleUnit}
        quantity={saleQuantity} setQuantity={setSaleQuantity} discount={saleDiscount} setDiscount={setSaleDiscount} bonus={saleBonus} setBonus={setSaleBonus}
        addLine={addSaleLine} selectedProduct={selectedSale} customer={salesCustomer} setCustomer={setSalesCustomer} walkInName={walkInName} setWalkInName={setWalkInName}
        walkInPhone={walkInPhone} setWalkInPhone={setWalkInPhone} mode={salesMode} setMode={setSalesMode} paid={salesPaid} setPaid={setSalesPaid}
        subtotal={salesSubtotal} tax={salesTax} taxRate={salesTaxRate} total={salesTotal} submit={submitSale} busy={busy} search={productSearch} setSearch={setProductSearch}
        openProductLookup={() => { setProductLookupSelection(null); setProductLookupQuery(""); setProductLookupError(""); setProductLookupOpen(true); }}
        isInsuranceSale={isInsuranceSale} setIsInsuranceSale={setIsInsuranceSale} insuranceProvider={insuranceProvider} setInsuranceProvider={setInsuranceProvider}
        insurancePolicyNumber={insurancePolicyNumber} setInsurancePolicyNumber={setInsurancePolicyNumber} templates={salesTemplates.filter((template) => template.isActive)}
        onApplyTemplate={applySalesTemplate} editingSale={!!editingSaleId} cancelEdit={cancelSaleEdit} clearForm={clearSaleForm}
        branchId={branchId} setBranchId={setBranchId} branches={branches} onClose={() => setTab("home")} labelFor={labelFor} />
    </SalesDepartmentWindow></EntityFormPanel>}
    {tab === "sales" && !selectedReport && !accountSetupAction && !reverseEntryOpen && salesWorkspaceScreen === "register" && <SalesDepartmentWindow title={labelFor(salesRegister === "CASH" ? "Open Cash Sales" : salesRegister === "CREDIT" ? "Open Credit Sales" : "Sales Register")} onClose={() => setTab("home")} width="max-w-7xl">
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2 border-b border-[#c7c5c1] bg-[#f4f3f0] p-2 text-xs text-[#333]">
          <label>{labelFor("From")}<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-7 w-36 rounded-none border-[#999] px-1 text-xs" /></label>
          <label>{labelFor("To")}<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-7 w-36 rounded-none border-[#999] px-1 text-xs" /></label>
          <label>{labelFor("Branch")}<Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 h-7 min-w-40 rounded-none border-[#999] px-1 text-xs"><option value="">{labelFor("All branches")}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={busy} className="h-7 rounded-none border-[#999] bg-[#f1f0ed] px-3 text-xs">{labelFor("Refresh")}</Button>
        </div>
        <EntityListPanel canAdd={false}><RegisterControls search={registerSearch} setSearch={setRegisterSearch} productId={registerProductId} setProductId={setRegisterProductId} products={products} register={salesRegister} setRegister={setSalesRegister} paymentStatus={salesPaymentStatus} setPaymentStatus={setSalesPaymentStatus} party={salesCustomerFilter} setParty={setSalesCustomerFilter} parties={customers} label="Customer" classic /></EntityListPanel>
        <EntityListPanel addLabel="Add sale" canAdd={canSell}><Register title={labelFor("Sales register")} rows={sales} empty={labelFor("No sales in this period.")} kind="sale" allowVoid={canSell} onVoid={askVoid} onOpen={setOpenedSale} classic /></EntityListPanel>
      </div>
    </SalesDepartmentWindow>}
    {tab === "sales" && !selectedReport && !accountSetupAction && !reverseEntryOpen && salesWorkspaceScreen === "return" && <SalesDepartmentWindow title={labelFor(saleReturnExpired ? "Expired Sales Return" : "Sales Return")} onClose={() => setTab("home")} width="max-w-6xl">
      <SalesReturnPanel sales={sales} history={salesReturns} orderId={saleReturnOrder} setOrderId={setSaleReturnOrder} productId={saleReturnProduct} setProductId={setSaleReturnProduct} quantity={saleReturnQty} setQuantity={setSaleReturnQty} reason={saleReturnReason} setReason={setSaleReturnReason} refundMethod={saleReturnRefundMethod} setRefundMethod={setSaleReturnRefundMethod} expiredReturn={saleReturnExpired} onSubmit={submitSalesReturn} busy={busy} />
    </SalesDepartmentWindow>}
    {tab === "purchases" && canPurchase && <div className="space-y-6"><EntityFormPanel><PurchaseForm products={products} suppliers={suppliers} lines={purchaseLines} setLines={setPurchaseLines} selected={selectedPurchaseProduct} setSelected={(value: string) => { setSelectedPurchaseProduct(value); setPurchaseUnit(defaultProductUnit(products.find((product) => product.id === value), "purchase")); }} selectedProduct={selectedPurchase} unit={purchaseUnit} setUnit={changePurchaseUnit} quantity={purchaseQuantity} setQuantity={setPurchaseQuantity} cost={purchaseCost} setCost={setPurchaseCost} batch={purchaseBatch} setBatch={setPurchaseBatch} expiry={purchaseExpiry} setExpiry={setPurchaseExpiry} invoiceNumber={purchaseInvoiceNumber} setInvoiceNumber={setPurchaseInvoiceNumber} notes={purchaseNotes} setNotes={setPurchaseNotes} addLine={addPurchaseLine} mode={purchaseMode} setMode={setPurchaseMode} paid={purchasePaid} setPaid={setPurchasePaid} total={purchaseTotal} supplier={purchaseSupplier} setSupplier={setPurchaseSupplier} submit={submitPurchase} busy={busy} search={productSearch} setSearch={setProductSearch} /></EntityFormPanel><EntityListPanel canAdd={false}><RegisterControls search={registerSearch} setSearch={setRegisterSearch} productId={registerProductId} setProductId={setRegisterProductId} products={products} register={purchaseRegister} setRegister={setPurchaseRegister} paymentStatus={purchasePaymentStatus} setPaymentStatus={setPurchasePaymentStatus} party={purchaseSupplierFilter} setParty={setPurchaseSupplierFilter} parties={suppliers} label="Supplier" /></EntityListPanel><EntityListPanel addLabel="Add purchase" canAdd={canPurchaseWrite}><Register title="Purchase register" rows={purchases} empty="No purchases in this period." kind="purchase" allowVoid={canPurchaseWrite} onVoid={askVoid} /></EntityListPanel><PurchaseReturnPanel rows={inventory} suppliers={suppliers} history={purchaseReturns} inventoryId={purchaseReturnInventory} setInventoryId={selectPurchaseReturnBatch} supplierId={purchaseReturnSupplier} setSupplierId={setPurchaseReturnSupplier} quantity={purchaseReturnQty} setQuantity={setPurchaseReturnQty} reason={purchaseReturnReason} setReason={setPurchaseReturnReason} onSubmit={submitPurchaseReturn} busy={busy} /></div>}
    {tab === "inventory" && canInventory && <InventoryDepartmentPanel key={`${inventoryInitialView}-${inventoryViewRequest}`} token={token} superAdmin={superAdmin} branchId={branchId || undefined} branches={branches} canWrite={canInventoryWrite} canManageMaster={canManageCatalog} canCreatePurchaseDraft={canCreatePurchaseDraft} initialView={inventoryInitialView} setupTitle={inventorySetupTitle || undefined} />}
    {tab === "credit" && canLedger && <CreditSection data={credit} customers={customers} suppliers={suppliers} customerParty={customerPaymentParty} setCustomerParty={setCustomerPaymentParty} supplierParty={supplierPaymentParty} setSupplierParty={setSupplierPaymentParty} amount={creditAmount} setAmount={setCreditAmount} method={creditMethod} setMethod={setCreditMethod} busy={creditBusy} allowReceive={hasCommercePermission(user, "receipts.manage")} allowPay={hasCommercePermission(user, "journal.manage")} onCustomerPayment={() => void submitCreditPayment("customer")} onSupplierPayment={() => void submitCreditPayment("supplier")} />}
    </div>
    {lastInvoice && <InvoicePreview invoice={lastInvoice} companyName={siteConfig.settings["website.name"] || "Company"} onClose={() => setLastInvoice(null)} />}
    </>}</div></EntityListWorkspace>;
}

function SalesDepartmentWindow({ title, onClose, children }: { title: string; onClose: () => void; width?: string; children: ReactNode }) { const list = useEntityList(); return <section className="min-w-0 rounded-xl border bg-white"><header className="flex items-center justify-between gap-3 border-b p-4"><h2 className="font-bold">{title}</h2><Button type="button" variant="outline" onClick={() => list ? list.cancel() : onClose()}>Back to list</Button></header>{children}</section>; }

function ProductPicker({ products, value, onChange, search, setSearch, classic = false, labelFor }: { products: CommerceProduct[]; value: string; onChange: (value: string) => void; search?: string; setSearch?: (value: string) => void; classic?: boolean; labelFor?: (label: string) => string }) {
  return <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,0.8fr)]">
    <div className="relative"><Search className={`absolute left-2.5 top-2.5 ${classic ? "text-[#777]" : "text-slate-400"}`} size={15} /><Input value={search ?? ""} onChange={(event) => setSearch?.(event.target.value)} placeholder={labelFor?.("Search product / SKU / barcode") ?? "Search product / SKU / barcode"} className={classic ? "h-8 rounded-none border-[#999] bg-white pl-8 text-xs" : "pl-9"} /></div>
    <Select value={value} onChange={(event) => onChange(event.target.value)} className={classic ? "h-8 rounded-none border-[#999] bg-white px-2 text-xs" : undefined}><option value="">{labelFor?.("Select product") ?? "Select product"}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku} · {product.stock} in stock</option>)}</Select>
  </div>;
}

function UnitPicker({ product, purpose, value, onChange, classic = false }: { product?: CommerceProduct; purpose: UnitPurpose; value: string; onChange: (value: string) => void; classic?: boolean }) {
  if (!product) return null;
  const options = productUnits(product, purpose);
  return <label className={`block space-y-1 text-xs font-semibold ${classic ? "text-[#444]" : "text-slate-600"}`}>{purpose === "purchase" ? "Purchase unit" : "Sales unit"}<Select value={value || defaultProductUnit(product, purpose)} onChange={(event) => onChange(event.target.value)} className={classic ? "h-8 rounded-none border-[#999] bg-white px-2 text-xs" : undefined}>{options.map((unit) => <option key={unit.name} value={unit.name}>{unit.name} · {unit.multiplierToBase} base {unit.multiplierToBase === 1 ? "unit" : "units"}</option>)}</Select></label>;
}

function SalesForm(p: any) {
  const list = useEntityList();
  const label = (value: string) => p.labelFor?.(value) ?? value;
  const compactField = "h-8 rounded-none border-[#999] bg-white px-2 text-xs";
  const insuranceChoices = ["IPD Insurance Thaili", "ECHS", "Insurance Product", "SSF", "Emergency", "Critical Disease"];
  const productSearchRows: CommerceProduct[] = p.products.filter((product: CommerceProduct) => !p.search?.trim() || `${product.name} ${product.sku} ${product.genericName || ""} ${product.category || ""}`.toLowerCase().includes(p.search.trim().toLowerCase())).slice(0, 30);
  const [reviewing, setReviewing] = useState(false);
  const [showPreviousBills, setShowPreviousBills] = useState(false);
  useEffect(() => { if (p.lastInvoice) setReviewing(false); }, [p.lastInvoice]);
  const amountFor = (line: Line) => {
    const product = p.products.find((candidate: CommerceProduct) => candidate.id === line.productId);
    if (!product) return 0;
    const multiplier = productUnits(product, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1;
    const defaultMultiplier = Math.max(1, product.salesUnitToBase || 1);
    const companyDiscount = p.companyDiscounts?.find((rule: { manufacturerId: string; discountPercent: number }) => rule.manufacturerId === product.manufacturerId)?.discountPercent ?? 0;
    const discount = Math.min(100, Number(product.discountPercent || 0) + Number(line.discountPercent || 0) + companyDiscount);
    return product.salePrice * multiplier / defaultMultiplier * (1 - discount / 100) * Number(line.quantity || 0);
  };
  const selectedParty: Party | undefined = p.customers.find((customer: Party) => customer.id === p.customer);
  const openingBalance: number | undefined = p.creditLedger ? p.creditLedger.customers?.find((customer: { id: string }) => customer.id === p.customer)?.balance ?? 0 : undefined;
  const paidAmount = p.mode === "CREDIT" ? 0 : Number(p.paid || p.total || 0);
  const outstanding = Math.max(0, Number(p.total || 0) - paidAmount);
  const today = getPlatformDateInput();
  const selectedBatch = p.selectedProduct?.batches?.find((batch: NonNullable<CommerceProduct["batches"]>[number]) => batch.inventoryId === p.selectedInventoryId);
  const entryMultiplier = productUnits(p.selectedProduct, "sales").find((unit) => unit.name === p.unit)?.multiplierToBase ?? 1;
  const entryRate = p.selectedProduct ? p.selectedProduct.salePrice * entryMultiplier / Math.max(1, p.selectedProduct.salesUnitToBase || 1) : 0;
  const entryDiscount = Math.min(100, Number(p.selectedProduct?.discountPercent || 0) + Number(p.discount || 0) + Number(p.companyDiscounts?.find((rule: { manufacturerId: string; discountPercent: number }) => rule.manufacturerId === p.selectedProduct?.manufacturerId)?.discountPercent || 0));
  const entryAmount = entryRate * (1 - entryDiscount / 100) * Number(p.quantity || 0);
  const discountTotal = p.lines.reduce((sum: number, line: Line) => {
    const product = p.products.find((candidate: CommerceProduct) => candidate.id === line.productId);
    if (!product) return sum;
    const multiplier = productUnits(product, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1;
    const baseMultiplier = Math.max(1, product.salesUnitToBase || 1);
    const companyDiscount = p.companyDiscounts?.find((rule: { manufacturerId: string; discountPercent: number }) => rule.manufacturerId === product.manufacturerId)?.discountPercent ?? 0;
    const discount = Math.min(100, Number(product.discountPercent || 0) + Number(line.discountPercent || 0) + companyDiscount);
    return sum + product.salePrice * multiplier / baseMultiplier * Number(line.quantity || 0) * discount / 100;
  }, 0);
  function reviewSale() {
    if (!p.lines.length) return toast.error("Add products to the bill first.");
    if (p.mode === "PARTIAL" && (Number(p.paid) <= 0 || Number(p.paid) >= Number(p.total))) return toast.error("For a partial sale, enter an amount greater than zero and less than the invoice total.");
    if (["CASH", "BANK_TRANSFER", "CHEQUE"].includes(p.mode) && p.paid && Number(p.paid) !== Number(p.total)) return toast.error("Cash, bank and cheque sales must be paid in full. Choose Partial or Credit for an outstanding balance.");
    if (p.isInsuranceSale && !p.insuranceProvider.trim()) return toast.error("Enter the insurance provider for this sale.");
    setReviewing(true);
  }
  if (reviewing) return <form onSubmit={event => { event.preventDefault(); void p.submit(); }}><div className="flex min-h-[70vh] flex-col p-4 text-[#333]">
    <div className="border-b border-[#c8c6c2] bg-[#f7f6f3] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#315889]">{label("Invoice review")}</p><h2 className="text-lg font-semibold">{label(p.mode === "CREDIT" ? "Credit Sales · Tax Invoice" : "Cash Sales · Tax Invoice")}</h2><p className="text-xs text-[#666]">{selectedParty?.name || p.walkInName || label("Walk-in customer")} · {formatPlatformDate(today)} · {formatNepaliDate(today)}</p></div>
    <div className="grid flex-1 content-start gap-4 p-4 md:grid-cols-[1fr_340px]">
      <div className="overflow-auto border border-[#aaa] bg-white"><RecordTable className="w-full min-w-[520px] border-collapse text-left text-xs"><thead className="bg-[#e9e8e5]"><tr>{["#", "Particular", "Batch", "Qty", "Discount", "Amount"].map((heading) => <th key={heading} className="border-b border-r border-[#c4c2be] px-2 py-2">{label(heading)}</th>)}</tr></thead><tbody>{p.lines.map((line: Line, index: number) => { const product = p.products.find((candidate: CommerceProduct) => candidate.id === line.productId); return <tr key={`${line.productId}-${index}`} className="odd:bg-white even:bg-[#faf9f7]"><td className="border-b border-r border-[#ddd] px-2 py-2">{index + 1}</td><td className="border-b border-r border-[#ddd] px-2 py-2">{product?.name ?? "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-2">{line.batchNumber || label("FEFO")}</td><td className="border-b border-r border-[#ddd] px-2 py-2 text-right">{line.quantity} {line.unit}</td><td className="border-b border-r border-[#ddd] px-2 py-2 text-right">{Number(line.discountPercent || 0).toFixed(2)}%</td><td className="border-b border-[#ddd] px-2 py-2 text-right">{money(amountFor(line))}</td></tr>; })}</tbody></RecordTable></div>
      <div className="space-y-2 border border-[#aaa] bg-[#f7f6f3] p-3 text-xs"><div className="flex justify-between"><span>{label("Company / product discount")}</span><strong>{money(discountTotal)}</strong></div><div className="flex justify-between"><span>{label("Taxable amount")}</span><strong>{money(p.subtotal)}</strong></div><div className="flex justify-between"><span>{label(`VAT (${p.taxRate}%)`)}</span><strong>{money(p.tax)}</strong></div><div className="flex justify-between border-t border-[#c8c6c2] pt-2"><span>{label("Invoice total")}</span><strong className="text-base">{money(p.total)}</strong></div><div className="mt-3 grid gap-2 border-t border-[#c8c6c2] pt-3"><div className="flex justify-between"><span>{label("Payment type")}</span><strong>{label(p.mode.replaceAll("_", " "))}</strong></div><div className="flex justify-between"><span>{label("Paid now")}</span><strong>{money(paidAmount)}</strong></div><div className="flex justify-between"><span>{label("Balance due")}</span><strong>{money(outstanding)}</strong></div><div className="flex justify-between"><span>{label("Previous balance")}</span><strong>{openingBalance == null ? label("Restricted") : money(openingBalance)}</strong></div></div><p className="border-t border-[#c8c6c2] pt-2 text-[11px] leading-4 text-[#666]">{label("Posting saves the invoice, payment, branch stock movement and customer ledger together.")}</p></div>
    </div>
    <div className="flex justify-between gap-2 border-t border-[#c8c6c2] bg-[#f1f0ed] p-3"><Button type="button" variant="outline" onClick={() => setReviewing(false)} className="h-9 rounded-none border-[#999] bg-white">{label("Back")}</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => list ? list.cancel() : p.onClose()} className="h-9 rounded-none border-[#999] bg-white">{label("Close")}</Button><FormSaveActions mode={p.editingSale ? "edit" : "create"} busy={p.busy || !p.canPost} onCancel={() => {}} /></div></div>
  </div></form>;
  return <form onSubmit={event => { event.preventDefault(); void p.submit(); }}><div id="sales-pos-form" className="space-y-2 p-3 text-[#333]">
    {p.editingSale && <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">Existing invoice loaded. Catalog prices and active discounts are recalculated; confirm the values before saving.</p>}
    <div className="grid gap-2 border border-[#bcbab6] bg-[#f7f6f3] p-2 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Party")}<Select value={p.customer} onChange={(event) => p.setCustomer(event.target.value)} className={compactField}><option value="">{label("Walk-in customer")}</option>{p.customers.map((customer: Party) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</Select></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Old Bal")}<div className="h-8 border border-[#999] bg-white px-2 py-1.5 text-right">{openingBalance == null ? label("Restricted") : money(openingBalance)}</div></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Branch")}<Select value={p.branchId} disabled={p.lines.length > 0} onChange={(event) => { p.setBranchId(event.target.value); p.setSelectedInventoryId(""); }} className={compactField}><option value="">Default branch</option>{p.branches.map((branch: AdminBranch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Address")}<div className="h-8 truncate border border-[#999] bg-white px-2 py-1.5" title={selectedParty?.address || ""}>{selectedParty?.address || "—"}</div></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("PAN")}<div className="h-8 border border-[#999] bg-white px-2 py-1.5">{selectedParty?.panNumber || "—"}</div></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Tel")}<div className="h-8 border border-[#999] bg-white px-2 py-1.5">{selectedParty?.telephone || selectedParty?.phone || p.walkInPhone || "—"}</div></label>
        <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Ref Code")}<Input value={p.referenceCode} onChange={(event) => p.setReferenceCode(event.target.value)} maxLength={120} className={compactField} /></label>
        {!p.customer && <><label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Walk-in name")}<Input value={p.walkInName} onChange={(event) => p.setWalkInName(event.target.value)} maxLength={160} className={compactField} /></label><label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Walk-in phone")}<Input value={p.walkInPhone} onChange={(event) => p.setWalkInPhone(event.target.value)} maxLength={40} className={compactField} /></label></>}
        <div className="flex items-center gap-2 text-xs"><span>AD: <strong>{formatPlatformDate(today)}</strong></span><span className="text-[#777]">·</span><span>{formatNepaliDate(today)}</span></div>
        <div className="flex items-center gap-2 text-xs"><span>{label("Count")}: <strong>{p.lines.length}</strong></span><Button type="button" variant="link" onClick={() => setShowPreviousBills((value) => !value)} className="h-6 p-0 text-xs text-[#315889]">{label("Prev Bills")}</Button></div>
        {p.templates?.length > 0 && !p.editingSale && <label className="grid grid-cols-[94px_1fr] items-center gap-1 text-xs">{label("Template")}<Select value="" onChange={(event) => p.onApplyTemplate(event.target.value)} className={compactField}><option value="">{label("Load saved bill…")}</option>{p.templates.map((template: PharmacySalesTemplate) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></label>}
      </div>
      <div className="flex flex-col justify-center border border-[#bcbab6] bg-[#eeedeb] px-4 py-2 text-right text-[#222]"><span className="text-sm font-semibold">{label("Total:")}</span><strong className="font-serif text-[38px] leading-tight">{money(p.total)}</strong><span className="text-[11px]">{label("Including VAT")} · {p.taxRate}%</span></div>
    </div>
    {showPreviousBills && <div className="max-h-36 overflow-auto border border-[#aaa] bg-white"><RecordTable className="w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#e9e8e5]"><tr>{["Date", "Invoice", "Party", "Total", "Status"].map((heading) => <th key={heading} className="border-b border-r border-[#ddd] px-2 py-1.5">{label(heading)}</th>)}</tr></thead><tbody>{p.sales.filter((sale: CommerceSale) => !p.customer || sale.customerId === p.customer).slice(0, 8).map((sale: CommerceSale) => <tr key={sale.id}><td className="border-b border-r border-[#eee] px-2 py-1">{formatPlatformDate(sale.date)}</td><td className="border-b border-r border-[#eee] px-2 py-1">{sale.invoiceNumber || sale.number}</td><td className="border-b border-r border-[#eee] px-2 py-1">{sale.customer}</td><td className="border-b border-r border-[#eee] px-2 py-1 text-right">{money(sale.total)}</td><td className="border-b border-r border-[#eee] px-2 py-1">{sale.paymentStatus}</td></tr>)}{!p.sales.length && <tr><td colSpan={5} className="px-3 py-3 text-center text-xs text-[#777]">{label("No previous bills found.")}</td></tr>}</tbody></RecordTable></div>}
    <div className="grid gap-2 border border-[#bcbab6] bg-[#f7f6f3] p-2 xl:grid-cols-[minmax(220px,1.25fr)_130px_190px_76px_100px_84px_92px_104px_auto] xl:items-end">
      <div><span className="mb-1 block text-xs">{label("Product / F9 Search")}</span><div className="flex gap-1"><div className="min-w-0 flex-1"><ProductPicker classic products={p.products} value={p.selected} onChange={p.setSelected} search={p.search} setSearch={p.setSearch} labelFor={label} /></div><Button type="button" variant="outline" onClick={p.openProductLookup} className="h-8 rounded-none border-[#777] bg-white px-2 text-xs">F9</Button></div></div>
      <UnitPicker classic product={p.selectedProduct} purpose="sales" value={p.unit} onChange={p.setUnit} />
      <label className="block text-xs">{label("Batch / Expiry")}<Select value={p.selectedInventoryId} onChange={(event) => { const batch = p.selectedProduct?.batches?.find((row: NonNullable<CommerceProduct["batches"]>[number]) => row.inventoryId === event.target.value); p.setSelectedInventoryId(event.target.value); if (batch?.branchId) p.setBranchId(batch.branchId); }} disabled={!p.selectedProduct} className={`${compactField} mt-1 w-full`}><option value="">{label("Automatic FEFO")}</option>{(p.selectedProduct?.batches ?? []).filter((batch: NonNullable<CommerceProduct["batches"]>[number]) => !p.branchId || batch.branchId === p.branchId).map((batch: NonNullable<CommerceProduct["batches"]>[number]) => <option key={batch.inventoryId} value={batch.inventoryId}>{batch.batchNumber} · {batch.branch || "—"} · Qty {batch.availableQuantity} · MRP {money(batch.mrp)}</option>)}</Select></label>
      <label className="block text-xs">{label("Qty")}<Input type="number" min="1" step="1" value={p.quantity} onChange={(event) => p.setQuantity(event.target.value)} className={`${compactField} mt-1`} /></label>
      <label className="block text-xs">{label("Rate")}<div className="mt-1 h-8 border border-[#999] bg-white px-2 py-1.5 text-right">{money(entryRate)}</div></label>
      <label className="block text-xs">{label("Disc %")}<Input type="number" min="0" max="100" step="0.01" value={p.discount} onChange={(event) => p.setDiscount(event.target.value)} className={`${compactField} mt-1`} /></label>
      <label className="block text-xs">{label("Scheme / Bonus")}<Input type="number" min="0" step="1" value={p.bonus} onChange={(event) => p.setBonus(event.target.value)} className={`${compactField} mt-1`} /></label>
      <label className="block text-xs">{label("Amount")}<div className="mt-1 h-8 border border-[#999] bg-white px-2 py-1.5 text-right">{money(entryAmount)}</div></label>
      <Button type="button" onClick={p.addLine} disabled={!p.selectedProduct} className="h-8 rounded-none bg-[#315889] px-3 text-xs hover:bg-[#264b79]"><Plus size={14} />{label("Add")}</Button>
      {p.selectedProduct && <div className="text-[11px] text-[#555] xl:col-span-full">{label("Stock")}: {selectedBatch?.availableQuantity ?? p.selectedProduct.stock} · {label("MRP")}: {money(selectedBatch?.mrp ?? p.selectedProduct.mrp ?? 0)} · {label("S.Price")}: {money(selectedBatch?.sellingPrice ?? p.selectedProduct.salePrice)} · {label("Batch")}: {selectedBatch?.batchNumber || label("Expiry-based allocation")}{selectedBatch?.expiryDate ? ` · ${formatPlatformDate(selectedBatch.expiryDate)}` : ""}</div>}
    </div>
    <div className="max-h-[34vh] min-h-28 overflow-auto border border-[#aaa] bg-white">
      <RecordTable className="w-full min-w-[1120px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#e9e8e5] text-[#333]"><tr>{["Serial", "Md Code", "Particular", "WSunit", "Batch", "Pack", "Qty", "Type", "Rate", "Count%", "Scheme", "Amount", ""].map((heading) => <th key={heading} className="border-b border-r border-[#c4c2be] px-2 py-1.5 font-semibold">{heading ? label(heading) : ""}</th>)}</tr></thead>
        <tbody>{p.lines.map((line: Line, index: number) => { const product = p.products.find((candidate: CommerceProduct) => candidate.id === line.productId); const pack = productUnits(product, "sales").find((unit) => unit.name === line.unit)?.multiplierToBase ?? 1; const batch = product?.batches?.find((row: NonNullable<CommerceProduct["batches"]>[number]) => row.inventoryId === line.inventoryId); return <tr key={`${line.productId}-${index}`} className="odd:bg-white even:bg-[#faf9f7] hover:bg-[#e4eef8]">
          <td className="border-b border-r border-[#ddd] px-2 py-1.5">{index + 1}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{product?.sku ?? "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 font-medium">{product?.name ?? "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{line.unit || "—"}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{line.batchNumber || label("FEFO")}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">×{pack}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{line.quantity}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5">{p.mode}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{money(product ? product.salePrice * pack / Math.max(1, product.salesUnitToBase || 1) : 0)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{Number(line.discountPercent || 0).toFixed(2)}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{line.bonusQuantity || 0}</td><td className="border-b border-r border-[#ddd] px-2 py-1.5 text-right">{money(amountFor(line))}</td><td className="border-b border-[#ddd] px-1 py-0.5"><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${product?.name ?? "line"}`} onClick={() => p.setLines(p.lines.filter((_: Line, lineIndex: number) => lineIndex !== index))} className="h-7 w-7 rounded-none text-rose-700"><Trash2 size={14} /></Button>{batch && <span className="sr-only">MRP {batch.mrp}</span>}</td>
        </tr>; })}
        {!p.lines.length && <tr><td colSpan={13} className="px-3 py-7 text-center text-xs text-[#777]">No product lines have been added.</td></tr>}</tbody>
      </RecordTable>
    </div>
    {p.search?.trim() && <div className="max-h-[20vh] overflow-auto border border-[#888] bg-white">
      <div className="border-b border-[#aaa] bg-[#efeeeb] px-2 py-1 text-xs">{label("Function")}</div>
      <RecordTable className="w-full min-w-[1050px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#e9e8e5]"><tr>{["Firm", "Ref Code", "Code", "Md Code", "Particular", "Unit", "Rate", "Qty", "Vat", "Ins. Rate"].map((heading) => <th key={heading} className="border-b border-r border-[#c4c2be] px-2 py-1.5 font-semibold">{label(heading)}</th>)}</tr></thead><tbody>
        {productSearchRows.map((product) => <tr key={product.id} className="bg-[#078b13] text-white hover:bg-[#0a9d18]"><td className="border-b border-r border-white/60 px-2 py-1.5">{product.batches?.find((batch) => !p.branchId || batch.branchId === p.branchId)?.branch || "1"}</td><td className="border-b border-r border-white/60 px-2 py-1.5">—</td><td className="border-b border-r border-white/60 px-2 py-1.5">{product.barcode || product.sku}</td><td className="border-b border-r border-white/60 px-2 py-1.5">{product.sku}</td><td className="border-b border-r border-white/60 px-2 py-1.5"><button type="button" onClick={() => p.setSelected(product.id)} className="w-full text-left underline-offset-2 hover:underline">{product.name}</button></td><td className="border-b border-r border-white/60 px-2 py-1.5">{product.salesUnit || product.baseUnit}</td><td className="border-b border-r border-white/60 px-2 py-1.5 text-right">{money(product.salePrice)}</td><td className="border-b border-r border-white/60 px-2 py-1.5 text-right">{product.stock}</td><td className="border-b border-r border-white/60 px-2 py-1.5">{(product.invoiceTaxRate ?? 0) > 0 ? "Y" : "N"}</td><td className="border-b border-white/60 px-2 py-1.5 text-right">0.00</td></tr>)}
        {!productSearchRows.length && <tr><td colSpan={10} className="px-3 py-5 text-center text-xs text-[#777]">{label("No matching products found.")}</td></tr>}
      </tbody></RecordTable>
    </div>}
    {p.selectedProduct && <div className="grid gap-x-5 gap-y-1 border border-[#aaa] bg-[#f4f3f0] px-3 py-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
      <span><b>{label("Stock")}:</b> <strong className="text-[#315889]">{p.selectedProduct.stock}</strong></span>
      <span><b>{label("Packing")}:</b> {entryMultiplier} {p.unit}</span>
      <span><b>{label("Bonus")}:</b> 0+{p.bonus || 0}</span>
      <span><b>{label("Lot Bonus")}:</b> 0+0</span>
      <span><b>{label("Net S Price")}:</b> <strong className="text-[#315889]">{money(entryRate * (1 - entryDiscount / 100))}</strong></span>
      <span><b>{label("Quantity")}:</b> <strong className="text-[#315889]">{selectedBatch?.availableQuantity ?? p.selectedProduct.stock}</strong></span>
      <span><b>{label("Expiry")}:</b> {selectedBatch?.expiryDate ? formatPlatformDate(selectedBatch.expiryDate) : "—"}</span>
      <span><b>{label("S Price")}:</b> {money(selectedBatch?.sellingPrice ?? p.selectedProduct.salePrice)}</span>
      <span><b>{label("MRP")}:</b> {money(selectedBatch?.mrp ?? p.selectedProduct.mrp ?? 0)}</span>
      <span><b>{label("Locked Stock")}:</b> {selectedBatch?.reservedQuantity ?? 0}</span>
    </div>}
    <div className="grid gap-2 border border-[#bcbab6] bg-[#f7f6f3] p-2 md:grid-cols-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#c8c6c2] pb-2 text-xs md:col-span-2">
        {insuranceChoices.map((choice) => <label key={choice} className="flex items-center gap-1.5"><input type="checkbox" checked={p.insuranceProvider === choice} onChange={(event) => { p.setIsInsuranceSale(event.target.checked); p.setInsuranceProvider(event.target.checked ? choice : ""); }} className="accent-[#315889]" />{label(choice)}</label>)}
        {p.isInsuranceSale && <Input value={p.insurancePolicyNumber} onChange={(event) => p.setInsurancePolicyNumber(event.target.value)} maxLength={120} placeholder={label("Policy / claim number")} className="h-7 max-w-64 rounded-none border-[#999] bg-white px-2 text-xs" />}
      </div>
      <label className="grid grid-cols-[118px_1fr] items-center gap-2 text-xs">{label("Payment")}<Select value={p.mode} onChange={(event) => { const mode = event.target.value; p.setMode(mode); p.setPaid(mode === "CREDIT" ? "0" : ""); }} className={compactField}><option value="CASH">Cash</option><option value="CREDIT">Credit (Udharo)</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="PARTIAL">Partial payment</option></Select></label>
      <label className="grid grid-cols-[118px_1fr] items-center gap-2 text-xs">{label("Paid amount")}<Input type="number" min="0" step="0.01" placeholder={p.mode === "CREDIT" ? "0.00" : money(p.total)} value={p.paid} disabled={p.mode === "CREDIT"} onChange={(event) => p.setPaid(event.target.value)} className={compactField} /></label>
      <div className="grid grid-cols-3 gap-2 border border-[#c8c6c2] bg-white p-2 text-xs md:col-span-2"><div><span className="text-[#666]">{label("Taxable")}</span><strong className="mt-1 block">{money(p.subtotal)}</strong></div><div><span className="text-[#666]">{label(`VAT (${p.taxRate}%)`)}</span><strong className="mt-1 block">{money(p.tax)}</strong></div><div><span className="text-[#666]">{label("Net total")}</span><strong className="mt-1 block text-sm">{money(p.total)}</strong></div></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#c8c6c2] pt-2">
      <p className="text-[11px] text-[#555]">{label("VAT is shown at the active configured rate; branch stock and customer ledger are checked again when posting.")}</p>
      <div className="flex items-center gap-2"><span className="text-xs">{label("Net total")}</span><strong className="min-w-32 border border-[#999] bg-white px-3 py-1.5 text-right text-sm">{money(p.total)}</strong></div>
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-[#c8c6c2] pt-2">
      <div className="flex gap-2">{p.editingSale && <Button type="button" variant="outline" onClick={p.cancelEdit} className="h-8 rounded-none border-[#999] bg-[#f1f0ed] text-xs">{label("Cancel correction")}</Button>}<Button type="button" variant="outline" onClick={p.clearForm} className="h-8 rounded-none border-[#999] bg-[#f1f0ed] text-xs">{label("Empty Record")}</Button></div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => list ? list.cancel() : p.onClose()} className="h-8 rounded-none border-[#999] bg-[#f1f0ed] text-xs">{label("Close")}</Button><Button type="button" onClick={reviewSale} disabled={p.busy || !p.lines.length} className="h-8 rounded-none bg-[#315889] px-5 text-xs hover:bg-[#264b79]">{label("Post")}</Button></div>
    </div>
  </div></form>;
}

function PurchaseForm(p: any) { return <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"><form onSubmit={event => { event.preventDefault(); void p.submit(); }}><Card><CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus size={18} className="text-[#003893]" />Purchase receipt</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={p.supplier} onChange={(e) => p.setSupplier(e.target.value)}><option value="">Select supplier</option>{p.suppliers.map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><ProductPicker products={p.products} value={p.selected} onChange={p.setSelected} search={p.search} setSearch={p.setSearch} /><UnitPicker product={p.selectedProduct} purpose="purchase" value={p.unit} onChange={p.setUnit} /><div className="grid gap-2 sm:grid-cols-2"><Input type="number" min="1" placeholder={`Quantity (${p.unit || "unit"})`} value={p.quantity} onChange={(e) => p.setQuantity(e.target.value)} /><Input type="number" min="0" placeholder={`Purchase rate per ${p.unit || "unit"}`} value={p.cost} onChange={(e) => p.setCost(e.target.value)} /></div><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Batch number" value={p.batch} onChange={(e) => p.setBatch(e.target.value)} /><Input type="date" value={p.expiry} onChange={(e) => p.setExpiry(e.target.value)} /></div><Button type="button" variant="outline" onClick={p.addLine}><Plus size={16} /> Add purchase line</Button>{p.lines.map((line: Line, i: number) => <div key={`${line.productId}-${i}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{p.products.find((x: CommerceProduct) => x.id === line.productId)?.name} × {line.quantity} {line.unit} @ {money(Number(line.unitCost))}{line.batchNumber ? ` · ${line.batchNumber}` : ""}</span><Button size="icon" variant="ghost" onClick={() => p.setLines(p.lines.filter((_: Line, n: number) => n !== i))}><Trash2 size={15} /></Button></div>)}<div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Supplier invoice number" value={p.invoiceNumber} onChange={(e) => p.setInvoiceNumber(e.target.value)} /><Input placeholder="Notes" value={p.notes} onChange={(e) => p.setNotes(e.target.value)} /></div><div className="grid gap-2 sm:grid-cols-3"><Select value={p.mode} onChange={(e) => p.setMode(e.target.value)}><option value="CASH">Cash</option><option value="CREDIT">Credit (Payable)</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="PARTIAL">Partial payment</option></Select><Input type="number" min="0" placeholder="Paid amount" value={p.paid} onChange={(e) => p.setPaid(e.target.value)} /><div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold">Total: {money(p.total)}</div></div><FormSaveActions mode="create" busy={p.busy} onCancel={() => {}} /></CardContent></Card></form><Card><CardHeader><CardTitle className="flex items-center gap-2"><History size={18} className="text-[#003893]" />Purchase controls</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><p>Each receipt creates batch-wise, branch-wise stock with expiry information.</p><p>Credit purchases remain in Supplier Payables until settled from the Credit Ledger.</p><p>Void is available when the recorded stock can be safely reversed.</p></CardContent></Card></div>; }

function RegisterControls({ search, setSearch, productId, setProductId, products, register, setRegister, paymentStatus, setPaymentStatus, party, setParty, parties, label, classic = false }: { search: string; setSearch: (value: string) => void; productId: string; setProductId: (value: string) => void; products: CommerceProduct[]; register: RegisterFilter; setRegister: (value: RegisterFilter) => void; paymentStatus: string; setPaymentStatus: (value: string) => void; party: string; setParty: (value: string) => void; parties: Party[] | Supplier[]; label: string; classic?: boolean }) {
  const fieldClass = classic ? "mt-1 h-7 rounded-none border-[#999] bg-white px-2 text-xs" : "mt-1";
  const labelClass = classic ? "text-xs text-[#444]" : "text-xs font-bold text-slate-500";
  return <div className={`flex flex-wrap items-end gap-2 ${classic ? "border border-[#aaa] bg-[#f7f6f3] p-2" : "rounded-2xl border bg-white p-4"}`}>
    <label className={`min-w-52 flex-1 ${labelClass}`}>Search register<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice, party or product" className={fieldClass} /></label>
    <label className={`min-w-40 ${labelClass}`}>Product<Select value={productId} onChange={(event) => setProductId(event.target.value)} className={fieldClass}><option value="">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></label>
    <label className={`min-w-40 ${labelClass}`}>{label}<Select value={party} onChange={(event) => setParty(event.target.value)} className={fieldClass}><option value="">All {label.toLowerCase()}s</option>{parties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    <label className={`min-w-28 ${labelClass}`}>Register<Select value={register} onChange={(event) => setRegister(event.target.value as RegisterFilter)} className={fieldClass}><option value="ALL">All</option><option value="CASH">Cash</option><option value="CREDIT">Credit</option></Select></label>
    <label className={`min-w-32 ${labelClass}`}>Payment status<Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className={fieldClass}><option value="">All statuses</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="UNPAID">Unpaid</option></Select></label>
  </div>;
}

function Register({ title, rows, empty, kind, onVoid, onOpen, allowVoid = true, classic = false }: { title: string; rows: (CommerceSale | CommercePurchase)[]; empty: string; kind: "sale" | "purchase"; onVoid: (kind: "sale" | "purchase", id: string, number: string) => void; onOpen?: (sale: CommerceSale) => void; allowVoid?: boolean; classic?: boolean }) {
  return <section className={classic ? "border border-[#aaa] bg-[#f1f0ee]" : "rounded-xl border bg-white"}>
    <div className={`flex items-center justify-between border-b ${classic ? "border-[#aaa] bg-[#e9e8e5] px-2 py-1.5 text-xs" : "px-4 py-3"}`}><h2 className={classic ? "font-semibold" : "font-bold"}>{title}</h2><span className={classic ? "text-[#555]" : "text-xs text-slate-500"}>{rows.length} records</span></div>
    <div className="max-h-[58vh] overflow-auto bg-white"><RecordTable className={`w-full min-w-[840px] border-collapse text-left ${classic ? "text-xs" : "text-sm"}`}><thead className="sticky top-0 bg-[#e9e8e5] text-[#444]"><tr>{["Number", "Party", "Date", "Items", "Payment", "Status", "Amount", "Actions"].map((heading) => <th key={heading} className={`border-b border-r border-[#d1cfca] font-semibold ${classic ? "px-2 py-1.5" : "p-3"} ${heading === "Amount" ? "text-right" : ""}`}>{heading}</th>)}</tr></thead><tbody>
      {rows.map((row) => <tr key={row.id} className="border-b border-[#ddd] odd:bg-white even:bg-[#faf9f7]"><td className={`${classic ? "px-2 py-1" : "p-3"} font-bold`}>{row.number}</td><td className={classic ? "px-2 py-1" : "p-3"}>{"customer" in row ? row.customer : row.supplier}</td><td className={`${classic ? "px-2 py-1" : "p-3"} whitespace-nowrap`}>{formatPlatformDateTime(row.date)}</td><td className={classic ? "px-2 py-1" : "p-3"}>{row.items.reduce((sum, item) => sum + item.quantity, 0)} units</td><td className={classic ? "px-2 py-1" : "p-3"}>{paymentLabel(row.paymentMethod)}</td><td className={classic ? "px-2 py-1" : "p-3"}>{row.paymentStatus}</td><td className={`${classic ? "px-2 py-1" : "p-3"} text-right font-bold`}>{row.total == null ? "Restricted" : money(row.total)}</td><td className={classic ? "px-2 py-1" : "p-3"}><div className="flex justify-end gap-1">{kind === "sale" && "customer" in row && <Button size="sm" variant="outline" onClick={() => onOpen?.(row)} className={classic ? "h-6 rounded-none border-[#999] px-2 text-[11px]" : ""}>Open</Button>}{allowVoid && row.status !== "CANCELLED" && row.paymentStatus !== "VOID" && <Button size="sm" variant="ghost" className={`text-rose-600 ${classic ? "h-6 rounded-none px-2 text-[11px]" : ""}`} onClick={() => onVoid(kind, row.id, row.number)}><XCircle size={13} /> Void</Button>}</div></td></tr>)}
      {!rows.length && <tr><td colSpan={8} className={`text-center text-[#666] ${classic ? "p-8" : "p-10"}`}>{empty}</td></tr>}
    </tbody></RecordTable></div>
  </section>;
}

function SalesReturnPanel({ sales, history, orderId, setOrderId, productId, setProductId, quantity, setQuantity, reason, setReason, refundMethod, setRefundMethod, expiredReturn, onSubmit, busy }: { sales: CommerceSale[]; history: CommerceSalesReturn[]; orderId: string; setOrderId: (value: string) => void; productId: string; setProductId: (value: string) => void; quantity: string; setQuantity: (value: string) => void; reason: string; setReason: (value: string) => void; refundMethod: "CASH" | "CREDIT"; setRefundMethod: (value: "CASH" | "CREDIT") => void; expiredReturn: boolean; onSubmit: () => void; busy: boolean }) {
  const selected = sales.find((x) => x.id === orderId);
  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
    <form onSubmit={event => { event.preventDefault(); void onSubmit(); }}><EntityFormPanel><Card className={expiredReturn ? "border-amber-300" : ""}>
      <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw size={18} className="text-[#003893]" />{expiredReturn ? "Expired product return" : "Sales returns"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {expiredReturn && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Returned units will be marked as quarantined and excluded from saleable stock.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-slate-600">Invoice / sale<Select value={orderId} onChange={(e) => { setOrderId(e.target.value); setProductId(""); }}><option value="">Select sale</option>{sales.filter((x) => x.status !== "CANCELLED").map((x) => <option key={x.id} value={x.id}>{x.invoiceNumber || x.number} · {x.customer}</option>)}</Select></label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Sold product<Select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!selected}><option value="">Select product</option>{selected?.items.map((x) => <option key={x.productId} value={x.productId}>{x.product} · sold {x.quantity}</option>)}</Select></label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Return quantity<Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Return / expiry reason<Input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={expiredReturn ? "e.g. expired on receipt" : "Reason for return"} /></label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Refund handling<Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as "CASH" | "CREDIT")}><option value="CREDIT">Credit customer / reduce balance</option><option value="CASH">Refund cash paid</option></Select></label>
          <div className="flex items-end"><FormSaveActions mode="create" busy={busy} onCancel={() => {}} /></div>
        </div>
      </CardContent>
    </Card></EntityFormPanel></form>
    <EntityListPanel addLabel="Add sales return"><ReturnHistory title="Recent sales returns" rows={history} /></EntityListPanel>
  </div>;
}
function PurchaseReturnPanel({ rows, suppliers, history, inventoryId, setInventoryId, supplierId, setSupplierId, quantity, setQuantity, reason, setReason, onSubmit, busy }: { rows: CommerceInventory[]; suppliers: Supplier[]; history: CommercePurchaseReturn[]; inventoryId: string; setInventoryId: (value: string) => void; supplierId: string; setSupplierId: (value: string) => void; quantity: string; setQuantity: (value: string) => void; reason: string; setReason: (value: string) => void; onSubmit: () => void; busy: boolean }) {
  const selectedBatch = rows.find((row) => row.id === inventoryId);
  const availableSuppliers = selectedBatch?.supplierId ? suppliers.filter((supplier) => supplier.id === selectedBatch.supplierId) : suppliers;
  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><form onSubmit={event => { event.preventDefault(); void onSubmit(); }}><EntityFormPanel formKey="1"><Card><CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw size={18} className="text-[#003893]" />Purchase returns</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><Select value={inventoryId} onChange={(e) => setInventoryId(e.target.value)}><option value="">Select stock batch</option>{rows.map((x) => <option key={x.id} value={x.id}>{x.product} · {x.batch} · available {x.available}</option>)}</Select><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!selectedBatch}><option value="">Select batch supplier</option>{availableSuppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select><Input type="number" min="1" max={selectedBatch?.available ?? undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" /><Input placeholder="Return reason" value={reason} onChange={(e) => setReason(e.target.value)} /><FormSaveActions mode="create" busy={busy} onCancel={() => {}} /></CardContent></Card></EntityFormPanel></form><EntityListPanel formKey="1" addLabel="Add purchase return"><ReturnHistory title="Recent purchase returns" rows={history} /></EntityListPanel></div>;
}
function ReturnHistory({ title, rows }: { title: string; rows: (CommerceSalesReturn | CommercePurchaseReturn)[] }) { const salesHistory = title.toLowerCase().includes("sales") || rows.some((row) => "returnType" in row); return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><RecordTable className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Return</th>{salesHistory && <th className="p-3">Type</th>}<th className="p-3">Party</th><th className="p-3">Date</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3 font-bold">{row.number}</td>{salesHistory && <td className="p-3">{"returnType" in row && row.returnType === "EXPIRED" ? <Badge variant="destructive">Expired</Badge> : "Standard"}</td>}<td className="p-3">{"customer" in row ? row.customer : row.supplier}</td><td className="p-3">{formatPlatformDate(row.date)}</td><td className="p-3 text-right font-bold">{row.amount == null ? "Restricted" : money(row.amount)}</td></tr>)}{!rows.length && <tr><td colSpan={salesHistory ? 5 : 4} className="p-8 text-center text-slate-500">No returns in this period.</td></tr>}</tbody></RecordTable></div></CardContent></Card>; }

function CreditSection({ allowReceive, allowPay, data, customers, suppliers, customerParty, setCustomerParty, supplierParty, setSupplierParty, amount, setAmount, method, setMethod, busy, onCustomerPayment, onSupplierPayment }: { allowReceive: boolean; allowPay: boolean; data: CommerceCreditLedger | null; customers: Party[]; suppliers: Supplier[]; customerParty: string; setCustomerParty: (value: string) => void; supplierParty: string; setSupplierParty: (value: string) => void; amount: string; setAmount: (value: string) => void; method: string; setMethod: (value: string) => void; busy: boolean; onCustomerPayment: () => void; onSupplierPayment: () => void }) { return <div className="space-y-6"><EntityFormPanel formKey="0"><CreditPaymentEntry title="Receive customer payment" parties={customers} party={customerParty} setParty={setCustomerParty} amount={amount} setAmount={setAmount} method={method} setMethod={setMethod} busy={busy || !allowReceive} submit={onCustomerPayment}/></EntityFormPanel><EntityFormPanel formKey="1"><CreditPaymentEntry title="Pay supplier" parties={suppliers} party={supplierParty} setParty={setSupplierParty} amount={amount} setAmount={setAmount} method={method} setMethod={setMethod} busy={busy || !allowPay} submit={onSupplierPayment}/></EntityFormPanel><EntityListPanel formKey="0" addLabel="Receive customer payment" canAdd={allowReceive}><LedgerCustomers rows={data?.customers ?? []}/></EntityListPanel><EntityListPanel formKey="1" addLabel="Pay supplier" canAdd={allowPay}><LedgerSuppliers rows={data?.suppliers ?? []}/></EntityListPanel></div>; }
function LedgerCustomers({ rows }: { rows: CommerceCreditLedger["customers"] }) { return <Card><CardHeader><CardTitle>Customer Udharo</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><RecordTable className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Customer</th><th className="p-3">0–30</th><th className="p-3">31–60</th><th className="p-3">60+</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-3 font-bold">{x.name}</td><td className="p-3">{money(x.aging0To30)}</td><td className="p-3">{money(x.aging31To60)}</td><td className="p-3">{money(x.aging60Plus)}</td><td className="p-3 text-right font-bold">{money(x.balance)}</td></tr>)}</tbody></RecordTable></div></CardContent></Card>; }
function LedgerSuppliers({ rows }: { rows: CommerceCreditLedger["suppliers"] }) { return <Card><CardHeader><CardTitle>Supplier Payables &amp; Credits</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><RecordTable className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Supplier</th><th className="p-3">Open invoices</th><th className="p-3 text-right">Net balance</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-3 font-bold">{x.name}</td><td className="p-3">{x.invoices}</td><td className={`p-3 text-right font-bold ${x.balance < 0 ? "text-emerald-700" : ""}`}>{x.balance < 0 ? `Supplier credit ${money(-x.balance)}` : money(x.balance)}</td></tr>)}</tbody></RecordTable></div></CardContent></Card>; }

function InvoicePreview({ invoice, companyName, onClose }: { invoice: CommerceSale; companyName: string; onClose: () => void }) {
  const [copies, setCopies] = useState("1");
  const [preview, setPreview] = useState(false);
  const copyCount = Math.min(10, Math.max(1, Number(copies) || 1));
  const copiesToPrint = Array.from({ length: copyCount }, (_, index) => index);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent overlayClassName="z-[80] bg-slate-950/30" className="z-[90] max-w-[470px] gap-0 rounded-sm border border-[#888] bg-[#f2f1ef] p-0 text-[#333] shadow-xl [&>button:last-child]:hidden">
      <DialogHeader className="border-b border-[#d3d1ce] px-3 py-2 pr-10"><DialogTitle className="text-sm font-normal">Bill print</DialogTitle><DialogDescription className="sr-only">Choose the number of invoice copies, preview the saved invoice, or print it.</DialogDescription></DialogHeader>
      <button type="button" className="w-fit px-3 py-1 text-left text-xs hover:bg-[#e3e2df]" onClick={onClose}>Exit</button>
      <div className="space-y-3 px-3 pb-3">
        <div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm"><span>Invoice No.</span><div className="border border-[#9b9b9b] bg-white px-2 py-1.5">{invoice.invoiceNumber || invoice.number}</div></div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm"><label htmlFor="sales-invoice-copies">No. of Copies</label><Input id="sales-invoice-copies" type="number" min="1" max="10" step="1" value={copies} onChange={(event) => setCopies(event.target.value)} className="h-8 rounded-none border-[#9b9b9b] bg-white px-2" /></div>
        {preview && <div className="max-h-[52vh] overflow-auto border border-[#aaa] bg-white p-3"><InvoicePrintCopies invoice={invoice} companyName={companyName} copies={copiesToPrint} /></div>}
        <DialogFooter className="grid grid-cols-3 gap-1 border-t border-[#d3d1ce] pt-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => printArea("sales-invoice-print-copies")} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">Print</Button>
          <Button type="button" variant="outline" onClick={() => setPreview((value) => !value)} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{preview ? "Hide Preview" : "Preview"}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">Close</Button>
        </DialogFooter>
        <div className="fixed left-[-10000px] top-0"><InvoicePrintCopies invoice={invoice} companyName={companyName} copies={copiesToPrint} printable /></div>
      </div>
    </DialogContent>
  </Dialog>;
}

function InvoicePrintCopies({ invoice, companyName, copies, printable = false }: { invoice: CommerceSale; companyName: string; copies: number[]; printable?: boolean }) {
  return <div id={printable ? "sales-invoice-print-copies" : undefined} className="space-y-5 bg-white text-sm text-black">{copies.map((copy) => <article key={copy} className="invoice-copy min-h-[250px] space-y-4 p-3 print:min-h-0 print:p-8">
    <header className="flex justify-between gap-4 border-b border-black pb-3"><div><p className="font-bold uppercase">{companyName}</p><h2 className="mt-1 text-xl font-bold">Tax Invoice</h2><p>{invoice.invoiceNumber || invoice.number}</p></div><div className="text-right"><p>Date: {formatPlatformDate(invoice.date)}</p><p>Branch: {invoice.branch || "—"}</p><p>Copy {copy + 1}</p></div></header>
    <div className="grid grid-cols-2 gap-1"><p><b>Party:</b> {invoice.customer}</p><p><b>Phone:</b> {invoice.customerPhone || "—"}</p><p><b>PAN:</b> {invoice.panNumber || "—"}</p><p><b>Payment:</b> {paymentLabel(invoice.paymentMethod)} · {invoice.paymentStatus}</p></div>
    <RecordTable className="w-full border-collapse text-left text-xs"><thead><tr className="border-y border-black"><th className="py-1">Particular</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Amount</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b border-gray-300"><td className="py-1">{item.product}{item.bonusQuantity ? ` · Bonus ${item.bonusQuantity}` : ""}</td><td className="py-1 text-right">{item.quantity} {item.unit || ""}</td><td className="py-1 text-right">{money(item.unitPrice)}</td><td className="py-1 text-right">{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></RecordTable>
    <div className="ml-auto max-w-xs space-y-1 text-right"><p>Amount: {money(invoice.subtotal ?? invoice.total - (invoice.taxAmount ?? 0))}</p><p>Discount: {money(invoice.discountAmount ?? 0)}</p><p>VAT: {money(invoice.taxAmount ?? 0)}</p><p className="border-t border-black pt-1 font-bold">Net: {money(invoice.total)}</p><p>Paid: {money(invoice.paidAmount ?? 0)} · Balance: {money(Math.max(0, invoice.total - (invoice.paidAmount ?? 0)))}</p></div>
  </article>)}</div>;
}

function CreditPaymentEntry({ title, parties, party, setParty, amount, setAmount, method, setMethod, busy, submit }: { title:string;parties:{id:string;name:string}[];party:string;setParty:(value:string)=>void;amount:string;setAmount:(value:string)=>void;method:string;setMethod:(value:string)=>void;busy:boolean;submit:()=>void }) {return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><form onSubmit={event=>{event.preventDefault();submit();}} className="grid gap-4"><label className="grid gap-1 text-sm font-semibold">Party<Select required value={party} onChange={e=>setParty(e.target.value)}><option value="">Choose party</option>{parties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select></label><label className="grid gap-1 text-sm font-semibold">Amount<Input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="grid gap-1 text-sm font-semibold">Method<Select value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option></Select></label><FormSaveActions mode="create" busy={busy} onCancel={()=>{}}/></form></CardContent></Card>; }
