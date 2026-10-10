"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, GripVertical, Globe2, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AdminHomepageSection,
  AdminWebsiteAsset,
  createAdminWebsiteAsset,
  getAdminHomepageSections,
  getAdminWebsiteAssets,
  updateAdminHomepageSection,
  uploadAdminMedia,
} from "@/services/api";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UniversalImageUploader } from "@/components/universal-image-uploader";

type AssetDraft = {
  kind: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  mobileImageUrl: string;
  buttonText: string;
  destination: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  enabled: boolean;
  mobileEnabled: boolean;
  desktopEnabled: boolean;
};

type TrustImageKey = "information" | "verification" | "delivery";

const defaultTrustImages: Record<TrustImageKey, string> = {
  information: "/trust-product-information.png",
  verification: "/trust-verification.png",
  delivery: "/trust-delivery-nepal.png",
};

const trustImageLabels: Record<TrustImageKey, string> = {
  information: "Clear product information",
  verification: "How verification works",
  delivery: "Delivering across Nepal",
};

function readTrustImages(contentJson?: string): Record<TrustImageKey, string> {
  if (!contentJson) return defaultTrustImages;
  try {
    const parsed = JSON.parse(contentJson) as Record<string, unknown>;
    return {
      information: typeof parsed.imageInformation === "string" ? parsed.imageInformation : defaultTrustImages.information,
      verification: typeof parsed.imageVerification === "string" ? parsed.imageVerification : defaultTrustImages.verification,
      delivery: typeof parsed.imageDelivery === "string" ? parsed.imageDelivery : defaultTrustImages.delivery,
    };
  } catch {
    return defaultTrustImages;
  }
}

function writeTrustImages(images: Record<TrustImageKey, string>, existingContentJson?: string) {
  let existing: Record<string, unknown> = {};
  try {
    const parsed = existingContentJson ? JSON.parse(existingContentJson) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existing = parsed as Record<string, unknown>;
  } catch {
    // Preserve the valid trust image payload even if older free-form JSON was malformed.
  }
  return JSON.stringify({
    ...existing,
    imageInformation: images.information,
    imageVerification: images.verification,
    imageDelivery: images.delivery,
  });
}

const emptyAsset: AssetDraft = {
  kind: "HERO",
  title: "",
  subtitle: "",
  description: "",
  imageUrl: "",
  mobileImageUrl: "",
  buttonText: "Shop medicines",
  destination: "/products",
  startsAt: "",
  endsAt: "",
  priority: 10,
  enabled: true,
  mobileEnabled: true,
  desktopEnabled: true,
};

