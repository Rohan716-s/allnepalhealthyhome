"use client";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate the edit form from the saved provider value once it is loaded. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSaveActions } from "@/components/form-save-actions";
import {
  defaultManagementSidebarTheme,
  sidebarThemePresets,
  useManagementTheme,
} from "@/components/management-theme-provider";
import {
  ManagementSidebarTheme,
  getManagementSidebarTheme,
  saveManagementSidebarTheme,
} from "@/services/api";

const themeRoles = [
  ["SUPERADMIN", "Superadmin"],
  ["ADMIN", "Admin"],
  ["SUPERVISOR", "Supervisor"],
  ["SALES_MANAGER", "Sales Manager"],
  ["SALES_EXECUTIVE", "Sales Executive"],
  ["PURCHASE_INVENTORY_MANAGER", "Purchase / Inventory Manager"],
  ["HR_MANAGER", "HR Manager"],
  ["ACCOUNTANT", "Accountant"],
  ["PHARMACIST", "Pharmacist"],
  ["DELIVERY", "Delivery"],
  ["VIEWER_AUDITOR", "Viewer / Auditor"],
  ["EMPLOYEE", "Employee"],
] as const;

const fields: {
  key: keyof ManagementSidebarTheme;
  label: string;
  description: string;
}[] = [
  {
    key: "sidebarBackground",
    label: "Sidebar background",
    description: "Main navigation surface",
  },
  { key: "sidebarText", label: "Sidebar text", description: "Default labels" },
  { key: "sidebarIcon", label: "Sidebar icon", description: "Default icons" },
  {
    key: "sidebarHoverBackground",
    label: "Hover background",
    description: "Pointer and keyboard hover",
  },
  { key: "sidebarHoverText", label: "Hover text", description: "Hover labels" },
  {
    key: "sidebarActiveBackground",
    label: "Active background",
    description: "Current route surface",
  },
  {
    key: "sidebarActiveText",
    label: "Active text",
    description: "Current route label",
  },
  {
    key: "sidebarActiveIcon",
    label: "Active icon",
    description: "Current route icon and marker",
  },
  {
    key: "sidebarBorder",
    label: "Sidebar border",
    description: "Outer navigation edge",
  },
  {
    key: "sidebarDivider",
    label: "Sidebar divider",
    description: "Section separators",
  },
  {
    key: "sidebarHeaderBackground",
    label: "Header background",
    description: "Sidebar identity area",
  },
  {
    key: "sidebarHeaderText",
    label: "Header text",
    description: "Sidebar identity text",
  },
  {
    key: "sidebarFooterBackground",
    label: "Footer background",
    description: "Signed-in account area",
  },
  {
    key: "sidebarFooterText",
    label: "Footer text",
    description: "Footer labels",
  },
  {
    key: "sidebarBadgeBackground",
    label: "Badge background",
    description: "Optional status badges",
  },
  {
    key: "sidebarBadgeText",
    label: "Badge text",
    description: "Optional status badge labels",
  },
];

const hexPattern = /^#[0-9a-fA-F]{6}$/;
function isHex(value: string) {
  return hexPattern.test(value);
}
function rgb(value: string) {
  if (!isHex(value)) return null;
  return [1, 3, 5].map(
    (index) => Number.parseInt(value.slice(index, index + 2), 16) / 255,
  );
}
function luminance(value: string) {
  const colors = rgb(value);
  if (!colors) return 0;
  return colors
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}
function contrast(background: string, foreground: string) {
  const light = Math.max(luminance(background), luminance(foreground));
  const dark = Math.min(luminance(background), luminance(foreground));
  return (light + 0.05) / (dark + 0.05);
}

