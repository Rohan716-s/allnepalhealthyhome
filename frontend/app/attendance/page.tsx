"use client";
import { OfflineStatus } from "@/components/offline-status";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate this protected workspace from the browser session. */

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  checkIn,
  checkOut,
  getAttendanceDashboard,
  getAttendanceHistory,
  getAttendanceToday,
  type AttendanceDashboard,
  type AttendanceRecord,
  type AttendanceLocationInput,
} from "@/services/api";
import { staffToken, staffUser } from "@/components/staff-shell";
import { useSiteConfig } from "@/components/site-config-provider";
import { formatKathmanduTime } from "@/lib/hrms-date-time";
import { formatPlatformDate } from "@/lib/date-time";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { BackButton } from "@/components/back-button";

function time(value?: string) {
  return formatKathmanduTime(value);
}
function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
function statusLabel(status?: string) {
  return (status ?? "NOT_STARTED")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
function attendanceHome(role?: string) {
  switch (role?.toUpperCase()) {
    case "DELIVERY":
      return "/delivery";
    case "SALES_EXECUTIVE":
      return "/sales-executive";
    case "ACCOUNTANT":
      return "/accounts";
    case "SUPERVISOR":
      return "/supervisor";
    case "ADMIN":
      return "/admin";
    case "SUPERADMIN":
      return "/superadmin";
    default:
      return "/pharmacist";
  }
}

export default function AttendancePage() {
  const router = useRouter();
  const { dateFormat } = useSiteConfig();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadError, setLoadError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");

  const load = useCallback(async () => {
    const token = staffToken();
    if (!token) {
      router.replace(
        `/staff/login?returnTo=${encodeURIComponent("/attendance")}`,
      );
      return;
    }
    setLoadError("");
    try {
      const [current, summary, records] = await Promise.all([
        getAttendanceToday(token),
        getAttendanceDashboard(token),
        getAttendanceHistory(token),
      ]);
      setToday(current);
      setDashboard(summary);
      setHistory(records);
      setReady(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Attendance could not be loaded.";
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        toast.error(message);
        router.replace(
          `/staff/login?returnTo=${encodeURIComponent("/attendance")}`,
        );
        return;
      }
      setLoadError(message);
      setReady(true);
      toast.error(message);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);

  async function mark(action: "in" | "out") {
    setBusy(action);
    setLocationMessage("");
    try {
      const location = await getBrowserLocation();
      const token = staffToken();
      if (!token) {
        router.replace(
          `/staff/login?returnTo=${encodeURIComponent("/attendance")}`,
        );
        return;
      }
      const result =
        action === "in"
          ? await checkIn(token, location)
          : await checkOut(token, location);
      setToday(result);
      toast.success(
        action === "in"
          ? "Check-in recorded with location."
          : "Check-out recorded with location.",
      );
      await load();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Attendance could not be updated.";
      setLocationMessage(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }
  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Loading staff attendance…
      </main>
    );
  const user = staffUser();
  const canCheckIn = !today?.checkInUtc;
  const canCheckOut = Boolean(today?.checkInUtc && !today?.checkOutUtc);
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between"><BackButton fallbackHref={attendanceHome(user?.role)} /><OfflineStatus /></div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
              HRMS · Staff workspace
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
              My attendance
            </h1>
          </div>
          {user && (
            <AccountProfileMenu
              kind="staff"
              name={user.fullName}
              email={user.email}
              accountTypeLabel={user.role}
              links={[
                { label: "My workspace", href: attendanceHome(user.role) },
                { label: "My leave", href: "/leave" },
              ]}
            />
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href="#mark-attendance" className="inline-flex items-center gap-2 rounded-xl bg-[#003893] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#002b70]"><CalendarDays size={17} />Mark Attendance</a>
          <Link href="/leave" className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-50">Open Leave Module</Link>
        </div>
        {loadError && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"
          >
            <span>{loadError}</span>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
        <div className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Card id="mark-attendance" className="scroll-mt-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays size={19} className="text-[#003893]" />
                Mark Attendance
              </CardTitle>
              <p className="text-sm text-slate-500">
                {formatPlatformDate(today?.workDate, dateFormat)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Status</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">
                    {statusLabel(today?.status)}
                  </p>
                  {today?.lateMinutes ? (
                    <p className="mt-1 text-xs font-bold text-amber-700">
                      {today.lateMinutes} minutes late
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Check in</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">
                    {time(today?.checkInUtc)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {today?.checkInLocationStatus?.replaceAll("_", " ") ??
                      "Location required"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">
                    Working time
                  </p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">
                    {hours(today?.totalMinutes ?? 0)}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={!canCheckIn || Boolean(busy)}
                  onClick={() => void mark("in")}
                >
                  <LogIn />
                  {busy === "in" ? "Checking in…" : "Check in"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={!canCheckOut || Boolean(busy)}
                  onClick={() => void mark("out")}
                >
                  <LogOut />
                  {busy === "out" ? "Checking out…" : "Check out"}
                </Button>
              </div>
              {locationMessage && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800"
                >
                  {locationMessage}
                </p>
              )}
              {today?.checkOutUtc && (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={16} />
                  Checked out at {time(today.checkOutUtc)} ·{" "}
                  {hours(today.totalMinutes)} ·{" "}
                  {today.checkOutLocationStatus?.replaceAll("_", " ")}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
            <Metric
              icon={<CheckCircle2 />}
              label="Present days"
              value={dashboard?.presentDays ?? 0}
            />
            <Metric
              icon={<Clock3 />}
              label="Late days"
              value={dashboard?.lateDays ?? 0}
            />
            <Metric
              icon={<CalendarDays />}
              label="Recorded days"
              value={dashboard?.totalDays ?? 0}
            />
            <Metric
              icon={<Timer />}
              label="Overtime"
              value={hours(dashboard?.overtimeMinutes ?? 0)}
            />
          </div>
        </div>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance history</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Check in</th>
                      <th className="px-3 py-3">Check out</th>
                      <th className="px-3 py-3">Hours</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 font-semibold">
                          {formatPlatformDate(item.workDate, dateFormat)}
                        </td>
                        <td className="px-3 py-3">{time(item.checkInUtc)}</td>
                        <td className="px-3 py-3">{time(item.checkOutUtc)}</td>
                        <td className="px-3 py-3">
                          {hours(item.totalMinutes)}
                        </td>
                        <td className="px-3 py-3 font-bold">
                          {statusLabel(item.status)}
                        </td>
                      </tr>
                    ))}
                    {!history.length && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          No attendance records yet.
                        </td>
                      </tr>
                    )}
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

function getBrowserLocation(): Promise<AttendanceLocationInput> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device does not support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          locationTimestampUtc: new Date(position.timestamp).toISOString(),
          locationSource: "BROWSER_GEOLOCATION",
        }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location access is required to check in. Allow location permission and retry."
              : "Your location could not be read. Check device location and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[#003893]">
          {icon}
          <span className="text-xs font-bold text-slate-500">{label}</span>
        </div>
        <p className="mt-3 text-2xl font-extrabold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
