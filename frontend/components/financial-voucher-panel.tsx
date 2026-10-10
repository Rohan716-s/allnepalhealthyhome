"use client";
import { RecordTable } from "@/components/entity-record-table";
import { FormSaveActions } from "@/components/form-save-actions";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EntityListWorkspace, EntityListPanel, EntityFormPanel, routeEntityEdit, entitySaveComplete, useEntityList } from "@/components/entity-list-panel";
import { staffUser } from "@/components/staff-shell";
import { hasCommercePermission } from "@/lib/sales-purchase-permissions";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import { formatPlatformDate } from "@/lib/date-time";
import { useSiteConfig } from "@/components/site-config-provider";
import { getFinancialOptions, getFinancialVoucher, getFinancialVouchers, saveFinancialVoucher, transitionFinancialVoucher, editFinancialNarration, getFinancialPrint, getFinancialAutoVouchers, getFinancialDebtorLedger, FinancialInvoiceOption } from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";
import type { FinancialVoucher, FinancialOptions, FinancialVoucherInput, AutoVoucher, FinancialDebtorLedger } from "@/services/api";
const types: Record<string, string> = {
    CASH_RECEIPT: "Cash receipt",
    DRAFT_RECEIPT: "Draft receipt",
    CREDIT_NOTE: "Credit note",
    DEBIT_NOTE: "Debit note",
    JOURNAL: "Journal voucher",
    EXPENSE_PURCHASE: "Expense / purchase voucher",
    PAYMENT: "Payment voucher",
    RECEIPT: "Receipt voucher",
    SUPPLIER_CREDIT: "Supplier A/C credit",
    SUPPLIER_DEBIT: "Supplier debit note"
};
const modeTypes: Record<string, string> = {
    "cash-receipt-edit": "CASH_RECEIPT",
    "cash-receipt-print": "CASH_RECEIPT",
    "cash-collection": "CASH_RECEIPT",
    "draft-receipt-edit": "DRAFT_RECEIPT",
    "draft-receipt-print": "DRAFT_RECEIPT",
    "credit-note-edit": "CREDIT_NOTE",
    "credit-note-print": "CREDIT_NOTE",
    "debit-note-edit": "DEBIT_NOTE",
    "debit-note-print": "DEBIT_NOTE",
    "journal-entry": "JOURNAL",
    "expense-entry": "EXPENSE_PURCHASE",
    "payment-entry": "PAYMENT",
    "receipt-entry": "RECEIPT",
    "supplier-credit": "SUPPLIER_CREDIT",
    "supplier-debit": "SUPPLIER_DEBIT",
    "supplier-debit-book": "SUPPLIER_DEBIT"
};
const money = (value: number) => `NPR ${value.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})}`;
function accountsFor(type: string, method = "CASH") {
    const cash = method === "CASH" ? "Cash" : method === "CHEQUE" ? "Cheques in Hand" : "Bank";
    if (type === "DEBIT_NOTE")
        return [
            "Accounts Receivable",
            "Other Income"
        ];
    if (type === "CREDIT_NOTE")
        return [
            "Sales Adjustments",
            "Accounts Receivable"
        ];
    if (type === "SUPPLIER_CREDIT")
        return [
            "Purchase Adjustments",
            "Accounts Payable"
        ];
    if (type === "SUPPLIER_DEBIT")
        return [
            "Accounts Payable",
            "Purchase Adjustments"
        ];
    if (type === "PAYMENT")
        return [
            "Accounts Payable",
            method === "CASH" ? "Cash" : "Bank"
        ];
    if (type === "EXPENSE_PURCHASE")
        return [
            "Business Expenses",
            "Cash"
        ];
    if (type === "JOURNAL")
        return [
            "",
            ""
        ];
    return [
        cash,
        "Accounts Receivable"
    ];
}
function emptyForm(type: string, branchId?: string): FinancialVoucherInput {
    const [debitAccount, creditAccount] = accountsFor(type, type === "DRAFT_RECEIPT" ? "BANK_TRANSFER" : "CASH");
    return {
        type,
        branchId,
        voucherDate: getPlatformDateInput(),
        reference: "",
        narration: "",
        debitAccount,
        creditAccount,
        amount: 0,
        method: type === "DRAFT_RECEIPT" ? "BANK_TRANSFER" : "CASH"
    };
}
const canEdit = (type: string) => hasCommercePermission(staffUser(), type.includes("NOTE") || type.startsWith("SUPPLIER_") ? "notes.manage" : type === "CASH_RECEIPT" || type === "DRAFT_RECEIPT" ? "receipts.manage" : "journal.manage");
type FinanceProps = {
    action: PharmacyMenuAction;
    token: string;
    superAdmin: boolean;
    branchId?: string;
    onClose: () => void;
    onSaved: () => void;
};
export function FinancialVoucherPanel(props: FinanceProps) { return <section className="min-w-0 rounded-xl border bg-white"><header className="border-b p-4"><h2 className="text-lg font-bold">{props.action.displayTitle || props.action.title}</h2></header><EntityListWorkspace title={props.action.title}><FinanceContent {...props}/></EntityListWorkspace></section>; }
function FinanceContent({ action, token, superAdmin, branchId: initialBranch, onSaved }: FinanceProps) {
    const pathname = usePathname();
    const router = useRouter();
    const site = useSiteConfig();
    const list = useEntityList();
    const mode = action.mode;
    const staff = staffUser();
    const can = (key: string) => hasCommercePermission(staff, key);
    const initialType = modeTypes[mode] || "JOURNAL";
    const [options, setOptions] = useState<FinancialOptions | null>(null);
    const [rows, setRows] = useState<FinancialVoucher[]>([]);
    const [autoRows, setAutoRows] = useState<AutoVoucher[]>([]);
    const [from, setFrom] = useState(() => `${getPlatformDateInput().slice(0, 8)}01`);
    const [to, setTo] = useState(getPlatformDateInput);
    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState(initialBranch || staff?.branchId || "");
    const [typeFilter, setTypeFilter] = useState(modeTypes[mode] || "");
    const [status, setStatus] = useState(mode === "post" ? "DRAFT" : mode === "unpost" ? "POSTED" : "");
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<FinancialVoucher | null>(null);
    const editorOpen = !!list?.form;
    const [form, setForm] = useState<FinancialVoucherInput>(() => emptyForm(initialType, initialBranch || staff?.branchId));
    const [selected, setSelected] = useState<FinancialVoucher | null>(null);
    const [operation, setOperation] = useState<"post" | "unpost" | "narration" | null>(null);
    const [reason, setReason] = useState("");
    const [narration, setNarration] = useState("");
    const [preview, setPreview] = useState<FinancialVoucher | null>(null);
    const [cheque, setCheque] = useState(false);
    const [ledger, setLedger] = useState<{
        name: string;
        data: FinancialDebtorLedger;
    } | null>(null);
    const debtorMode = mode.startsWith("debtor-");
    const reconciliation = mode === "supplier-reconciliation-book";
    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [lookups, documents, auto] = await Promise.all([
                getFinancialOptions(token, superAdmin, branchId || undefined, debtorMode || reconciliation ? from : undefined, debtorMode || reconciliation ? to : undefined),
                getFinancialVouchers(token, {
                    from,
                    to,
                    branchId: branchId || undefined,
                    type: typeFilter || undefined,
                    status: status || undefined,
                    search: search || undefined
                }, superAdmin),
                mode === "auto-vouchers" ? getFinancialAutoVouchers(token, from, to, superAdmin, branchId || undefined) : Promise.resolve([])
            ]);
            setOptions(lookups);
            setRows(documents);
            setAutoRows(auto);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Financial records could not be loaded.");
        }
        finally {
            setLoading(false);
        }
    }, [
        setError, setLoading, setOptions, setRows, setAutoRows,
        token,
        superAdmin,
        branchId,
        from,
        to,
        typeFilter,
        status,
        search,
        mode,
        debtorMode,
        reconciliation
    ]);
    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 200);
        return () => window.clearTimeout(timer);
    }, [
        load
    ]);
    useEffect(() => {
        const refresh = () => void load();
        window.addEventListener("anhh-form-saved", refresh);
        return () => window.removeEventListener("anhh-form-saved", refresh);
    }, [
        load
    ]);
    useEffect(() => { const id = pathname.match(/\/([^/]+)\/edit$/)?.[1]; if (id)
        getFinancialVoucher(token, id, superAdmin).then(row => { if (row.status !== "DRAFT" || !canEdit(row.type)) {
            setError("This document is locked or you cannot edit it.");
            return;
        } setEditing(row); setForm({ ...row, voucherDate: row.voucherDate.slice(0, 10) }); }).catch(e => setError(e instanceof Error ? e.message : "Document could not be loaded.")); }, [pathname, token, superAdmin]);
    function openEditor(row?: FinancialVoucher) {
        if (!row) {
            if (list)
                router.push(list.createHref());
            return;
        }
        if (routeEntityEdit(row.id))
            return;
        if (row && (row.status !== "DRAFT" || !canEdit(row.type)))
            return;
        setEditing(row || null);
        setForm(row ? {
            ...row,
            voucherDate: row.voucherDate.slice(0, 10)
        } : emptyForm(initialType, branchId || undefined));
        setError("");
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError("");
        try {
            const result = await saveFinancialVoucher(token, {
                ...form,
                amount: Number(form.amount),
                revision: editing?.revision
            }, editing?.id, superAdmin);
            setEditing(editing ? result : null);
            setForm({
                ...result,
                voucherDate: result.voucherDate.slice(0, 10)
            });
            toast.success("Draft saved. Post to Ledger applies the financial entry.");
            await load();
            onSaved();
            if (!editing)
                setForm(emptyForm(initialType, branchId || undefined));
            entitySaveComplete();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "The voucher could not be saved.");
        }
        finally {
            setBusy(false);
        }
    }
    function chooseInvoice(value: string, supplier: boolean) {
        const row = (supplier ? options?.supplierInvoices : options?.customerInvoices)?.find((x) => x.id === value);
        setForm((current) => ({
            ...current,
            invoiceId: supplier ? undefined : value || undefined,
            supplierInvoiceId: supplier ? value || undefined : undefined,
            branchId: row?.branchId || branchId || undefined,
            payee: row?.partyName || current.payee
        }));
    }
    async function print(row: FinancialVoucher, asCheque: boolean) {
        setBusy(true);
        setError("");
        try {
            const saved = await getFinancialPrint(token, row.id, superAdmin);
            setPreview(saved);
            setCheque(asCheque);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Print data could not be loaded.");
        }
        finally {
            setBusy(false);
        }
    }
    function beginOperation(row: FinancialVoucher, value: "post" | "unpost" | "narration") {
        setSelected(row);
        setOperation(value);
        setReason("");
        setNarration(row.narration);
    }
    async function confirmOperation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected || !operation || busy)
            return;
        setBusy(true);
        setError("");
        try {
            if (operation === "narration")
                await editFinancialNarration(token, selected, narration, reason, superAdmin);
            else
                await transitionFinancialVoucher(token, selected, operation, reason, superAdmin);
            toast.success(operation === "post" ? "Posted to ledger." : operation === "unpost" ? "Financial effects reversed. Voucher is now a draft." : "Narration saved.");
            setSelected(null);
            setOperation(null);
            await load();
            onSaved();
            if (editing?.id === selected.id) {
                setEditing(null);
                list?.open();
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "The financial operation failed.");
        }
        finally {
            setBusy(false);
        }
    }
    const filters = <div className="flex flex-wrap items-end gap-3 border-b p-4"><label className="text-xs">{"From"}<Input aria-label="Financial from date" type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="text-xs">{"To"}<Input aria-label="Financial to date" type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label><label className="min-w-40 text-xs">{"Branch"}<Select aria-label="Financial branch" value={branchId} disabled={!!staff?.branchId && staff.role !== "SUPERADMIN"} onChange={(e) => setBranchId(e.target.value)}><option value="">{"Head office / all branches"}</option>{options?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label><label className="text-xs">{"Type"}<Select aria-label="Financial type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">{"All types"}</option>{Object.entries(types).map(([key, label], rowIndex) => <option value={key} key={rowIndex}>{label}</option>)}</Select></label><label className="text-xs">{"Status"}<Select aria-label="Financial status filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{"All"}</option><option>{"DRAFT"}</option><option>{"POSTED"}</option></Select></label><label className="flex-1 text-xs">{"Search"}<Input aria-label="Search financial documents" placeholder="Number, reference, narration or payee" value={search} onChange={(e) => setSearch(e.target.value)}/></label><Button variant="outline" disabled={loading || busy} onClick={() => void load()}><RefreshCw size={15}/>{"Refresh"}</Button></div>;
    const displayed = rows.filter((row) => mode !== "cheque-print" || row.method === "CHEQUE").filter((row) => mode !== "collection-register" || [
        "CASH_RECEIPT",
        "DRAFT_RECEIPT",
        "CREDIT_NOTE",
        "DEBIT_NOTE"
    ].includes(row.type));
    const register = <div>{filters}<div className="p-4"><p className="mb-3 text-xs text-slate-600">{displayed.length}{" documents \xb7 Posted total "}{money(displayed.filter((x) => x.status === "POSTED").reduce((sum, x) => sum + x.amount, 0))}{" \xb7 Most recent 1000 matching documents"}</p>{loading ? <p role="status">{"Loading saved documents…"}</p> : !displayed.length ? <p>{"No matching financial documents."}</p> : <div className="overflow-x-auto"><RecordTable className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">{"Date / number"}</th><th>{"Type / party"}</th><th>{"Reference / narration"}</th><th>{"Amount"}</th><th>{"Status"}</th><th>{"Actions"}</th></tr></thead><tbody>{displayed.map((row) => <tr key={row.id} className="border-b align-top"><td className="p-2">{formatPlatformDate(row.voucherDate, site.dateFormat)}<br /><span className="break-all">{row.number}</span></td><td>{types[row.type]}<br />{row.partyName || row.payee}<br />{row.invoiceNumber}</td><td className="max-w-48 break-words">{row.reference}<br />{row.narration}</td><td className="whitespace-nowrap">{money(row.amount)}</td><td>{row.status}</td><td><div className="flex flex-wrap gap-1">{row.status === "DRAFT" && canEdit(row.type) && <Button size="sm" variant="outline" onClick={() => openEditor(row)}>{"Edit"}</Button>}{row.status === "DRAFT" && can("vouchers.post") && <Button size="sm" onClick={() => beginOperation(row, "post")}>{"Post to Ledger"}</Button>}{row.status === "POSTED" && can("vouchers.unpost") && <Button size="sm" variant="outline" onClick={() => beginOperation(row, "unpost")}>{"Unpost to Edit"}</Button>}{can("vouchers.narration") && <Button size="sm" variant="outline" onClick={() => beginOperation(row, "narration")}>{"Narration"}</Button>}{can("vouchers.print") && <Button size="sm" variant="outline" disabled={busy} onClick={() => void print(row, mode === "cheque-print")}>{"Print"}</Button>}</div></td></tr>)}</tbody></RecordTable></div>}</div></div>;
    const supplierInvoice = form.type === "PAYMENT" || form.type.startsWith("SUPPLIER_");
    const customerInvoice = [
        "CASH_RECEIPT",
        "DRAFT_RECEIPT",
        "CREDIT_NOTE",
        "DEBIT_NOTE",
        "RECEIPT"
    ].includes(form.type);
    const invoiceOptions = (supplierInvoice ? options?.supplierInvoices : options?.customerInvoices) ?? [];
    const linked = invoiceOptions.find((x) => x.id === (form.invoiceId || form.supplierInvoiceId));
    const filteredInvoices = ((reconciliation ? options?.supplierInvoices : options?.customerInvoices) ?? []).filter((x) => (!reconciliation || x.balance > 0) && `${x.partyName} ${x.invoiceNumber}`.toLowerCase().includes(search.toLowerCase()));
    return <div className="min-w-0">{error && <p role="alert" className="m-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{debtorMode || reconciliation ? <>{filters}<InvoiceRegister rows={filteredInvoices} debtorLedger={mode === "debtor-ledger"} onLedger={async (id: string, name: string) => {
                try {
                    const data = await getFinancialDebtorLedger(token, id, {
                        branchId: branchId || undefined,
                        from,
                        to
                    }, superAdmin);
                    setLedger({
                        name,
                        data
                    });
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : "The customer ledger could not be loaded.");
                }
            }}/></> : mode === "auto-vouchers" ? <>{filters}<div className="overflow-x-auto p-4"><p className="mb-3 text-xs">{"Automatically generated invoice, payment and expense entries, plus existing journal records."}</p>{autoRows.length ? <RecordTable className="w-full text-left text-xs"><thead><tr><th>{"Date"}</th><th>{"Reference / narration"}</th><th>{"Debit"}</th><th>{"Credit"}</th><th>{"Amount"}</th><th>{"Status"}</th></tr></thead><tbody>{autoRows.map((row, index) => <tr className="border-t" key={index}><td className="py-2">{formatPlatformDate(row.entryDate, site.dateFormat)}</td><td>{row.reference}<br />{row.description}</td><td>{row.debitAccount}</td><td>{row.creditAccount}</td><td>{money(row.amount)}</td><td>{row.status}</td></tr>)}</tbody></RecordTable> : <p>{"No automatic journal entries in this date range."}</p>}</div></> : <>{editorOpen ? <EntityFormPanel><form onSubmit={submit} className="space-y-4 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{editing ? `Edit ${editing.number}` : `New ${types[form.type]}`}{" \xb7 DRAFT"}</p><Button type="button" variant="outline" onClick={() => openEditor()}>{"New document"}</Button></div><p className="text-xs text-slate-600">{"Save keeps a draft. Post to Ledger applies the entry once. Credit and debit notes adjust invoice balances without changing stock."}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Voucher type"><Select aria-label="Voucher type" value={form.type} onChange={(e) => {
                    const next = emptyForm(e.target.value, form.branchId);
                    setForm((current) => ({
                        ...current,
                        ...next,
                        reference: current.reference,
                        narration: current.narration
                    }));
                }}>{Object.entries(types).filter(([key]) => canEdit(key)).map(([key, label], rowIndex) => <option value={key} key={rowIndex}>{label}</option>)}</Select></Field><Field label="Voucher date"><Input aria-label="Voucher date" required={true} type="date" value={form.voucherDate} onChange={(e) => setForm((current) => ({
                    ...current,
                    voucherDate: e.target.value
                }))}/></Field><Field label="Voucher branch"><Select aria-label="Voucher branch" value={form.branchId || ""} disabled={!!staff?.branchId && staff.role !== "SUPERADMIN"} onChange={(e) => setForm((current) => ({
                    ...current,
                    branchId: e.target.value || undefined,
                    invoiceId: undefined,
                    supplierInvoiceId: undefined
                }))}><option value="">{"Head office"}</option>{options?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field><Field label="Reference"><Input aria-label="Voucher reference" required={true} maxLength={160} value={form.reference} onChange={(e) => setForm((current) => ({
                    ...current,
                    reference: e.target.value
                }))}/></Field><Field label="Amount (NPR)"><Input aria-label="Voucher amount" required={true} type="number" min="0.01" max="100000000" step="0.01" value={form.amount || ""} onChange={(e) => setForm((current) => ({
                    ...current,
                    amount: Number(e.target.value)
                }))}/></Field><Field label="Payment method"><Select aria-label="Voucher payment method" disabled={form.type === "CASH_RECEIPT"} value={form.method} onChange={(e) => {
                    const [debitAccount, creditAccount] = accountsFor(form.type, e.target.value);
                    setForm((current) => ({
                        ...current,
                        method: e.target.value,
                        debitAccount,
                        creditAccount
                    }));
                }}><option value="CASH" disabled={form.type === "DRAFT_RECEIPT"}>{"Cash"}</option><option value="BANK_TRANSFER">{"Bank transfer / draft"}</option><option value="CHEQUE">{"Cheque"}</option></Select></Field>{(supplierInvoice || customerInvoice) && <div className="sm:col-span-2"><Field label={supplierInvoice ? "Supplier invoice" : "Customer invoice"}><Select aria-label="Voucher invoice" required={form.type !== "PAYMENT" && form.type !== "RECEIPT"} value={form.invoiceId || form.supplierInvoiceId || ""} onChange={(e) => chooseInvoice(e.target.value, supplierInvoice)}><option value="">{form.type === "PAYMENT" || form.type === "RECEIPT" ? "General ledger entry (no invoice)" : "Select invoice"}</option>{invoiceOptions.filter((x) => (x.branchId || "") === (form.branchId || "")).map((x) => <option key={x.id} value={x.id}>{x.partyName}{" \xb7 "}{x.invoiceNumber}{" \xb7 "}{money(x.balance)}{" due"}</option>)}</Select></Field>{linked && <p className="mt-1 text-xs">{"Current invoice balance: "}{money(linked.balance)}</p>}</div>}<Field label="Debit account"><Input aria-label="Debit account" required={true} maxLength={120} list="financial-accounts" value={form.debitAccount} onChange={(e) => setForm((current) => ({
                    ...current,
                    debitAccount: e.target.value
                }))}/></Field><Field label="Credit account"><Input aria-label="Credit account" required={true} maxLength={120} list="financial-accounts" value={form.creditAccount} onChange={(e) => setForm((current) => ({
                    ...current,
                    creditAccount: e.target.value
                }))}/></Field><Field label="Payee / party"><Input aria-label="Voucher payee" required={form.method === "CHEQUE"} maxLength={160} value={form.payee || ""} onChange={(e) => setForm((current) => ({
                    ...current,
                    payee: e.target.value
                }))}/></Field>{form.method === "CHEQUE" && <><Field label="Cheque number"><Input aria-label="Cheque number" required={true} maxLength={80} value={form.chequeNumber || ""} onChange={(e) => setForm((current) => ({
                        ...current,
                        chequeNumber: e.target.value
                    }))}/></Field><Field label="Bank name"><Input aria-label="Bank name" required={true} maxLength={160} value={form.bankName || ""} onChange={(e) => setForm((current) => ({
                        ...current,
                        bankName: e.target.value
                    }))}/></Field></>}<div className="sm:col-span-2 lg:col-span-3"><Field label="Narration"><Textarea aria-label="Voucher narration" required={true} maxLength={1000} value={form.narration} onChange={(e) => setForm((current) => ({
                    ...current,
                    narration: e.target.value
                }))}/></Field></div></div><datalist id="financial-accounts">{[
                    ...new Set([
                        "Cash",
                        "Bank",
                        "Cheques in Hand",
                        "Accounts Receivable",
                        "Accounts Payable",
                        "Sales Adjustments",
                        "Purchase Adjustments",
                        "Business Expenses",
                        "Other Income",
                        ...options?.accounts.map((x) => x.name) ?? []
                    ])
                ].map((name) => <option key={name} value={name}/>)}</datalist><FormSaveActions mode={editing ? "edit" : "create"} busy={busy} onCancel={() => { }}/></form></EntityFormPanel> : <div className="flex justify-end p-3">{canEdit(initialType) && !mode.endsWith("print") && <Button onClick={() => openEditor()}>{"New document"}</Button>}</div>}<EntityListPanel canAdd={canEdit(initialType) && !mode.endsWith("print")}>{register}</EntityListPanel></>}<Dialog open={!!operation} onOpenChange={(open) => {
            if (!open && !busy)
                setOperation(null);
        }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{operation === "post" ? "Post to Ledger" : operation === "unpost" ? "Unpost to Edit" : "Edit Narration"}</DialogTitle><DialogDescription>{selected?.number}{" \xb7 "}{money(selected?.amount || 0)}</DialogDescription></DialogHeader><form onSubmit={confirmOperation} className="space-y-3">{operation === "post" ? <p className="text-sm">{"Post the saved draft and apply its ledger and invoice effects?"}</p> : <><p className="text-xs">{"This action is audited. Unposting reverses the original entry before edits are allowed."}</p>{operation === "narration" && <Field label="New narration"><Textarea aria-label="New narration" required={true} maxLength={1000} value={narration} onChange={(e) => setNarration(e.target.value)}/></Field>}<Field label="Audit reason"><Textarea aria-label="Financial audit reason" required={true} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}/></Field></>}{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button disabled={busy} type="submit">{busy ? "Saving…" : "Confirm"}</Button></form></DialogContent></Dialog><Dialog open={!!ledger} onOpenChange={(open) => {
            if (!open)
                setLedger(null);
        }}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{ledger?.name}{" — Debtor Ledger"}</DialogTitle><DialogDescription>{"Opening balance "}{money(ledger?.data.opening || 0)}{" \xb7 "}{from}{" to "}{to}</DialogDescription></DialogHeader><div className="overflow-x-auto"><RecordTable className="w-full text-left text-xs"><thead><tr><th>{"Date"}</th><th>{"Reference / description"}</th><th>{"Debit"}</th><th>{"Credit"}</th><th>{"Running balance"}</th></tr></thead><tbody>{ledger?.data.entries.map((row, index) => <tr className="border-t" key={index}><td className="py-2">{formatPlatformDate(row.entryDate, site.dateFormat)}</td><td>{row.reference}<br />{row.description}</td><td>{row.entryType === "DEBIT" ? money(row.amount) : "—"}</td><td>{row.entryType === "CREDIT" ? money(row.amount) : "—"}</td><td>{money(ledger.data.opening + ledger.data.entries.slice(0, index + 1).reduce((sum, item) => sum + (item.entryType === "DEBIT" ? item.amount : -item.amount), 0))}</td></tr>)}</tbody></RecordTable>{ledger && !ledger.data.entries.length && <p>{"No entries in this date range."}</p>}</div></DialogContent></Dialog><Dialog open={!!preview} onOpenChange={(open) => {
            if (!open)
                setPreview(null);
        }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{cheque ? "Cheque print" : "Document print"}</DialogTitle><DialogDescription>{"Preview of the saved document"}</DialogDescription></DialogHeader>{preview && <div id="financial-print" className="space-y-4 border border-slate-300 bg-white p-6 text-slate-950"><p className="text-center text-lg font-bold">{site.settings["website.name"] || "All Nepal Healthy Home"}</p><h2 className="text-center font-bold">{cheque ? "CHEQUE PAYMENT" : types[preview.type]?.toUpperCase()}{" "}{preview.status === "DRAFT" && "— DRAFT / NOT POSTED"}</h2><dl className="grid grid-cols-2 gap-2 text-sm"><dt>{"Date"}</dt><dd>{formatPlatformDate(preview.voucherDate, site.dateFormat)}</dd><dt>{"Document no."}</dt><dd className="break-all">{preview.number}</dd><dt>{"Reference"}</dt><dd>{preview.reference}</dd><dt>{"Party / payee"}</dt><dd>{preview.partyName || preview.payee || "—"}</dd><dt>{"Invoice"}</dt><dd>{preview.invoiceNumber || "—"}</dd>{cheque && <><dt>{"Bank"}</dt><dd>{preview.bankName}</dd><dt>{"Cheque no."}</dt><dd>{preview.chequeNumber}</dd></>}<dt>{"Debit"}</dt><dd>{preview.debitAccount}</dd><dt>{"Credit"}</dt><dd>{preview.creditAccount}</dd><dt>{"Amount"}</dt><dd className="font-bold">{money(preview.amount)}</dd><dt>{"Method"}</dt><dd>{preview.method}</dd></dl><p className="whitespace-pre-wrap text-sm">{preview.narration}</p><div className="flex justify-between pt-12 text-xs"><span>{"Prepared by"}</span><span>{"Approved by"}</span><span>{"Received by"}</span></div></div>}<Button onClick={() => {
            const style = document.createElement("style");
            style.textContent = "@media print { body * { visibility: hidden !important; } #financial-print, #financial-print * { visibility: visible !important; } #financial-print { position: fixed; inset: 0; width: 100%; height: fit-content; border: none; } }";
            document.head.append(style);
            window.addEventListener("afterprint", () => style.remove(), {
                once: true
            });
            window.print();
        }}><Printer size={16}/>{"Print / Save PDF"}</Button></DialogContent></Dialog></div>;
}
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return <label className="grid gap-1 text-xs font-semibold text-slate-700">{label}{children}</label>;
}
function InvoiceRegister({ rows, debtorLedger, onLedger }: {
    rows: FinancialInvoiceOption[];
    debtorLedger: boolean;
    onLedger: (id: string, name: string) => void;
}) {
    const groups = new Map<string, {
        name: string;
        total: number;
        paid: number;
        balance: number;
        count: number;
    }>();
    rows.forEach((row) => {
        const group = groups.get(row.partyId) || {
            name: row.partyName,
            total: 0,
            paid: 0,
            balance: 0,
            count: 0
        };
        group.total += row.total;
        group.paid += row.paidAmount;
        group.balance += row.balance;
        group.count++;
        groups.set(row.partyId, group);
    });
    return <div className="overflow-x-auto p-4"><p className="mb-3 text-xs">{"Invoice totals "}{money(rows.reduce((sum, x) => sum + x.total, 0))}{" \xb7 Paid "}{money(rows.reduce((sum, x) => sum + x.paidAmount, 0))}{" \xb7 Outstanding "}{money(rows.reduce((sum, x) => sum + x.balance, 0))}{" \xb7 Most recent 2000 invoices"}</p>{!rows.length ? <p>{"No matching invoices."}</p> : <RecordTable className="w-full text-left text-xs"><thead><tr><th>{"Party"}</th><th>{debtorLedger ? "Invoices" : "Invoice"}</th><th>{"Total"}</th><th>{"Paid"}</th><th>{"Outstanding"}</th>{debtorLedger && <th>{"Ledger"}</th>}</tr></thead><tbody>{debtorLedger ? [
                ...groups.entries()
            ].map(([id, row], rowIndex) => <tr className="border-t" key={rowIndex}><td className="py-2">{row.name}</td><td>{row.count}</td><td>{money(row.total)}</td><td>{money(row.paid)}</td><td>{money(row.balance)}</td><td><Button size="sm" variant="outline" onClick={() => onLedger(id, row.name)}>{"View ledger"}</Button></td></tr>) : rows.map((row) => <tr key={row.id} className="border-t"><td className="py-2">{row.partyName}</td><td>{row.invoiceNumber}</td><td>{money(row.total)}</td><td>{money(row.paidAmount)}</td><td>{money(row.balance)}</td></tr>)}</tbody></RecordTable>}</div>;
}
