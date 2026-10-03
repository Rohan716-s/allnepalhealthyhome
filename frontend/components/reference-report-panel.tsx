"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Printer, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPlatformDate } from "@/lib/date-time";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import { cancelInventoryAdjustment, getCommerceProducts, getCommerceSaleByInvoice, getCommerceSales, getCommerceSalesReturnByNumber, getCommerceSalesReturns, getInventoryMovements, getInventoryProductMaster, getPurchaseChangeInSupplier, getSalesChangeInDebtors, getSalesUserCashSummary, type AccountingSummary, type CommerceCreditLedger, type CommerceInventory, type CommerceProduct, type CommercePurchase, type CommercePurchaseReturn, type CommerceSale, type CommerceSalesReturn, type DebtorChangeReport, type InventoryMovement, type InventoryProductMaster, type SupplierChangeReport, type UserCashSummaryRow } from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";
import { CashHandoverPanel } from "@/components/cash-handover-panel";
import { ReturnCancellationPanel } from "@/components/return-cancellation-panel";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { toast } from "sonner";
import { PurchaseAdditionalInfoEditor, PurchaseCorrectionPanel } from "@/components/purchase-reference-workflows";

const money = (value: number) => `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Row = Record<string, string | number>;
const sumNullable = (values: (number | null | undefined)[]) => values.some((value) => value != null) ? money(values.reduce<number>((sum, value) => sum + (value ?? 0), 0)) : "Not tracked";
function printArea(id: string) {
  const style = document.createElement("style");
  style.dataset.printArea = id;
  style.textContent = `@media print { body * { visibility: hidden !important; } #${id}, #${id} * { visibility: visible !important; } #${id} { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; height: auto !important; max-height: none !important; overflow: visible !important; background: white !important; } #${id} .overflow-auto, #${id} .overflow-y-auto, #${id} .overflow-x-auto { max-height: none !important; overflow: visible !important; } #${id} .sales-report-no-print { display: none !important; } }`;
  document.head.append(style);
  window.addEventListener("afterprint", () => style.remove(), { once: true });
  window.print();
}

