"use client";

/* eslint-disable react-hooks/set-state-in-effect -- load the selected role's saved configuration after the browser session is available. */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Pencil, Plus, Save, Search, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getRoleSidebarConfig, saveRoleSidebarConfig, type AdminRoleSidebarMenuItem } from "@/services/api";
import { resolveSidebarIcon, SIDEBAR_ICONS } from "@/lib/sidebar-icons";

const roles = [
  ["SUPERADMIN", "Superadmin"],
  ["ADMIN", "Admin"],
  ["SUPERVISOR", "Supervisor"],
  ["ACCOUNTANT", "Accountant"],
  ["PHARMACIST", "Pharmacist"],
  ["DELIVERY", "Delivery"],
  ["SALES_EXECUTIVE", "Sales Executive"],
  ["SALES_MANAGER", "Sales Manager"],
  ["PURCHASE_INVENTORY_MANAGER", "Purchase / Inventory Manager"],
  ["HR_MANAGER", "HR Manager"],
  ["VIEWER_AUDITOR", "Viewer / Auditor"],
  ["EMPLOYEE", "Employee"],
] as const;

type EditableItem = Omit<AdminRoleSidebarMenuItem, "id" | "role">;

const starterItems: Record<string, EditableItem[]> = {
  SUPERADMIN: [
    ["Products", "/superadmin/products", "TAGS"], ["Dashboard", "/superadmin", "LAYOUT_DASHBOARD"], ["HRMS", "/superadmin/hrms", "USERS"],
    ["Attendance", "/attendance", "CALENDAR_DAYS"], ["Accounts", "/accounts", "CREDIT_CARD"], ["Orders", "/superadmin/orders", "STORE"],
    ["Customers", "/superadmin/customers", "USERS"], ["Website settings", "/superadmin/settings", "SETTINGS"], ["Reports", "/superadmin/reports", "BAR_CHART_3"],
  ].map(([label, href, icon], index) => ({ label, href, icon, displayOrder: (index + 1) * 10, isVisible: true })),
  ADMIN: [
    ["Dashboard", "/admin", "LAYOUT_DASHBOARD"], ["Orders", "/admin/orders", "STORE"], ["Products", "/admin/products", "TAGS"],
    ["Inventory", "/admin/inventory", "BOXES"], ["Customers", "/admin/customers", "USERS"], ["Reports", "/admin/reports", "BAR_CHART_3"],
  ].map(([label, href, icon], index) => ({ label, href, icon, displayOrder: (index + 1) * 10, isVisible: true })),
};

function normalize(items: EditableItem[]): EditableItem[] {
  // Keep the current array order. Reordering swaps array positions first, so
  // sorting here would immediately undo an Up/Down click using the old order.
  return items.map((item, index) => ({ ...item, displayOrder: (index + 1) * 10 }));
}

function normalizeLoaded(items: EditableItem[]): EditableItem[] {
  return normalize([...items].sort((a, b) => a.displayOrder - b.displayOrder));
}

