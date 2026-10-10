"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";

export type PharmacyMenuAction = {
  section: "sales" | "purchases" | "inventory" | "credit" | "catalogue" | "account" | "journal";
  mode: string;
  title: string;
  displayTitle?: string;
};

type Node = {
  label: string;
  children?: Node[];
  action?: PharmacyMenuAction;
  href?: string;
};
type TopMenu = { label: string; items?: Node[]; href?: string; exit?: boolean };

const report = (section: PharmacyMenuAction["section"], title: string): Node => ({
  label: title,
  action: { section, mode: "report", title },
});
const salesAction = (label: string, mode: string): Node => ({ label, action: { section: "sales", mode, title: label } });
const purchaseAction = (label: string, mode: string): Node => ({ label, action: { section: "purchases", mode, title: label } });
const inventoryAction = (label: string, mode: string): Node => ({ label, action: { section: "inventory", mode, title: label } });
const financeAction = (section: "account" | "journal", label: string, mode: string): Node => ({ label, action: { section, mode, title: label } });
const accountReport = (label: string): Node => report("credit", label);
const catalogueAction = (label: string, mode: string): Node => ({ label, action: { section: "catalogue", mode, title: label } });

export const salesReports = [
  "Sales Register", "Datewise Sales Summary", "Userwise Sales Summary", "Partywise Sales Summary",
  "Productwise Sales by Category", "Areawise Sales Summary", "MRwise Sales Summary", "Sales Summary", "Insurance Sales Report",
  "Sales Book All (Materialized View)", "Sales VAT Register", "Sales VAT Register Summary", "Net Sales",
  "Productwise Summary", "Sales Man Report", "Sales Man vs Product Report", "Monthly Sales", "MRwise Product",
  "Sales Statement Company MR", "Companywise Sales Book", "Sales by MR Territory Product", "Productwise Monthly Sales",
  "Product vs Party", "Sales Flash", "MR Sales Report", "Net Sales - All Credit + Cash Party",
];

export const salesReturnReports = [
  "Sales Return Register",
  "Datewise Sales Return Summary",
  "Partywise Sales Return Summary",
  "Productwise Sales Return Summary",
  "Sales Return Summary",
];