export function ReferenceReportPanel({ action, sales, purchases, salesReturns, purchaseReturns, inventory, products, credit, accountingSummary, branchId, branches, from, to, setFrom, setTo, token, superAdmin, allowAllFirms, companyName, labelFor, onClose, onSaved, onCorrectPurchase }: {
  action: PharmacyMenuAction;
  sales: CommerceSale[];
  purchases: CommercePurchase[];
  salesReturns: CommerceSalesReturn[];
  purchaseReturns: CommercePurchaseReturn[];
  inventory: CommerceInventory[];
  products: CommerceProduct[];
  credit: CommerceCreditLedger | null;
  accountingSummary: AccountingSummary | null;
  branchId: string;
  branches: import("@/services/api").AdminBranch[];
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  token: string;
  superAdmin: boolean;
  allowAllFirms: boolean;
  companyName: string;
  labelFor: (label: string) => string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCorrectPurchase: (purchase: CommercePurchase) => void;
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedMovementId, setSelectedMovementId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [stockMisGroup, setStockMisGroup] = useState<"Company" | "Product" | "Sector" | "Party">("Sector");
  const [movementRows, setMovementRows] = useState<InventoryMovement[]>([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [productMasterRows, setProductMasterRows] = useState<InventoryProductMaster[]>([]);
  const [productMasterLoading, setProductMasterLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [reportCompany, setReportCompany] = useState("");
  const [movementType, setMovementType] = useState("");
  const [userCashRows, setUserCashRows] = useState<UserCashSummaryRow[]>([]);
  const [userCashLoading, setUserCashLoading] = useState(false);
  const [userCashError, setUserCashError] = useState("");
  const [includeCard, setIncludeCard] = useState(true);
  const [reportAllFirm, setReportAllFirm] = useState(false);
  const [allFirmSales, setAllFirmSales] = useState<CommerceSale[]>([]);
  const [allFirmReturns, setAllFirmReturns] = useState<CommerceSalesReturn[]>([]);
  const [allFirmSalesLoading, setAllFirmSalesLoading] = useState(false);
  const [debtorChange, setDebtorChange] = useState<DebtorChangeReport | null>(null);
  const [debtorLoading, setDebtorLoading] = useState(false);
  const [debtorError, setDebtorError] = useState("");
  const [supplierChange, setSupplierChange] = useState<SupplierChangeReport | null>(null);
  const [supplierChangeLoading, setSupplierChangeLoading] = useState(false);
  const [supplierChangeError, setSupplierChangeError] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState("");
  const [creditNoteSearch, setCreditNoteSearch] = useState("");
  const [invoiceLookup, setInvoiceLookup] = useState<CommerceSale | null>(null);
  const [creditNoteLookup, setCreditNoteLookup] = useState<CommerceSalesReturn | null>(null);
  const [documentLookupLoading, setDocumentLookupLoading] = useState(false);
  const [salesTool, setSalesTool] = useState<"price-list" | "generic-list" | "calculator" | "telephone" | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [salesCatalogRows, setSalesCatalogRows] = useState<CommerceProduct[]>(products);
  const [salesCatalogLoading, setSalesCatalogLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calculatorLeft, setCalculatorLeft] = useState("");
  const [calculatorRight, setCalculatorRight] = useState("");
  const [calculatorOperator, setCalculatorOperator] = useState("+");
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const reportTitle = action.title.toLowerCase();
  const wantsMovements = action.section === "inventory" && (reportTitle === "stock register" || reportTitle.includes("partywise stock register") || action.mode === "adjustment-slip" || action.mode === "adjustment-cancel");
  const wantsProductMaster = action.section === "inventory" && ["no stock", "below limit", "over stock", "product lock", "non-slow"].some((term) => reportTitle.includes(term));
  const wantsUserCashSummary = action.section === "sales" && reportTitle === "user cash summary";
  const wantsDebtorChange = action.section === "sales" && reportTitle === "change in debtors";
  const wantsSupplierChange = action.section === "purchases" && reportTitle === "change in supplier";
  const wantsSalesAggregateData = action.section === "sales" && (reportTitle.includes("company wise") || reportTitle.includes("companywise") || reportTitle.includes("statement company") || reportTitle.includes("net sales - all credit + cash party") || titleIncludesPartywiseNet(action.title));
  useEffect(() => {
    if (action.section !== "sales") return;
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === "F9") { event.preventDefault(); setSalesTool("price-list"); }
      else if (event.key === "F10") { event.preventDefault(); setSalesTool("generic-list"); }
      else if (event.key === "F8") { event.preventDefault(); setSalesTool("calculator"); }
      else if (event.key === "F4") { event.preventDefault(); setSalesTool("telephone"); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [action.section]);
  useEffect(() => {
    if (salesTool !== "price-list" && salesTool !== "generic-list") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSalesCatalogLoading(true);
      void getCommerceProducts(token, catalogSearch.trim() || undefined, branchId || undefined, superAdmin)
        .then((result) => { if (active) setSalesCatalogRows(result); })
        .catch((error: unknown) => { if (active) { setSalesCatalogRows([]); toast.error(error instanceof Error ? error.message : "The product list could not be loaded."); } })
        .finally(() => { if (active) setSalesCatalogLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, catalogSearch, salesTool, superAdmin, token]);
  useEffect(() => {
    if (!wantsMovements) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setMovementLoading(true); setMovementError("");
      void getInventoryMovements(token, { branchId: branchId || undefined, from: from || undefined, to: to || undefined }, superAdmin)
        .then((result) => { if (active) setMovementRows(result); })
        .catch((error: unknown) => { if (active) setMovementError(error instanceof Error ? error.message : "Stock movement history could not be loaded."); })
        .finally(() => { if (active) setMovementLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, from, superAdmin, to, token, wantsMovements]);
  useEffect(() => {
    if (!wantsProductMaster) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setProductMasterLoading(true);
      void getInventoryProductMaster(token, undefined, superAdmin, branchId || undefined)
        .then((result) => { if (active) setProductMasterRows(result); })
        .catch((error: unknown) => { if (active) { setProductMasterRows([]); toast.error(error instanceof Error ? error.message : "Product stock analysis could not be loaded."); } })
        .finally(() => { if (active) setProductMasterLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, superAdmin, token, wantsProductMaster]);
  useEffect(() => {
    if (!wantsUserCashSummary) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setUserCashLoading(true); setUserCashError("");
      void getSalesUserCashSummary(token, { from: from || undefined, to: to || undefined, branchId: reportAllFirm ? undefined : branchId || undefined, includeCard }, superAdmin)
        .then((result) => { if (active) setUserCashRows(result); })
        .catch((error: unknown) => { if (active) { setUserCashRows([]); setUserCashError(error instanceof Error ? error.message : "User cash summary could not be loaded."); } })
        .finally(() => { if (active) setUserCashLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, from, includeCard, reportAllFirm, superAdmin, to, token, wantsUserCashSummary]);
  useEffect(() => {
    if (!wantsSalesAggregateData || !reportAllFirm) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setAllFirmSalesLoading(true);
      void Promise.all([
        getCommerceSales(token, { from: from || undefined, to: to || undefined }, superAdmin),
        getCommerceSalesReturns(token, { from: from || undefined, to: to || undefined }, superAdmin),
      ]).then(([saleRows, returnRows]) => { if (active) { setAllFirmSales(saleRows); setAllFirmReturns(returnRows); } })
        .catch((error: unknown) => { if (active) { setAllFirmSales([]); setAllFirmReturns([]); toast.error(error instanceof Error ? error.message : "The all-firm sales report could not be loaded."); } })
        .finally(() => { if (active) setAllFirmSalesLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [from, reportAllFirm, superAdmin, to, token, wantsSalesAggregateData]);
  useEffect(() => {
    if (!wantsDebtorChange) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setDebtorLoading(true); setDebtorError("");
      void getSalesChangeInDebtors(token, { from: from || undefined, to: to || undefined, branchId: reportAllFirm ? undefined : branchId || undefined }, superAdmin)
        .then((result) => { if (active) setDebtorChange(result); })
        .catch((error: unknown) => { if (active) { setDebtorChange(null); setDebtorError(error instanceof Error ? error.message : "Debtor movement could not be loaded."); } })
        .finally(() => { if (active) setDebtorLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, from, reportAllFirm, superAdmin, to, token, wantsDebtorChange]);
  useEffect(() => {
    if (!wantsSupplierChange) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setSupplierChangeLoading(true); setSupplierChangeError("");
      void getPurchaseChangeInSupplier(token, { from: from || undefined, to: to || undefined, branchId: branchId || undefined }, superAdmin)
        .then((result) => { if (active) setSupplierChange(result); })
        .catch((error: unknown) => { if (active) { setSupplierChange(null); setSupplierChangeError(error instanceof Error ? error.message : "Supplier balance movement could not be loaded."); } })
        .finally(() => { if (active) setSupplierChangeLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, from, superAdmin, to, token, wantsSupplierChange]);
  const reportSales = reportAllFirm && wantsSalesAggregateData ? allFirmSales : sales;
  const reportSalesReturns = reportAllFirm && wantsSalesAggregateData ? allFirmReturns : salesReturns;
  const { rows, notice } = useMemo<{ rows: Row[]; notice: string }>(() => {
    const title = action.title.toLowerCase();

    if (action.section === "sales") {
      if (title === "user cash summary") {
        const totals = userCashRows.reduce((sum, item) => ({ cashReceive: sum.cashReceive + item.cashReceive, sales: sum.sales + item.sales, receipt: sum.receipt + item.receipt, card: sum.card + (item.card ?? 0), returns: sum.returns + item.return, net: sum.net + item.net, handOver: sum.handOver + item.handOver }), { cashReceive: 0, sales: 0, receipt: 0, card: 0, returns: 0, net: 0, handOver: 0 });
        return {
        rows: [...userCashRows.map((item) => ({
          UserName: item.userName, Cash_Receive: money(item.cashReceive), Sales: money(item.sales), Receipt: money(item.receipt),
          Card: !includeCard ? "Excluded" : item.card == null ? "Not tracked" : money(item.card),
          "OPD-Copy": item.opdCopy == null ? "Not tracked" : money(item.opdCopy), DrNote: item.drNote == null ? "Not tracked" : money(item.drNote),
          CashIn: item.cashIn == null ? "Not tracked" : money(item.cashIn), Return: money(item.return),
          CashOld: item.cashOld == null ? "Not tracked" : money(item.cashOld), CrNote: item.crNote == null ? "Not tracked" : money(item.crNote),
          Purch: item.purch == null ? "Not tracked" : money(item.purch), Net: money(item.net), "Hand Over": money(item.handOver),
        })), { UserName: "Total", Cash_Receive: money(totals.cashReceive), Sales: money(totals.sales), Receipt: money(totals.receipt), Card: !includeCard ? "Excluded" : userCashRows.some((item) => item.card != null) ? money(totals.card) : "Not tracked", "OPD-Copy": sumNullable(userCashRows.map((item) => item.opdCopy)), DrNote: sumNullable(userCashRows.map((item) => item.drNote)), CashIn: sumNullable(userCashRows.map((item) => item.cashIn)), Return: money(totals.returns), CashOld: sumNullable(userCashRows.map((item) => item.cashOld)), CrNote: sumNullable(userCashRows.map((item) => item.crNote)), Purch: sumNullable(userCashRows.map((item) => item.purch)), Net: money(totals.net), "Hand Over": money(totals.handOver) }],
        notice: "Cash sales, receipts, returns, card payments, debtor notes, cash-ins, purchases and handovers use values returned by the report API. A field with no source transactions is shown as Not tracked rather than estimated.",
      };
      }
      if (title === "change in debtors") return {
        rows: (debtorChange?.rows ?? []).map((item) => ({ Date: formatPlatformDate(item.date), "Opening Debtor": money(item.openingDebtor), "Closing Debtor": money(item.closingDebtor), Increase: money(item.increase) })).concat(debtorChange ? [{ Date: "Total", "Opening Debtor": money(debtorChange.openingDebtor), "Closing Debtor": money(debtorChange.closingDebtor), Increase: money(debtorChange.total) }] : []),
        notice: "Daily opening and closing debtor amounts are calculated from the persisted customer-ledger debit and credit entries, scoped to the selected branch and date range.",
      };
      if (title.includes("insurance")) return {
        rows: sales.filter((x) => x.insuranceProvider).map((x) => ({ Invoice: x.invoiceNumber || x.number, Date: formatPlatformDate(x.date), Customer: x.customer, "Insurance provider": x.insuranceProvider!, "Policy / claim": x.insurancePolicyNumber || "—", PAN: x.panNumber || "—", Subtotal: money(x.subtotal ?? x.total - (x.taxAmount ?? 0)), VAT: money(x.taxAmount ?? 0), Total: money(x.total), Branch: x.branch || "—" })),
        notice: "Insurance sales are identified only when the POS bill was saved with an insurance provider and are shown with the stored invoice and customer details.",
      };
      if (title.includes("vat register summary")) {
        const subtotal = sales.reduce((sum, x) => sum + (x.subtotal ?? x.total - (x.taxAmount ?? 0)), 0);
        const tax = sales.reduce((sum, x) => sum + (x.taxAmount ?? 0), 0);
        return { rows: [{ Bills: sales.length, "Taxable amount": money(subtotal), VAT: money(tax), "Gross amount": money(sales.reduce((sum, x) => sum + x.total, 0)) }], notice: "VAT totals use the saved invoice amounts returned by the sales API." };
      }
      if (title.includes("vat register")) return {
        rows: sales.map((x) => ({ Invoice: x.invoiceNumber || x.number, Date: formatPlatformDate(x.date), Customer: x.customer, PAN: x.panNumber || "—", "Taxable amount": money(x.subtotal ?? x.total - (x.taxAmount ?? 0)), VAT: money(x.taxAmount ?? 0), Discount: money(x.discountAmount ?? 0), Total: money(x.total), Paid: money(x.paidAmount ?? 0) })),
        notice: "This register reads persisted invoice subtotal, tax, discount, payment, PAN, and invoice-number values; older non-POS records without an invoice are shown with their available order values.",
      };
      if (title.includes("userwise") || title.includes("sales man") || title.includes("mrwise") || title.includes("salesperson")) {
        if (title.includes("mrwise product")) {
          const grouped = new Map<string, { salesperson: string; product: string; quantity: number; sales: number; invoices: Set<string> }>();
          sales.forEach((sale) => sale.items.forEach((item) => {
            const salesperson = sale.salesPerson || "Not recorded (online / legacy)";
            const key = `${salesperson}\u0000${item.productId}`;
            const row = grouped.get(key) ?? { salesperson, product: item.product, quantity: 0, sales: 0, invoices: new Set<string>() };
            row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; row.invoices.add(sale.id); grouped.set(key, row);
          }));
          return { rows: [...grouped.values()].map((row) => ({ "Sales person / MR": row.salesperson, Product: row.product, Quantity: row.quantity, Invoices: row.invoices.size, Sales: money(row.sales) })), notice: "MR/product totals use the staff attribution saved with each POS invoice and its actual product lines. Orders without an attributed staff member remain explicitly unassigned." };
        }
        if (title.includes("sales man vs product")) {
          const grouped = new Map<string, { salesperson: string; product: string; quantity: number; sales: number; transactions: Set<string> }>();
          sales.forEach((sale) => sale.items.forEach((item) => {
            const salesperson = sale.salesPerson || "Not recorded (online / legacy)";
            const key = `${salesperson}\u0000${item.productId}`;
            const row = grouped.get(key) ?? { salesperson, product: item.product, quantity: 0, sales: 0, transactions: new Set<string>() };
            row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; row.transactions.add(sale.id); grouped.set(key, row);
          }));
          return { rows: [...grouped.values()].map((row) => ({ "Sales person / MR": row.salesperson, Product: row.product, Quantity: row.quantity, Transactions: row.transactions.size, Sales: money(row.sales) })), notice: "Sales-person/product rows use the saved POS actor and invoice line items; online or legacy sales without an actor are explicitly unassigned." };
        }
        const grouped = new Map<string, { invoices: number; total: number; quantity: number; products: Map<string, number> }>();
        sales.forEach((sale) => {
          const seller = sale.salesPerson || "Not recorded (online / legacy)";
          const row = grouped.get(seller) ?? { invoices: 0, total: 0, quantity: 0, products: new Map<string, number>() };
          row.invoices += 1; row.total += sale.total;
          sale.items.forEach((item) => { row.quantity += item.quantity; row.products.set(item.product, (row.products.get(item.product) ?? 0) + item.quantity); });
          grouped.set(seller, row);
        });
        return { rows: [...grouped.entries()].map(([seller, x]) => ({ "Sales person / MR": seller, Invoices: x.invoices, Units: x.quantity, Sales: money(x.total), Products: [...x.products.keys()].join(", ") })), notice: "Salesperson attribution comes from the recorded staff actor on POS sale audit entries. Online orders and older records without a staff actor stay explicitly unassigned." };
      }
      if (title.includes("areawise") || title.includes("territory")) {
        if (title.includes("territory") && title.includes("product")) {
          const grouped = new Map<string, { area: string; product: string; salesperson: string; quantity: number; sales: number; transactions: Set<string> }>();
          sales.forEach((sale) => sale.items.forEach((item) => {
            const area = [sale.municipality, sale.district, sale.province].filter(Boolean).join(", ") || "Address not recorded";
            const salesperson = sale.salesPerson || "Not recorded";
            const key = `${area}\u0000${item.productId}\u0000${salesperson}`;
            const row = grouped.get(key) ?? { area, product: item.product, salesperson, quantity: 0, sales: 0, transactions: new Set<string>() };
            row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; row.transactions.add(sale.id); grouped.set(key, row);
          }));
          return { rows: [...grouped.values()].map((row) => ({ Territory: row.area, Product: row.product, "Sales person / MR": row.salesperson, Quantity: row.quantity, Transactions: row.transactions.size, Sales: money(row.sales) })), notice: "Territory/product rows are derived from saved order addresses, catalog products and recorded POS salesperson attribution." };
        }
        const grouped = new Map<string, { invoices: number; sales: number; parties: Set<string> }>();
        sales.forEach((sale) => { const area = [sale.municipality, sale.district, sale.province].filter(Boolean).join(", ") || "Address not recorded"; const row = grouped.get(area) ?? { invoices: 0, sales: 0, parties: new Set<string>() }; row.invoices += 1; row.sales += sale.total; row.parties.add(sale.customer); grouped.set(area, row); });
        return { rows: [...grouped.entries()].map(([area, x]) => ({ Area: area, Invoices: x.invoices, Parties: x.parties.size, Sales: money(x.sales) })), notice: "Area groupings are derived from the address saved on each actual order; orders without an address are listed separately." };
      }
      if (title.includes("sales by category") || title.includes("productwise sales by category")) {
        const grouped = new Map<string, { quantity: number; value: number }>();
        sales.forEach((sale) => sale.items.forEach((item) => { const category = item.category || "Unclassified"; const row = grouped.get(category) ?? { quantity: 0, value: 0 }; row.quantity += item.quantity; row.value += item.quantity * item.unitPrice; grouped.set(category, row); }));
        return { rows: [...grouped.entries()].map(([category, x]) => ({ Category: category, Quantity: x.quantity, Sales: money(x.value) })), notice: "Category totals use the product-to-medicine-category relationship from the live catalog." };
      }
      if (title.includes("sales statement company mr")) {
        const grouped = new Map<string, { company: string; salesperson: string; invoices: Set<string>; units: number; sales: number }>();
        reportSales.forEach((sale) => sale.items.forEach((item) => {
          const company = item.manufacturer || "Manufacturer not recorded";
          const salesperson = sale.salesPerson || "Not recorded (online / legacy)";
          const key = `${company}\u0000${salesperson}`;
          const row = grouped.get(key) ?? { company, salesperson, invoices: new Set<string>(), units: 0, sales: 0 };
          row.invoices.add(sale.id); row.units += item.quantity; row.sales += item.quantity * item.unitPrice; grouped.set(key, row);
        }));
        return { rows: [...grouped.values()].map((row) => ({ Company: row.company, "Sales person / MR": row.salesperson, Invoices: row.invoices.size, Units: row.units, Sales: money(row.sales) })), notice: "This statement groups actual invoice product lines by their recorded manufacturer and the staff member attributed to the invoice; missing attribution is shown as unassigned." };
      }
      if (title.includes("companywise sales book")) {
        const rows = reportSales.flatMap((sale) => {
          const lineBase = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
          return sale.items.map((item) => {
            const base = item.quantity * item.unitPrice;
            const share = lineBase > 0 ? base / lineBase : 0;
            const discount = (sale.discountAmount ?? 0) * share;
            const vat = (sale.taxAmount ?? 0) * share;
            return { Company: item.manufacturer || "Manufacturer not recorded", Invoice: sale.invoiceNumber || sale.number, Date: formatPlatformDate(sale.date), Party: sale.customer, Product: item.product, Qty: item.quantity, Rate: money(item.unitPrice), Amount: money(base), Discount: money(discount), VAT: money(vat), Net: money(base - discount + vat), Payment: sale.paymentMethod.replaceAll("_", " "), Branch: sale.branch || "—" };
          });
        });
        return { rows, notice: "Invoice-level company book rows are derived from saved sales and product lines; manufacturer names come from the live product catalog and invoice discounts/VAT are allocated proportionally across lines." };
      }
      if (title.includes("sales book all") || title === "sales book") {
        const rows = reportSales.flatMap((sale) => {
          const lineBase = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
          return sale.items.map((item) => {
            const base = item.quantity * item.unitPrice;
            const share = lineBase > 0 ? base / lineBase : 0;
            const discount = (sale.discountAmount ?? 0) * share;
            const vat = (sale.taxAmount ?? 0) * share;
            return { Invoice: sale.invoiceNumber || sale.number, Date: formatPlatformDate(sale.date), Party: sale.customer, Product: item.product, Qty: item.quantity, Rate: money(item.unitPrice), Amount: money(base), Discount: money(discount), VAT: money(vat), Net: money(base - discount + vat), Payment: sale.paymentMethod.replaceAll("_", " "), Branch: sale.branch || "—" };
          });
        });
        return { rows, notice: "The all-sales book lists saved invoices at product-line level. Discount and VAT amounts are allocated by each line's share of the invoice's pre-tax product value." };
      }
      if (title.includes("companywise") || title.includes("company wise") || title.includes("statement company")) {
        const grouped = new Map<string, { salesAmount: number; salesDiscount: number; returnAmount: number; returnDiscount: number; expiredAmount: number; expiredDiscount: number }>();
        const groupFor = (company: string) => { const row = grouped.get(company) ?? { salesAmount: 0, salesDiscount: 0, returnAmount: 0, returnDiscount: 0, expiredAmount: 0, expiredDiscount: 0 }; grouped.set(company, row); return row; };
        const salesById = new Map(reportSales.map((sale) => [sale.id, sale]));
        reportSales.forEach((sale) => {
          const lineBase = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
          sale.items.forEach((item) => {
            const company = item.manufacturer || "Manufacturer not recorded"; const row = groupFor(company); const base = item.quantity * item.unitPrice; const ratio = lineBase > 0 ? base / lineBase : 0;
            row.salesAmount += base; row.salesDiscount += (sale.discountAmount ?? 0) * ratio;
          });
        });
        reportSalesReturns.filter((item) => item.status.toUpperCase() === "APPROVED" && item.orderId).forEach((item) => {
          const sale = salesById.get(item.orderId!); if (!sale) return;
          item.items.forEach((returned) => {
            const sold = sale.items.find((line) => line.productId === returned.productId); if (!sold) return;
            const company = sold.manufacturer || "Manufacturer not recorded"; const row = groupFor(company); const saleLineBase = sold.quantity * sold.unitPrice; const returnBase = returned.quantity * returned.unitPrice; const ratio = saleLineBase > 0 ? Math.min(1, returnBase / saleLineBase) : 0; const saleBase = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); const lineRatio = saleBase > 0 ? saleLineBase / saleBase : 0; const allocatedDiscount = (sale.discountAmount ?? 0) * lineRatio * ratio;
            if (item.returnType === "EXPIRED") { row.expiredAmount += returnBase; row.expiredDiscount += allocatedDiscount; }
            else { row.returnAmount += returnBase; row.returnDiscount += allocatedDiscount; }
          });
        });
        const toReportRow = (company: string, x: { salesAmount: number; salesDiscount: number; returnAmount: number; returnDiscount: number; expiredAmount: number; expiredDiscount: number }) => ({ Company: company, SalAmount: money(x.salesAmount), SalDisc: money(x.salesDiscount), TotSales: money(x.salesAmount - x.salesDiscount), RetAmount: money(x.returnAmount), RetDisc: money(x.returnDiscount), TotalReturn: money(x.returnAmount - x.returnDiscount), RetExpAmount: money(x.expiredAmount), RetExpDisc: money(x.expiredDiscount), TotExpReturn: money(x.expiredAmount - x.expiredDiscount), NetSales: money(x.salesAmount - x.salesDiscount - x.returnAmount + x.returnDiscount - x.expiredAmount + x.expiredDiscount) });
        const totals = [...grouped.values()].reduce((sum, x) => ({ salesAmount: sum.salesAmount + x.salesAmount, salesDiscount: sum.salesDiscount + x.salesDiscount, returnAmount: sum.returnAmount + x.returnAmount, returnDiscount: sum.returnDiscount + x.returnDiscount, expiredAmount: sum.expiredAmount + x.expiredAmount, expiredDiscount: sum.expiredDiscount + x.expiredDiscount }), { salesAmount: 0, salesDiscount: 0, returnAmount: 0, returnDiscount: 0, expiredAmount: 0, expiredDiscount: 0 });
        const rows = [...grouped.entries()].map(([company, values]) => toReportRow(company, values));
        rows.push(toReportRow("Total", totals));
        return { rows, notice: "Amounts are grouped by the manufacturer recorded on invoice lines. Approved standard and expired returns are separated and their original invoice discounts are allocated proportionally." };
      }
      if (action.mode === "credit-note-report" || title.includes("return")) {
        const postedReturns = salesReturns.filter((item) => item.status.toUpperCase() === "APPROVED");
        if (title.includes("datewise")) {
          const grouped = new Map<string, { returns: number; units: number; amount: number }>();
          salesReturns.forEach((item) => {
            const date = item.date.slice(0, 10);
            const row = grouped.get(date) ?? { returns: 0, units: 0, amount: 0 };
            row.returns += 1;
            row.units += item.items.reduce((sum, line) => sum + line.quantity, 0);
            if (item.status.toUpperCase() === "APPROVED") row.amount += item.amount;
            grouped.set(date, row);
          });
          return { rows: [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({ Date: formatPlatformDate(date), Returns: row.returns, Units: row.units, "Posted return amount": money(row.amount) })), notice: "Daily return totals use saved sales-return records. Only approved returns are included in posted return amounts." };
        }
        if (title.includes("partywise")) {
          const grouped = new Map<string, { returns: number; units: number; amount: number }>();
          salesReturns.forEach((item) => {
            const row = grouped.get(item.customer) ?? { returns: 0, units: 0, amount: 0 };
            row.returns += 1;
            row.units += item.items.reduce((sum, line) => sum + line.quantity, 0);
            if (item.status.toUpperCase() === "APPROVED") row.amount += item.amount;
            grouped.set(item.customer, row);
          });
          return { rows: [...grouped.entries()].map(([customer, row]) => ({ Customer: customer, Returns: row.returns, Units: row.units, "Posted return amount": money(row.amount) })), notice: "Customer totals are grouped from actual saved sales-return records; only approved returns contribute to the posted amount." };
        }
        if (title.includes("productwise")) {
          const grouped = new Map<string, { quantity: number; amount: number; returns: Set<string> }>();
          postedReturns.forEach((item) => item.items.forEach((line) => {
            const product = line.product || line.productId;
            const row = grouped.get(product) ?? { quantity: 0, amount: 0, returns: new Set<string>() };
            row.quantity += line.quantity;
            row.amount += line.quantity * line.unitPrice;
            row.returns.add(item.id);
            grouped.set(product, row);
          }));
          return { rows: [...grouped.entries()].map(([product, row]) => ({ Product: product, Returns: row.returns.size, Quantity: row.quantity, Amount: money(row.amount) })), notice: "Product return totals are calculated from approved return line items and their saved unit prices." };
        }
        if (title.includes("summary")) return {
          rows: [{ Returns: salesReturns.length, "Approved returns": postedReturns.length, "Returned units": salesReturns.reduce((sum, item) => sum + item.items.reduce((lineSum, line) => lineSum + line.quantity, 0), 0), "Posted return amount": money(postedReturns.reduce((sum, item) => sum + item.amount, 0)) }],
          notice: "Summary counts reflect saved sales returns; only approved returns contribute to the posted financial total.",
        };
        return {
          rows: salesReturns.map((x) => ({ Return: x.number, Type: x.returnType === "EXPIRED" ? "Expired / quarantined" : "Standard", Customer: x.customer, Date: formatPlatformDate(x.date), Branch: x.branch || "—", Products: x.items.map((item) => `${item.product || item.productId} × ${item.quantity}`).join(", ") || "—", Status: x.status, Amount: money(x.amount), Reason: x.reason || "—" })),
          notice: "Actual saved sales-return records for the selected reporting period and branch.",
        };
      }
      if (title.includes("partywise")) {
        const grouped = new Map<string, { party: string; address: string; sales: number; discount: number; vat: number; returns: number; returnDiscount: number; returnVat: number; credit: number; count: number }>();
        const groupFor = (key: string, party: string, address: string) => { const row = grouped.get(key) ?? { party, address, sales: 0, discount: 0, vat: 0, returns: 0, returnDiscount: 0, returnVat: 0, credit: 0, count: 0 }; grouped.set(key, row); return row; };
        const salesById = new Map(reportSales.map((sale) => [sale.id, sale]));
        reportSales.forEach((sale) => {
          const row = groupFor(sale.customerId || sale.customer, sale.customer, [sale.municipality, sale.district, sale.province].filter(Boolean).join(", ") || "Address not recorded");
          row.sales += sale.subtotal ?? sale.total - (sale.taxAmount ?? 0); row.discount += sale.discountAmount ?? 0; row.vat += sale.taxAmount ?? 0; row.credit += Math.max(0, sale.total - (sale.paidAmount ?? 0)); row.count += 1;
        });
        reportSalesReturns.filter((item) => item.status.toUpperCase() === "APPROVED" && item.orderId).forEach((item) => {
          const sale = salesById.get(item.orderId!); if (!sale) return;
          const row = groupFor(sale.customerId || sale.customer, sale.customer, [sale.municipality, sale.district, sale.province].filter(Boolean).join(", ") || "Address not recorded");
          row.returns += item.amount;
          item.items.forEach((returned) => { const sold = sale.items.find((line) => line.productId === returned.productId); if (!sold) return; const lineBase = sold.quantity * sold.unitPrice; const saleBase = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); const ratio = lineBase > 0 && saleBase > 0 ? Math.min(1, returned.quantity * returned.unitPrice / lineBase) * lineBase / saleBase : 0; row.returnDiscount += (sale.discountAmount ?? 0) * ratio; row.returnVat += (sale.taxAmount ?? 0) * ratio; });
        });
        const matching = [...grouped.values()].filter((x) => !partySearch.trim() || `${x.party} ${x.address}`.toLowerCase().includes(partySearch.trim().toLowerCase()));
        const rows = matching.map((x) => ({ Party: x.party, Address: x.address, Sales: money(x.sales + x.discount), "Sales Disc": money(x.discount), "Sales VAT": money(x.vat), "Sales Return": money(x.returns), "Return Discount": money(x.returnDiscount), "Return VAT": money(x.returnVat), Credit: money(x.credit), "D.note": "Not tracked", Net: money(x.sales - x.discount + x.vat - x.returns + x.returnDiscount - x.returnVat) }));
        const totals = matching.reduce((sum, x) => ({ sales: sum.sales + x.sales + x.discount, discount: sum.discount + x.discount, vat: sum.vat + x.vat, returns: sum.returns + x.returns, returnDiscount: sum.returnDiscount + x.returnDiscount, returnVat: sum.returnVat + x.returnVat, credit: sum.credit + x.credit, net: sum.net + x.sales - x.discount + x.vat - x.returns + x.returnDiscount - x.returnVat }), { sales: 0, discount: 0, vat: 0, returns: 0, returnDiscount: 0, returnVat: 0, credit: 0, net: 0 });
        rows.push({ Party: "Total", Address: "", Sales: money(totals.sales), "Sales Disc": money(totals.discount), "Sales VAT": money(totals.vat), "Sales Return": money(totals.returns), "Return Discount": money(totals.returnDiscount), "Return VAT": money(totals.returnVat), Credit: money(totals.credit), "D.note": "Not tracked", Net: money(totals.net) });
        return { rows, notice: "Party-level sales, saved customer address, discounts, VAT and posted returns are calculated from persisted invoices and linked return lines. Return tax/discount are allocated proportionally; PMC does not have a separate debit-note ledger." };
      }
      if (title.includes("net sales - all credit + cash party")) {
        const grouped = new Map<string, { party: string; cash: number; credit: number; returns: number; invoices: number }>();
        const groupFor = (key: string, party: string) => {
          const row = grouped.get(key) ?? { party, cash: 0, credit: 0, returns: 0, invoices: 0 };
          grouped.set(key, row);
          return row;
        };
        const salesById = new Map(reportSales.map((sale) => [sale.id, sale]));
        reportSales.forEach((sale) => {
          const row = groupFor(sale.customerId || sale.customer, sale.customer);
          if (sale.paymentMethod.toUpperCase().includes("CREDIT")) row.credit += sale.total;
          else row.cash += sale.total;
          row.invoices += 1;
        });
        reportSalesReturns.filter((item) => item.status.toUpperCase() === "APPROVED" && item.orderId).forEach((item) => {
          const sale = salesById.get(item.orderId!);
          if (sale) groupFor(sale.customerId || sale.customer, sale.customer).returns += item.amount;
        });
        const partyRows = [...grouped.values()].map((row) => ({ Party: row.party, "Cash Sales": money(row.cash), "Credit Sales": money(row.credit), Returns: money(row.returns), "Net Sales": money(row.cash + row.credit - row.returns), Invoices: row.invoices }));
        const totals = [...grouped.values()].reduce((sum, row) => ({ cash: sum.cash + row.cash, credit: sum.credit + row.credit, returns: sum.returns + row.returns, invoices: sum.invoices + row.invoices }), { cash: 0, credit: 0, returns: 0, invoices: 0 });
        partyRows.push({ Party: "Total", "Cash Sales": money(totals.cash), "Credit Sales": money(totals.credit), Returns: money(totals.returns), "Net Sales": money(totals.cash + totals.credit - totals.returns), Invoices: totals.invoices });
        return { rows: partyRows, notice: "Customer totals combine saved cash and credit invoices with approved returns linked to those same invoices. Each return is assigned to its original customer; only transactions in the current date and branch scope are included." };
      }
      if (title.includes("net sales")) {
        const gross = sales.reduce((sum, sale) => sum + sale.total, 0);
        const returned = salesReturns.filter((item) => item.status.toUpperCase() === "APPROVED").reduce((sum, item) => sum + item.amount, 0);
        return { rows: [{ "Gross sales": money(gross), Returns: money(returned), "Net sales": money(gross - returned), Transactions: sales.length }], notice: "Net sales are calculated from posted saved sales less posted sales returns for the selected reporting scope." };
      }
      if (title.includes("product vs party")) {
        const grouped = new Map<string, { product: string; party: string; quantity: number; sales: number; orders: Set<string> }>();
        sales.forEach((sale) => sale.items.forEach((item) => {
          const key = `${item.productId}\u0000${sale.customerId || sale.customer}`;
          const row = grouped.get(key) ?? { product: item.product, party: sale.customer, quantity: 0, sales: 0, orders: new Set<string>() };
          row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; row.orders.add(sale.id); grouped.set(key, row);
        }));
        return { rows: [...grouped.values()].map((row) => ({ Product: row.product, Party: row.party, Quantity: row.quantity, Transactions: row.orders.size, Sales: money(row.sales) })), notice: "Product-versus-party rows are calculated from persisted order line items and linked customer records." };
      }
      if (title.includes("productwise") && title.includes("monthly")) {
        const grouped = new Map<string, { period: string; product: string; quantity: number; sales: number; transactions: Set<string> }>();
        sales.forEach((sale) => sale.items.forEach((item) => {
          const period = sale.date.slice(0, 7);
          const key = `${period}\u0000${item.productId}`;
          const row = grouped.get(key) ?? { period, product: item.product, quantity: 0, sales: 0, transactions: new Set<string>() };
          row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; row.transactions.add(sale.id); grouped.set(key, row);
        }));
        return { rows: [...grouped.values()].sort((a, b) => a.period.localeCompare(b.period) || a.product.localeCompare(b.product)).map((row) => ({ Month: row.period, Product: row.product, Quantity: row.quantity, Transactions: row.transactions.size, Sales: money(row.sales) })), notice: "Monthly product quantities and sales are grouped from saved invoice dates and product line items." };
      }
      if (title.includes("productwise")) {
        const grouped = new Map<string, { product: string; quantity: number; bonus: number; sales: number; transactions: Set<string> }>();
        sales.forEach((sale) => sale.items.forEach((item) => {
          const row = grouped.get(item.productId) ?? { product: item.product, quantity: 0, bonus: 0, sales: 0, transactions: new Set<string>() };
          row.quantity += item.quantity; row.bonus += item.bonusQuantity ?? 0; row.sales += item.quantity * item.unitPrice; row.transactions.add(sale.id); grouped.set(item.productId, row);
        }));
        return { rows: [...grouped.values()].map((x) => ({ Product: x.product, Quantity: x.quantity, "Bonus units": x.bonus, Transactions: x.transactions.size, Sales: money(x.sales) })), notice: "Product totals and promotional free units are calculated from saved sale line items for the selected dates and branch." };
      }
      if (title.includes("datewise") || title.includes("monthly sales") || title === "sales summary") {
        const grouped = new Map<string, { transactions: number; sales: number; cash: number; credit: number }>();
        sales.forEach((sale) => {
          const period = title.includes("monthly") ? sale.date.slice(0, 7) : sale.date.slice(0, 10);
          const row = grouped.get(period) ?? { transactions: 0, sales: 0, cash: 0, credit: 0 };
          row.transactions += 1; row.sales += sale.total;
          if (sale.paymentMethod.toUpperCase().includes("CREDIT")) row.credit += sale.total; else row.cash += sale.total;
          grouped.set(period, row);
        });
        return { rows: [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, x]) => ({ Period: period, Transactions: x.transactions, Sales: money(x.sales), Cash: money(x.cash), Credit: money(x.credit) })), notice: "Totals are based on real saved sales matching the selected reporting period and branch." };
      }
      const unavailable = ["teller", "hand over", "sales flash", "super", "issue", "cp"].some((x) => title.includes(x));
      const functionClassificationUnavailable = ["super", "issue", "cp"].some((x) => title.includes(x));
      return {
        rows: sales.map((x) => ({ Invoice: x.number, Date: formatPlatformDate(x.date), Customer: x.customer, Branch: x.branch || "—", Payment: x.paymentMethod.replaceAll("_", " "), "Payment status": x.paymentStatus, Status: x.status, Items: x.items.reduce((sum, item) => sum + item.quantity, 0), Total: money(x.total) })),
        notice: functionClassificationUnavailable ? "PMC does not currently store Super, Issue, or CP as a distinct sale classification. This report therefore shows actual saved sales matching the selected date and branch, without inventing a classification." : unavailable ? "The reference report requires salesperson, territory, insurance, or cash-teller fields not stored on the PMC sale record. This view shows the underlying real transactions and does not invent those missing values." : "Actual saved sales matching the selected reporting period and branch.",
      };
    }

    if (action.section === "purchases") {
      if (title === "change in supplier") return {
        rows: (supplierChange?.rows ?? []).map((item) => ({ Date: formatPlatformDate(item.date), "Opening Supplier": money(item.openingSupplier), "Closing Supplier": money(item.closingSupplier), Increase: money(item.increase) })).concat(supplierChange ? [{ Date: "Total", "Opening Supplier": money(supplierChange.openingSupplier), "Closing Supplier": money(supplierChange.closingSupplier), Increase: money(supplierChange.total) }] : []),
        notice: "Daily supplier balances are calculated from saved purchase invoices, approved supplier returns, and cleared supplier payments within your branch access.",
      };
      if (title.includes("return")) return { rows: purchaseReturns.map((x) => ({ Return: x.number, Supplier: x.supplier || "—", Date: formatPlatformDate(x.date), Branch: x.branch || "—", Status: x.status, Amount: x.amount == null ? "Restricted" : money(x.amount), Reason: x.reason || "—" })), notice: "Actual posted supplier-return records." };
      if (title.includes("adjustment")) return { rows: inventory.map((x) => ({ Product: x.product || x.sku || "—", Batch: x.batch, Branch: x.branch || "—", "On hand": x.stock, Available: x.available, Expiry: x.expiry ? formatPlatformDate(x.expiry) : "—", Status: x.status })), notice: "The current batch balances are real. An adjustment audit register requires movement-history rows and is not fabricated from current balances." };
      if (title.includes("purchase addition book")) return {
        rows: purchases.map((x) => ({ Purchase: x.number, "Supplier invoice": x.supplierInvoiceNumber || "—", Date: formatPlatformDate(x.date), Supplier: x.supplier || "—", Branch: x.branch || "—", Items: x.items.reduce((sum, item) => sum + item.quantity, 0), Notes: x.notes || "—", Total: x.total == null ? "Restricted" : money(x.total) })),
        notice: "Additional supplier invoice references and notes are taken from the saved purchase records; missing historical notes are shown as —.",
      };
      if (title.includes("purchase book")) return {
        rows: purchases.flatMap((purchase) => purchase.items.map((item) => ({ Invoice: purchase.number, Date: formatPlatformDate(purchase.date), Supplier: purchase.supplier || "—", Product: item.product, Batch: item.batch || "—", Expiry: item.expiry ? formatPlatformDate(item.expiry) : "—", Qty: item.quantity, Unit: item.unit || "—", Rate: item.unitCost == null ? "Restricted" : money(item.unitCost), Amount: item.unitCost == null ? "Restricted" : money(item.quantity * item.unitCost), Payment: purchase.paymentMethod.replaceAll("_", " "), "Payment status": purchase.paymentStatus, Branch: purchase.branch || "—" }))),
        notice: "Each row is a received purchase item with its saved supplier, batch, expiry, quantity, unit cost, payment status and branch. Restricted rates remain hidden for users without valuation permission.",
      };
      return { rows: purchases.map((x) => ({ Invoice: x.number, Date: formatPlatformDate(x.date), Supplier: x.supplier || "—", Branch: x.branch || "—", Payment: x.paymentMethod.replaceAll("_", " "), "Payment status": x.paymentStatus, Status: x.status, Items: x.items.reduce((sum, item) => sum + item.quantity, 0), Total: x.total == null ? "Restricted" : money(x.total) })), notice: "Actual purchase receipts matching the selected date and branch filters." };
    }

    if (action.section === "inventory") {
      if (title.includes("stock mis")) {
        const keyOf = (item: CommerceInventory) => stockMisGroup === "Company" ? item.manufacturer || "Company not set" : stockMisGroup === "Product" ? item.product || item.sku || "Product not set" : stockMisGroup === "Sector" ? item.category || "Sector not set" : item.supplier || "Party not recorded";
        return { rows: groupInventory(inventory, keyOf, (items) => ({ Products: new Set(items.map((x) => x.productId)).size, Batches: items.length, Available: items.reduce((sum, x) => sum + x.available, 0), "Stock value": money(items.reduce((sum, x) => sum + x.available * (x.purchasePrice ?? 0), 0)) })), notice: `Live batch stock grouped by ${stockMisGroup.toLowerCase()} using saved catalogue and supplier links; missing classifications are shown as not set.` };
      }
      if (["no stock", "below limit", "over stock", "product lock"].some((term) => title.includes(term))) {
        const filtered = productMasterRows.filter((product) => (!reportCompany || product.manufacturer === reportCompany) && (() => {
          if (title.includes("no stock")) return product.stock <= 0;
          if (title.includes("product lock")) return !product.isActive;
          if (title.includes("over stock")) return product.maximumStock > 0 && product.stock > product.maximumStock;
          return product.stock <= product.reorderLevel;
        })());
        return {
          rows: filtered.map((product) => ({ Product: product.name, SKU: product.productCode, Generic: product.genericName || "—", Company: product.manufacturer || "—", Category: product.category || "—", Rack: product.storageLocation || "—", Stock: product.stock, "Reorder level": product.reorderLevel, "Maximum stock": product.maximumStock || "—", "Purchase rate": product.purchaseRate == null ? "Restricted" : money(product.purchaseRate), "Sale rate": money(product.saleRate), Status: !product.isActive ? "LOCKED" : product.stock <= 0 ? "NO STOCK" : product.maximumStock > 0 && product.stock > product.maximumStock ? "OVER STOCK" : product.stock <= product.reorderLevel ? "BELOW LIMIT" : "IN STOCK" })),
          notice: title.includes("no stock") ? "This report includes active and inactive products from the product master, including products with no inventory batch. Branch-scoped stock is calculated from the selected branch's live batches." : title.includes("product lock") ? "Product lock status comes from the saved product master; stock values and locations are shown from the selected branch or all branches." : "Product-level available quantities are aggregated across valid batches before applying the saved reorder and maximum-stock thresholds.",
        };
      }
      if (title.includes("non-slow")) {
        const sold = new Set(sales.flatMap((sale) => sale.items.map((item) => item.productId)));
        return { rows: productMasterRows.filter((product) => product.stock > 0 && !sold.has(product.id)).map((product) => ({ Product: product.name, SKU: product.productCode, Company: product.manufacturer || "—", Rack: product.storageLocation || "—", Stock: product.stock, "Last sale": "No sale in selected period", "Sale rate": money(product.saleRate) })), notice: "This list uses products with live stock and no saved sale line in the selected period. It does not label products as non-moving when there is no sales history in that period." };
      }
      if (title === "stock register" || title.includes("partywise stock register")) {
        const transactionRows = movementRows.map((movement) => {
          const sale = sales.find((item) => item.id === movement.referenceId);
          const purchase = purchases.find((item) => item.id === movement.referenceId);
          const saleReturn = salesReturns.find((item) => item.id === movement.referenceId);
          const purchaseReturn = purchaseReturns.find((item) => item.id === movement.referenceId);
          const linkedSale = sale ?? sales.find((item) => item.id === saleReturn?.orderId);
          const saleLine = sale?.items.find((item) => item.productId === movement.productId) ?? linkedSale?.items.find((item) => item.productId === movement.productId);
          const purchaseLine = purchase?.items.find((item) => item.productId === movement.productId) ?? purchaseReturn?.items.find((item) => item.productId === movement.productId);
          const party = saleReturn?.customer || sale?.customer || purchaseReturn?.supplier || purchase?.supplier || "—";
          const movementLabel = movement.type.replaceAll("_", " ");
          return { Date: formatPlatformDate(movement.date), Product: movement.product, Batch: movement.batch || "—", Branch: movement.branch || "—", Party: party, Movement: movementLabel, In: Math.max(0, movement.quantity), Out: Math.max(0, -movement.quantity), Balance: movement.quantityAfter, Rate: saleLine ? money(saleLine.unitPrice) : purchaseLine?.unitCost == null ? "—" : money(purchaseLine.unitCost), Reference: movement.referenceType || "—", Notes: movement.reason || movement.note || "—" };
        }).filter((row) => !movementType || row.Movement.toUpperCase().replaceAll(" ", "_") === movementType)
          .filter((row) => !stockSearch.trim() || Object.values(row).some((value) => String(value).toLowerCase().includes(stockSearch.trim().toLowerCase())));
        return { rows: transactionRows, notice: "Stock register rows come from persisted batch-level stock transactions, filtered to the selected period and branch. Current balances are not substituted for historical movements." };
      }
      if (title.includes("rackwise")) return { rows: groupInventory(inventory, (row) => row.storageLocation || "Rack not set", (items) => ({ Products: new Set(items.map((x) => x.productId)).size, Batches: items.length, Available: items.reduce((sum, x) => sum + x.available, 0), "Stock value": money(items.reduce((sum, x) => sum + x.available * (x.purchasePrice ?? 0), 0)) })), notice: "Rack groupings use the live product storage-location field. Products without a rack assignment remain visible as Rack not set." };
      if (title.includes("partywise stock")) return { rows: groupInventory(inventory, (row) => row.supplier || "Supplier not recorded", (items) => ({ Products: new Set(items.map((x) => x.productId)).size, Batches: items.length, Available: items.reduce((sum, x) => sum + x.available, 0), "Stock value": money(items.reduce((sum, x) => sum + x.available * (x.purchasePrice ?? 0), 0)) })), notice: "Supplier attribution is taken from the recorded source of each inventory batch; unlinked stock is shown separately." };
      if (title.includes("department stock")) return { rows: groupInventory(inventory, (row) => row.category || "Category not set", (items) => ({ Products: new Set(items.map((x) => x.productId)).size, Batches: items.length, Available: items.reduce((sum, x) => sum + x.available, 0), "Stock at selling price": money(items.reduce((sum, x) => sum + x.available * x.salePrice, 0)) })), notice: "Department totals follow the product-to-category relationship in the live catalog." };
      if (title.includes("product lock")) return { rows: inventory.filter((x) => x.productActive === false).map((x) => ({ Product: x.product || x.sku || "—", SKU: x.sku || "—", Batch: x.batch, Branch: x.branch || "—", Available: x.available, Status: "Product inactive" })), notice: "Inactive status is read from the product master; no stock record is hidden or marked inactive on the client." };
      if (title.includes("free goods analysis")) return { rows: inventory.filter((x) => (x.bonusQuantity ?? 0) > 0).map((x) => ({ Product: x.product || x.sku || "—", Batch: x.batch, Branch: x.branch || "—", "Bonus stock": x.bonusQuantity ?? 0, Available: x.available, Expiry: x.expiry ? formatPlatformDate(x.expiry) : "—" })), notice: "Bonus stock is the actual batch bonus quantity recorded at purchase receipt." };
      if (title.includes("free goods monthly sales")) {
        const grouped = new Map<string, { product: string; units: number }>();
        sales.forEach((sale) => sale.items.forEach((item) => { const key = `${sale.date.slice(0, 7)}\u0000${item.productId}`; const row = grouped.get(key) ?? { product: item.product, units: 0 }; row.units += item.bonusQuantity ?? 0; grouped.set(key, row); }));
        return { rows: [...grouped.entries()].filter(([, value]) => value.units > 0).map(([key, value]) => ({ Month: key.split("\u0000")[0], Product: value.product, "Free units": value.units })), notice: "Monthly free-goods totals use bonus quantities persisted on POS sale line items." };
      }
      if (title.includes("stock/sales")) {
        const sold = new Map<string, { quantity: number; sales: number }>();
        sales.forEach((sale) => sale.items.forEach((item) => { const row = sold.get(item.productId) ?? { quantity: 0, sales: 0 }; row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; sold.set(item.productId, row); }));
        return { rows: inventory.map((x) => { const productSales = sold.get(x.productId); return { Product: x.product || x.sku || "—", Batch: x.batch, Branch: x.branch || "—", "Available stock": x.available, "Qty sold": productSales?.quantity ?? 0, "Sales value": money(productSales?.sales ?? 0), Expiry: x.expiry ? formatPlatformDate(x.expiry) : "—" }; }), notice: "Batch stock and product sales are joined using real product IDs and the selected date/branch filters." };
      }
      if (!title.includes("free goods") && (title.includes("sales") || title.includes("max sales"))) {
        const grouped = new Map<string, { product: string; quantity: number; sales: number }>();
        sales.forEach((sale) => sale.items.forEach((item) => {
          const row = grouped.get(item.productId) ?? { product: item.product, quantity: 0, sales: 0 };
          row.quantity += item.quantity; row.sales += item.quantity * item.unitPrice; grouped.set(item.productId, row);
        }));
        return { rows: [...grouped.values()].sort((a, b) => b.sales - a.sales).map((x) => ({ Product: x.product, "Qty sold": x.quantity, Sales: money(x.sales) })), notice: "Sales volume is grouped from actual saved sale line items." };
      }
      const lowStock = title.includes("below limit") || title.includes("no stock") || title.includes("over stock");
      const nearExpiry = title.includes("expiry");
      const productAvailable = new Map<string, number>();
      inventory.forEach((x) => productAvailable.set(x.productId, (productAvailable.get(x.productId) ?? 0) + x.available));
      const overStockProducts = new Set(inventory.filter((x) => x.maximumStock && x.maximumStock > 0 && (productAvailable.get(x.productId) ?? 0) > x.maximumStock).map((x) => x.productId));
      const stockRows = inventory.filter((x) => !lowStock || (title.includes("no stock") ? x.available <= 0 : title.includes("over stock") ? overStockProducts.has(x.productId) : x.status === "LOW_STOCK" || x.available <= 0)).filter((x) => !nearExpiry || x.status === "NEAR_EXPIRY" || x.status === "EXPIRED");
      const unavailable = ["mrwise"].some((x) => title.includes(x));
      return {
        rows: stockRows.map((x) => ({ Product: x.product || x.sku || "—", SKU: x.sku || "—", Batch: x.batch, Branch: x.branch || "—", Stock: x.stock, Reserved: x.reserved, Available: x.available, "Purchase rate": x.purchasePrice == null ? "Restricted" : money(x.purchasePrice), "Sale rate": money(x.salePrice), Expiry: x.expiry ? formatPlatformDate(x.expiry) : "—", Status: overStockProducts.has(x.productId) ? "OVER STOCK" : x.status })),
        notice: unavailable ? "This specific grouping needs rack, department, party, free-goods, or MR classification not available in current PMC stock rows. The table shows real batch-level stock without inventing that classification." : "Actual batch- and branch-level stock records within the selected reporting scope.",
      };
    }

    if (title.includes("trial balance") || title.includes("grouping trial")) {
      if (branchId) return { rows: [], notice: "The existing general-ledger summary is company-wide and does not accept a branch filter. Clear the branch filter to view the real current-period trial balance." };
      return { rows: (accountingSummary?.trialBalance ?? []).map((x) => ({ Account: x.account, Debit: money(x.debit), Credit: money(x.credit), Balance: money(x.balance) })), notice: accountingSummary ? "General-ledger balances returned by the existing accounting API for the selected period." : "The accounting API did not return a trial-balance result for this account. No values are generated on the client." };
    }
    if (title.includes("supplier")) return { rows: (credit?.suppliers ?? []).map((x) => ({ Supplier: x.name, "Open invoices": x.invoices, "0–30 days": money(x.aging0To30 ?? 0), "31–60 days": money(x.aging31To60 ?? 0), "60+ days": money(x.aging60Plus ?? 0), Balance: money(x.balance), Type: x.balance < 0 ? "Supplier credit" : "Payable" })), notice: "Supplier ageing is calculated from each real unpaid supplier invoice using its due date, or invoice date when no due date is recorded." };
    return { rows: (credit?.customers ?? []).map((x) => ({ Customer: x.name, Email: x.email || "—", "Credit limit": money(x.limit), "0–30 days": money(x.aging0To30), "31–60 days": money(x.aging31To60), "60+ days": money(x.aging60Plus), Balance: money(x.balance) })), notice: "Customer balances and aging from the existing credit ledger." };
  }, [action, accountingSummary, branchId, credit, debtorChange, includeCard, inventory, movementRows, movementType, partySearch, productMasterRows, purchaseReturns, purchases, reportCompany, reportSales, reportSalesReturns, sales, salesReturns, stockMisGroup, stockSearch, supplierChange, userCashRows]);

  if (action.mode === "sales-return-cancel" || action.mode === "purchase-return-cancel") {
    const kind = action.mode === "sales-return-cancel" ? "sales" : "purchase";
    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent overlayClassName="bg-slate-950/20" className="max-h-[88vh] max-w-[560px] gap-0 overflow-y-auto rounded-sm border border-[#888] bg-[#f1f0ee] p-0 text-[#333] shadow-xl [&>button:last-child]:hidden">
        <DialogHeader className="sr-only"><DialogTitle>{kind === "sales" ? "Sales Return Cancel" : "Purchase Return Cancel"}</DialogTitle><DialogDescription>Choose an approved return and provide a reason before cancellation.</DialogDescription></DialogHeader>
        <ReturnCancellationPanel kind={kind} salesReturns={salesReturns} purchaseReturns={purchaseReturns} token={token} superAdmin={superAdmin} onClose={onClose} onSaved={onSaved} labelFor={labelFor} />
      </DialogContent>
    </Dialog>;
  }
  if (action.mode === "purchase-additional-info-edit") return <PurchaseAdditionalInfoEditor purchases={purchases} token={token} superAdmin={superAdmin} onClose={onClose} onSaved={onSaved} />;
  if (action.mode === "purchase-modify") return <PurchaseCorrectionPanel purchases={purchases} token={token} superAdmin={superAdmin} onClose={onClose} onSaved={onSaved} onCorrect={onCorrectPurchase} />;
  if (action.mode === "adjustment-cancel") {
    const eligible = movementRows.filter((row) => row.referenceType === "INVENTORY_ADJUSTMENT" && row.batchStatusBefore && row.batchStatusAfter && !row.isCancelled && ["ADJUSTMENT", "OPENING_STOCK", "EXPIRED", "EXPIRY", "DAMAGE", "OTHER"].includes(row.type));
    const selected = eligible.find((row) => row.id === selectedMovementId);
    const cancel = () => {
      if (!selected || !adjustmentReason.trim()) { toast.error("Choose an adjustment and enter a cancellation reason."); return; }
      requestSiteConfirmation({ title: "Cancel stock adjustment?", message: `The saved movement for ${selected.product} · ${selected.batch} will be reversed against current batch stock.`, inputLabel: "Cancellation reason", inputPlaceholder: "Required audit reason", inputRequired: true, confirmLabel: "Reverse adjustment", tone: "danger", onConfirm: async (_checked, reason) => {
        try { await cancelInventoryAdjustment(token, selected.id, reason?.trim() || adjustmentReason.trim(), superAdmin); toast.success("Stock adjustment reversed and logged."); setAdjustmentReason(""); const rows = await getInventoryMovements(token, { branchId: branchId || undefined, from: from || undefined, to: to || undefined }, superAdmin); setMovementRows(rows); await onSaved(); }
        catch (error) { toast.error(error instanceof Error ? error.message : "This adjustment could not be safely reversed."); }
      } });
    };
    return <Card className="border-[#003893]/25"><CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">Stock Adjustment Cancel</span><Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600">Only saved manual adjustment movements can be reversed. Purchase, sales, and transfer movements are excluded.</p><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(220px,1fr)_auto] md:items-end"><label className="block space-y-1 text-xs font-bold text-slate-600">Adjustment<Select value={selectedMovementId} onChange={(event) => setSelectedMovementId(event.target.value)}><option value="">Select movement</option>{eligible.map((row) => <option key={row.id} value={row.id}>{row.product} · {row.batch} · {row.type} · {formatPlatformDate(row.date)} · {row.quantity > 0 ? "+" : ""}{row.quantity}</option>)}</Select></label><label className="block space-y-1 text-xs font-bold text-slate-600">Reason<Input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={500} placeholder="Required audit reason" /></label><Button variant="destructive" disabled={!selected || !adjustmentReason.trim()} onClick={cancel}>Cancel adjustment</Button></div>{movementLoading && <p className="text-sm text-slate-500">Loading saved adjustments…</p>}{movementError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{movementError}</p>}{!eligible.length && !movementLoading && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No cancellable adjustment movements were found for this date and branch range.</p>}{selected && <p className="rounded-xl border bg-slate-50 p-4 text-sm">Current batch: {selected.quantityAfter} {selected.unit}; adjustment reason: {selected.reason || "—"}</p>}</CardContent></Card>;
  }
  if (action.mode === "adjustment-slip") {
    const eligible = movementRows.filter((row) => row.referenceType === "INVENTORY_ADJUSTMENT");
    const selected = eligible.find((row) => row.id === selectedMovementId) ?? eligible[0];
    return <Card className="border-[#003893]/25 print:border-0 print:shadow-none"><CardHeader className="print:hidden"><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">Stock Adjustment Slip</span><Select aria-label="Select stock adjustment" className="max-w-lg" value={selected?.id ?? ""} onChange={(event) => setSelectedMovementId(event.target.value)}><option value="">Select adjustment</option>{eligible.map((row) => <option key={row.id} value={row.id}>{row.product} · {row.batch} · {formatPlatformDate(row.date)} · {row.type}</option>)}</Select><Button variant="outline" disabled={!selected} onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader><CardContent className="p-6">{!selected ? <p className="py-10 text-center text-sm text-slate-500">No saved adjustment slips match the selected date and branch.</p> : <article className="mx-auto max-w-2xl space-y-4 print:max-w-none"><div className="border-b pb-4"><p className="text-xs font-bold uppercase tracking-wider text-[#003893]">All Nepal Healthy Home Pvt. Ltd.</p><h2 className="mt-1 text-2xl font-extrabold">Stock Adjustment Slip</h2><p>{selected.type.replaceAll("_", " ")} · {formatPlatformDate(selected.date)}</p></div><p><strong>Branch:</strong> {selected.branch} · <strong>Product:</strong> {selected.product} · <strong>Batch:</strong> {selected.batch}</p><p><strong>Quantity:</strong> {selected.quantity > 0 ? "+" : ""}{selected.quantity} {selected.unit}</p><p><strong>Balance:</strong> {selected.quantityBefore} → {selected.quantityAfter}</p><p><strong>Reason:</strong> {selected.reason || "—"}</p><p><strong>Reference:</strong> {selected.referenceType || "—"}</p></article>}</CardContent></Card>;
  }
  if (action.section === "sales" && ["cash to teller", "cash hand over"].includes(action.title.toLowerCase())) {
    return <CashHandoverPanel title={action.displayTitle ?? action.title} token={token} superAdmin={superAdmin} branchId={branchId} branches={branches} from={from} to={to} onClose={onClose} />;
  }

  if (action.mode === "invoice-report") {
    const sale = invoiceLookup ?? sales.find((item) => item.id === selectedDocumentId) ?? null;
    const previewInvoice = async () => {
      const query = invoiceNumberSearch.trim().toLowerCase();
      const match = query ? sales.find((item) => (item.invoiceNumber || item.number).toLowerCase() === query || item.number.toLowerCase() === query) : null;
      if (!query) { toast.error("Enter an invoice number first."); return; }
      if (match) { setInvoiceLookup(match); setSelectedDocumentId(match.id); setInvoiceNumberSearch(match.invoiceNumber || match.number); return; }
      setDocumentLookupLoading(true);
      try {
        const found = await getCommerceSaleByInvoice(token, invoiceNumberSearch.trim(), superAdmin);
        setInvoiceLookup(found); setSelectedDocumentId(found.id); setInvoiceNumberSearch(found.invoiceNumber || found.number);
      } catch {
        try {
          const historical = await getCommerceSales(token, { from: "2000-01-01", to: getPlatformDateInput(), search: invoiceNumberSearch.trim() }, superAdmin);
          const found = historical.find((item) => (item.invoiceNumber || item.number).toLowerCase() === query || item.number.toLowerCase() === query);
          if (found) { setInvoiceLookup(found); setSelectedDocumentId(found.id); setInvoiceNumberSearch(found.invoiceNumber || found.number); }
          else toast.error("No accessible saved invoice was found with that number.");
        } catch (fallbackError) { toast.error(fallbackError instanceof Error ? fallbackError.message : "No invoice with that number was found."); }
      }
      finally { setDocumentLookupLoading(false); }
    };
    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent overlayClassName="bg-slate-950/20" className="max-w-[420px] gap-0 rounded-sm border border-[#8b8b8b] bg-[#f2f1ef] p-0 shadow-lg [&>button:last-child]:hidden">
      <DialogHeader className="border-b border-[#d3d1ce] px-3 py-2 pr-10"><DialogTitle className="text-sm font-normal text-[#333]">{labelFor("Bill print")}</DialogTitle><DialogDescription className="sr-only">Find a saved invoice, preview it, or print it.</DialogDescription></DialogHeader>
      <button type="button" className="w-fit px-3 py-1 text-left text-xs text-[#444] hover:bg-[#e3e2df]" onClick={onClose}>{labelFor("Exit")}</button>
      <form className="space-y-3 px-3 pb-3" onSubmit={(event) => { event.preventDefault(); previewInvoice(); }}>
        <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm font-semibold text-[#333]">{labelFor("Invoice No.")}<Input list="sales-invoice-numbers" value={invoiceNumberSearch} onChange={(event) => { setInvoiceNumberSearch(event.target.value); setSelectedDocumentId(""); setInvoiceLookup(null); }} placeholder="" className="h-8 rounded-none border-[#9b9b9b] bg-white px-2" /><datalist id="sales-invoice-numbers">{sales.map((item) => <option key={item.id} value={item.invoiceNumber || item.number}>{item.customer}</option>)}</datalist></label>
        <DialogFooter className="grid grid-cols-3 gap-1 border-t border-[#d3d1ce] pt-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={!sale || documentLookupLoading} onClick={() => printArea("sales-invoice-print")} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Print")}</Button>
          <Button type="submit" variant="outline" disabled={documentLookupLoading} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{documentLookupLoading ? "Searching…" : labelFor("Preview")}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Close")}</Button>
        </DialogFooter>
      </form>
      {sale && <div id="sales-invoice-print" className="max-h-[58vh] overflow-auto border-t border-[#d3d1ce] bg-white p-4">
        <article className="mx-auto max-w-3xl space-y-5 print:max-w-none">
          <div className="flex flex-wrap justify-between gap-4 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#003893]">{companyName}</p><h2 className="mt-1 text-2xl font-extrabold">{labelFor("Tax Invoice")}</h2><p className="text-sm text-slate-500">{sale.invoiceNumber || sale.number}</p></div><div className="text-right text-sm"><p>{labelFor("Date")}: {formatPlatformDate(sale.date)}</p><p>{labelFor("Branch")}: {sale.branch || "—"}</p><p>{labelFor("Status")}: {sale.status}</p></div></div>
          <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>{labelFor("Customer")}:</strong> {sale.customer}</p><p><strong>{labelFor("PAN")}:</strong> {sale.panNumber || "—"}</p><p><strong>{labelFor("Party type")}:</strong> {sale.accountType || "—"}</p><p><strong>{labelFor("Payment")}:</strong> {sale.paymentMethod.replaceAll("_", " ")} · {sale.paymentStatus}</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-y text-xs uppercase text-slate-500"><th className="p-3">{labelFor("Product")}</th><th className="p-3 text-right">{labelFor("Qty")}</th><th className="p-3 text-right">{labelFor("Rate")}</th><th className="p-3 text-right">{labelFor("Amount")}</th></tr></thead><tbody>{sale.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b"><td className="p-3">{item.product}{item.bonusQuantity ? <span className="block text-xs text-slate-500">Bonus: {item.bonusQuantity}</span> : null}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{money(item.unitPrice)}</td><td className="p-3 text-right">{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto max-w-xs space-y-1 text-right text-sm"><p>{labelFor("Subtotal")}: {money(sale.subtotal ?? sale.total - (sale.taxAmount ?? 0))}</p><p>{labelFor("Discount")}: {money(sale.discountAmount ?? 0)}</p><p>{labelFor("VAT")}: {money(sale.taxAmount ?? 0)}</p><p className="border-t pt-2 text-base font-extrabold">{labelFor("Total")}: {money(sale.total)}</p><p>{labelFor("Paid")}: {money(sale.paidAmount ?? 0)}</p><p>{labelFor("Balance")}: {money(Math.max(0, sale.total - (sale.paidAmount ?? 0)))}</p></div>
        </article>
      </div>}
    </DialogContent></Dialog>;
  }
  if (action.mode === "credit-note-report") {
    const row = creditNoteLookup ?? salesReturns.find((item) => item.id === selectedDocumentId) ?? null;
    const previewCreditNote = async () => {
      const query = creditNoteSearch.trim().toLowerCase();
      const match = query ? salesReturns.find((item) => item.number.toLowerCase() === query) : null;
      if (!query) { toast.error("Enter a credit note number first."); return; }
      if (match) { setCreditNoteLookup(match); setSelectedDocumentId(match.id); setCreditNoteSearch(match.number); return; }
      setDocumentLookupLoading(true);
      try {
        const found = await getCommerceSalesReturnByNumber(token, creditNoteSearch.trim(), superAdmin);
        setCreditNoteLookup(found); setSelectedDocumentId(found.id); setCreditNoteSearch(found.number);
      } catch {
        try {
          const historical = await getCommerceSalesReturns(token, { from: "2000-01-01", to: getPlatformDateInput(), search: creditNoteSearch.trim() }, superAdmin);
          const found = historical.find((item) => item.number.toLowerCase() === query);
          if (found) { setCreditNoteLookup(found); setSelectedDocumentId(found.id); setCreditNoteSearch(found.number); }
          else toast.error("No accessible saved credit note was found with that number.");
        } catch (fallbackError) { toast.error(fallbackError instanceof Error ? fallbackError.message : "No credit note with that number was found."); }
      }
      finally { setDocumentLookupLoading(false); }
    };
    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent overlayClassName="bg-slate-950/20" className="max-w-[400px] gap-0 rounded-sm border border-[#8b8b8b] bg-[#f2f1ef] p-0 shadow-lg [&>button:last-child]:hidden">
        <DialogHeader className="border-b border-[#d3d1ce] px-3 py-2 pr-10"><DialogTitle className="text-sm font-normal text-[#333]">{labelFor("Print Credit Note")}</DialogTitle><DialogDescription className="sr-only">Find a saved credit note, preview it, or print it.</DialogDescription></DialogHeader>
      <button type="button" className="w-fit px-3 py-1 text-left text-xs text-[#444] hover:bg-[#e3e2df]" onClick={onClose}>{labelFor("Exit")}</button>
      <form className="space-y-3 px-3 pb-3" onSubmit={(event) => { event.preventDefault(); previewCreditNote(); }}>
        <label className="grid grid-cols-[70px_1fr] items-center gap-2 text-sm font-semibold text-[#333]">{labelFor("Cr No.")}<Input list="sales-credit-note-numbers" value={creditNoteSearch} onChange={(event) => { setCreditNoteSearch(event.target.value); setSelectedDocumentId(""); setCreditNoteLookup(null); }} placeholder="" className="h-8 rounded-none border-[#9b9b9b] bg-white px-2" /><datalist id="sales-credit-note-numbers">{salesReturns.map((item) => <option key={item.id} value={item.number}>{item.customer}</option>)}</datalist></label>
        <DialogFooter className="grid grid-cols-3 gap-1 border-t border-[#d3d1ce] pt-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={!row || documentLookupLoading} onClick={() => printArea("sales-credit-note-print")} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Print")}</Button>
          <Button type="submit" variant="outline" disabled={documentLookupLoading} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{documentLookupLoading ? "Searching…" : labelFor("Preview")}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-8 rounded-none border-[#aaa] bg-[#f1f1f1] text-sm text-[#333] shadow-sm hover:bg-white">{labelFor("Close")}</Button>
        </DialogFooter>
      </form>
      {row && <div id="sales-credit-note-print" className="max-h-[58vh] overflow-auto border-t border-[#d3d1ce] bg-white p-4"><article className="mx-auto max-w-3xl space-y-5 print:max-w-none"><div className="flex flex-wrap justify-between gap-4 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#003893]">{companyName}</p><h2 className="mt-1 text-2xl font-extrabold">{labelFor("Credit Note")}</h2><p className="text-sm text-slate-500">{row.number}</p></div><div className="text-right text-sm"><p>{labelFor("Date")}: {formatPlatformDate(row.date)}</p><p>{labelFor("Branch")}: {row.branch || "—"}</p><p>{labelFor("Status")}: {row.status} · {labelFor(row.returnType === "EXPIRED" ? "Expired return" : "Standard return")}</p></div></div><p className="text-sm"><strong>{labelFor("Customer")}:</strong> {row.customer} · <strong>{labelFor("Reason")}:</strong> {row.reason || "—"}</p><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-y text-xs uppercase text-slate-500"><th className="p-3">{labelFor("Product")}</th><th className="p-3">{labelFor("Batch")}</th><th className="p-3 text-right">{labelFor("Qty")}</th><th className="p-3 text-right">{labelFor("Rate")}</th><th className="p-3 text-right">{labelFor("Amount")}</th></tr></thead><tbody>{row.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b"><td className="p-3">{item.product || item.productId}</td><td className="p-3">{item.batch}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{money(item.unitPrice)}</td><td className="p-3 text-right">{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div><p className="text-right text-lg font-extrabold">{labelFor("Credit amount")}: {money(row.amount)}</p></article></div>}
    </DialogContent></Dialog>;
  }

  if (action.mode === "purchase-mrn-report") {
    const purchase = purchases.find((item) => item.id === selectedDocumentId) ?? purchases[0];
    return <Card className="border-[#003893]/25 print:border-0 print:shadow-none"><CardHeader className="print:hidden"><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">Print MRN / Purchase Receipt</span><Select aria-label="Select purchase receipt" className="max-w-lg" value={purchase?.id ?? ""} onChange={(event) => setSelectedDocumentId(event.target.value)}><option value="">Select receipt</option>{purchases.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.supplier} · {formatPlatformDate(item.date)}</option>)}</Select><Button variant="outline" disabled={!purchase} onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader><CardContent className="p-6">{!purchase ? <p className="py-10 text-center text-sm text-slate-500">No saved purchase receipts match the selected date and branch.</p> : <article className="mx-auto max-w-3xl space-y-5 print:max-w-none"><div className="flex justify-between gap-4 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#003893]">All Nepal Healthy Home Pvt. Ltd.</p><h2 className="mt-1 text-2xl font-extrabold">Material Receipt Note</h2><p>{purchase.number}</p></div><div className="text-right text-sm"><p>Date: {formatPlatformDate(purchase.date)}</p><p>Branch: {purchase.branch || "—"}</p><p>Status: {purchase.status}</p></div></div><p><strong>Supplier:</strong> {purchase.supplier || "—"}</p><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-y text-xs uppercase text-slate-500"><th className="p-3">Product</th><th className="p-3">Batch</th><th className="p-3">Expiry</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{purchase.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b"><td className="p-3">{item.product}</td><td className="p-3">{item.batch || "—"}</td><td className="p-3">{item.expiry ? formatPlatformDate(item.expiry) : "—"}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{item.unitCost == null ? "Restricted" : money(item.unitCost)}</td><td className="p-3 text-right">{item.unitCost == null ? "Restricted" : money(item.quantity * item.unitCost)}</td></tr>)}</tbody></table></div><p className="text-right font-extrabold">Receipt total: {purchase.total == null ? "Restricted" : money(purchase.total)}</p><div className="grid grid-cols-2 gap-10 pt-10 text-sm"><p className="border-t pt-2">Received by</p><p className="border-t pt-2">Checked by</p></div></article>}</CardContent></Card>;
  }
  if (action.mode === "purchase-return-slip") {
    const purchaseReturn = purchaseReturns.find((item) => item.id === selectedDocumentId) ?? purchaseReturns[0];
    return <Card className="border-[#003893]/25 print:border-0 print:shadow-none"><CardHeader className="print:hidden"><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">Print Purchase Return Slip</span><Select aria-label="Select purchase return" className="max-w-lg" value={purchaseReturn?.id ?? ""} onChange={(event) => setSelectedDocumentId(event.target.value)}><option value="">Select return</option>{purchaseReturns.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.supplier} · {formatPlatformDate(item.date)}</option>)}</Select><Button variant="outline" disabled={!purchaseReturn} onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader><CardContent className="p-6">{!purchaseReturn ? <p className="py-10 text-center text-sm text-slate-500">No saved purchase returns match the selected date and branch.</p> : <article className="mx-auto max-w-3xl space-y-5 print:max-w-none"><div className="flex justify-between gap-4 border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#003893]">All Nepal Healthy Home Pvt. Ltd.</p><h2 className="mt-1 text-2xl font-extrabold">Purchase Return Slip</h2><p>{purchaseReturn.number}</p></div><div className="text-right text-sm"><p>Date: {formatPlatformDate(purchaseReturn.date)}</p><p>Branch: {purchaseReturn.branch || "—"}</p><p>Status: {purchaseReturn.status}</p></div></div><p><strong>Supplier:</strong> {purchaseReturn.supplier || "—"} · <strong>Reason:</strong> {purchaseReturn.reason || "—"}</p><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-y text-xs uppercase text-slate-500"><th className="p-3">Product</th><th className="p-3">Batch</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{purchaseReturn.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b"><td className="p-3">{item.product || item.productId}</td><td className="p-3">{item.batch}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{item.unitCost == null ? "Restricted" : money(item.unitCost)}</td><td className="p-3 text-right">{item.unitCost == null ? "Restricted" : money(item.quantity * item.unitCost)}</td></tr>)}</tbody></table></div><p className="text-right font-extrabold">Return total: {purchaseReturn.amount == null ? "Restricted" : money(purchaseReturn.amount)}</p></article>}</CardContent></Card>;
  }

  const fallbackColumns = wantsUserCashSummary
    ? ["UserName", "Cash_Receive", "Sales", "Receipt", "Card", "OPD-Copy", "DrNote", "CashIn", "Return", "CashOld", "CrNote", "Purch", "Net", "Hand Over"]
    : wantsDebtorChange ? ["Date", "Opening Debtor", "Closing Debtor", "Increase"]
      : wantsSupplierChange ? ["Date", "Opening Supplier", "Closing Supplier", "Increase"]
      : titleIncludesPartywiseNet(action.title) ? ["Party", "Address", "Sales", "Sales Disc", "Sales VAT", "Sales Return", "Return Discount", "Return VAT", "Credit", "D.note", "Net"]
        : action.section === "sales" && action.title.toLowerCase().includes("net sales - all credit + cash party") ? ["Party", "Cash Sales", "Credit Sales", "Returns", "Net Sales", "Invoices"]
          : action.section === "sales" && action.title.toLowerCase().includes("mrwise product") ? ["Sales person / MR", "Product", "Quantity", "Invoices", "Sales"]
            : action.section === "sales" && action.title.toLowerCase().includes("sales statement company mr") ? ["Company", "Sales person / MR", "Invoices", "Units", "Sales"]
              : action.section === "sales" && (action.title.toLowerCase().includes("sales book all") || action.title.toLowerCase() === "sales book") ? ["Invoice", "Date", "Party", "Product", "Qty", "Rate", "Amount", "Discount", "VAT", "Net", "Payment", "Branch"]
                : action.section === "sales" && action.title.toLowerCase().includes("companywise sales book") ? ["Company", "Invoice", "Date", "Party", "Product", "Qty", "Rate", "Amount", "Discount", "VAT", "Net", "Payment", "Branch"]
                  : action.section === "sales" && (action.title.toLowerCase().includes("company wise") || action.title.toLowerCase().includes("companywise")) ? ["Company", "SalAmount", "SalDisc", "TotSales", "RetAmount", "RetDisc", "TotalReturn", "RetExpAmount", "RetExpDisc", "TotExpReturn", "NetSales"]
                    : action.section === "purchases" && action.title.toLowerCase().includes("purchase addition book") ? ["Purchase", "Supplier invoice", "Date", "Supplier", "Branch", "Items", "Notes", "Total"]
                      : action.section === "purchases" && action.title.toLowerCase().includes("purchase book") ? ["Invoice", "Date", "Supplier", "Product", "Batch", "Expiry", "Qty", "Unit", "Rate", "Amount", "Payment", "Payment status", "Branch"] : [];
  const columns = rows.length ? Object.keys(rows[0]) : fallbackColumns;
  const catalogRows = salesCatalogRows.filter((product) => !catalogSearch.trim() || `${product.name} ${product.sku} ${product.genericName ?? ""} ${product.category ?? ""}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()));
  const calculatorA = Number(calculatorLeft) || 0;
  const calculatorB = Number(calculatorRight) || 0;
  const calculatorValue = calculatorOperator === "+" ? calculatorA + calculatorB : calculatorOperator === "−" ? calculatorA - calculatorB : calculatorOperator === "×" ? calculatorA * calculatorB : calculatorB === 0 ? null : calculatorA / calculatorB;
  function exportCsv() {
    const csv = [columns, ...rows.map((row) => columns.map((column) => String(row[column] ?? "")))].map((line) => line.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${action.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  function exportDosPrint() {
    const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)));
    const line = (values: string[]) => values.map((value, index) => value.padEnd(widths[index])).join(" | ");
    const body = [line(columns), widths.map((width) => "-".repeat(width)).join("-+-"), ...rows.map((row) => line(columns.map((column) => String(row[column] ?? ""))))].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${action.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`; link.click(); URL.revokeObjectURL(url);
  }
  if (action.section === "inventory" && action.title.toLowerCase().includes("stock mis")) return <Card className="border-[#003893]/25">
    <CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">{action.displayTitle ?? action.title}</span><Button variant="outline" onClick={exportCsv}><FileDown size={15} /> Export CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader>
    <CardContent><div role="tablist" aria-label="Stock MIS grouping" className="mb-4 flex flex-wrap gap-2">{(["Company", "Product", "Sector", "Party"] as const).map((group) => <Button key={group} role="tab" aria-selected={stockMisGroup === group} variant={stockMisGroup === group ? "default" : "outline"} onClick={() => setStockMisGroup(group)}>{group}</Button>)}</div><p className="mb-3 text-sm text-slate-500">{notice}</p><ReportTable rows={rows} columns={columns} /></CardContent>
  </Card>;
  if (wantsMovements || wantsProductMaster) return <Card className="border-[#003893]/25">
    <CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">{action.displayTitle ?? action.title}</span><Button variant="outline" onClick={exportCsv}><FileDown size={15} /> Export CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader>
    <CardContent><div className="mb-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(190px,220px)_220px_auto] sm:items-end"><label className="block space-y-1 text-xs font-bold text-slate-500">Search product, batch or party<Input value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} placeholder="Search this report" /></label>{wantsProductMaster && <label className="block space-y-1 text-xs font-bold text-slate-500">Company / manufacturer<Select value={reportCompany} onChange={(event) => setReportCompany(event.target.value)}><option value="">All companies</option>{[...new Set(productMasterRows.map((row) => row.manufacturer).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b)).map((company) => <option key={company} value={company}>{company}</option>)}</Select></label>}{wantsMovements && <label className="block space-y-1 text-xs font-bold text-slate-500">Movement type<Select value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="">All movements</option>{[...new Set(movementRows.map((item) => item.type))].sort().map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></label>}<Button variant="outline" disabled={movementLoading || productMasterLoading} onClick={() => { if (wantsMovements) { setMovementLoading(true); void getInventoryMovements(token, { branchId: branchId || undefined, from: from || undefined, to: to || undefined }, superAdmin).then((result) => { setMovementRows(result); setMovementError(""); }).catch((error: unknown) => setMovementError(error instanceof Error ? error.message : "Stock movement history could not be loaded.")).finally(() => setMovementLoading(false)); } else { setProductMasterLoading(true); void getInventoryProductMaster(token, undefined, superAdmin, branchId || undefined).then(setProductMasterRows).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Product stock analysis could not be loaded.")).finally(() => setProductMasterLoading(false)); } }}><RefreshCw size={15} className={movementLoading || productMasterLoading ? "animate-spin" : ""} /> Refresh</Button></div>{movementError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{movementError}</p>}<p className="mb-3 text-sm text-slate-500">{notice}</p>{movementLoading || productMasterLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading saved inventory report data…</p> : <ReportTable rows={rows.filter((row) => !stockSearch.trim() || Object.values(row).some((value) => String(value).toLowerCase().includes(stockSearch.trim().toLowerCase())))} columns={columns} />}</CardContent>
  </Card>;
  const isReferenceReport = action.section === "sales" || action.section === "purchases";
  const reportTitleKey = action.displayTitle && action.displayTitle !== action.title ? action.displayTitle
    : wantsUserCashSummary ? "Userwise Cash Summary"
      : action.title.toLowerCase().includes("companywise sales book") ? "Companywise Sales Book"
        : action.title.toLowerCase().includes("company wise") || action.title.toLowerCase().includes("companywise") ? "Companywise Sales"
          : titleIncludesPartywiseNet(action.title) ? "Partywise Net Sale CC Charge Included"
            : action.displayTitle ?? action.title;
  const reportWindowTitle = labelFor(reportTitleKey);
  const showsAllFirm = allowAllFirms && wantsSalesAggregateData;
  const reportWidth = wantsUserCashSummary ? "max-w-[96vw]" : titleIncludesPartywiseNet(action.title) || wantsSalesAggregateData ? "max-w-[94vw]" : wantsDebtorChange || wantsSupplierChange ? "max-w-[620px]" : "max-w-[88vw]";
  const reportHeight = wantsUserCashSummary ? "h-[76vh]" : wantsDebtorChange || wantsSupplierChange ? "h-[68vh]" : "h-[72vh]";
  const reportPanel = <div id="sales-report-print-area" className={`flex min-h-[390px] flex-col overflow-hidden bg-[#f1f0ee] text-[#333] ${reportHeight}`}>
    <div className="border-b border-[#c9c7c3] px-3 py-2 text-sm font-medium">{reportWindowTitle}</div>
    <div className="sales-report-no-print flex items-center gap-4 border-b border-[#d0ceca] bg-[#f7f6f3] px-3 py-1 text-xs">
      <div className="relative">
        <button type="button" className="font-medium hover:text-[#003893]" aria-haspopup="menu" aria-expanded={reportMenuOpen} onClick={() => setReportMenuOpen((open) => !open)}>{labelFor("Report")}</button>
        {reportMenuOpen && <div role="menu" className="absolute left-0 top-full z-20 mt-1 min-w-44 border border-[#aaa] bg-[#f5f4f1] py-1 shadow-lg">
          <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { setPreviewOpen(true); setReportMenuOpen(false); }}>{labelFor("Preview")}</button>
          <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { printArea("sales-report-print-area"); setReportMenuOpen(false); }}>{labelFor("Print")}</button>
          <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { exportCsv(); setReportMenuOpen(false); }}>{labelFor("Export")}</button>
          <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { exportDosPrint(); setReportMenuOpen(false); }}>{labelFor("Dos-Print")}</button>
          {action.section === "sales" && <>
            <div className="my-1 border-t border-[#d2d0cc]" />
            <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { setSalesTool("price-list"); setReportMenuOpen(false); }}>{labelFor("Price List")} <span className="float-right pl-5">F9</span></button>
            <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { setSalesTool("generic-list"); setReportMenuOpen(false); }}>{labelFor("Generic List")} <span className="float-right pl-5">F10</span></button>
            <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { setSalesTool("calculator"); setReportMenuOpen(false); }}>{labelFor("Calculator")} <span className="float-right pl-5">F8</span></button>
            <button role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-[#dce8f8]" onClick={() => { setSalesTool("telephone"); setReportMenuOpen(false); }}>{labelFor("Telephone")} <span className="float-right pl-5">F4</span></button>
          </>}
        </div>}
      </div>
      <button type="button" className="font-medium hover:text-[#003893]" onClick={onClose}>{labelFor("Exit")}</button>
    </div>
    <div className="sales-report-no-print flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#d0ceca] bg-[#f5f4f1] px-3 py-2 text-xs">
      <Button type="button" variant="outline" onClick={() => { fromDateRef.current?.focus(); fromDateRef.current?.showPicker?.(); }} className="h-7 rounded-sm border-[#9b9b9b] bg-[#f4f3f0] px-3 text-xs">{labelFor("Date Range")}</Button>
      <span>{labelFor("From")}</span><Input ref={fromDateRef} aria-label={labelFor("From")} type="date" value={from} onChange={(event) => { if (to && event.target.value > to) { toast.error("The start date cannot be after the end date."); return; } setFrom(event.target.value); }} className="h-7 w-[150px] rounded-none border-[#aaa] bg-white px-2 text-xs" />
      <span>{labelFor("To")}</span><Input aria-label={labelFor("To")} type="date" value={to} onChange={(event) => { if (from && event.target.value < from) { toast.error("The end date cannot be before the start date."); return; } setTo(event.target.value); }} className="h-7 w-[150px] rounded-none border-[#aaa] bg-white px-2 text-xs" />
      {showsAllFirm && <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap"><input type="checkbox" checked={reportAllFirm} onChange={(event) => setReportAllFirm(event.target.checked)} className="h-3.5 w-3.5 accent-[#003893]" />{labelFor("All Firm")}</label>}
      {wantsUserCashSummary && <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap"><input type="checkbox" checked={includeCard} onChange={(event) => setIncludeCard(event.target.checked)} className="h-3.5 w-3.5 accent-[#003893]" />{labelFor("Card Include")}</label>}
      {titleIncludesPartywiseNet(action.title) && <label className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap">{labelFor("Search")}<Input aria-label={labelFor("Search")} value={partySearch} onChange={(event) => setPartySearch(event.target.value)} placeholder="" className="h-7 w-48 rounded-none border-[#aaa] bg-white px-2 text-xs" /></label>}
    </div>
    {(userCashError || debtorError || supplierChangeError) && <p role="alert" className="sales-report-no-print border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{userCashError || debtorError || supplierChangeError}</p>}
    {(userCashLoading || debtorLoading || supplierChangeLoading || allFirmSalesLoading) && <p className="sales-report-no-print px-3 py-2 text-xs text-slate-600">Loading saved report data…</p>}
    <div id="sales-report-table" className="min-h-0 flex-1 overflow-auto bg-[#faf9f7] p-1">
      <ReportTable rows={rows} columns={columns} compact labelFor={labelFor} />
    </div>
    <div className="sales-report-no-print border-t border-[#d0ceca] px-3 py-1 text-right text-xs text-[#555]">{labelFor("Total")}: {rows.length ? String(rows.at(-1)?.[columns[0]] === "Total" || rows.at(-1)?.Date === "Total" ? rows.at(-1)?.[columns[columns.length - 1]] ?? "" : "") : "0.00"}</div>
  </div>;
  return <>
    {isReferenceReport ? <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent overlayClassName="bg-slate-950/20" className={`${reportWidth} gap-0 rounded-sm border border-[#888] bg-[#f1f0ee] p-0 shadow-xl [&>button:last-child]:hidden`}>
      {reportPanel}
    </DialogContent></Dialog> : <Card className="border-[#003893]/25">
      <CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">{action.displayTitle ?? action.title}</span><Button variant="outline" onClick={exportCsv}><FileDown size={15} /> Export CSV</Button><Button variant="outline" onClick={() => printArea("sales-report-print-area")}><Printer size={15} /> Print</Button><Button variant="ghost" onClick={onClose}><X size={16} /> Close</Button></CardTitle></CardHeader>
      <CardContent><p className="mb-3 text-sm text-slate-500">{notice}</p><div id="sales-report-print-area"><ReportTable rows={rows} columns={columns} /></div></CardContent>
    </Card>}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-[94vw] gap-2 rounded-sm border border-[#888] bg-white p-3">
        <DialogHeader className="border-b pb-2"><DialogTitle className="text-base">{reportWindowTitle} — Preview</DialogTitle><DialogDescription>{from ? formatPlatformDate(from) : "—"} to {to ? formatPlatformDate(to) : "—"} · saved report data</DialogDescription></DialogHeader>
        <div className="max-h-[72vh] overflow-auto"><ReportTable rows={rows} columns={columns} compact labelFor={labelFor} /></div>
        <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>{labelFor("Close")}</Button><Button onClick={() => printArea("sales-report-print-area")}><Printer size={14} /> {labelFor("Print")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={salesTool !== null} onOpenChange={(open) => { if (!open) setSalesTool(null); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{salesTool === "price-list" ? "Price List" : salesTool === "generic-list" ? "Generic List" : salesTool === "calculator" ? "Calculator" : "Telephone"}</DialogTitle><DialogDescription>Sales Department utility · use Escape or Close to return to the report.</DialogDescription></DialogHeader>
        {(salesTool === "price-list" || salesTool === "generic-list") && <div className="space-y-3"><Input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search product, generic, SKU or category" />{salesCatalogLoading && <p className="text-xs text-slate-500">Loading current product catalog…</p>}<div className="max-h-[52vh] overflow-auto rounded-lg border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">{salesTool === "price-list" ? "Product" : "Generic"}</th><th className="p-3">Product / SKU</th><th className="p-3">Category</th><th className="p-3 text-right">Price (NPR)</th><th className="p-3 text-right">Stock</th></tr></thead><tbody>{catalogRows.map((product) => <tr key={product.id} className="border-t"><td className="p-3">{salesTool === "price-list" ? product.name : product.genericName || "Generic not recorded"}</td><td className="p-3">{product.name} · {product.sku}</td><td className="p-3">{product.category || "—"}</td><td className="p-3 text-right">{money(product.salePrice)}</td><td className="p-3 text-right">{product.stock}</td></tr>)}{!catalogRows.length && !salesCatalogLoading && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No products matched.</td></tr>}</tbody></table></div></div>}
        {salesTool === "calculator" && <div className="grid gap-3 sm:grid-cols-[1fr_130px_1fr]"><Input inputMode="decimal" type="number" value={calculatorLeft} onChange={(event) => setCalculatorLeft(event.target.value)} placeholder="First amount" /><Select value={calculatorOperator} onChange={(event) => setCalculatorOperator(event.target.value)}><option>+</option><option>−</option><option>×</option><option>÷</option></Select><Input inputMode="decimal" type="number" value={calculatorRight} onChange={(event) => setCalculatorRight(event.target.value)} placeholder="Second amount" /><p className="rounded-xl bg-slate-50 p-4 text-xl font-extrabold sm:col-span-3">Result: {calculatorValue == null ? "Cannot divide by zero" : money(calculatorValue)}</p></div>}
        {salesTool === "telephone" && <div className="space-y-3"><label className="block space-y-1 text-sm font-semibold">Telephone number<Input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Enter customer / contact number" inputMode="tel" /></label><p className="text-xs text-slate-500">Opens the device’s phone app when calling is supported.</p></div>}
        <DialogFooter><Button variant="outline" onClick={() => setSalesTool(null)}>Close</Button>{salesTool === "telephone" && <Button disabled={!phoneNumber.trim()} onClick={() => { window.location.href = `tel:${phoneNumber.replace(/[^+\d]/g, "")}`; }}>Call</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function titleIncludesPartywiseNet(title: string) { return title.toLowerCase().includes("partywise net sale"); }

function ReportTable({ rows, columns, compact = false, labelFor = (label: string) => label }: { rows: Row[]; columns: string[]; compact?: boolean; labelFor?: (label: string) => string }) {
  const minWidth = !compact ? "min-w-[640px]" : columns.length > 12 ? "min-w-[1350px]" : columns.length > 9 ? "min-w-[1180px]" : "min-w-[640px]";
  return <div className="overflow-x-auto"><table className={`w-full ${minWidth} ${compact ? "text-xs" : "text-sm"} text-left`}><thead><tr className="border-b bg-[#e9e8e5] text-[11px] text-[#444]">{columns.map((column) => <th key={column} className={compact ? "whitespace-nowrap px-2 py-1.5 font-medium" : "p-3 font-semibold uppercase text-slate-500"}>{labelFor(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${String(row[columns[0]] ?? "row")}`} className={`border-b border-[#e1dfdb] last:border-0 ${index === rows.length - 1 && (row[columns[0]] === "Total" || row.Date === "Total" || row.Party === "Total") ? "bg-[#efeeeb] font-semibold" : ""}`}>{columns.map((column) => <td key={column} className={compact ? "whitespace-nowrap px-2 py-1" : "p-3"}>{row[column]}</td>)}</tr>)}{!rows.length && <tr><td colSpan={Math.max(1, columns.length)} className="p-8 text-center text-slate-500">No matching records were returned for this report.</td></tr>}</tbody></table></div>;
}

function groupInventory(rows: CommerceInventory[], keyOf: (row: CommerceInventory) => string, valuesOf: (items: CommerceInventory[]) => Record<string, string | number>): Row[] {
  const grouped = new Map<string, CommerceInventory[]>();
  rows.forEach((row) => { const key = keyOf(row); const items = grouped.get(key) ?? []; items.push(row); grouped.set(key, items); });
  return [...grouped.entries()].map(([key, items]) => ({ Group: key, ...valuesOf(items) }));
}
