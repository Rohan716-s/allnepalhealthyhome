"use client";

/* eslint-disable react-hooks/set-state-in-effect -- load the signed-in employee's leave records after client authentication is available. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, ClipboardList, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { staffToken, staffUser } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createLeaveRequest, getLeaveRequests, type LeaveRequest } from "@/services/api";
import { formatPlatformDate } from "@/lib/date-time";
import { useSiteConfig } from "@/components/site-config-provider";

const emptyForm = { leaveType: "SICK", startDate: "", endDate: "", reason: "" };

function readableStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export default function LeavePage() {
  const router = useRouter();
  const { dateFormat } = useSiteConfig();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const token = staffToken();
    if (!token) {
      router.replace(`/staff/login?returnTo=${encodeURIComponent("/leave")}`);
      return;
    }
    setError("");
    try {
      setRows(await getLeaveRequests(token));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Leave requests could not be loaded.";
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        toast.error(message);
        router.replace(`/staff/login?returnTo=${encodeURIComponent("/leave")}`);
        return;
      }
      setError(message);
    } finally {
      setReady(true);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.endDate < form.startDate) {
      toast.error("The end date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      await createLeaveRequest(staffToken(), form);
      setForm(emptyForm);
      toast.success("Leave request saved and sent for approval.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Leave request could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">Loading leave module…</main>;
  const user = staffUser();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-700">HRMS · Staff workspace</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">My leave</h1>
            <p className="mt-2 text-sm text-slate-600">Apply for leave and check the status of your own requests.</p>
          </div>
          {user && <AccountProfileMenu kind="staff" name={user.fullName} email={user.email} accountTypeLabel={user.role} links={[{ label: "My Attendance", href: "/attendance" }, { label: "My Orders", href: user.role === "DELIVERY" ? "/delivery/orders" : "/pharmacist/orders" }, { label: "Wishlist", href: "/wishlist" }]} />}
        </header>

        <nav aria-label="HRMS modules" className="mt-6 flex flex-wrap gap-3">
          <Link href="/attendance" className="inline-flex items-center gap-2 rounded-xl border border-[#003893]/25 bg-white px-4 py-2.5 text-sm font-bold text-[#003893] hover:bg-blue-50"><CalendarDays size={17} />Attendance module</Link>
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white"><CalendarPlus size={17} />Leave module</span>
        </nav>

        {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><span>{error}</span><Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></div>}

        <div className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarPlus size={19} className="text-amber-700" />Apply for leave</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={submit}>
                <label className="grid gap-2 text-sm font-semibold">Leave type
                  <Select value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })}>
                    <option value="ANNUAL">Annual leave</option><option value="SICK">Sick leave</option><option value="CASUAL">Casual leave</option><option value="UNPAID">Unpaid leave</option><option value="OTHER">Other</option>
                  </Select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-semibold">Start date<Input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                  <label className="grid gap-2 text-sm font-semibold">End date<Input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
                </div>
                <label className="grid gap-2 text-sm font-semibold">Reason
                  <Textarea required minLength={3} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Explain your request" />
                </label>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Send size={16} />Save leave request</>}</Button>
              </form>
              <p className="mt-4 text-xs leading-5 text-slate-500">Your request is saved to the HRMS database and is visible to you and authorized administrators.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList size={19} className="text-[#003893]" />My leave list</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Admin comment</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.leaveType.replaceAll("_", " ")}</td><td className="px-4 py-4 text-xs">{formatPlatformDate(row.startDate, dateFormat)} – {formatPlatformDate(row.endDate, dateFormat)}</td><td className="max-w-sm px-4 py-4 text-slate-600">{row.reason}</td><td className="px-4 py-4"><Badge variant={row.status === "APPROVED" ? "secondary" : row.status === "REJECTED" ? "destructive" : "outline"}>{readableStatus(row.status)}</Badge></td><td className="px-4 py-4 text-slate-600">{row.approvalComment || "—"}</td></tr>)}
                    {!rows.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">You have no leave requests yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