const menus: TopMenu[] = [
  {
    label: "Sales-Department",
    items: [
      { label: "Credit Sales Section", children: [salesAction("Credit Sales", "credit-entry"), salesAction("Open Credit Sales", "credit-register"), salesAction("Credit Sales Return", "sales-return-credit"), salesAction("Credit Sales Return (Exp)", "sales-return-credit-expired")] },
      { label: "Cash Sales Section", children: [salesAction("Cash Sales", "cash-entry"), salesAction("Open Cash Sales", "cash-register"), salesAction("Cash Sales Return", "sales-return-cash"), salesAction("Cash Sales Return (Exp)", "sales-return-cash-expired")] },
      salesAction("Sales Reverse Entry", "reverse-entry"), salesAction("Sales Return Cancel", "sales-return-cancel"),
      salesAction("Print Invoice", "invoice-report"), salesAction("Print Credit Note", "credit-note-report"),
      salesAction("Sales / Sales-Return Register", "sales-register-picker"),
      ...["User Cash Summary", "Company Wise Sales"].map((name) => report("sales", name)),
      report("sales", "Change In Debtors"), report("sales", "Partywise Net Sales"),
      ...["Cash to Teller", "Cash Hand Over"].map((name) => report("sales", name)),
    ],
  },
  {
    label: "Purchase-Department",
    items: [
      { label: "Purchase Section", children: [purchaseAction("Purchase Entry", "entry"), purchaseAction("Purchase Return", "return"), purchaseAction("Purchase Addition Information Edit", "purchase-additional-info-edit"), purchaseAction("Purchase Entry Auto", "entry"), report("purchases", "Purchase Book"), report("purchases", "Purchase Addition Book")] },
      purchaseAction("Modify Purchase", "purchase-modify"), purchaseAction("Purchase Return Cancel", "purchase-return-cancel"),
      inventoryAction("Stock Adjustment Cancel", "adjustment-cancel"), purchaseAction("Print MRN", "purchase-mrn-report"),
      purchaseAction("Purchase Return Slip", "purchase-return-slip"), inventoryAction("Stock Adjustment Slip", "adjustment-slip"),
      report("purchases", "Purchase / Adjustment Register"), report("purchases", "Change in Supplier"),
    ],
  },
  {
    label: "Account-Department",
    items: [
      { label: "Debtor Account", children: [financeAction("account", "Debtor Ledger", "debtor-ledger"), financeAction("account", "Debtor Invoice Register", "debtor-invoices")] },
      financeAction("account", "Cash Receipt Edit", "cash-receipt-edit"),
      financeAction("account", "Draft Receipt Edit", "draft-receipt-edit"),
      financeAction("account", "Credit Note Edit", "credit-note-edit"),
      financeAction("account", "Debit Note Edit", "debit-note-edit"),
      financeAction("account", "Cash Receipt Print", "cash-receipt-print"),
      financeAction("account", "Draft Receipt Print", "draft-receipt-print"),
      financeAction("account", "Credit Note Print", "credit-note-print"),
      financeAction("account", "Debit Note Print", "debit-note-print"),
      financeAction("account", "Collection/Adjustment Register", "collection-register"),
      financeAction("account", "Cash Collection", "cash-collection"),
    ],
  },
  {
    label: "Journal Voucher Section",
    items: [
      financeAction("journal", "Journal Voucher Entry", "journal-entry"),
      financeAction("journal", "Expense/ Purchase Voucher Entry", "expense-entry"),
      financeAction("journal", "Cheque Print", "cheque-print"),
      financeAction("journal", "Payment Voucher", "payment-entry"),
      financeAction("journal", "Receipt Voucher", "receipt-entry"),
      financeAction("journal", "Narration Edit", "narration"),
      financeAction("journal", "Post To Ledger", "post"),
      financeAction("journal", "UnPost To Edit", "unpost"),
      financeAction("journal", "Voucher Edit", "voucher-edit"),
      financeAction("journal", "Voucher Print", "voucher-print"),
      financeAction("journal", "Show Auto-Vouchers", "auto-vouchers"),
      financeAction("journal", "Journal Book", "journal-book"),
      financeAction("journal", "Supplier A/C Credit Entry", "supplier-credit"),
      financeAction("journal", "Supplier Debit Note", "supplier-debit"),
      financeAction("journal", "Supplier Debit Note Book", "supplier-debit-book"),
      financeAction("journal", "Supplier In-Complete Reconciliation Book", "supplier-reconciliation-book"),
    ],
  },
  {
    label: "Reports-Inventory",
    items: [
      report("inventory", "Stock/Sales Summary"), report("inventory", "Stock Register"), report("inventory", "Partywise Stock Register"),
      { label: "Stock Balance", children: ["Stock Balance / Valuation", "Stock Balance Current on S Price", "Rackwise Stock Balance", "Itemwise Department Stock", "Product Lock List", "Stock Balance Register"].map((name) => inventoryAction(name, "stock")) },
      { label: "Stock Analysis", children: ["No Stock List", "Stock Below Limit", "Over Stock/Re-Level", "Near Expiry Product", "Non-Slow Moving Product", "Free Goods Analysis", "Free Goods Monthly Sales"].map((name) => inventoryAction(name, "analysis")) },
      report("inventory", "Stock MIS"),
      { label: "MIS Reports 2", children: [report("inventory", "Office Sales"), report("inventory", "MRwise Yearly Sales Report")] },
      report("inventory", "Max Sales"),
    ],
  },
  {
    label: "Reports-Account",
    items: [
      { label: "Credit (Udharo) Ledger", action: { section: "credit", mode: "ledger", title: "Credit (Udharo) Ledger" } },
      { label: "Debtor Section", children: ["Party-Sub Ledger", "Aging Dues", "Aging Monthly", "Party Interest", "Debtor List", "Debtor List (1)", "Aging List", "Aging List Monthly", "Debtor Analysis", "Transaction Letter"].map(accountReport) },
      { label: "Supplier Section", children: [accountReport("Supplier’s Aging"), accountReport("Supplier Ageing List")] },
      ...["Quick Balance", "Statement", "Trial Balance", "Grouping Trial"].map(accountReport),
    ],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Product Setup", children: [
        { label: "Company Setup", href: "/superadmin/catalog/manufacturer" }, { label: "Drug Category Setup", href: "/superadmin/catalog/category" },
        { label: "Drug Group Setup", href: "/superadmin/catalog/category" }, { label: "Generic Name Setup", href: "/superadmin/catalog/medicine" },
        { label: "Product Division Setup", href: "/superadmin/catalog/manufacturer" }, catalogueAction("Product Rack Group Setup", "rack-groups"),
        catalogueAction("Product Rack Setup", "racks"), { label: "Product Setup", href: "/superadmin/products" },
        { label: "Open Stock Entry", action: { section: "inventory", mode: "opening-stock", title: "Open Stock Entry" } }, { label: "Open Stock List", action: { section: "inventory", mode: "opening-stock-list", title: "Open Stock List" } },
        catalogueAction("Sales Template Setup", "sales-templates"), catalogueAction("Companywise Party Discount", "party-discounts"),
        { label: "Transporter Setup", href: "/superadmin/transporters" }, catalogueAction("Companywise Supplier Discount", "supplier-discounts"),
        { label: "Doses Setup", href: "/superadmin/catalog/medicine" }, { label: "Scheme Discount Catalogue", href: "/superadmin/products" },
      { label: "Product Division Party Setup", action: { section: "catalogue", mode: "party-sectors", title: "Product Division Party Setup" } },
      ] },
      { label: "Account Setup", children: [catalogueAction("Party-Sector", "party-sectors"), catalogueAction("A/C Opening", "account-opening")] }, { label: "Cash Party", href: "/superadmin/customers" },
      { label: "Sales Man Setup", href: "/superadmin/sales-executives" }, { label: "Delivery Man", href: "/superadmin/staff" },
      { label: "Auto-Party Lock", href: "/superadmin/customers" }, { label: "Lock Party List", href: "/superadmin/customers" },
      { label: "Price List", href: "/superadmin/products" }, { label: "Tender and Order Section", href: "/superadmin/orders" },
      { label: "Medipro Software Product", href: "/superadmin/products" }, catalogueAction("Budget", "sales-budget"),
    ],
  },
  { label: "Utility", href: "/superadmin/system-health" },
  { label: "Setup", href: "/superadmin/settings" },
  { label: "Exit", exit: true },
];

