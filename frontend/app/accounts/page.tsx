"use client";
import { RecordTable } from "@/components/entity-record-table";
import { EntityListWorkspace, EntityListPanel, EntityFormPanel, entitySaveComplete, useWorkspaceSelection } from "@/components/entity-list-panel";
import { FormSaveActions } from "@/components/form-save-actions";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate the protected finance workspace from the browser session. */
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  FileBarChart,
  FileText,
  Landmark,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  addReconciliation,
  createAccountantExpense,
  createJournalEntry,
  createSupplierInvoice,
  downloadAccountantReport,
  getAccountantDashboard,
  getAccountantExpenses,
  getAccountantInvoices,
  getAccountantLedger,
  getAccountantPayments,
  getAccountantSuppliers,
  getAccountingSummary,
  getJournalEntries,
  getReconciliations,
  getSupplierInvoices,
  getTaxSettings,
  matchReconciliation,
  recordAccountantPayment,
  saveTaxSettings,
  type AccountantDashboard,
  type AccountantExpense,
  type AccountantInvoice,
  type AccountantLedger,
  type AccountantPayment,
  type AccountingSummary,
  type JournalEntry,
  type Reconciliation,
  type SupplierInvoice,
  type TaxSettings,
} from "@/services/api";
import { staffToken, staffUser } from "@/components/staff-shell";
import { formatPlatformDate } from "@/lib/date-time";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { MessagingLink } from "@/components/messaging-link";

type Tab =
  | "overview"
  | "accounting"
  | "invoices"
  | "ledger"
  | "payables"
  | "expenses"
  | "reconciliation"
  | "bank"
  | "reports";
