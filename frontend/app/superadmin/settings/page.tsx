"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Building2,
  ArrowDown,
  ArrowUp,
  Globe2,
  Mail,
  MessageCircle,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminIntegrations,
  AdminMaintenance,
  getAdminIntegrations,
  getAdminMaintenance,
  getAdminSettings,
  saveAdminEmailIntegration,
  saveAdminMaintenance,
  saveAdminSetting,
  saveAdminSmsIntegration,
  saveAdminWhatsAppIntegration,
  testAdminEmail,
} from "@/services/api";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SuperadminSidebarThemeSettings } from "@/components/superadmin-sidebar-theme-settings";
import { publishTablePageSize, normalizeTablePageSize, TABLE_PAGE_SIZE_KEY, TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-preferences";
import { findTimezoneOption, PLATFORM_TIMEZONES, timezoneLabel } from "@/lib/platform-timezones";
import { orderedPharmacyMenuLabels, PHARMACY_WORKSPACE_LABELS, PHARMACY_WORKSPACE_MENU_GROUPS, parsePharmacyWorkspaceMenuOrder, type PharmacyWorkspaceMenuOrder } from "@/components/pharmacy-module-menu";
import { parseWorkspaceLabels } from "@/lib/workspace-labels";

type Setting = {
  key: string;
  value: string;
  group: string;
  isPublic: boolean;
  description?: string;
};
type EmailForm = {
  host: string;
  port: string;
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
  encryption: string;
};
type SmsForm = {
  provider: string;
  apiUrl: string;
  apiKey: string;
  senderId: string;
  otpExpiryMinutes: string;
  otpLength: string;
  rateLimitPerHour: string;
  retryLimit: string;
};
type WhatsAppForm = {
  provider: string;
  apiUrl: string;
  apiKey: string;
  businessNumber: string;
  templates: string;
};
type ToastSettings = {
  position: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  duration: string;
  signedIn: string;
  accountCreated: string;
  staffSignedIn: string;
};

const emptyEmail: EmailForm = {
  host: "",
  port: "587",
  username: "",
  password: "",
  senderName: "All Nepal Healthy Home",
  senderEmail: "",
  encryption: "STARTTLS",
};
const emptySms: SmsForm = {
  provider: "",
  apiUrl: "",
  apiKey: "",
  senderId: "",
  otpExpiryMinutes: "10",
  otpLength: "6",
  rateLimitPerHour: "5",
  retryLimit: "3",
};
const emptyWhatsApp: WhatsAppForm = {
  provider: "",
  apiUrl: "",
  apiKey: "",
  businessNumber: "",
  templates: "",
};
const emptyToastSettings: ToastSettings = {
  position: "top-right",
  duration: "4000",
  signedIn: "Signed in successfully",
  accountCreated: "Account created successfully",
  staffSignedIn: "Secure staff sign-in complete",
};

function Status({ configured }: { configured: boolean }) {
  return (
    <Badge variant={configured ? "default" : "destructive"}>
      {configured ? (
        <>
          <CheckCircle2 className="mr-1" size={13} />
          Configured
        </>
      ) : (
        <>
          <TriangleAlert className="mr-1" size={13} />
          Not configured
        </>
      )}
    </Badge>
  );
}

export default function SettingsPage() {
  const [items, setItems] = useState<Setting[]>([]);
  const [integration, setIntegration] = useState<AdminIntegrations | null>(
    null,
  );
  const [maintenance, setMaintenance] = useState<AdminMaintenance>({
    enabled: false,
    message: "",
    allowAdmin: true,
  });
  const [email, setEmail] = useState(emptyEmail);
  const [sms, setSms] = useState(emptySms);
  const [whatsapp, setWhatsApp] = useState(emptyWhatsApp);
  const [testRecipient, setTestRecipient] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [dateFormat, setDateFormat] = useState<"AD" | "BS">("AD");
  const [timeFormat, setTimeFormat] = useState<"12" | "24">("12");
  const [timeZone, setTimeZone] = useState("Asia/Kathmandu");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [tablePageSize, setTablePageSize] = useState("25");
  const [toastSettings, setToastSettings] = useState<ToastSettings>(emptyToastSettings);
  const [workspaceCompanyName, setWorkspaceCompanyName] = useState("All Nepal Healthy Home");
  const [workspaceTagline, setWorkspaceTagline] = useState("Trusted pharmacy care, delivered home");
  const [workspaceHeaderRight, setWorkspaceHeaderRight] = useState("ALL NEPAL");
  const [workspaceBannerMessage, setWorkspaceBannerMessage] = useState("Trusted healthcare operations · Accurate stock, sales and reports");
  const [workspaceFooterDeveloper, setWorkspaceFooterDeveloper] = useState("Developed for {company_name}");
  const [workspaceFooterContact, setWorkspaceFooterContact] = useState("Pharmacy Management Workspace");
  const [workspaceFooterVersion, setWorkspaceFooterVersion] = useState("PMC Workspace");
  const [workspaceLabels, setWorkspaceLabels] = useState<Record<string, string>>({});
  const [workspaceLabelSearch, setWorkspaceLabelSearch] = useState("");
  const [workspaceMenuOrder, setWorkspaceMenuOrder] = useState<PharmacyWorkspaceMenuOrder>(PHARMACY_WORKSPACE_MENU_GROUPS);
  const [workspaceMenuGroup, setWorkspaceMenuGroup] = useState("TOP");

  useEffect(() => {
    const token = window.localStorage.getItem("anhh-staff-access-token");
    if (!token) return;
    Promise.all([
      getAdminSettings(token),
      getAdminIntegrations(token),
      getAdminMaintenance(token),
    ])
      .then(([settings, providers, maintenanceSettings]) => {
        setItems(settings);
        const settingValue = (key: string, fallback: string) => settings.find((item) => item.key === key)?.value ?? fallback;
        setWorkspaceCompanyName(settingValue("website.name", "All Nepal Healthy Home"));
        setWorkspaceTagline(settingValue("website.tagline", "Trusted pharmacy care, delivered home"));
        setWorkspaceHeaderRight(settingValue("workspace.header.right", "ALL NEPAL"));
        setWorkspaceBannerMessage(settingValue("workspace.banner.message", "Trusted healthcare operations · Accurate stock, sales and reports"));
        setWorkspaceFooterDeveloper(settingValue("workspace.footer.developer", "Developed for {company_name}"));
        setWorkspaceFooterContact(settingValue("workspace.footer.contact", "Pharmacy Management Workspace"));
        setWorkspaceFooterVersion(settingValue("workspace.footer.version", "PMC Workspace"));
        setWorkspaceLabels(parseWorkspaceLabels(settingValue("workspace.labels", "{}")));
        setWorkspaceMenuOrder(parsePharmacyWorkspaceMenuOrder(settingValue("workspace.menuOrder", "")));
        setDateFormat(settings.find((item) => item.key === "system.dateFormat")?.value === "BS" ? "BS" : "AD");
        setTimeFormat(settings.find((item) => item.key === "system.timeFormat")?.value === "24" ? "24" : "12");
        setTimeZone(settings.find((item) => item.key === "system.timezone")?.value?.trim() || "Asia/Kathmandu");
        setTablePageSize(String(normalizeTablePageSize(settings.find((item) => item.key === TABLE_PAGE_SIZE_KEY)?.value)));
        setToastSettings({
          position: (settings.find((item) => item.key === "notification.toast.position")?.value as ToastSettings["position"]) || "top-right",
          duration: settings.find((item) => item.key === "notification.toast.duration")?.value || "4000",
          signedIn: settings.find((item) => item.key === "notification.toast.signedIn")?.value || emptyToastSettings.signedIn,
          accountCreated: settings.find((item) => item.key === "notification.toast.accountCreated")?.value || emptyToastSettings.accountCreated,
          staffSignedIn: settings.find((item) => item.key === "notification.toast.staffSignedIn")?.value || emptyToastSettings.staffSignedIn,
        });
        setIntegration(providers);
        setMaintenance(maintenanceSettings);
        setEmail({
          host: providers.email.host ?? "",
          port: String(providers.email.port ?? 587),
          username: providers.email.username ?? "",
          password: "",
          senderName: providers.email.senderName ?? "All Nepal Healthy Home",
          senderEmail: providers.email.senderEmail ?? "",
          encryption: providers.email.encryption ?? "STARTTLS",
        });
        setSms({
          provider: providers.sms.provider ?? "",
          apiUrl: providers.sms.apiUrl ?? "",
          apiKey: "",
          senderId: providers.sms.senderId ?? "",
          otpExpiryMinutes: String(providers.sms.otpExpiryMinutes),
          otpLength: String(providers.sms.otpLength),
          rateLimitPerHour: String(providers.sms.rateLimitPerHour),
          retryLimit: String(providers.sms.retryLimit),
        });
        setWhatsApp({
          provider: providers.whatsapp.provider ?? "",
          apiUrl: providers.whatsapp.apiUrl ?? "",
          apiKey: "",
          businessNumber: providers.whatsapp.businessNumber ?? "",
          templates: providers.whatsapp.templates ?? "",
        });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function token() {
    return window.localStorage.getItem("anhh-staff-access-token") ?? "";
  }
  function update(key: string, value: string) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, value } : item)),
    );
  }
  async function save(item: Setting) {
    setSaving(item.key);
    setError("");
    try {
      await saveAdminSetting(
        item.key,
        {
          value: item.value,
          group: item.group,
          isPublic: item.isPublic,
          description: item.description,
        },
        token(),
      );
      toast.success("Setting saved");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The setting could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function saveDateFormat() {
    setSaving("system.dateFormat");
    setError("");
    try {
      await saveAdminSetting("system.dateFormat", { value: dateFormat, group: "system", isPublic: true, description: "Global date display format: AD or BS." }, token());
      setItems((current) => current.some((item) => item.key === "system.dateFormat") ? current.map((item) => item.key === "system.dateFormat" ? { ...item, value: dateFormat } : item) : [...current, { key: "system.dateFormat", value: dateFormat, group: "system", isPublic: true, description: "Global date display format: AD or BS." }]);
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Global date format saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Date format could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveDateTimeSettings() {
    setSaving("system.dateTime");
    setError("");
    try {
      const definitions = [
        ["system.timeFormat", timeFormat, "Global time display format: 12-hour or 24-hour."],
        ["system.timezone", timeZone, "Global IANA timezone used for platform display and business time."],
      ] as const;
      await Promise.all(definitions.map(([key, value, description]) => saveAdminSetting(key, { value, group: "system", isPublic: true, description }, token())));
      setItems((current) => definitions.reduce((rows, [key, value, description]) => rows.some((item) => item.key === key) ? rows.map((item) => item.key === key ? { ...item, value, isPublic: true } : item) : [...rows, { key, value, group: "system", isPublic: true, description }], current));
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Global date and time settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Date and time settings could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveTablePageSize() {
    const value = normalizeTablePageSize(tablePageSize);
    setSaving(TABLE_PAGE_SIZE_KEY);
    setError("");
    try {
      await saveAdminSetting(TABLE_PAGE_SIZE_KEY, { value: String(value), group: "system", isPublic: true, description: "Global default number of rows shown on management tables." }, token());
      setTablePageSize(String(value));
      setItems((current) => current.some((item) => item.key === TABLE_PAGE_SIZE_KEY) ? current.map((item) => item.key === TABLE_PAGE_SIZE_KEY ? { ...item, value: String(value) } : item) : [...current, { key: TABLE_PAGE_SIZE_KEY, value: String(value), group: "system", isPublic: true, description: "Global default number of rows shown on management tables." }]);
      publishTablePageSize(value);
      toast.success("Global table row count saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Table row count could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveToastSettings(event: FormEvent) {
    event.preventDefault();
    const duration = Math.min(10000, Math.max(1500, Number(toastSettings.duration) || 4000));
    const next = { ...toastSettings, duration: String(duration) };
    setSaving("notification.toasts");
    setError("");
    try {
      const definitions = [
        ["notification.toast.position", next.position, "Toast position"],
        ["notification.toast.duration", next.duration, "Toast duration in milliseconds"],
        ["notification.toast.signedIn", next.signedIn.trim(), "Customer sign-in success message"],
        ["notification.toast.accountCreated", next.accountCreated.trim(), "Account creation success message"],
        ["notification.toast.staffSignedIn", next.staffSignedIn.trim(), "Staff sign-in success message"],
      ] as const;
      await Promise.all(definitions.map(([key, value, description]) => saveAdminSetting(key, { value, group: "notifications", isPublic: true, description }, token())));
      setToastSettings(next);
      setItems((current) => definitions.reduce((rows, [key, value, description]) => rows.some((item) => item.key === key) ? rows.map((item) => item.key === key ? { ...item, value } : item) : [...rows, { key, value, group: "notifications", isPublic: true, description }], current));
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Toast notification settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toast notification settings could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveWorkspaceSettings(event: FormEvent) {
    event.preventDefault();
    const companyName = workspaceCompanyName.trim();
    if (!companyName) {
      setError("Enter a company name before saving the workspace settings.");
      return;
    }
    const previousCompanyName = items.find((item) => item.key === "website.name")?.value || "All Nepal Healthy Home";
    const invoiceFooter = (items.find((item) => item.key === "invoice.footer")?.value || "Thank you for choosing All Nepal Healthy Home.").replaceAll(previousCompanyName, companyName);
    const footerDeveloper = workspaceFooterDeveloper.trim().replaceAll(previousCompanyName, companyName).replaceAll("All Nepal Healthy Home", companyName);
    const definitions = [
      ["website.name", companyName, "general", "Company name shown across the public site and staff workspace."],
      ["invoice.companyName", companyName, "invoice", "Business name printed on invoices; kept in sync with the company display name."],
      ["invoice.footer", invoiceFooter, "invoice", "Invoice footer; any existing company name is synchronized when the company display name changes."],
      ["website.tagline", workspaceTagline.trim(), "general", "Company tagline shown in the staff workspace and public site."],
      ["workspace.header.right", workspaceHeaderRight.trim(), "workspace", "Small right-side header label in the pharmacy workspace."],
      ["workspace.banner.message", workspaceBannerMessage.trim(), "workspace", "Message shown in the pharmacy dashboard banner."],
      ["workspace.footer.developer", footerDeveloper, "workspace", "Left-side workspace footer text."],
      ["workspace.footer.contact", workspaceFooterContact.trim(), "workspace", "Center workspace footer text."],
      ["workspace.footer.version", workspaceFooterVersion.trim(), "workspace", "Right-side workspace footer text."],
      ["workspace.labels", JSON.stringify(workspaceLabels), "workspace", "Editable pharmacy workspace menu, screen, report, and breadcrumb labels."],
      ["workspace.menuOrder", JSON.stringify(workspaceMenuOrder), "workspace", "Admin-configurable ordering for the pharmacy workspace top navigation and nested menus. Exit remains at the end."],
    ] as const;
    setSaving("workspace");
    setError("");
    try {
      await Promise.all(definitions.map(([key, value, group, description]) => saveAdminSetting(key, { value, group, isPublic: true, description }, token())));
      setItems((current) => definitions.reduce((rows, [key, value, group, description]) => rows.some((item) => item.key === key)
        ? rows.map((item) => item.key === key ? { ...item, value, group, isPublic: true, description } : item)
        : [...rows, { key, value, group, isPublic: true, description }], current));
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Company and pharmacy workspace settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace settings could not be saved.");
    } finally {
      setSaving("");
    }
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    setSaving("email");
    setError("");
    try {
      const saved = await saveAdminEmailIntegration(
        {
          ...email,
          port: Number(email.port),
          password: email.password || undefined,
        },
        token(),
      );
      setIntegration((current) =>
        current ? { ...current, email: saved } : current,
      );
      setEmail((current) => ({ ...current, password: "" }));
      toast.success("Email settings saved");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Email settings could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function sendTest(event: FormEvent) {
    event.preventDefault();
    setSaving("email-test");
    setError("");
    try {
      await testAdminEmail(testRecipient, token());
      toast.success("Test email sent");
      setTestRecipient("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The SMTP test failed.");
    } finally {
      setSaving("");
    }
  }
  async function saveSms(event: FormEvent) {
    event.preventDefault();
    setSaving("sms");
    setError("");
    try {
      const saved = await saveAdminSmsIntegration(
        {
          ...sms,
          apiKey: sms.apiKey || undefined,
          otpExpiryMinutes: Number(sms.otpExpiryMinutes),
          otpLength: Number(sms.otpLength),
          rateLimitPerHour: Number(sms.rateLimitPerHour),
          retryLimit: Number(sms.retryLimit),
        },
        token(),
      );
      setIntegration((current) =>
        current ? { ...current, sms: saved } : current,
      );
      setSms((current) => ({ ...current, apiKey: "" }));
      toast.success("SMS settings saved");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "SMS settings could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function saveWhatsApp(event: FormEvent) {
    event.preventDefault();
    setSaving("whatsapp");
    setError("");
    try {
      const saved = await saveAdminWhatsAppIntegration(
        { ...whatsapp, apiKey: whatsapp.apiKey || undefined },
        token(),
      );
      setIntegration((current) =>
        current ? { ...current, whatsapp: saved } : current,
      );
      setWhatsApp((current) => ({ ...current, apiKey: "" }));
      toast.success("WhatsApp settings saved");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "WhatsApp settings could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function saveMaintenance(event: FormEvent) {
    event.preventDefault();
    setSaving("maintenance");
    setError("");
    try {
      setMaintenance(await saveAdminMaintenance(maintenance, token()));
      toast.success(
        maintenance.enabled
          ? "Maintenance mode enabled"
          : "Maintenance mode disabled",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Maintenance settings could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }

  return (
    <AdminShell superAdmin>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
          SuperAdmin
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          System settings
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Control public website settings and provider connections from one
          protected workspace.
        </p>
      </div>
      {error && (
        <Alert className="mt-5 border-rose-200 bg-rose-50 text-rose-800">
          {error}
        </Alert>
      )}
      <SuperadminSidebarThemeSettings />
      <Card className="mt-7 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="text-[#003893]" size={18} />Role-based sidebar menus</CardTitle>
          <p className="text-sm text-slate-500">Choose what each staff role sees in its own sidebar, including labels, routes, icons, order and visibility.</p>
        </CardHeader>
        <CardContent>
          <a href="/superadmin/settings/sidebar" className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--color-primary)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">Customize sidebar menus</a>
        </CardContent>
      </Card>
      <Card className="mt-7 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="text-[#003893]" size={18} />Company identity and pharmacy workspace</CardTitle>
          <p className="text-sm text-slate-500">These shared settings drive the company name and editable labels in the pharmacy dashboards. The signed-in user name always comes from that user’s staff profile.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveWorkspaceSettings} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div><Label htmlFor="workspace-company">Company display name</Label><Input id="workspace-company" value={workspaceCompanyName} onChange={(event) => setWorkspaceCompanyName(event.target.value)} maxLength={160} required /></div>
              <div><Label htmlFor="workspace-tagline">Company tagline</Label><Input id="workspace-tagline" value={workspaceTagline} onChange={(event) => setWorkspaceTagline(event.target.value)} maxLength={180} /></div>
              <div><Label htmlFor="workspace-header-right">Header right-side label</Label><Input id="workspace-header-right" value={workspaceHeaderRight} onChange={(event) => setWorkspaceHeaderRight(event.target.value)} maxLength={80} /></div>
              <div className="md:col-span-2 xl:col-span-3"><Label htmlFor="workspace-banner">Dashboard banner message</Label><Input id="workspace-banner" value={workspaceBannerMessage} onChange={(event) => setWorkspaceBannerMessage(event.target.value)} maxLength={240} /></div>
              <div><Label htmlFor="workspace-footer-developer">Footer — left</Label><Input id="workspace-footer-developer" value={workspaceFooterDeveloper} onChange={(event) => setWorkspaceFooterDeveloper(event.target.value)} maxLength={140} /></div>
              <div><Label htmlFor="workspace-footer-contact">Footer — center</Label><Input id="workspace-footer-contact" value={workspaceFooterContact} onChange={(event) => setWorkspaceFooterContact(event.target.value)} maxLength={180} /></div>
              <div><Label htmlFor="workspace-footer-version">Footer — right</Label><Input id="workspace-footer-version" value={workspaceFooterVersion} onChange={(event) => setWorkspaceFooterVersion(event.target.value)} maxLength={100} /></div>
            </div>
            <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="workspace-menu-order-title">
              <div className="mb-3">
                <h3 id="workspace-menu-order-title" className="text-sm font-bold">Sales &amp; Purchase top menu order</h3>
                <p className="mt-1 text-xs text-slate-500">Reorder the Medi Pro-style top headings and every Sales/Purchase submenu. The Exit option stays at the end; labels remain editable below.</p>
              </div>
              <div className="mb-3 max-w-2xl">
                <Label htmlFor="workspace-menu-group">Menu group</Label>
                <Select id="workspace-menu-group" value={workspaceMenuGroup} onChange={(event) => setWorkspaceMenuGroup(event.target.value)}>
                  {Object.keys(PHARMACY_WORKSPACE_MENU_GROUPS).map((group) => <option key={group} value={group}>{group === "TOP" ? "Top navigation" : group.replaceAll("/", " › ")}</option>)}
                </Select>
              </div>
              <ol className="grid max-w-2xl gap-2">
                {orderedPharmacyMenuLabels(workspaceMenuGroup, workspaceMenuOrder).map((menuLabel, index, menuLabels) => <li key={menuLabel} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="w-7 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 font-semibold">{workspaceLabels[menuLabel]?.trim() || menuLabel}</span>
                  <button type="button" aria-label={`Move ${menuLabel} up`} disabled={index === 0} onClick={() => setWorkspaceMenuOrder((current) => { const next = [...menuLabels]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return { ...current, [workspaceMenuGroup]: next }; })} className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ArrowUp size={15} /></button>
                  <button type="button" aria-label={`Move ${menuLabel} down`} disabled={index === menuLabels.length - 1} onClick={() => setWorkspaceMenuOrder((current) => { const next = [...menuLabels]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return { ...current, [workspaceMenuGroup]: next }; })} className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ArrowDown size={15} /></button>
                </li>)}
              </ol>
            </section>
            <details className="rounded-xl border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold">Customize all pharmacy menu and screen labels ({PHARMACY_WORKSPACE_LABELS.length})</summary>
              <div className="border-t border-slate-200 p-4">
                <p className="mb-3 text-xs leading-5 text-slate-500">Changes apply to the department menus, screen headings, report choices and breadcrumbs. Internal routes and permission keys remain stable, so renaming a label cannot change access rights.</p>
                <Input aria-label="Search workspace labels" value={workspaceLabelSearch} onChange={(event) => setWorkspaceLabelSearch(event.target.value)} placeholder="Search labels…" className="mb-3" />
                <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {PHARMACY_WORKSPACE_LABELS.filter((label) => label.toLowerCase().includes(workspaceLabelSearch.toLowerCase())).map((label) => <div key={label}><Label htmlFor={`workspace-label-${label}`}>{label}</Label><Input id={`workspace-label-${label}`} value={workspaceLabels[label] ?? label} onChange={(event) => setWorkspaceLabels((current) => {
                    const next = { ...current };
                    const value = event.target.value.trim();
                    if (!value || value === label) delete next[label];
                    else next[label] = value;
                    return next;
                  })} maxLength={120} /></div>)}
                </div>
              </div>
            </details>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3"><p className="max-w-3xl text-xs text-slate-500">The header’s user name is the authenticated staff member’s profile name; update that person in Staff Management. Company name changes also synchronize the invoice business name.</p><a href="/superadmin/staff" className="shrink-0 text-xs font-bold text-[#003893] underline-offset-4 hover:underline">Edit staff names</a></div>
              <Button type="submit" disabled={saving === "workspace"}>{saving === "workspace" ? "Saving…" : <><Save size={16} />Save workspace settings</>}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-7 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="text-emerald-600" size={18} />Toast notifications</CardTitle>
          <p className="text-sm text-slate-500">Control the short success notifications used across the website and protected workspaces. They are not the large welcome campaign popup.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveToastSettings} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="toast-position">Notification position</Label><Select id="toast-position" value={toastSettings.position} onChange={(event) => setToastSettings((current) => ({ ...current, position: event.target.value as ToastSettings["position"] }))}><option value="top-right">Top right (recommended)</option><option value="top-center">Top center</option><option value="top-left">Top left</option><option value="bottom-right">Bottom right</option><option value="bottom-center">Bottom center</option><option value="bottom-left">Bottom left</option></Select></div>
              <div><Label htmlFor="toast-duration">Visible for (milliseconds)</Label><Input id="toast-duration" type="number" min="1500" max="10000" step="500" value={toastSettings.duration} onChange={(event) => setToastSettings((current) => ({ ...current, duration: event.target.value }))} /><p className="mt-1 text-xs text-slate-500">1,500–10,000 ms</p></div>
              <div className="flex items-end"><div className="w-full rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-2 inline" size={16} />Preview: <b>{toastSettings.signedIn || "Signed in successfully"}</b></div></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="toast-signed-in">Customer sign-in message</Label><Input id="toast-signed-in" maxLength={160} value={toastSettings.signedIn} onChange={(event) => setToastSettings((current) => ({ ...current, signedIn: event.target.value }))} /></div>
              <div><Label htmlFor="toast-account-created">Account created message</Label><Input id="toast-account-created" maxLength={160} value={toastSettings.accountCreated} onChange={(event) => setToastSettings((current) => ({ ...current, accountCreated: event.target.value }))} /></div>
              <div><Label htmlFor="toast-staff-signed-in">Staff sign-in message</Label><Input id="toast-staff-signed-in" maxLength={160} value={toastSettings.staffSignedIn} onChange={(event) => setToastSettings((current) => ({ ...current, staffSignedIn: event.target.value }))} /></div>
            </div>
            <div><Button type="submit" disabled={saving === "notification.toasts"}>{saving === "notification.toasts" ? "Saving…" : <><Save size={16} />Save toast settings</>}</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-7 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="text-[#003893]" size={18} />Global platform preferences</CardTitle>
          <p className="text-sm text-slate-500">One date, time, and timezone preference is used across orders, invoices, HRMS, audit logs, reports, and dashboards.</p>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-4 lg:items-end">
          <div><Label htmlFor="global-date-format">Date display format</Label><Select id="global-date-format" value={dateFormat} onChange={(event) => setDateFormat(event.target.value as "AD" | "BS")}><option value="AD">English (AD)</option><option value="BS">Nepali (Bikram Sambat)</option></Select></div>
          <div><Label htmlFor="global-time-format">Time display format</Label><Select id="global-time-format" value={timeFormat} onChange={(event) => setTimeFormat(event.target.value as "12" | "24")}><option value="12">12-hour (2:30 PM)</option><option value="24">24-hour (14:30)</option></Select></div>
          <div><Label htmlFor="global-table-page-size">Rows per table page</Label><Select id="global-table-page-size" value={TABLE_PAGE_SIZE_OPTIONS.includes(Number(tablePageSize) as (typeof TABLE_PAGE_SIZE_OPTIONS)[number]) ? tablePageSize : "custom"} onChange={(event) => setTablePageSize(event.target.value === "custom" ? "" : event.target.value)}><option value="10">10 rows</option><option value="25">25 rows</option><option value="50">50 rows</option><option value="100">100 rows</option><option value="custom">Custom…</option></Select>{(!TABLE_PAGE_SIZE_OPTIONS.includes(Number(tablePageSize) as (typeof TABLE_PAGE_SIZE_OPTIONS)[number])) && <Input className="mt-2" type="number" min="1" max="100" value={tablePageSize} onChange={(event) => setTablePageSize(event.target.value)} placeholder="1–100" />}</div>
          <div className="lg:col-span-1"><Label htmlFor="global-timezone-search">Timezone / country</Label><div className="relative"><Globe2 className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} /><Input id="global-timezone-search" className="pl-9" value={timezoneSearch} onChange={(event) => setTimezoneSearch(event.target.value)} placeholder="Search country or timezone" /><div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">{PLATFORM_TIMEZONES.filter((option) => `${option.country} ${option.zone}`.toLowerCase().includes(timezoneSearch.toLowerCase())).map((option) => <button type="button" key={option.zone} onClick={() => { setTimeZone(option.zone); setTimezoneSearch(""); }} className={`block w-full px-3 py-2 text-left text-xs transition hover:bg-blue-50 ${timeZone === option.zone ? "bg-blue-50 font-semibold text-[#003893]" : "text-slate-700"}`}>{timezoneLabel(option)}</button>)}{PLATFORM_TIMEZONES.filter((option) => `${option.country} ${option.zone}`.toLowerCase().includes(timezoneSearch.toLowerCase())).length === 0 && <p className="px-3 py-3 text-xs text-slate-500">No timezone found.</p>}</div></div><p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />Selected: {timezoneLabel(findTimezoneOption(timeZone))}</p></div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-950 lg:col-span-4"><span><b>Platform time:</b> {timeZone} · {timeFormat === "12" ? "12-hour" : "24-hour"}. Timestamps remain stored in UTC and are converted for display.</span><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void saveDateFormat()} disabled={saving === "system.dateFormat"}><Save size={16} />{saving === "system.dateFormat" ? "Saving…" : "Save date format"}</Button><Button type="button" onClick={() => void saveDateTimeSettings()} disabled={saving === "system.dateTime"}><Save size={16} />{saving === "system.dateTime" ? "Saving…" : "Save time settings"}</Button><Button type="button" variant="outline" onClick={() => void saveTablePageSize()} disabled={saving === TABLE_PAGE_SIZE_KEY}><Save size={16} />{saving === TABLE_PAGE_SIZE_KEY ? "Saving…" : "Save row count"}</Button></div></div>
        </CardContent>
      </Card>
      <Card className="mt-7 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-[#003893]" size={18} />
            Communication providers
          </CardTitle>
          <p className="text-sm text-slate-500">
            Secrets are encrypted on the server and never returned to the
            browser.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-3">
          <form
            onSubmit={saveEmail}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Mail size={17} />
                Email / SMTP
              </h2>
              {integration && (
                <Status configured={integration.email.configured} />
              )}
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <div>
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input
                    id="smtp-host"
                    value={email.host}
                    onChange={(e) =>
                      setEmail({ ...email, host: e.target.value })
                    }
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={email.port}
                    onChange={(e) =>
                      setEmail({ ...email, port: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="smtp-user">Username</Label>
                <Input
                  id="smtp-user"
                  value={email.username}
                  onChange={(e) =>
                    setEmail({ ...email, username: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="smtp-password">Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={email.password}
                  onChange={(e) =>
                    setEmail({ ...email, password: e.target.value })
                  }
                  placeholder="Leave blank to keep saved password"
                />
              </div>
              <div>
                <Label htmlFor="smtp-sender">Sender name</Label>
                <Input
                  id="smtp-sender"
                  value={email.senderName}
                  onChange={(e) =>
                    setEmail({ ...email, senderName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="smtp-email">Sender email</Label>
                <Input
                  id="smtp-email"
                  type="email"
                  value={email.senderEmail}
                  onChange={(e) =>
                    setEmail({ ...email, senderEmail: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="smtp-encryption">Encryption</Label>
                <Select
                  id="smtp-encryption"
                  value={email.encryption}
                  onChange={(e) =>
                    setEmail({ ...email, encryption: e.target.value })
                  }
                >
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="SSL">SSL</option>
                  <option value="NONE">None</option>
                </Select>
              </div>
              <Button disabled={saving === "email"}>
                {saving === "email" ? (
                  "Saving…"
                ) : (
                  <>
                    <Save />
                    Save email
                  </>
                )}
              </Button>
            </div>
          </form>
          <form
            onSubmit={saveSms}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Smartphone size={17} />
                SMS / OTP
              </h2>
              {integration && (
                <Status configured={integration.sms.configured} />
              )}
            </div>
            <div className="mt-4 grid gap-3">
              <div>
                <Label htmlFor="sms-provider">Provider</Label>
                <Input
                  id="sms-provider"
                  value={sms.provider}
                  onChange={(e) => setSms({ ...sms, provider: e.target.value })}
                  placeholder="Your SMS provider"
                />
              </div>
              <div>
                <Label htmlFor="sms-url">API URL</Label>
                <Input
                  id="sms-url"
                  type="url"
                  value={sms.apiUrl}
                  onChange={(e) => setSms({ ...sms, apiUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label htmlFor="sms-key">API key</Label>
                <Input
                  id="sms-key"
                  type="password"
                  value={sms.apiKey}
                  onChange={(e) => setSms({ ...sms, apiKey: e.target.value })}
                  placeholder="Leave blank to keep saved key"
                />
              </div>
              <div>
                <Label htmlFor="sms-sender">Sender ID</Label>
                <Input
                  id="sms-sender"
                  value={sms.senderId}
                  onChange={(e) => setSms({ ...sms, senderId: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="otp-expiry">OTP expiry (min)</Label>
                  <Input
                    id="otp-expiry"
                    type="number"
                    min="1"
                    max="60"
                    value={sms.otpExpiryMinutes}
                    onChange={(e) =>
                      setSms({ ...sms, otpExpiryMinutes: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="otp-length">OTP length</Label>
                  <Input
                    id="otp-length"
                    type="number"
                    min="4"
                    max="10"
                    value={sms.otpLength}
                    onChange={(e) =>
                      setSms({ ...sms, otpLength: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="sms-rate">Rate / hour</Label>
                  <Input
                    id="sms-rate"
                    type="number"
                    min="1"
                    max="100"
                    value={sms.rateLimitPerHour}
                    onChange={(e) =>
                      setSms({ ...sms, rateLimitPerHour: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="sms-retry">Retries</Label>
                  <Input
                    id="sms-retry"
                    type="number"
                    min="0"
                    max="10"
                    value={sms.retryLimit}
                    onChange={(e) =>
                      setSms({ ...sms, retryLimit: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button disabled={saving === "sms"}>
                {saving === "sms" ? (
                  "Saving…"
                ) : (
                  <>
                    <Save />
                    Save SMS
                  </>
                )}
              </Button>
            </div>
          </form>
          <form
            onSubmit={saveWhatsApp}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <MessageCircle size={17} />
                WhatsApp
              </h2>
              {integration && (
                <Status configured={integration.whatsapp.configured} />
              )}
            </div>
            <div className="mt-4 grid gap-3">
              <div>
                <Label htmlFor="wa-provider">Provider</Label>
                <Input
                  id="wa-provider"
                  value={whatsapp.provider}
                  onChange={(e) =>
                    setWhatsApp({ ...whatsapp, provider: e.target.value })
                  }
                  placeholder="Meta, Twilio, or another provider"
                />
              </div>
              <div>
                <Label htmlFor="wa-url">API URL</Label>
                <Input
                  id="wa-url"
                  type="url"
                  value={whatsapp.apiUrl}
                  onChange={(e) =>
                    setWhatsApp({ ...whatsapp, apiUrl: e.target.value })
                  }
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label htmlFor="wa-key">API key</Label>
                <Input
                  id="wa-key"
                  type="password"
                  value={whatsapp.apiKey}
                  onChange={(e) =>
                    setWhatsApp({ ...whatsapp, apiKey: e.target.value })
                  }
                  placeholder="Leave blank to keep saved key"
                />
              </div>
              <div>
                <Label htmlFor="wa-number">Business number</Label>
                <Input
                  id="wa-number"
                  value={whatsapp.businessNumber}
                  onChange={(e) =>
                    setWhatsApp({ ...whatsapp, businessNumber: e.target.value })
                  }
                  placeholder="+977…"
                />
              </div>
              <div>
                <Label htmlFor="wa-templates">Template names</Label>
                <Input
                  id="wa-templates"
                  value={whatsapp.templates}
                  onChange={(e) =>
                    setWhatsApp({ ...whatsapp, templates: e.target.value })
                  }
                  placeholder="order_status, delivery_update"
                />
              </div>
              <Button disabled={saving === "whatsapp"}>
                {saving === "whatsapp" ? (
                  "Saving…"
                ) : (
                  <>
                    <Save />
                    Save WhatsApp
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-5 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="text-[#003893]" size={18} />
            Verify email delivery
          </CardTitle>
          <p className="text-sm text-slate-500">
            This sends a real message through the saved SMTP connection. It does
            not simulate delivery.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={sendTest}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label htmlFor="test-email">Test recipient</Label>
              <Input
                id="test-email"
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button disabled={saving === "email-test"}>
              {saving === "email-test" ? "Sending…" : "Send test email"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-7 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="text-amber-600" size={18} />
            Maintenance mode
          </CardTitle>
          <p className="text-sm text-slate-500">
            Temporarily pause the customer website while protected staff
            operations remain available.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={saveMaintenance}
            className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end"
          >
            <div>
              <Label htmlFor="maintenance-enabled">Website status</Label>
              <Select
                id="maintenance-enabled"
                value={maintenance.enabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setMaintenance((current) => ({
                    ...current,
                    enabled: event.target.value === "enabled",
                  }))
                }
              >
                <option value="disabled">Open to customers</option>
                <option value="enabled">Maintenance mode</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="maintenance-message">Customer message</Label>
              <Input
                id="maintenance-message"
                value={maintenance.message}
                onChange={(event) =>
                  setMaintenance((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                maxLength={500}
              />
            </div>
            <Button disabled={saving === "maintenance"}>
              {saving === "maintenance" ? (
                "Saving…"
              ) : (
                <>
                  <Save />
                  Save maintenance
                </>
              )}
            </Button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Admin access during maintenance:{" "}
            <span className="font-bold">
              {maintenance.allowAdmin ? "Allowed" : "Disabled by policy"}
            </span>
          </p>
        </CardContent>
      </Card>
      <div className="mt-7">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            Website and operational settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These values are stored in the database and reflected by the public
            site according to their visibility.
          </p>
        </div>
        <div className="mt-4 grid gap-4">
          {items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-slate-500">
                No settings have been seeded yet.
              </CardContent>
            </Card>
          ) : (
            items
              .filter(
                (item) =>
                  !item.key.startsWith("integration.") &&
                  !item.key.startsWith("maintenance.") &&
                  !item.key.startsWith("notification.toast."),
              )
              .map((item) => (
                <Card key={item.key}>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Settings2 size={16} className="text-[#003893]" />
                      {item.key}
                    </CardTitle>
                    <Badge variant="secondary">{item.group}</Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor={`setting-${item.key}`}>Value</Label>
                      <Input
                        id={`setting-${item.key}`}
                        className="mt-2"
                        value={item.value}
                        onChange={(event) =>
                          update(item.key, event.target.value)
                        }
                      />
                    </div>
                    <Button
                      disabled={saving === item.key}
                      onClick={() => save(item)}
                    >
                      <Save size={15} />
                      {saving === item.key ? "Saving" : "Save"}
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