/** Default Medi Pro-style sibling order for the top bar and every nested menu. */
export const PHARMACY_WORKSPACE_ACTIONS: PharmacyMenuAction[] = (() => { const result: PharmacyMenuAction[] = []; const collect = (nodes: Node[]) => nodes.forEach(node => { if (node.action) result.push(node.action); if (node.children) collect(node.children); }); menus.forEach(menu => collect(menu.items || [])); return result; })();

export const PHARMACY_WORKSPACE_MENU_GROUPS: Record<string, string[]> = (() => {
  const groups: Record<string, string[]> = { TOP: menus.filter((menu) => !menu.exit).map((menu) => menu.label) };
  const collect = (nodes: Node[], path: string) => {
    groups[path] = nodes.map((node) => node.label);
    nodes.forEach((node) => { if (node.children) collect(node.children, `${path}/${node.label}`); });
  };
  menus.forEach((menu) => { if (menu.items) collect(menu.items, menu.label); });
  return groups;
})();

export type PharmacyWorkspaceMenuOrder = Record<string, string[]>;

export function parsePharmacyWorkspaceMenuOrder(value?: string): PharmacyWorkspaceMenuOrder {
  if (!value) return PHARMACY_WORKSPACE_MENU_GROUPS;
  try {
    const parsed: unknown = JSON.parse(value);
    // Accept the initial top-bar-only format for compatibility with settings saved by earlier builds.
    const supplied: Record<string, unknown> = Array.isArray(parsed) ? { TOP: parsed } : parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(PHARMACY_WORKSPACE_MENU_GROUPS).map(([group, defaults]) => {
      const allowed = new Set(defaults);
      const candidates = Array.isArray(supplied[group]) ? supplied[group].filter((label): label is string => typeof label === "string" && allowed.has(label)) : [];
      const unique = [...new Set(candidates)];
      for (const label of defaults) {
        if (unique.includes(label)) continue;
        const previous = defaults.slice(0, defaults.indexOf(label)).reverse().find(candidate => unique.includes(candidate));
        unique.splice(previous ? unique.indexOf(previous) + 1 : 0, 0, label);
      }
      return [group, unique];
    }));
  } catch {
    return PHARMACY_WORKSPACE_MENU_GROUPS;
  }
}