export default function WebsiteManagementPage() {
  const [sections, setSections] = useState<AdminHomepageSection[]>([]);
  const [assets, setAssets] = useState<AdminWebsiteAsset[]>([]);
  const [asset, setAsset] = useState<AssetDraft>(emptyAsset);
  const [imageFile, setImageFile] = useState<File>();
  const [trustFiles, setTrustFiles] = useState<Partial<Record<TrustImageKey, File>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const token = () => window.localStorage.getItem("anhh-staff-access-token") ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const accessToken = token();
      Promise.all([getAdminHomepageSections(accessToken), getAdminWebsiteAssets(accessToken)])
        .then(([loadedSections, loadedAssets]) => {
          setSections(loadedSections);
          setAssets(loadedAssets);
        })
        .catch((cause: Error) => setError(cause.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const orderedSections = useMemo(
    () => sections.slice().sort((a, b) => a.displayOrder - b.displayOrder || a.sectionKey.localeCompare(b.sectionKey)),
    [sections],
  );

  function updateSection(id: string, patch: Partial<AdminHomepageSection>) {
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section));
  }

  async function saveSection(section: AdminHomepageSection) {
    setSaving(section.id);
    setError("");
    try {
      let contentJson = section.contentJson;
      if (section.sectionKey.toLowerCase() === "trust") {
        const images = readTrustImages(section.contentJson);
        for (const key of Object.keys(trustImageLabels) as TrustImageKey[]) {
          const file = trustFiles[key];
          if (file) {
            images[key] = (await uploadAdminMedia(file, "TRUST_BADGE", trustImageLabels[key], true, token())).url;
          }
        }
        contentJson = writeTrustImages(images, section.contentJson);
      }
      const updated = await updateAdminHomepageSection(section.id, {
        sectionKey: section.sectionKey,
        title: section.title,
        contentJson,
        displayOrder: section.displayOrder,
        enabled: section.enabled,
      }, token());
      setSections((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (section.sectionKey.toLowerCase() === "trust") setTrustFiles({});
      toast.success(`${section.title} updated`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Homepage section could not be saved.");
    } finally {
      setSaving("");
    }
  }

  function setAssetField<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) {
    setAsset((current) => ({ ...current, [key]: value }));
  }

  async function createAsset(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const imageUrl = imageFile
        ? (await uploadAdminMedia(imageFile, asset.kind, asset.title.trim(), true, token())).url
        : asset.imageUrl || undefined;
      const created = await createAdminWebsiteAsset({
        ...asset,
        imageUrl,
        priority: Number(asset.priority),
        startsAt: asset.startsAt ? new Date(asset.startsAt).toISOString() : undefined,
        endsAt: asset.endsAt ? new Date(asset.endsAt).toISOString() : undefined,
      }, token());
      setAssets((current) => [...current, created]);
      setAsset(emptyAsset);
      setImageFile(undefined);
      toast.success(`${created.kind} asset created`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Website asset could not be created.");
    }
  }

  return (
    <AdminShell superAdmin>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">Website control</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Homepage builder</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Manage the database-backed customer homepage. Save a section&apos;s order or visibility and the public website updates from the saved configuration.</p>
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
      {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading website controls…</div> : <>
        <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles size={18} className="text-[#DC143C]" />Homepage sections</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {orderedSections.map((section) => <div key={section.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[auto_1fr_100px_92px_auto] sm:items-end">
                <GripVertical className="mb-2 hidden text-slate-300 sm:block" size={18} aria-hidden="true" />
                <div className="grid gap-2">
                  <Label htmlFor={`section-${section.id}`}>{section.sectionKey}</Label>
                  <Input id={`section-${section.id}`} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} />
                  <Textarea value={section.contentJson ?? ""} onChange={(event) => updateSection(section.id, { contentJson: event.target.value })} placeholder="Optional JSON content" className="min-h-16 text-xs" />
                </div>
                {section.sectionKey.toLowerCase() === "trust" && <div className="grid gap-4 sm:col-span-5 sm:grid-cols-3">
                  {(Object.keys(trustImageLabels) as TrustImageKey[]).map((key) => {
                    const images = readTrustImages(section.contentJson);
                    return <UniversalImageUploader key={`${section.id}-${key}`} disabled={saving === section.id} uploadState={saving === section.id ? "uploading" : "idle"} label={trustImageLabels[key]} value={images[key]} onChange={(file) => setTrustFiles((current) => ({ ...current, [key]: file }))} onRemove={() => { setTrustFiles((current) => { const next = { ...current }; delete next[key]; return next; }); updateSection(section.id, { contentJson: writeTrustImages({ ...images, [key]: "" }, section.contentJson) }); }} helperText="Upload a matched transparent illustration. It will be saved to the shared media library." aspect="aspect-square" />;
                  })}
                </div>}
                <label className="flex items-center gap-2 pb-2 text-xs font-bold"><input type="checkbox" checked={section.enabled} onChange={(event) => updateSection(section.id, { enabled: event.target.checked })} /> Enabled</label>
                <div className="grid gap-2"><Label htmlFor={`order-${section.id}`}>Order</Label><Input id={`order-${section.id}`} type="number" min={0} value={section.displayOrder} onChange={(event) => updateSection(section.id, { displayOrder: Number(event.target.value) })} /></div>
                <Button disabled={saving === section.id} onClick={() => void saveSection(section)}>{saving === section.id ? <Loader2 className="animate-spin" /> : <Save />}Save</Button>
              </div>)}
              {!orderedSections.length && <p className="p-8 text-center text-sm text-slate-500">No homepage sections have been seeded.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 size={18} className="text-[#003893]" />Create hero or banner</CardTitle></CardHeader>
            <CardContent><form onSubmit={createAsset} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="asset-kind">Asset type</Label><select id="asset-kind" value={asset.kind} onChange={(event) => setAssetField("kind", event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="HERO">Hero slider</option><option value="BANNER">Promotional banner</option><option value="POPUP">Popup</option></select></div>
              <div className="grid gap-2"><Label htmlFor="asset-title">Title</Label><Input id="asset-title" required value={asset.title} onChange={(event) => setAssetField("title", event.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="asset-subtitle">Subtitle</Label><Input id="asset-subtitle" value={asset.subtitle} onChange={(event) => setAssetField("subtitle", event.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="asset-description">Description</Label><Textarea id="asset-description" value={asset.description} onChange={(event) => setAssetField("description", event.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="asset-button">Button text</Label><Input id="asset-button" value={asset.buttonText} onChange={(event) => setAssetField("buttonText", event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="asset-destination">Destination</Label><Input id="asset-destination" value={asset.destination} onChange={(event) => setAssetField("destination", event.target.value)} /></div></div>
              <UniversalImageUploader key={asset.imageUrl || "empty"} label="Asset image" accept={asset.kind === "LOGO" ? "image/svg+xml,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif" : undefined} value={asset.imageUrl} onChange={setImageFile} onRemove={() => { setImageFile(undefined); setAssetField("imageUrl", ""); }} helperText="Stored in the shared media library · SVG, JPG, PNG, WebP, GIF, BMP, or AVIF · maximum 8 MB" />
              <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="asset-priority">Priority</Label><Input id="asset-priority" type="number" value={asset.priority} onChange={(event) => setAssetField("priority", Number(event.target.value))} /></div><label className="flex items-center gap-2 pt-7 text-xs font-bold"><input type="checkbox" checked={asset.enabled} onChange={(event) => setAssetField("enabled", event.target.checked)} /> Active</label></div>
              <Button type="submit"><Eye size={16} />Publish asset</Button>
            </form></CardContent>
          </Card>
        </div>
        <Card className="mt-6"><CardHeader><CardTitle>Published and scheduled assets</CardTitle></CardHeader><CardContent className="grid gap-3">{assets.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><div className="flex items-center gap-2"><Badge>{item.kind}</Badge><p className="font-extrabold">{item.title}</p></div><p className="mt-1 text-xs text-slate-500">{item.destination ?? "No destination"} · Priority {item.priority}</p></div><Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "Active" : "Inactive"}</Badge></div>)}{!assets.length && <p className="p-8 text-center text-sm text-slate-500">No website assets have been created.</p>}</CardContent></Card>
      </>}
    </AdminShell>
  );
}
