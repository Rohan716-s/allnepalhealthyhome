"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeStaffPassword,
  getStaffProfile,
  updateStaffProfile,
  type Staff,
} from "@/services/api";
import { utcToDateInput } from "@/lib/date-time";

const emptyPassword = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SupervisorProfilePage() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    employeeId: "",
    address: "",
    joiningDate: "",
  });
  const [password, setPassword] = useState(emptyPassword);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getStaffProfile(token(), "supervisor")
      .then((value) => {
        setStaff(value);
        setForm({
          fullName: value.fullName,
          phone: value.phone,
          employeeId: value.employeeId ?? "",
          address: value.address ?? "",
          joiningDate: utcToDateInput(value.joiningDate),
        });
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);
  function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setError("");
    void updateStaffProfile(token(), "supervisor", form)
      .then((value) => {
        setStaff(value);
        window.localStorage.setItem("anhh-staff", JSON.stringify(value));
        toast.success("Profile updated successfully.");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(""));
  }
  function savePassword(event: FormEvent) {
    event.preventDefault();
    setBusy("password");
    setError("");
    void changeStaffPassword(token(), "supervisor", password)
      .then(() => {
        setPassword(emptyPassword);
        toast.success("Password changed successfully.");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(""));
  }
  function resetProfile() {
    if (staff)
      setForm({
        fullName: staff.fullName,
        phone: staff.phone,
        employeeId: staff.employeeId ?? "",
        address: staff.address ?? "",
        joiningDate: utcToDateInput(staff.joiningDate),
      });
  }
  return (
    <AdminShell supervisor>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DC143C]">
          Profile
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          My supervisor profile
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Update your own contact details and password. Role and branch access
          remain controlled by administration.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
        >
          {error}
        </p>
      )}
      {!staff ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 animate-spin" />
          Loading profile…
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound size={18} className="text-[#DC143C]" />
                Work details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProfile} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-name">Full name</Label>
                  <Input
                    id="supervisor-name"
                    required
                    value={form.fullName}
                    onChange={(event) =>
                      setForm({ ...form, fullName: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-phone">Phone</Label>
                  <Input
                    id="supervisor-phone"
                    required
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-email">Work email</Label>
                  <Input id="supervisor-email" disabled value={staff.email} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-employee">Employee ID</Label>
                  <Input
                    id="supervisor-employee"
                    value={form.employeeId}
                    onChange={(event) =>
                      setForm({ ...form, employeeId: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-branch">Authorized branch</Label>
                  <Input
                    id="supervisor-branch"
                    disabled
                    value={staff.branchName ?? "Not assigned"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-joining">Joining date</Label>
                  <Input
                    id="supervisor-joining"
                    type="date"
                    value={form.joiningDate}
                    onChange={(event) =>
                      setForm({ ...form, joiningDate: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-address">Address</Label>
                  <Input
                    id="supervisor-address"
                    value={form.address}
                    onChange={(event) =>
                      setForm({ ...form, address: event.target.value })
                    }
                  />
                </div>
                <FormSaveActions
                  mode="edit"
                  busy={busy === "profile"}
                  onCancel={resetProfile}
                  saveLabel="Save profile"
                />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePassword} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-current-password">
                    Current password
                  </Label>
                  <Input
                    id="supervisor-current-password"
                    required
                    type="password"
                    value={password.currentPassword}
                    onChange={(event) =>
                      setPassword({
                        ...password,
                        currentPassword: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-new-password">New password</Label>
                  <Input
                    id="supervisor-new-password"
                    required
                    minLength={8}
                    type="password"
                    value={password.newPassword}
                    onChange={(event) =>
                      setPassword({
                        ...password,
                        newPassword: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supervisor-confirm-password">
                    Confirm new password
                  </Label>
                  <Input
                    id="supervisor-confirm-password"
                    required
                    minLength={8}
                    type="password"
                    value={password.confirmPassword}
                    onChange={(event) =>
                      setPassword({
                        ...password,
                        confirmPassword: event.target.value,
                      })
                    }
                  />
                </div>
                <FormSaveActions
                  mode="edit"
                  busy={busy === "password"}
                  onCancel={() => setPassword(emptyPassword)}
                  saveLabel="Change password"
                />
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}

function token() {
  return typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");
}