function Preview({ theme }: { theme: ManagementSidebarTheme }) {
  const style = {
    backgroundColor: theme.sidebarBackground,
    color: theme.sidebarText,
    borderColor: theme.sidebarBorder,
  };
  const items = [
    "Dashboard",
    "Products",
    "Orders",
    "Prescriptions",
    "Inventory",
    "Customers",
  ];
  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm" style={style}>
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{
          backgroundColor: theme.sidebarHeaderBackground,
          color: theme.sidebarHeaderText,
        }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: theme.sidebarActiveBackground,
            color: theme.sidebarActiveIcon,
          }}
        >
          <Shield size={17} />
        </span>
        <span className="text-[11px] font-extrabold tracking-[0.13em]">
          ALL NEPAL
          <br />
          <span className="opacity-80">MANAGEMENT</span>
        </span>
      </div>
      <div className="space-y-1 p-3">
        {items.map((item, index) => (
          <div
            key={item}
            className={`flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-xs font-bold ${index === 0 ? "shadow-sm" : ""}`}
            style={
              index === 0
                ? {
                    backgroundColor: theme.sidebarActiveBackground,
                    color: theme.sidebarActiveText,
                    borderColor: theme.sidebarActiveIcon,
                  }
                : { color: theme.sidebarText, borderColor: "transparent" }
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  index === 0 ? theme.sidebarActiveIcon : theme.sidebarIcon,
              }}
            />
            {item}
          </div>
        ))}
      </div>
      <div
        className="mx-3 mb-3 rounded-xl px-3 py-2.5 text-xs font-bold"
        style={{
          backgroundColor: theme.sidebarFooterBackground,
          color: theme.sidebarFooterText,
        }}
      >
        Signed-in staff · Account menu
      </div>
    </div>
  );
}