const money = (value: number) =>
  `NPR ${value.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (value: string) => formatPlatformDate(value);
const statusVariant = (status: string) =>
  status === "PAID" || status === "MATCHED"
    ? "default"
    : status === "PARTIAL"
      ? "secondary"
      : "destructive";

export default function AccountsPage() {
  const router = useRouter();
  const user = staffUser();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useWorkspaceSelection<Tab>("tab", "overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dashboard, setDashboard] = useState<AccountantDashboard | null>(null);
  const [accounting, setAccounting] = useState<AccountingSummary | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<AccountantInvoice[]>([]);
  const [payments, setPayments] = useState<AccountantPayment[]>([]);
  const [ledger, setLedger] = useState<AccountantLedger[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>(
    [],
  );
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [expenses, setExpenses] = useState<AccountantExpense[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [payment, setPayment] = useState({
    invoiceId: "",
    amount: "",
    method: "CASH",
    paymentDate: "",
    reference: "",
  });
  const [expense, setExpense] = useState({
    category: "Transport",
    description: "",
    amount: "",
    expenseDate: "",
    paymentMethod: "CASH",
    reference: "",
  });
  const [supplierInvoice, setSupplierInvoice] = useState({
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueAt: "",
    subtotal: "",
    taxAmount: "",
    notes: "",
  });
  const [bank, setBank] = useState({
    statementDate: "",
    bankAccount: "",
    transactionType: "CREDIT",
    amount: "",
    reference: "",
    notes: "",
  });
  const [journalForm, setJournalForm] = useState({
    entryDate: "",
    reference: "",
    description: "",
    debitAccount: "Accounts Receivable",
    creditAccount: "Sales Revenue",
    amount: "",
    notes: "",
  });
  const [taxForm, setTaxForm] = useState({
    name: "Nepal VAT",
    vatRate: "13",
    effectiveFrom: "",
  });
  useEffect(() => {
    const today = getPlatformDateInput();
    const firstOfMonth = `${today.slice(0, 8)}01`;
    setFrom(firstOfMonth);
    setTo(today);
    setPayment((x) => ({ ...x, paymentDate: today }));
    setExpense((x) => ({ ...x, expenseDate: today }));
    setSupplierInvoice((x) => ({ ...x, invoiceDate: today }));
    setBank((x) => ({ ...x, statementDate: today }));
    setJournalForm((x) => ({ ...x, entryDate: today }));
    setTaxForm((x) => ({ ...x, effectiveFrom: today }));
    setReady(true);
  }, []);
  useEffect(() => {
    if (
      ready &&
      (!staffToken() ||
        !user ||
        !["ACCOUNTANT", "SUPERADMIN"].includes(user.role))
    )
      router.replace(
        `/staff/login?returnTo=${encodeURIComponent("/accounts")}`,
      );
  }, [ready, router, user]);
  const load = useCallback(async () => {
    const token = staffToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const [
        summary,
        accountingSummary,
        journalRows,
        invoiceRows,
        paymentRows,
        ledgerRows,
        payableRows,
        supplierRows,
        expenseRows,
        bankRows,
        taxSettings,
      ] = await Promise.all([
        getAccountantDashboard(token, from, to),
        getAccountingSummary(token, from, to),
        getJournalEntries(token, from, to),
        getAccountantInvoices(token, { from, to }),
        getAccountantPayments(token, from, to),
        getAccountantLedger(token),
        getSupplierInvoices(token),
        getAccountantSuppliers(token),
        getAccountantExpenses(token, from, to),
        getReconciliations(token),
        getTaxSettings(token),
      ]);
      setDashboard(summary);
      setAccounting(accountingSummary);
      setJournal(journalRows);
      setInvoices(invoiceRows);
      setPayments(paymentRows);
      setLedger(ledgerRows);
      setSupplierInvoices(payableRows);
      setSuppliers(supplierRows);
      setExpenses(expenseRows);
      setReconciliations(bankRows);
      setTax(taxSettings);
      setTaxForm({
        name: taxSettings.name,
        vatRate: String(taxSettings.vatRate),
        effectiveFrom: taxSettings.effectiveFrom.slice(0, 10),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Finance data could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }, [from, to]);
  useEffect(() => {
    if (ready && from && to) void load();
  }, [from, load, ready, to]);
  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!payment.invoiceId || !payment.amount)
      return toast.error("Choose an invoice and enter the amount received.");
    setBusy(true);
    try {
      await recordAccountantPayment(staffToken(), {
        invoiceId: payment.invoiceId,
        amount: Number(payment.amount),
        method: payment.method,
        paymentDate: payment.paymentDate,
        reference: payment.reference || undefined,
      });
      toast.success("Payment recorded and invoice balance updated.");
      setPayment((x) => ({ ...x, invoiceId: "", amount: "", reference: "" }));
      await load();
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Payment could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createAccountantExpense(staffToken(), {
        ...expense,
        amount: Number(expense.amount),
      });
      toast.success("Expense recorded.");
      setExpense((x) => ({ ...x, description: "", amount: "", reference: "" }));
      await load();
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Expense could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitSupplierInvoice(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createSupplierInvoice(staffToken(), {
        ...supplierInvoice,
        subtotal: Number(supplierInvoice.subtotal),
        taxAmount: Number(supplierInvoice.taxAmount),
        supplierId: supplierInvoice.supplierId,
      });
      toast.success("Supplier invoice saved.");
      setSupplierInvoice((x) => ({
        ...x,
        invoiceNumber: "",
        subtotal: "",
        taxAmount: "",
        notes: "",
      }));
      await load();
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Supplier invoice could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitBank(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addReconciliation(staffToken(), {
        ...bank,
        amount: Number(bank.amount),
      });
      toast.success("Bank transaction added for reconciliation.");
      setBank((x) => ({ ...x, amount: "", reference: "", notes: "" }));
      await load();
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Bank transaction could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitTax(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const updated = await saveTaxSettings(staffToken(), {
        name: taxForm.name,
        vatRate: Number(taxForm.vatRate),
        effectiveFrom: taxForm.effectiveFrom,
      });
      setTax(updated);
      toast.success("VAT settings saved.");
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "VAT settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitJournal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createJournalEntry(staffToken(), {
        ...journalForm,
        amount: Number(journalForm.amount),
      });
      toast.success("Journal entry posted.");
      setJournalForm((x) => ({
        ...x,
        reference: "",
        description: "",
        amount: "",
        notes: "",
      }));
      await load();
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Journal entry could not be posted.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!ready || !user || !["ACCOUNTANT", "SUPERADMIN"].includes(user.role))
    return <EntityListWorkspace title="Accounts">
      <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Loading finance workspace…
      </main>
    </EntityListWorkspace>;
  const filteredInvoices = invoices.filter(
    (row) =>
      (!invoiceStatus || row.paymentStatus === invoiceStatus) &&
      (!search ||
        `${row.invoiceNumber} ${row.orderNumber} ${row.customerName}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const nav: [Tab, string, typeof Receipt][] = [
    ["overview", "Overview", TrendingUp],
    ["accounting", "Accounting", BookOpen],
    ["invoices", "Sales invoices", Receipt],
    ["ledger", "Customer ledger", Users],
    ["payables", "Payables", Building2],
    ["expenses", "Expenses", Wallet],
    ["reconciliation", "Reconciliation report", Landmark],
    ["bank", "Statement entries", Landmark],
    ["reports", "Reports & VAT", FileBarChart],
  ];
  return <EntityListWorkspace title="Accounts">
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#003893]"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
              All Nepal Healthy Home · Finance
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
              Accountant workspace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-900">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <MessagingLink accountType="staff" href={user.role === "SUPERADMIN" ? "/superadmin/messaging?tab=inbox" : "/messages?account=staff"} />
            <AccountProfileMenu
              kind="staff"
              name={user.fullName}
              email={user.email}
              accountTypeLabel={user.role}
              links={[
                { label: "My Account", href: "/accounts" },
                { label: "Manage orders", href: user.role === "SUPERADMIN" ? "/superadmin/orders" : "/admin/orders" },
              ]}
            />
          </div>
        </header>
        <div className="mt-7 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {nav.map(([key, label, Icon]) => (
            <Button
              key={key}
              variant={tab === key ? "default" : "ghost"}
              onClick={() => setTab(key)}
              className="gap-2"
            >
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-bold text-slate-500">
              From
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="text-xs font-bold text-slate-500">
              To
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={busy}>
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />{" "}
            {busy ? "Refreshing…" : "Refresh data"}
          </Button>
        </div>
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}
        {tab === "overview" && <Overview dashboard={dashboard} money={money} />}
        {tab === "accounting" && (
          <AccountingPanel
            summary={accounting}
            journal={journal}
            form={journalForm}
            setForm={setJournalForm}
            onJournal={submitJournal}
            money={money}
            busy={busy}
          />
        )}
        {tab === "invoices" && (
          <Invoices
            invoices={filteredInvoices}
            payments={payments}
            status={invoiceStatus}
            setStatus={setInvoiceStatus}
            search={search}
            setSearch={setSearch}
            payment={payment}
            setPayment={setPayment}
            onPayment={submitPayment}
            busy={busy}
            money={money}
          />
        )}
        {tab === "ledger" && <Ledger rows={ledger} money={money} />}
        {tab === "payables" && (
          <Payables
            rows={supplierInvoices}
            suppliers={suppliers}
            form={supplierInvoice}
            setForm={setSupplierInvoice}
            onSubmit={submitSupplierInvoice}
            money={money}
            busy={busy}
          />
        )}
        {tab === "expenses" && (
          <Expenses
            rows={expenses}
            form={expense}
            setForm={setExpense}
            onSubmit={submitExpense}
            money={money}
            busy={busy}
          />
        )}
        {tab === "reconciliation" && (
          <ReconciliationPanel rows={reconciliations} money={money} />
        )}
        {tab === "bank" && (
          <Bank
            rows={reconciliations}
            form={bank}
            setForm={setBank}
            onSubmit={submitBank}
            money={money}
            busy={busy}
            onMatch={async (id) => {
              try {
                await matchReconciliation(staffToken(), id);
                toast.success("Transaction marked as matched.");
                await load();
               entitySaveComplete(); } catch (e) {
                toast.error(
                  e instanceof Error
                    ? e.message
                    : "Transaction could not be matched.",
                );
              }
            }}
          />
        )}
        {tab === "reports" && (
          <Reports
            from={from}
            to={to}
            tax={tax}
            taxForm={taxForm}
            setTaxForm={setTaxForm}
            onTax={submitTax}
            busy={busy}
          />
        )}
      </div>
    </main>
  </EntityListWorkspace>;
}

