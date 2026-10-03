"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, Layers3, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProductRackGroups, getProductRacks, saveProductRack, saveProductRackGroup, type ProductRack, type ProductRackGroup } from "@/services/api";
import type { PharmacyMenuAction } from "@/components/pharmacy-module-menu";

export function ProductRackSetupPanel({ action, token, superAdmin, onClose }: { action: PharmacyMenuAction; token: string; superAdmin: boolean; onClose: () => void }) {
  const groupMode = action.mode === "rack-groups";
  const [groups, setGroups] = useState<ProductRackGroup[]>([]);
  const [racks, setRacks] = useState<ProductRack[]>([]);
  const [editingId, setEditingId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSetup = useCallback(
    () => Promise.all([getProductRackGroups(token, superAdmin), getProductRacks(token, undefined, superAdmin)]),
    [superAdmin, token],
  );
  const load = useCallback(async () => {
    try {
      const [groupRows, rackRows] = await fetchSetup();
      setGroups(groupRows); setRacks(rackRows);
      setGroupId((current) => current || groupRows.find((row) => row.isActive)?.id || "");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rack setup could not be loaded."); }
    finally { setLoading(false); }
  }, [fetchSetup]);
  useEffect(() => {
    let active = true;
    fetchSetup()
      .then(([groupRows, rackRows]) => {
        if (!active) return;
        setGroups(groupRows); setRacks(rackRows);
        setGroupId((current) => current || groupRows.find((row) => row.isActive)?.id || "");
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Rack setup could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchSetup]);

  function reset() { setEditingId(""); setName(""); setCode(""); setActive(true); }
  function editGroup(row: ProductRackGroup) { setEditingId(row.id); setName(row.name); setCode(row.code ?? ""); setActive(row.isActive); }
  function editRack(row: ProductRack) { setEditingId(row.id); setGroupId(row.rackGroupId); setName(row.name); setCode(row.code ?? ""); setActive(row.isActive); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error(groupMode ? "Enter a rack-group name." : "Enter a rack name.");
    if (!groupMode && !groupId) return toast.error("Create or choose an active rack group first.");
    setSaving(true);
    try {
      if (groupMode) await saveProductRackGroup(token, { id: editingId || undefined, name: name.trim(), code: code.trim() || undefined, isActive: active }, superAdmin);
      else await saveProductRack(token, { id: editingId || undefined, rackGroupId: groupId, name: name.trim(), code: code.trim() || undefined, isActive: active }, superAdmin);
      toast.success(editingId ? "Rack setup updated." : "Rack setup saved."); reset(); setLoading(true); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rack setup could not be saved."); }
    finally { setSaving(false); }
  }

  const listedRacks = racks.filter((rack) => !groupId || rack.rackGroupId === groupId);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Product setup</p><h2 className="mt-1 text-2xl font-extrabold">{action.title}</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">Create reusable storage groups and rack locations. Assign racks to medicines in Inventory → Medicine master; stock registers then display the saved location.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={15} />Refresh</Button><Button variant="outline" onClick={onClose}>Back to module</Button></div></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2">{groupMode ? <Layers3 size={17} /> : <Boxes size={17} />}{editingId ? "Edit saved record" : groupMode ? "Create rack group" : "Create rack"}</CardTitle></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {!groupMode && <label className="grid gap-1.5 text-xs font-bold text-slate-600">Rack group<Select value={groupId} onChange={(event) => setGroupId(event.target.value)} required><option value="">Select active group</option>{groups.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>}
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">{groupMode ? "Rack group name" : "Rack name"}<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-600">Code (optional)<Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Active</label>
          <div className="flex gap-2"><Button type="submit" disabled={saving || loading || (!groupMode && !groups.some((row) => row.isActive))}><Save size={15} />{saving ? "Saving…" : editingId ? "Save changes" : "Save"}</Button>{editingId && <Button type="button" variant="outline" onClick={reset}>Cancel edit</Button>}</div>
          {!groupMode && !groups.some((row) => row.isActive) && <p className="text-xs text-amber-700">Create an active rack group before adding rack locations.</p>}
        </form>
      </CardContent></Card>
      {groupMode ? <Card><CardHeader><CardTitle>Saved rack groups <Badge variant="secondary" className="ml-2">{groups.length}</Badge></CardTitle></CardHeader><CardContent><div className="divide-y">{groups.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-bold">{row.name}</p><p className="text-xs text-slate-500">{row.code || "No code"} · {row.rackCount} rack(s)</p></div><Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge><Button size="sm" variant="outline" onClick={() => editGroup(row)}>Edit</Button></div>)}{!groups.length && <p className="py-8 text-center text-sm text-slate-500">No rack groups have been configured.</p>}</div></CardContent></Card> : <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-3">Saved rack locations <Badge variant="secondary">{listedRacks.length}</Badge><Select className="ml-auto max-w-xs" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">All groups</option>{groups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></CardTitle></CardHeader><CardContent><div className="divide-y">{listedRacks.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-bold">{row.rackGroup} · {row.name}</p><p className="text-xs text-slate-500">{row.code || "No code"} · {row.productCount} product(s)</p></div><Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge><Button size="sm" variant="outline" onClick={() => editRack(row)}>Edit</Button></div>)}{!listedRacks.length && <p className="py-8 text-center text-sm text-slate-500">No rack locations in this group yet.</p>}</div></CardContent></Card>}
    </div>
  </section>;
}