export function orderedPharmacyMenuLabels(group: string, order: PharmacyWorkspaceMenuOrder) {
  const defaults = PHARMACY_WORKSPACE_MENU_GROUPS[group] ?? [];
  const configured = order[group] ?? defaults;
  return [...configured, ...defaults.filter((label) => !configured.includes(label))];
}

function collectNodeLabels(nodes: Node[], labels: string[]) {
  for (const node of nodes) {
    labels.push(node.label);
    if (node.children) collectNodeLabels(node.children, labels);
  }
}

/** Every menu label that Admin Settings can customize for the pharmacy workspace. */
export const PHARMACY_WORKSPACE_LABELS = [...new Set([...menus.flatMap((menu) => {
  const labels = [menu.label];
  if (menu.items) collectNodeLabels(menu.items, labels);
  return labels;
}), ...[
  "Sales & Purchase Management", "Sales / Sales-Return Register",
  "Sales Reverse Entry", "Sales Return Cancel", "Print Invoice", "Print Credit Note", "Bill print", "Invoice No.", "Remarks", "Reverse", "Cr No.", "Preview", "Print", "Report", "Exit", "Companywise Sales", "Userwise Cash Summary", "Partywise Net Sale CC Charge Included", "Date Range", "Search", "Dos-Print", "Price List", "Generic List", "Calculator", "Telephone", "Approved return", "Select return", "Required audit reason", "Cancel return", "Cancelling…", "Only approved returns appear here. Cancellation is blocked if the linked batch/ledger cannot be reversed safely.", "There are no approved returns available to cancel in the selected date and branch range.", "Amount restricted", "Expired / quarantined", "Standard",
  "UserName", "Cash_Receive", "Sales", "Receipt", "Card", "OPD-Copy", "DrNote", "CashIn", "Return", "CashOld", "CrNote", "Purch", "Net", "Hand Over", "Date", "Opening Debtor", "Closing Debtor", "Increase", "Total", "Company", "SalAmount", "SalDisc", "TotSales", "RetAmount", "RetDisc", "TotalReturn", "RetExpAmount", "RetExpDisc", "TotExpReturn", "NetSales", "Party", "Address", "Sales Disc", "Sales VAT", "Sales Return", "Return Discount", "Return VAT", "Credit", "D.note", "Function", "All Firm", "Card Include", "Tax Invoice", "Credit Note", "Date", "Branch", "Status", "Customer", "PAN", "Party type", "Payment", "Subtotal", "Discount", "VAT", "Total", "Paid", "Balance", "Product", "Qty", "Rate", "Amount", "Bonus", "Reason", "Expired return", "Standard return", "Credit amount", "Searching…", "Select", "All branches", "No matching records were returned for this report.", "Userwise Cash Summary", "Companywise Sales", "Partywise Net Sale CC Charge Included",
  "ANHH · Pharmacy operations", "Operations workspace", "Operations Home",
  "Billing, cash and credit sales, returns, invoices and sales reports.",
  "Supplier receipts, purchase returns, payment tracking and purchasing reports.",
  "Billing, procurement, live stock and Udharo in one workspace.",
  "Print / PDF", "Export", "From", "To", "Branch", "Refresh",
  "Sales", "Sales Return", "Function", "Select", "Close", "All Firm",
  "Cash Sales", "Credit Sales", "Open Cash Sales", "Open Credit Sales", "Sales Register", "Sales register",
  "Customer / Party", "Walk-in customer", "Walk-in name", "Walk-in phone", "Default branch", "Product", "Select product", "Sales unit", "Qty", "Discount %", "Bonus", "Add line", "Remove", "Sales template", "Load saved sales template…", "Payment", "Paid amount", "Net total", "Search register", "Payment status", "All products", "All customers", "No product lines have been added.", "Search product / SKU / barcode", "Product Search", "MRP", "Search product, generic, SKU or barcode", "Searching products…", "Generic", "SKU", "Category", "Available stock", "Sale price", "Purchase price", "No matching products found.", "Available stock", "Catalog discount", "batches are allocated by earliest expiry when saved.", "Insurance-covered sale", "Policy / claim number (optional)", "Save sale and issue VAT bill", "Save sale corrections", "Cancel correction", "Saving…", "Close", "Exit", "No sales in this period.", "Expired Sales Return", "Sales Return",
]])].sort((left, right) => left.localeCompare(right));