function AccountingPanel({
  summary,
  journal,
  form,
  setForm,
  onJournal,
  money,
  busy,
}: {
  summary: AccountingSummary | null;
  journal: JournalEntry[];
  form: {
    entryDate: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: string;
    notes: string;
  };
  setForm: (x: {
    entryDate: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: string;
    notes: string;
  }) => void;
  onJournal: (event: FormEvent) => void;
  money: (value: number) => string;
  busy: boolean;
}) {
  const [section, setSection] = useState("journal");
  const sections = [
    ["journal", "Journal"],
    ["trial-balance", "Trial Balance"],
    ["ledger-report", "Ledger"],
    ["draft-ledger", "Draft Ledger"],
    ["income-statement", "Income Statement"],
    ["balance-sheet", "Balance sheet"],
    ["party-confirmation", "Party Confirmation"],
    ["rp-report", "RP Report"],
  ];
  const balances = summary?.trialBalance ?? [];
  return (
    <div className="mt-6 grid gap-6 ">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Accounting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 p-3">
          {sections.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded-xl px-3 py-3 text-left text-sm font-bold transition ${section === key ? "bg-[#003893] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
            </button>
          ))}
        </CardContent>
      </Card>
      <div>
        {section === "journal" && (
          <JournalView
            rows={journal}
            form={form}
            setForm={setForm}
            onSubmit={onJournal}
            busy={busy}
            money={money}
          />
        )}
        {section === "trial-balance" && (
          <AccountingTable
            title="Trial Balance"
            rows={balances}
            money={money}
          />
        )}
        {section === "ledger-report" && (
          <AccountingTable
            title="General Ledger"
            rows={balances}
            money={money}
          />
        )}
        {section === "draft-ledger" && (
          <JournalTable
            title="Draft Ledger"
            rows={journal.filter((x) => x.status === "DRAFT")}
            money={money}
            empty="No draft ledger entries."
          />
        )}
        {section === "income-statement" && (
          <Statement
            title="Income Statement"
            money={money}
            fields={[
              ["Sales revenue", summary?.revenue ?? 0],
              ["Operating expenses", summary?.expenses ?? 0],
              ["Net profit", summary?.netProfit ?? 0],
            ]}
          />
        )}
        {section === "balance-sheet" && (
          <Statement
            title="Balance sheet"
            money={money}
            fields={[
              ["Cash and bank", summary?.cashBalance ?? 0],
              ["Accounts receivable", summary?.receivables ?? 0],
              ["Accounts payable", summary?.payables ?? 0],
              [
                "Net position",
                (summary?.cashBalance ?? 0) +
                  (summary?.receivables ?? 0) -
                  (summary?.payables ?? 0),
              ],
            ]}
          />
        )}
        {section === "party-confirmation" && (
          <Card>
            <CardHeader>
              <CardTitle>Party Confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                Use this view to confirm retailer balances before collection
                follow-up. Current receivables are{" "}
                <b>{money(summary?.receivables ?? 0)}</b> across the live sales
                ledger.
              </p>
              <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-[#003893]">
                Confirmation data is based on posted invoices and cleared
                payments in the selected reporting period.
              </div>
            </CardContent>
          </Card>
        )}
        {section === "rp-report" && (
          <Statement
            title="RP Report"
            money={money}
            fields={[
              ["Posted journal entries", summary?.postedEntries ?? 0],
              ["Receivables", summary?.receivables ?? 0],
              ["Payables", summary?.payables ?? 0],
              ["Cash balance", summary?.cashBalance ?? 0],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function JournalView({
  rows,
  form,
  setForm,
  onSubmit,
  busy,
  money,
}: {
  rows: JournalEntry[];
  form: {
    entryDate: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: string;
    notes: string;
  };
  setForm: (x: {
    entryDate: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: string;
    notes: string;
  }) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  money: (value: number) => string;
}) {
  return (
    <div className="grid gap-6 ">
      <EntityListPanel><JournalTable title="Journal" rows={rows} money={money} /></EntityListPanel>
      <EntityFormPanel><Card>
        <CardHeader>
          <CardTitle>Post journal entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <Label>
              Date
              <Input
                required
                type="date"
                value={form.entryDate}
                onChange={(e) =>
                  setForm({ ...form, entryDate: e.target.value })
                }
              />
            </Label>
            <Label>
              Reference
              <Input
                required
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                placeholder="JV-0001"
              />
            </Label>
            <Label>
              Description
              <Input
                required
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Label>
            <Label>
              Debit account
              <Input
                required
                value={form.debitAccount}
                onChange={(e) =>
                  setForm({ ...form, debitAccount: e.target.value })
                }
              />
            </Label>
            <Label>
              Credit account
              <Input
                required
                value={form.creditAccount}
                onChange={(e) =>
                  setForm({ ...form, creditAccount: e.target.value })
                }
              />
            </Label>
            <Label>
              Amount
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Label>
            <FormSaveActions mode="create" busy={busy} onCancel={() => {}} />
          </form>
        </CardContent>
      </Card></EntityFormPanel>
    </div>
  );
}

function JournalTable({
  title,
  rows,
  money,
  empty = "No journal entries for this period.",
}: {
  title: string;
  rows: JournalEntry[];
  money: (value: number) => string;
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <RecordTable className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Reference</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Debit</th>
                <th className="px-3 py-3">Credit</th>
                <th className="px-3 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-4">{dateOnly(row.entryDate)}</td>
                  <td className="px-3 py-4 font-bold">{row.reference}</td>
                  <td className="px-3 py-4">{row.description}</td>
                  <td className="px-3 py-4">{row.debitAccount}</td>
                  <td className="px-3 py-4">{row.creditAccount}</td>
                  <td className="px-3 py-4 font-bold">{money(row.amount)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    <Empty icon={FileText} text={empty} />
                  </td>
                </tr>
              )}
            </tbody>
          </RecordTable>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountingTable({
  title,
  rows,
  money,
}: {
  title: string;
  rows: { account: string; debit: number; credit: number; balance: number }[];
  money: (value: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <RecordTable className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Debit</th>
                <th className="px-3 py-3">Credit</th>
                <th className="px-3 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.account}>
                  <td className="px-3 py-4 font-bold">{row.account}</td>
                  <td className="px-3 py-4">{money(row.debit)}</td>
                  <td className="px-3 py-4">{money(row.credit)}</td>
                  <td className="px-3 py-4 font-extrabold">
                    {money(row.balance)}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4}>
                    <Empty
                      icon={BookOpen}
                      text="No account balances for this period."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </RecordTable>
        </div>
      </CardContent>
    </Card>
  );
}

function Statement({
  title,
  fields,
  money,
}: {
  title: string;
  fields: [string, number][];
  money: (value: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-3 text-2xl font-extrabold text-slate-950">
                {typeof value === "number" && label.includes("entries")
                  ? value
                  : money(value)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Generated from posted invoices, cleared payments, expenses, supplier
          invoices, and journal entries for the selected period.
        </p>
      </CardContent>
    </Card>
  );
}

function ReconciliationPanel({
  rows,
  money,
}: {
  rows: Reconciliation[];
  money: (value: number) => string;
}) {
  const matched = rows.filter((row) => row.status === "MATCHED").length;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Account Reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Statement lines</p>
          <p className="mt-2 text-3xl font-extrabold">{rows.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Matched transactions</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-700">
            {matched}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Unmatched</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Needs review</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-700">
            {rows.length - matched}
          </p>
        </CardContent>
      </Card>
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Reconciliation report detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <b>{row.reference}</b>
                  <p className="text-xs text-slate-500">
                    {row.bankAccount} · {dateOnly(row.statementDate)} ·{" "}
                    {row.transactionType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <b>{money(row.amount)}</b>
                  <Badge variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                </div>
              </div>
            ))}
            {!rows.length && (
              <Empty icon={Landmark} text="No reconciliation records yet." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Overview({
  dashboard,
  money,
}: {
  dashboard: AccountantDashboard | null;
  money: (value: number) => string;
}) {
  const cards = [
    ["Revenue", dashboard?.revenue ?? 0, Receipt, "text-[#003893]"],
    [
      "Receivables",
      dashboard?.receivables ?? 0,
      CircleDollarSign,
      "text-amber-700",
    ],
    ["Payables", dashboard?.payables ?? 0, Building2, "text-rose-700"],
    ["Cash flow", dashboard?.cashFlow ?? 0, TrendingUp, "text-emerald-700"],
  ] as const;
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, color]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div
                className={`flex items-center gap-2 text-sm font-bold ${color}`}
              >
                <Icon size={18} />
                {label}
              </div>
              <p className="mt-4 text-2xl font-extrabold text-slate-950">
                {money(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 ">
        <Card>
          <CardHeader>
            <CardTitle>Top retailers by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {dashboard?.topCustomers.map((customer) => (
                <div
                  key={customer.customerId}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#003893]">
                      <Users size={17} />
                    </span>
                    <div>
                      <p className="font-bold">{customer.customerName}</p>
                      <p className="text-xs text-slate-500">
                        Outstanding {money(customer.outstanding)}
                      </p>
                    </div>
                  </div>
                  <p className="font-extrabold">{money(customer.revenue)}</p>
                </div>
              ))}
              {!dashboard?.topCustomers.length && (
                <Empty
                  icon={Users}
                  text="No invoice activity for this period."
                />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Period snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoices issued</span>
              <b>{dashboard?.invoiceCount ?? 0}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Operating expenses</span>
              <b>{money(dashboard?.expenses ?? 0)}</b>
            </div>
            <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              Revenue is calculated from invoices, payments, purchasing, and
              payroll for the selected period.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Invoices({
  invoices,
  payments,
  status,
  setStatus,
  search,
  setSearch,
  payment,
  setPayment,
  onPayment,
  busy,
  money,
}: {
  invoices: AccountantInvoice[];
  payments: AccountantPayment[];
  status: string;
  setStatus: (x: string) => void;
  search: string;
  setSearch: (x: string) => void;
  payment: {
    invoiceId: string;
    amount: string;
    method: string;
    paymentDate: string;
    reference: string;
  };
  setPayment: (x: {
    invoiceId: string;
    amount: string;
    method: string;
    paymentDate: string;
    reference: string;
  }) => void;
  onPayment: (event: FormEvent) => void;
  busy: boolean;
  money: (value: number) => string;
}) {
  return (
    <div className="mt-6 grid gap-6 ">
      <EntityListPanel addLabel="Add entry"><Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Sales invoices</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Search size={15} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 bg-transparent py-2 text-sm outline-none"
                  placeholder="Search invoice or retailer"
                />
              </div>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-auto"
              >
                <option value="">All payment statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNPAID">Unpaid</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <RecordTable className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Invoice</th>
                  <th className="px-3 py-3">Retailer</th>
                  <th className="px-3 py-3">Issued</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-3 font-bold">
                      {row.invoiceNumber}
                      <p className="text-xs font-normal text-slate-400">
                        {row.orderNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3">{row.customerName}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {dateOnly(row.issuedAt)}
                    </td>
                    <td className="px-3 py-3 font-bold">{money(row.total)}</td>
                    <td className="px-3 py-3 text-amber-700">
                      {money(row.dueAmount)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(row.paymentStatus)}>
                        {row.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!invoices.length && (
                  <tr>
                    <td colSpan={6}>
                      <Empty
                        icon={FileText}
                        text="No invoices match these filters."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </RecordTable>
          </div>
        </CardContent>
      </Card></EntityListPanel>
      <div className="grid gap-6">
        <EntityFormPanel><Card>
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={onPayment}>
              <Label>
                Sales invoice
                <Select
                  value={payment.invoiceId}
                  onChange={(e) =>
                    setPayment({ ...payment, invoiceId: e.target.value })
                  }
                >
                  <option value="">Choose an unpaid invoice</option>
                  {invoices
                    .filter((x) => x.dueAmount > 0)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.invoiceNumber} · {money(x.dueAmount)}
                      </option>
                    ))}
                </Select>
              </Label>
              <Label>
                Amount
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) =>
                    setPayment({ ...payment, amount: e.target.value })
                  }
                />
              </Label>
              <Label>
                Method
                <Select
                  value={payment.method}
                  onChange={(e) =>
                    setPayment({ ...payment, method: e.target.value })
                  }
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </Label>
              <Label>
                Payment date
                <Input
                  type="date"
                  value={payment.paymentDate}
                  onChange={(e) =>
                    setPayment({ ...payment, paymentDate: e.target.value })
                  }
                />
              </Label>
              <Label>
                Reference
                <Input
                  value={payment.reference}
                  onChange={(e) =>
                    setPayment({ ...payment, reference: e.target.value })
                  }
                  placeholder="Receipt, cheque, or bank reference"
                />
              </Label>
              <FormSaveActions mode="create" busy={busy} onCancel={() => {}} />
            </form>
          </CardContent>
        </Card></EntityFormPanel>
        <EntityListPanel addLabel="Add entry"><Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.slice(0, 5).map((row) => (
              <div key={row.id} className="flex justify-between gap-3 text-sm">
                <div>
                  <b>{row.invoiceNumber ?? row.supplierInvoiceNumber}</b>
                  <p className="text-xs text-slate-500">
                    {row.method} · {dateOnly(row.paymentDate)}
                  </p>
                </div>
                <b>{money(row.amount)}</b>
              </div>
            ))}
            {!payments.length && (
              <p className="text-sm text-slate-500">
                No payments recorded in this period.
              </p>
            )}
          </CardContent>
        </Card></EntityListPanel>
      </div>
    </div>
  );
}

function Ledger({
  rows,
  money,
}: {
  rows: AccountantLedger[];
  money: (value: number) => string;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Retailer customer ledger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <RecordTable className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Retailer</th>
                <th className="px-3 py-3">Credit limit</th>
                <th className="px-3 py-3">Debits</th>
                <th className="px-3 py-3">Credits</th>
                <th className="px-3 py-3">Balance</th>
                <th className="px-3 py-3">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.customerId}>
                  <td className="px-3 py-4">
                    <b>{row.customerName}</b>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-3 py-4">{money(row.creditLimit)}</td>
                  <td className="px-3 py-4">{money(row.totalDebit)}</td>
                  <td className="px-3 py-4 text-emerald-700">
                    {money(row.totalCredit)}
                  </td>
                  <td className="px-3 py-4 font-extrabold">
                    {money(row.balance)}
                  </td>
                  <td className="px-3 py-4">
                    <Badge
                      variant={row.overdue > 0 ? "destructive" : "default"}
                    >
                      {money(row.overdue)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    <Empty
                      icon={BookOpen}
                      text="Ledger entries will appear as invoices and payments are recorded."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </RecordTable>
        </div>
      </CardContent>
    </Card>
  );
}

function Payables({
  rows,
  suppliers,
  form,
  setForm,
  onSubmit,
  money,
  busy,
}: {
  rows: SupplierInvoice[];
  suppliers: { id: string; name: string }[];
  form: {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueAt: string;
    subtotal: string;
    taxAmount: string;
    notes: string;
  };
  setForm: (x: {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueAt: string;
    subtotal: string;
    taxAmount: string;
    notes: string;
  }) => void;
  onSubmit: (event: FormEvent) => void;
  money: (value: number) => string;
  busy: boolean;
}) {
  return (
    <div className="mt-6 grid gap-6 ">
      <EntityListPanel addLabel="Add entry"><Card>
        <CardHeader>
          <CardTitle>Supplier invoices & payables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <RecordTable className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Supplier invoice</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-4 font-bold">{row.invoiceNumber}</td>
                    <td className="px-3 py-4">{row.supplierName}</td>
                    <td className="px-3 py-4">{dateOnly(row.invoiceDate)}</td>
                    <td className="px-3 py-4 font-bold">{money(row.total)}</td>
                    <td className="px-3 py-4 text-rose-700">
                      {money(row.dueAmount)}
                    </td>
                    <td className="px-3 py-4">
                      <Badge variant={statusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6}>
                      <Empty
                        icon={Building2}
                        text="No supplier invoices recorded yet."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </RecordTable>
          </div>
        </CardContent>
      </Card></EntityListPanel>
      <EntityFormPanel><Card>
        <CardHeader>
          <CardTitle>Add supplier invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <Label>
              Supplier
              <Select
                required
                value={form.supplierId}
                onChange={(e) =>
                  setForm({ ...form, supplierId: e.target.value })
                }
              >
                <option value="">Choose supplier</option>
                {suppliers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label>
              Invoice number
              <Input
                required
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm({ ...form, invoiceNumber: e.target.value })
                }
              />
            </Label>
            <Label>
              Invoice date
              <Input
                required
                type="date"
                value={form.invoiceDate}
                onChange={(e) =>
                  setForm({ ...form, invoiceDate: e.target.value })
                }
              />
            </Label>
            <Label>
              Due date
              <Input
                type="date"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label>
                Subtotal
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.subtotal}
                  onChange={(e) =>
                    setForm({ ...form, subtotal: e.target.value })
                  }
                />
              </Label>
              <Label>
                VAT
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taxAmount}
                  onChange={(e) =>
                    setForm({ ...form, taxAmount: e.target.value })
                  }
                />
              </Label>
            </div>
            <FormSaveActions mode="create" busy={busy} onCancel={() => {}} />
          </form>
        </CardContent>
      </Card></EntityFormPanel>
    </div>
  );
}

function Expenses({
  rows,
  form,
  setForm,
  onSubmit,
  money,
  busy,
}: {
  rows: AccountantExpense[];
  form: {
    category: string;
    description: string;
    amount: string;
    expenseDate: string;
    paymentMethod: string;
    reference: string;
  };
  setForm: (x: {
    category: string;
    description: string;
    amount: string;
    expenseDate: string;
    paymentMethod: string;
    reference: string;
  }) => void;
  onSubmit: (event: FormEvent) => void;
  money: (value: number) => string;
  busy: boolean;
}) {
  return (
    <div className="mt-6 grid gap-6 ">
      <EntityListPanel addLabel="Add entry"><Card>
        <CardHeader>
          <CardTitle>Business expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <RecordTable className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-4">{dateOnly(row.expenseDate)}</td>
                    <td className="px-3 py-4">
                      <Badge variant="secondary">{row.category}</Badge>
                    </td>
                    <td className="px-3 py-4">{row.description}</td>
                    <td className="px-3 py-4">{row.paymentMethod}</td>
                    <td className="px-3 py-4 font-bold">{money(row.amount)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5}>
                      <Empty
                        icon={Wallet}
                        text="No expenses recorded for this period."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </RecordTable>
          </div>
        </CardContent>
      </Card></EntityListPanel>
      <EntityFormPanel><Card>
        <CardHeader>
          <CardTitle>Record an expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <Label>
              Category
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Rent</option>
                <option>Salaries</option>
                <option>Utilities</option>
                <option>Transport</option>
                <option>Other</option>
              </Select>
            </Label>
            <Label>
              Description
              <Input
                required
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Label>
            <Label>
              Amount
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Label>
            <Label>
              Date
              <Input
                required
                type="date"
                value={form.expenseDate}
                onChange={(e) =>
                  setForm({ ...form, expenseDate: e.target.value })
                }
              />
            </Label>
            <Label>
              Payment method
              <Select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value })
                }
              >
                <option>CASH</option>
                <option>BANK_TRANSFER</option>
                <option>CHEQUE</option>
              </Select>
            </Label>
            <FormSaveActions mode="create" busy={busy} onCancel={() => {}} />
          </form>
        </CardContent>
      </Card></EntityFormPanel>
    </div>
  );
}

function Bank({
  rows,
  form,
  setForm,
  onSubmit,
  money,
  busy,
  onMatch,
}: {
  rows: Reconciliation[];
  form: {
    statementDate: string;
    bankAccount: string;
    transactionType: string;
    amount: string;
    reference: string;
    notes: string;
  };
  setForm: (x: {
    statementDate: string;
    bankAccount: string;
    transactionType: string;
    amount: string;
    reference: string;
    notes: string;
  }) => void;
  onSubmit: (event: FormEvent) => void;
  money: (value: number) => string;
  busy: boolean;
  onMatch: (id: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-6 ">
      <EntityListPanel addLabel="Add entry"><Card>
        <CardHeader>
          <CardTitle>Bank statement reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <RecordTable className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3">Reference</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-4">{dateOnly(row.statementDate)}</td>
                    <td className="px-3 py-4">{row.bankAccount}</td>
                    <td className="px-3 py-4">{row.reference}</td>
                    <td className="px-3 py-4">{row.transactionType}</td>
                    <td className="px-3 py-4 font-bold">{money(row.amount)}</td>
                    <td className="px-3 py-4">
                      <Badge variant={statusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 text-right">
                      {row.status !== "MATCHED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMatch(row.id)}
                        >
                          <CheckCircle2 size={14} /> Match
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7}>
                      <Empty
                        icon={Landmark}
                        text="Add bank statement lines to begin reconciliation."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </RecordTable>
          </div>
        </CardContent>
      </Card></EntityListPanel>
      <EntityFormPanel><Card>
        <CardHeader>
          <CardTitle>Add statement line</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <Label>
              Statement date
              <Input
                required
                type="date"
                value={form.statementDate}
                onChange={(e) =>
                  setForm({ ...form, statementDate: e.target.value })
                }
              />
            </Label>
            <Label>
              Bank account
              <Input
                required
                value={form.bankAccount}
                onChange={(e) =>
                  setForm({ ...form, bankAccount: e.target.value })
                }
                placeholder="Nabil · ending 1234"
              />
            </Label>
            <Label>
              Type
              <Select
                value={form.transactionType}
                onChange={(e) =>
                  setForm({ ...form, transactionType: e.target.value })
                }
              >
                <option>CREDIT</option>
                <option>DEBIT</option>
              </Select>
            </Label>
            <Label>
              Amount
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Label>
            <Label>
              Reference
              <Input
                required
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </Label>
            <FormSaveActions mode="create" busy={busy} onCancel={() => {}} />
          </form>
        </CardContent>
      </Card></EntityFormPanel>
    </div>
  );
}

function Reports({
  from,
  to,
  tax,
  taxForm,
  setTaxForm,
  onTax,
  busy,
}: {
  from: string;
  to: string;
  tax: TaxSettings | null;
  taxForm: { name: string; vatRate: string; effectiveFrom: string };
  setTaxForm: (x: {
    name: string;
    vatRate: string;
    effectiveFrom: string;
  }) => void;
  onTax: (event: FormEvent) => void;
  busy: boolean;
}) {
  const [reportBusy, setReportBusy] = useState("");
  const reportTypes: [string, string, typeof Receipt][] = [
    ["sales", "Sales summary", Receipt],
    ["vat", "VAT report", FileText],
    ["profit-margin", "Profit margin", TrendingUp],
    ["receivables", "Outstanding receivables", CircleDollarSign],
    ["expenses", "Expense report", Wallet],
  ];
  async function download(type: string) {
    setReportBusy(type);
    try {
      await downloadAccountantReport(staffToken(), type, from, to);
      toast.success("Excel-compatible report downloaded.");
     entitySaveComplete(); } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Report could not be generated.",
      );
    } finally {
      setReportBusy("");
    }
  }
  return (
    <div className="mt-6 grid gap-6 ">
      <Card>
        <CardHeader>
          <CardTitle>Financial reports</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {reportTypes.map(([type, label, Icon]) => (
            <Button
              key={type}
              variant="outline"
              className="h-auto justify-start gap-3 p-4"
              onClick={() => void download(type)}
              disabled={!!reportBusy}
            >
              <Download size={17} />
              <span className="text-left">
                <span className="block font-bold">{label}</span>
                <span className="block text-xs font-normal text-slate-500">
                  {reportBusy === type
                    ? "Preparing…"
                    : "Download Excel-compatible CSV"}
                </span>
              </span>
              <Icon size={16} className="ml-auto text-slate-400" />
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>VAT settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onTax}>
            <Label>
              Tax name
              <Input
                value={taxForm.name}
                onChange={(e) =>
                  setTaxForm({ ...taxForm, name: e.target.value })
                }
              />
            </Label>
            <Label>
              VAT rate (%)
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxForm.vatRate}
                onChange={(e) =>
                  setTaxForm({ ...taxForm, vatRate: e.target.value })
                }
              />
            </Label>
            <Label>
              Effective from
              <Input
                type="date"
                value={taxForm.effectiveFrom}
                onChange={(e) =>
                  setTaxForm({ ...taxForm, effectiveFrom: e.target.value })
                }
              />
            </Label>
            <p className="rounded-xl bg-blue-50 p-3 text-xs text-[#003893]">
              Current Nepal VAT setting: <b>{tax?.vatRate ?? 13}%</b>. Keep this
              aligned with your registered filing period.
            </p>
            <Button type="submit" disabled={busy}>
              <CreditCard size={16} /> Save VAT settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="p-10 text-center text-sm text-slate-500">
      <Icon size={28} className="mx-auto text-slate-300" />
      <p className="mt-3">{text}</p>
    </div>
  );
}
