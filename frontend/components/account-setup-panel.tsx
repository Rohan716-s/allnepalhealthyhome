"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, Plus, RefreshCw, Save, Tags, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPlatformDate } from "@/lib/date-time";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";
import {
  assignPartySector,
  createAccountOpeningBalance,
  getAccountOpeningBalances,
  getAccountSetupParties,
  getChartAccounts,
  getPartySectors,
  saveChartAccount,
  savePartySector,
  type AccountOpeningBalanceRecord,
  type AccountSetupParty,
  type ChartAccountRecord,
  type PartySectorRecord,
} from "@/services/api";
import type { AdminBranch } from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";
import { PharmacyCommercialSetupPanel } from "@/components/pharmacy-commercial-setup-panel";
import { ProductRackSetupPanel } from "@/components/product-rack-setup-panel";

const money = (amount: number) => `NPR ${amount.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export function AccountSetupPanel({ action, token, superAdmin, branches, onClose }: {
  action: PharmacyMenuAction;
  token: string;
  superAdmin: boolean;
  branches: AdminBranch[];
  onClose: () => void;
}) {
  if (action.mode === "party-sectors") return <PartySectorSetup token={token} superAdmin={superAdmin} onClose={onClose} />;
  if (action.mode === "account-opening") return <AccountOpeningSetup token={token} superAdmin={superAdmin} branches={branches} onClose={onClose} />;
  if (action.mode === "rack-groups" || action.mode === "racks") return <ProductRackSetupPanel action={action} token={token} superAdmin={superAdmin} onClose={onClose} />;
  return <PharmacyCommercialSetupPanel key={action.mode} action={action} token={token} superAdmin={superAdmin} branches={branches} onClose={onClose} />;
}

function PartySectorSetup({ token, superAdmin, onClose }: { token: string; superAdmin: boolean; onClose: () => void }) {
  const [sectors, setSectors] = useState<PartySectorRecord[]>([]);
  const [parties, setParties] = useState<AccountSetupParty[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PartySectorRecord | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sectorRows, partyRows] = await Promise.all([getPartySectors(token, superAdmin), getAccountSetupParties(token, search || undefined, superAdmin)]);
      setSectors(sectorRows); setParties(partyRows);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Party-sector records could not be loaded."); }
    finally { setLoading(false); }
  }, [search, superAdmin, token]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  function resetForm() { setEditing(null); setName(""); setCode(""); setDescription(""); setIsActive(true); }
  function beginEdit(row: PartySectorRecord) { setEditing(row); setName(row.name); setCode(row.code ?? ""); setDescription(row.description ?? ""); setIsActive(row.isActive); }
  async function submitSector(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Enter a sector name.");
    setSaving(true);
    try {
      await savePartySector(token, { id: editing?.id, name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined, isActive }, superAdmin);
      toast.success(editing ? "Party sector updated." : "Party sector created."); resetForm(); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The sector could not be saved."); }
    finally { setSaving(false); }
  }
  async function changePartySector(customerId: string, sectorId: string) {
    try { await assignPartySector(token, customerId, sectorId || null, superAdmin); toast.success("Party sector assignment saved."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The party assignment could not be saved."); }
  }

  return <div className="space-y-5">
    <PanelHeading title="Party-Sector" description="Maintain real party classifications and assign them to customer accounts." icon={Tags} onRefresh={() => void load()} loading={loading} onClose={onClose} />
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.6fr)]">
      <Card><CardHeader><CardTitle>{editing ? "Edit party sector" : "Create party sector"}</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={(event) => void submitSector(event)}>
          <Field label="Sector name"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Retail pharmacy, hospital, clinic…" required /></Field>
          <Field label="Code"><Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} placeholder="Optional code" /></Field>
          <Field label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Optional notes about this party type" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active for new assignments</label>
          <div className="flex gap-2"><Button type="submit" disabled={saving}><Save size={15} />{saving ? "Saving…" : editing ? "Save changes" : "Create sector"}</Button>{editing && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
        </form>
        <div className="mt-5 space-y-2 border-t pt-4">{sectors.map((row) => <button key={row.id} type="button" onClick={() => beginEdit(row)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-[#003893]/40 ${editing?.id === row.id ? "border-[#003893] bg-blue-50" : ""}`}><span className="min-w-0 flex-1"><span className="block truncate font-bold">{row.name}</span><span className="text-xs text-slate-500">{row.code || "No code"} · {row.customerCount} parties</span></span><Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge></button>)}{!sectors.length && <p className="py-4 text-sm text-slate-500">No party sectors created yet.</p>}</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-3">Party classification <span className="ml-auto text-sm font-normal text-slate-500">{parties.length} records</span></CardTitle></CardHeader><CardContent>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search party name, email or phone" className="mb-3" />
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Party</th><th className="p-3">Account</th><th className="p-3">Sector</th></tr></thead><tbody>{parties.map((party) => <tr key={party.id} className="border-b last:border-0"><td className="p-3"><span className="block font-bold">{party.name}</span><span className="text-xs text-slate-500">{party.email} · {party.phone}</span></td><td className="p-3">{party.accountType}</td><td className="p-3"><Select aria-label={`Sector for ${party.name}`} value={party.partySectorId ?? ""} onChange={(event) => void changePartySector(party.id, event.target.value)}><option value="">Unassigned</option>{sectors.map((sector) => <option key={sector.id} value={sector.id} disabled={!sector.isActive && sector.id !== party.partySectorId}>{sector.name}{sector.isActive ? "" : " (inactive)"}</option>)}</Select></td></tr>)}{!parties.length && <tr><td colSpan={3} className="p-8 text-center text-slate-500">No parties match this search.</td></tr>}</tbody></table></div>
      </CardContent></Card>
    </div>
  </div>;
}