export function SuperadminSidebarThemeSettings() {
  const { theme, loaded, setTheme } = useManagementTheme();
  const [saved, setSaved] = useState(defaultManagementSidebarTheme);
  const [draft, setDraft] = useState(defaultManagementSidebarTheme);
  const [ready, setReady] = useState(false);
  const [preset, setPreset] = useState("Default Healthcare");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [role, setRole] = useState("SUPERADMIN");

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    setReady(false);
    const load = role === "SUPERADMIN"
      ? Promise.resolve(theme)
      : getManagementSidebarTheme(token(), role);
    load.then((result) => {
      if (!active) return;
      setSaved(result);
      setDraft(result);
      setReady(true);
      setPreset("Default Healthcare");
    }).catch((exception) => {
      if (!active) return;
      setError(exception instanceof Error ? exception.message : "The role theme could not be loaded.");
      setReady(true);
    });
    return () => { active = false; };
  // The provider theme is intentionally read once for the current Superadmin role;
  // other roles are loaded from the API when selected.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, role]);
  const invalidFields = fields.filter((field) => !isHex(draft[field.key]));
  const contrastChecks = useMemo(
    () =>
      [
        ["Text on sidebar", draft.sidebarBackground, draft.sidebarText],
        ["Icons on sidebar", draft.sidebarBackground, draft.sidebarIcon],
        ["Active item", draft.sidebarActiveBackground, draft.sidebarActiveText],
        ["Hover item", draft.sidebarHoverBackground, draft.sidebarHoverText],
      ]
        .map(([label, background, foreground]) => ({
          label,
          value: contrast(background, foreground),
        }))
        .filter((item) => Number.isFinite(item.value)),
    [draft],
  );
  const lowContrast = contrastChecks.filter((item) => item.value < 4.5);

  function update(key: keyof ManagementSidebarTheme, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreset("Custom");
    setError("");
  }
  function applyPreset(name: string) {
    const selected = sidebarThemePresets[name];
    if (!selected) return;
    setDraft({ ...selected });
    setPreset(name);
    setError("");
  }
  function token() {
    return window.localStorage.getItem("anhh-staff-access-token") ?? "";
  }
  async function persist(next: ManagementSidebarTheme, reset = false) {
    setSaving(true);
    setError("");
    try {
      const result = await saveManagementSidebarTheme(next, token(), role);
      setSaved(result);
      setDraft(result);
      if (role === "SUPERADMIN") setTheme(result);
      setPreset(reset ? "Default Healthcare" : "Custom");
      toast.success(
        reset ? "Sidebar theme reset to default" : "Sidebar theme saved",
      );
      setResetOpen(false);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "The sidebar theme could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (invalidFields.length) {
      setError(
        "Use a valid six-digit HEX value for every color before saving.",
      );
      return;
    }
    void persist(draft);
  }

  if (!loaded || !ready)
    return (
      <Card className="mt-7">
        <CardContent className="flex min-h-48 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Loading sidebar theme…
        </CardContent>
      </Card>
    );
  return (
    <Card className="mt-7 border-[#003893]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="text-[#003893]" size={19} />
          Sidebar &amp; theme appearance
        </CardTitle>
        <p className="text-sm text-slate-500">
          Choose a professional preset or tune every management-sidebar color.
          Choose a role to preview and save its theme. The selected role sees
          the saved colors after the next navigation or sign-in.
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
        >
          <div>
            <div className="mb-5 max-w-sm">
              <Label htmlFor="sidebar-theme-role">Theme role</Label>
              <select id="sidebar-theme-role" value={role} onChange={(event) => { setRole(event.target.value); setError(""); }} className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-[#003893] focus:ring-2 focus:ring-[#003893]/20">
                {themeRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-500">Superadmin can manage every role. Non-Superadmin users only receive their own saved theme.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">
                Presets
              </span>
              {Object.keys(sidebarThemePresets).map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={preset === name ? "default" : "outline"}
                  onClick={() => applyPreset(name)}
                >
                  <Check
                    className={preset === name ? "" : "invisible"}
                    size={14}
                  />
                  {name}
                </Button>
              ))}
              <Badge variant="secondary">{preset}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const value = draft[field.key];
                const valid = isHex(value);
                return (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Input
                        aria-label={`${field.label} color picker`}
                        type="color"
                        value={valid ? value : "#000000"}
                        onChange={(event) =>
                          update(field.key, event.target.value.toUpperCase())
                        }
                        className="h-10 w-14 shrink-0 cursor-pointer p-1"
                      />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`theme-${field.key}`}>
                          {field.label}
                        </Label>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {field.description}
                        </p>
                        <Input
                          id={`theme-${field.key}`}
                          value={value}
                          onChange={(event) =>
                            update(field.key, event.target.value)
                          }
                          className={`mt-2 font-mono text-xs uppercase ${!valid ? "border-rose-400 focus-visible:ring-rose-200" : ""}`}
                          aria-invalid={!valid}
                          maxLength={7}
                          placeholder="#003893"
                        />
                      </div>
                    </div>
                    {!valid && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">
                        Enter six hexadecimal digits, for example #003893.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {error && (
              <Alert className="mt-5 border-rose-200 bg-rose-50 text-rose-800">
                <AlertTriangle className="mr-2 inline" size={16} />
                {error}
              </Alert>
            )}
            <FormSaveActions
              mode="edit"
              busy={saving}
              onCancel={() => {
                setDraft(saved);
                setPreset("Custom");
                setError("");
              }}
              saveLabel="Save changes"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResetOpen(true)}
                disabled={saving}
              >
                <RotateCcw size={15} />
                Reset to default
              </Button>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Eye size={17} className="text-[#003893]" />
                <h3 className="text-sm font-extrabold">Live preview</h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This preview follows unsaved edits. Your current application
                theme changes only after Save changes succeeds.
              </p>
              <div className="mt-4">
                <Preview theme={draft} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                Contrast check
              </p>
              {contrastChecks.map((check) => (
                <div
                  key={check.label}
                  className="mt-3 flex items-center justify-between gap-3 text-xs"
                >
                  <span>{check.label}</span>
                  <Badge
                    variant={check.value >= 4.5 ? "default" : "destructive"}
                  >
                    {check.value.toFixed(2)}:1
                  </Badge>
                </div>
              ))}
              {lowContrast.length > 0 && (
                <p className="mt-3 flex gap-2 text-xs font-semibold leading-5 text-amber-700">
                  <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                  Low contrast — some text may be difficult to read.
                </p>
              )}
              <p className="mt-3 text-[11px] text-slate-500">
                Contrast warnings do not block saving, but the active state
                should remain easy to identify.
              </p>
            </div>
          </div>
        </form>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset sidebar theme?</AlertDialogTitle>
              <AlertDialogDescription>
                This will save the default healthcare colors to the database and
                update every management sidebar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>
                <X size={16} />
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={saving}
                onClick={(event) => {
                  event.preventDefault();
                  void persist(defaultManagementSidebarTheme, true);
                }}
              >
                <Save size={16} />
                Reset and save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