export function RoleSidebarSettings() {
  const [role, setRole] = useState("SUPERADMIN");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [error, setError] = useState("");

  const token = typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
  const selected = selectedIndex === null ? null : items[selectedIndex];
  const filteredIcons = useMemo(
    () => SIDEBAR_ICONS.filter((item) => `${item.name} ${item.label}`.toLowerCase().includes(iconSearch.toLowerCase())).slice(0, 48),
    [iconSearch],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSelectedIndex(null);
    getRoleSidebarConfig(role, token, true)
      .then((rows) => {
        if (cancelled) return;
        setItems(normalizeLoaded(rows));
      })
      .catch((requestError: Error) => {
        if (cancelled) return;
        setItems(starterItems[role] ?? []);
        setError(requestError.message || "The sidebar configuration could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [role, token]);

  function updateSelected(patch: Partial<EditableItem>) {
    if (selectedIndex === null) return;
    setItems((current) => current.map((item, index) => index === selectedIndex ? { ...item, ...patch } : item));
  }

  function addItem() {
    const next = { label: "New menu item", href: "/", icon: "MENU", displayOrder: items.length * 10 + 10, isVisible: true };
    setItems((current) => [...current, next]);
    setSelectedIndex(items.length);
    setIconSearch("");
  }

  function removeItem(index: number) {
    setItems((current) => normalize(current.filter((_, itemIndex) => itemIndex !== index)));
    setSelectedIndex(null);
  }

  function toggleVisibility(index: number) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isVisible: !item.isVisible } : item));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return normalize(next);
    });
    setSelectedIndex(target);
  }

  async function save() {
    if (!items.every((item) => item.label.trim() && item.href.trim().startsWith("/") && !item.href.trim().startsWith("//"))) {
      toast.error("Every visible menu item needs a label and a local route.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveRoleSidebarConfig(role, normalize(items), token);
      setItems(normalize(saved));
      setSelectedIndex(null);
      toast.success(`${roles.find(([value]) => value === role)?.[1] ?? role} sidebar saved.`);
      setError("");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "The sidebar could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Superadmin settings</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Sidebar menu customization</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Configure an independent sidebar for each staff role. Changes are saved centrally and appear for that role after the next navigation refresh.</p>
        </div>
        <Button onClick={save} disabled={saving || loading}><Save />{saving ? "Saving…" : "Save sidebar"}</Button>
      </div>

      {error && <Alert className="border-amber-200 bg-amber-50 text-amber-900">The saved configuration could not be loaded. You can still edit the safe starter menu, then save it once the backend is available.</Alert>}

      <Card>
        <CardHeader><CardTitle>Choose role</CardTitle></CardHeader>
        <CardContent>
          <Label htmlFor="sidebar-role">Sidebar role</Label>
          <Select id="sidebar-role" className="mt-2 max-w-sm" value={role} onChange={(event) => setRole(event.target.value)}>
            {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <p className="mt-2 text-xs text-slate-500">Each role has its own saved menu. Customer account navigation is managed separately.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Menu items</CardTitle><Button size="sm" onClick={addItem}><Plus />Add item</Button></CardHeader>
          <CardContent>
            {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No menu items. Add the first item for this role.</div> : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  const Icon = resolveSidebarIcon(item.icon);
                  return <div key={`${item.href}-${index}`} className={`flex items-center gap-3 rounded-xl border p-3 ${selectedIndex === index ? "border-teal-400 bg-teal-50/50" : "border-slate-200"}`}>
                    <GripVertical size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
                    <Icon size={18} className="shrink-0 text-teal-700" />
                    <div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${item.isVisible ? "text-slate-800" : "text-slate-400 line-through"}`}>{item.label}</p><p className="truncate text-xs text-slate-500">{item.href}</p></div>
                    <Badge variant={item.isVisible ? "default" : "secondary"}>{item.isVisible ? "Visible" : "Hidden"}</Badge>
                    <Button size="icon-xs" variant="ghost" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Move ${item.label} up`} title="Move up"><ArrowUp /></Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${item.label} down`} title="Move down"><ArrowDown /></Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => toggleVisibility(index)} aria-label={`${item.isVisible ? "Hide" : "Show"} ${item.label}`} title={item.isVisible ? "Hide item" : "Show item"}>{item.isVisible ? <Eye /> : <EyeOff />}</Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => setSelectedIndex(index)} aria-label={`Edit ${item.label}`} title="Edit item"><Pencil /></Button>
                    <Button size="icon-xs" variant="ghost" className="text-rose-600" onClick={() => removeItem(index)} aria-label={`Remove ${item.label}`} title="Remove item"><Trash2 /></Button>
                  </div>;
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-6"><CardHeader><CardTitle>Live preview</CardTitle></CardHeader><CardContent>
          <div className="overflow-hidden rounded-2xl bg-[#003893] p-3 text-white shadow-xl">
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#002B6F] px-3 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#003893]"><Shield size={15} /></span><span className="text-[10px] font-extrabold uppercase tracking-widest">ANHH management</span></div>
            <nav className="grid gap-1" aria-label="Sidebar live preview">{items.filter((item) => item.isVisible).sort((a, b) => a.displayOrder - b.displayOrder).map((item) => { const Icon = resolveSidebarIcon(item.icon); return <div key={`${item.href}-preview`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"><Icon size={15} />{item.label}</div>; })}</nav>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Hidden items remain saved and can be shown again. Route access is still enforced by the backend permissions.</p>
        </CardContent></Card>
      </div>

      {selected && selectedIndex !== null && <Card><CardHeader><CardTitle>Edit menu item</CardTitle></CardHeader><CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div><Label htmlFor="sidebar-label">Label</Label><Input id="sidebar-label" className="mt-2" value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} maxLength={120} /></div>
          <div><Label htmlFor="sidebar-route">Local route</Label><Input id="sidebar-route" className="mt-2" value={selected.href} onChange={(event) => updateSelected({ href: event.target.value })} placeholder="/admin/products" /></div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-bold text-slate-800">Visibility</p><p className="text-xs text-slate-500">Show this item in the selected role sidebar.</p></div><Button variant={selected.isVisible ? "default" : "secondary"} onClick={() => updateSelected({ isVisible: !selected.isVisible })}>{selected.isVisible ? "Visible" : "Hidden"}</Button></div>
        </div>
        <div>
          <Label>Icon</Label><div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} /><Input value={iconSearch} onChange={(event) => setIconSearch(event.target.value)} className="pl-9" placeholder="Search icons" aria-label="Search sidebar icons" /></div>
          <div className="mt-3 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-6">{filteredIcons.map(({ name, label, Icon }) => <button key={name} type="button" title={label} aria-label={`Use ${label} icon`} onClick={() => updateSelected({ icon: name })} className={`flex flex-col items-center gap-1 rounded-lg p-2 text-[10px] font-semibold ${selected.icon === name ? "bg-teal-100 text-teal-800 ring-2 ring-teal-500" : "text-slate-500 hover:bg-slate-100"}`}><Icon size={18} /><span className="truncate max-w-full">{label}</span></button>)}</div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm">{(() => { const Icon = resolveSidebarIcon(selected.icon); return <Icon size={19} />; })()}</span><div><p className="text-sm font-bold text-slate-800">{selected.label || "Menu item"}</p><p className="text-xs text-slate-500">{selected.icon}</p></div></div>
        </div>
      </CardContent></Card>}
    </div>
  );
}