function AccountOpeningSetup({ token, superAdmin, branches, onClose }: { token: string; superAdmin: boolean; branches: AdminBranch[]; onClose: () => void }) {
  const [accounts, setAccounts] = useState<ChartAccountRecord[]>([]);
  const [rows, setRows] = useState<AccountOpeningBalanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ChartAccountRecord | null>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [type, setType] = useState("ASSET"); const [parentId, setParentId] = useState(""); const [isSubLedger, setIsSubLedger] = useState(false); const [accountActive, setAccountActive] = useState(true);
  const [accountId, setAccountId] = useState(""); const [branchId, setBranchId] = useState(""); const [openingDate, setOpeningDate] = useState(getPlatformDateInput()); const [debit, setDebit] = useState(""); const [credit, setCredit] = useState(""); const [reference, setReference] = useState(""); const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const [accountRows, openingRows] = await Promise.all([getChartAccounts(token, true, superAdmin), getAccountOpeningBalances(token, undefined, superAdmin)]); setAccounts(accountRows); setRows(openingRows); setAccountId((current) => current || accountRows[0]?.id || ""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Account records could not be loaded."); }
    finally { setLoading(false); }
  }, [superAdmin, token]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  function clearAccountForm() { setEditing(null); setCode(""); setName(""); setType("ASSET"); setParentId(""); setIsSubLedger(false); setAccountActive(true); }
  function editAccount(row: ChartAccountRecord) { setEditing(row); setCode(row.code); setName(row.name); setType(row.accountType); setParentId(row.parentAccountId ?? ""); setIsSubLedger(row.isSubLedger); setAccountActive(row.isActive); }
  async function submitAccount(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await saveChartAccount(token, { id: editing?.id, code: code.trim(), name: name.trim(), accountType: type, parentAccountId: parentId || undefined, isSubLedger, isActive: accountActive }, superAdmin); toast.success(editing ? "Account updated." : "Account created."); clearAccountForm(); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The chart account could not be saved."); }
    finally { setSaving(false); }
  }
  async function submitOpening(event: React.FormEvent) {
    event.preventDefault();
    const debitAmount = Number(debit || 0); const creditAmount = Number(credit || 0);
    if (!accountId || !reference.trim() || (debitAmount > 0) === (creditAmount > 0)) return toast.error("Select an account, add a reference, and enter exactly one debit or credit amount.");
    setSaving(true);
    try { await createAccountOpeningBalance(token, { accountId, branchId: branchId || undefined, openingDate, debitAmount, creditAmount, reference: reference.trim(), notes: notes.trim() || undefined }, superAdmin); toast.success("Opening balance posted to the account ledger."); setDebit(""); setCredit(""); setReference(""); setNotes(""); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The opening balance could not be posted."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <PanelHeading title="A/C Opening" description="Manage the chart of accounts and post dated opening balances." icon={BookOpenCheck} onRefresh={() => void load()} loading={loading} onClose={onClose} />
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
      <Card><CardHeader><CardTitle>{editing ? "Edit ledger account" : "Add ledger account"}</CardTitle></CardHeader><CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submitAccount(event)}>
          <Field label="Account code"><Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} required /></Field><Field label="Account name"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required /></Field>
          <Field label="Account type"><Select value={type} onChange={(event) => setType(event.target.value)}>{accountTypes.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Parent account"><Select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">No parent (top level)</option>{accounts.filter((item) => item.id !== editing?.id && item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isSubLedger} onChange={(event) => setIsSubLedger(event.target.checked)} />Sub-ledger account</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={accountActive} onChange={(event) => setAccountActive(event.target.checked)} />Active</label>
          <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}><Save size={15} />{saving ? "Saving…" : editing ? "Save account" : "Add account"}</Button>{editing && <Button type="button" variant="outline" onClick={clearAccountForm}>Cancel</Button>}</div>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Post account opening balance</CardTitle></CardHeader><CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submitOpening(event)}>
          <Field label="Account"><Select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="">Choose account</option>{accounts.filter((x) => x.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></Field>
          <Field label="Branch"><Select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Opening date"><Input type="date" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} required /></Field><Field label="Reference"><Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} placeholder="Opening balance reference" required /></Field>
          <Field label="Debit (NPR)"><Input type="number" min="0" step="0.01" value={debit} onChange={(event) => { setDebit(event.target.value); if (event.target.value) setCredit(""); }} placeholder="0.00" /></Field><Field label="Credit (NPR)"><Input type="number" min="0" step="0.01" value={credit} onChange={(event) => { setCredit(event.target.value); if (event.target.value) setDebit(""); }} placeholder="0.00" /></Field>
          <Field label="Notes"><Input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Optional" /></Field><div className="flex items-end"><Button type="submit" disabled={saving || !accounts.length}><Plus size={15} />Post opening balance</Button></div>
        </form>
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-3">Chart of accounts <Badge variant="secondary">{accounts.length}</Badge></CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Code</th><th className="p-3">Account</th><th className="p-3">Type</th><th className="p-3">Parent</th><th className="p-3 text-right">Opening debit</th><th className="p-3 text-right">Opening credit</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody>{accounts.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3 font-mono font-bold">{item.code}</td><td className="p-3 font-semibold">{item.name}{item.isSubLedger && <span className="ml-2 text-xs text-slate-500">Sub-ledger</span>}</td><td className="p-3">{item.accountType}</td><td className="p-3">{item.parentName || "—"}</td><td className="p-3 text-right">{money(item.openingDebit)}</td><td className="p-3 text-right">{money(item.openingCredit)}</td><td className="p-3"><Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => editAccount(item)}>Edit</Button></td></tr>)}{!accounts.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No ledger accounts have been set up yet.</td></tr>}</tbody></table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Opening balance register</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Date</th><th className="p-3">Account</th><th className="p-3">Branch</th><th className="p-3">Reference</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3">{formatPlatformDate(item.openingDate)}</td><td className="p-3">{item.accountCode} · {item.accountName}</td><td className="p-3">{item.branchName}</td><td className="p-3">{item.reference}{item.notes && <span className="block text-xs text-slate-500">{item.notes}</span>}</td><td className="p-3 text-right">{item.debitAmount ? money(item.debitAmount) : "—"}</td><td className="p-3 text-right">{item.creditAmount ? money(item.creditAmount) : "—"}</td></tr>)}{!rows.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No opening balances posted yet.</td></tr>}</tbody></table></div></CardContent></Card>
  </div>;
}

function PanelHeading({ title, description, icon: Icon, onRefresh, loading, onClose }: { title: string; description: string; icon: typeof Tags; onRefresh: () => void; loading: boolean; onClose: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#003893]"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-lg font-extrabold">{title}</span><span className="block text-sm text-slate-500">{description}</span></span><Button variant="outline" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close account setup"><X size={17} /></Button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1 text-xs font-bold text-slate-500">{label}{children}</label>; }