function MenuNode({ node, groupPath, menuOrder, onAction, onNavigate, labelFor }: { node: Node; groupPath: string; menuOrder: PharmacyWorkspaceMenuOrder; onAction: (action: PharmacyMenuAction) => void; onNavigate: (href: string) => void; labelFor: (label: string) => string }) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number } | null>(null);
  const showSubmenu = (target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const width = 224;
    const height = Math.min(window.innerHeight * 0.72, (node.children?.length ?? 1) * 28 + 12);
    const openLeft = bounds.right + width > window.innerWidth - 8;
    setSubmenuPosition({
      left: openLeft ? Math.max(8, bounds.left - width + 2) : bounds.right - 2,
      top: Math.max(8, Math.min(bounds.top, window.innerHeight - height - 8)),
    });
    setSubmenuOpen(true);
  };
  if (node.children) return <div className="group/sub relative" onMouseEnter={(event) => {
    const button = event.currentTarget.querySelector("button");
    if (button) showSubmenu(button);
  }} onMouseLeave={() => setSubmenuOpen(false)}>
    <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenuOpen} onClick={(event) => submenuOpen ? setSubmenuOpen(false) : showSubmenu(event.currentTarget)} className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-none px-2 py-1 text-left text-xs hover:bg-[#dce8f8] hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] ${submenuOpen ? "bg-[#dce8f8] text-[#003893]" : "text-[#444]"}`}>
      <span>{labelFor(node.label)}</span><ChevronRight size={14} className="shrink-0" />
    </button>
    {submenuOpen && <div role="menu" aria-label={labelFor(node.label)} style={{ left: submenuPosition?.left ?? 8, top: submenuPosition?.top ?? 64 }} className="fixed z-[120] max-h-[72vh] min-w-52 overflow-y-auto border border-[#aaa] bg-[#f5f4f1] p-1 text-[#444] shadow-lg max-md:static max-md:ml-3 max-md:border-y-0 max-md:border-r-0 max-md:shadow-none">
      {orderedPharmacyMenuLabels(`${groupPath}/${node.label}`, menuOrder).map((label) => node.children!.find((child) => child.label === label)!).filter(Boolean).map((child) => <MenuNode key={child.label} node={child} groupPath={`${groupPath}/${node.label}`} menuOrder={menuOrder} onAction={onAction} onNavigate={onNavigate} labelFor={labelFor} />)}
    </div>}
  </div>;
  return <button type="button" className="block w-full rounded-none px-2 py-1 text-left text-xs font-normal hover:bg-[#dce8f8] hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893]" onClick={() => node.action ? onAction({ ...node.action, displayTitle: labelFor(node.action.title) }) : node.href && onNavigate(node.href)}>{labelFor(node.label)}</button>;
}

export function PharmacyModuleMenu({ onAction, onExit, superAdmin = false, allowSales = true, allowPurchase = true, canAction = () => true, allowInventory = true, allowLedger = true, allowCatalog = true, department, menuOrder, labelFor = (label) => label }: { onAction: (action: PharmacyMenuAction) => void; onExit: () => void; superAdmin?: boolean; allowSales?: boolean; allowPurchase?: boolean; canAction?: (action: PharmacyMenuAction) => boolean; allowInventory?: boolean; allowLedger?: boolean; allowCatalog?: boolean; department?: "sales" | "purchase" | "home"; menuOrder?: string; labelFor?: (label: string) => string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [openPosition, setOpenPosition] = useState<{ left: number; top: number } | null>(null);
  const configuredOrder = parsePharmacyWorkspaceMenuOrder(menuOrder);
  const filterNodes = (nodes: Node[]): Node[] => nodes.flatMap(node => {
    if (node.children) { const children = filterNodes(node.children); return children.length ? [{ ...node, children }] : []; }
    if (node.action && !canAction(node.action)) return [];
    return [node];
  });
  const orderedMenus = orderedPharmacyMenuLabels("TOP", configuredOrder).map((label) => menus.find((menu) => menu.label === label)!).filter(Boolean).map(menu => ({ ...menu, items: menu.items ? filterNodes(menu.items) : undefined }));
  const visibleMenus = [...orderedMenus, ...menus.filter((menu) => menu.exit)].filter((menu) => {
    if (menu.items && menu.items.length === 0) return false;
    return menu.label === "Sales-Department" ? allowSales : menu.label === "Purchase-Department" ? allowPurchase : menu.label === "Reports-Inventory" ? allowInventory : menu.label === "Reports-Account" ? allowLedger : menu.label === "Catalogue" ? allowCatalog : true;
  });
  const navigate = (href: string) => {
    setOpen(null);
    if (!superAdmin) {
      const routeMap: Record<string, string> = {
        "/superadmin/system-health": "/admin/reports",
        "/superadmin/settings": "/admin/catalog",
        "/superadmin/sales-executives": "/admin/staff",
      };
      const [path, query] = href.split("?");
      href = `${routeMap[path] ?? path.replace("/superadmin/", "/admin/")}${query ? `?${query}` : ""}`;
    }
    router.push(href);
  };
  return <nav aria-label="Pharmacy management menus" className="relative z-40 overflow-visible border-y border-[#d6dcc9] bg-[#edf2df] shadow-none">
    <div role="menubar" className="flex gap-0 overflow-x-auto px-1 py-0 text-nowrap">
      {visibleMenus.map((menu) => {
        const opensOtherDepartment = !!department && department !== "home" && ((department === "sales" && menu.label === "Purchase-Department") || (department === "purchase" && menu.label === "Sales-Department"));
        return <div key={menu.label} className="relative shrink-0">
        <button type="button" role="menuitem" aria-haspopup={menu.items && !opensOtherDepartment ? "menu" : undefined} aria-expanded={opensOtherDepartment ? undefined : open === menu.label} onClick={(event) => {
          if (menu.exit) { onExit(); return; }
          if (menu.href) { navigate(menu.href); return; }
          if (opensOtherDepartment) {
            const workspaceRoot = superAdmin ? "/superadmin/sales-purchase" : "/admin/sales-purchase";
            const targetDepartment = department === "sales" ? "purchase" : "sales";
            window.open(`${workspaceRoot}/${targetDepartment}`, "_blank", "noopener,noreferrer");
            return;
          }
          if (!menu.items) return;
          if (open === menu.label) { setOpen(null); return; }
          const bounds = event.currentTarget.getBoundingClientRect();
          setOpenPosition({ left: Math.max(8, Math.min(bounds.left, window.innerWidth - 328)), top: Math.min(bounds.bottom + 4, window.innerHeight - 120) });
          setOpen(menu.label);
        }} className={`rounded-none px-2 py-1 text-xs font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] ${open === menu.label ? "bg-[#d9e5f3] text-[#123b68]" : "text-[#333] hover:bg-white/70 hover:text-[#003893]"}`}>
          {labelFor(menu.label)}{menu.items && !opensOtherDepartment && <ChevronDown size={13} className="ml-1 inline" />}
        </button>
        {open === menu.label && menu.items && <div role="menu" aria-label={menu.label} style={{ left: openPosition?.left ?? 8, top: openPosition?.top ?? 64 }} className="fixed z-[100] max-h-[76vh] min-w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-none border border-[#aaa] bg-[#f5f4f1] p-1 text-[#444] shadow-lg">
          {orderedPharmacyMenuLabels(menu.label, configuredOrder).map((label) => menu.items!.find((node) => node.label === label)!).filter(Boolean).filter((node) => menu.label !== "Sales-Department" || allowLedger || node.label !== "Change In Debtors").map((node) => <MenuNode key={node.label} node={node} groupPath={menu.label} menuOrder={configuredOrder} onAction={(action) => { setOpen(null); onAction(action); }} onNavigate={navigate} labelFor={labelFor} />)}
        </div>}
      </div>;
      })}
    </div>
  </nav>;
}
