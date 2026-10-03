"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { FloatingContactWidget } from "@/components/floating-contact-widget";
import { useSiteConfig } from "@/components/site-config-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getAdminHomepageSections,
  getAdminSettings,
  saveAdminSetting,
  uploadAdminMedia,
  resolveMediaUrl,
  updateAdminHomepageSection,
  type AdminHomepageSection,
} from "@/services/api";
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
import {
  defaultMarquee,
  defaultContactWidget,
  defaultSiteDesign,
  parseContactWidget,
  parseMarquee,
  parseSiteDesign,
  type AnnouncementMessage,
  type ContactWidgetItem,
  type ContactWidgetSettings,
  type MarqueeSettings,
  type SiteDesignSettings,
} from "@/lib/site-design";
import { dateTimeInputToUtc, utcToDateTimeInput } from "@/lib/date-time";

type Panel = "branding" | "colors" | "typography" | "interactions" | "contact" | "marquee" | "sections";
const colorFields: [keyof SiteDesignSettings, string][] = [
  ["primary", "Primary"],
  ["primaryDark", "Primary dark"],
  ["primaryLight", "Primary light"],
  ["secondary", "Secondary"],
  ["secondaryDark", "Secondary dark"],
  ["secondaryLight", "Secondary light"],
  ["background", "Background"],
  ["surface", "Surface"],
  ["surfaceSecondary", "Surface secondary"],
  ["textPrimary", "Text primary"],
  ["textSecondary", "Text secondary"],
  ["border", "Border"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
  ["info", "Info"],
];
const fontOptions = [
  { value: "Geist", label: "Geist", description: "Crisp, modern interface sans", sample: "All Nepal Healthy Home" },
  { value: "Inter", label: "Inter", description: "Friendly and highly readable", sample: "Trusted pharmacy care" },
  { value: "Arial", label: "Arial", description: "Familiar and dependable", sample: "Healthcare delivered" },
  { value: "system-ui", label: "System UI", description: "Uses the visitor’s native UI font", sample: "Everyday wellness" },
] as const;
const textAnimations = [
  "NONE",
  "FADE",
  "FADE_UP",
  "FADE_DOWN",
  "FADE_LEFT",
  "FADE_RIGHT",
  "SLIDE_UP",
  "SLIDE_DOWN",
  "SLIDE_LEFT",
  "SLIDE_RIGHT",
  "SOFT_REVEAL",
  "ZOOM_IN",
  "BLUR_REVEAL",
  "WORD_REVEAL",
  "LETTER_REVEAL",
  "CHARACTER_REVEAL",
  "TYPEWRITER",
];
const imageAnimations = [
  "NONE",
  "FADE",
  "FADE_UP",
  "FADE_DOWN",
  "FADE_LEFT",
  "FADE_RIGHT",
  "SOFT_SCALE",
  "ZOOM_IN",
  "ZOOM_OUT",
  "KEN_BURNS",
  "SUBTLE_PARALLAX",
  "SCALE_FADE",
];

function token() {
  return typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");
}
function validHex(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

function DesignSettingsPage() {
  const superAdmin = typeof window === "undefined" ? true : !window.location.pathname.startsWith("/admin/");
  const { design: liveDesign, marquee: liveMarquee } = useSiteConfig();
  const [panel, setPanel] = useState<Panel>("colors");
  const [design, setDesign] = useState<SiteDesignSettings>(liveDesign);
  const [marquee, setMarquee] = useState<MarqueeSettings>(liveMarquee);
  const [contactWidget, setContactWidget] = useState<ContactWidgetSettings>(defaultContactWidget);
  const [sections, setSections] = useState<AdminHomepageSection[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoProgress, setLogoProgress] = useState(0);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [removeLogoOpen, setRemoveLogoOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionSaving, setSectionSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const accessToken = token();
      Promise.all([
        getAdminSettings(accessToken, superAdmin),
        getAdminHomepageSections(accessToken, superAdmin),
      ])
        .then(([settings, rows]) => {
          const designSetting = settings.find(
            (item) => item.key === "website.design",
          );
          const marqueeSetting = settings.find(
            (item) => item.key === "website.marquee",
          );
          const contactWidgetSetting = settings.find(
            (item) => item.key === "website.contactWidget",
          );
          const logoSetting = settings.find((item) => item.key === "website.logoUrl");
          if (designSetting)
            try {
              setDesign(parseSiteDesign(designSetting.value));
            } catch {
              /* the public provider safely uses defaults */
            }
          if (marqueeSetting)
            try {
              setMarquee(parseMarquee(marqueeSetting.value));
            } catch {
              /* the public provider safely uses defaults */
            }
          if (contactWidgetSetting)
            try {
              setContactWidget(parseContactWidget(contactWidgetSetting.value));
            } catch {
              /* the public provider safely uses defaults */
            }
          setLogoUrl(logoSetting?.value ?? "");
          setSections(rows.sort((a, b) => a.displayOrder - b.displayOrder));
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [superAdmin]);
  function setDesignField<K extends keyof SiteDesignSettings>(
    key: K,
    value: SiteDesignSettings[K],
  ) {
    setDesign((current) => ({ ...current, [key]: value }));
  }
  function setMarqueeField<K extends keyof MarqueeSettings>(
    key: K,
    value: MarqueeSettings[K],
  ) {
    setMarquee((current) => ({ ...current, [key]: value }));
  }
  function setContactWidgetField<K extends keyof ContactWidgetSettings>(
    key: K,
    value: ContactWidgetSettings[K],
  ) {
    setContactWidget((current) => ({ ...current, [key]: value }));
  }
  function updateContactItem(id: string, patch: Partial<ContactWidgetItem>) {
    setContactWidgetField(
      "items",
      contactWidget.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    );
  }
  function addContactItem() {
    const nextOrder = contactWidget.items.reduce((max, item) => Math.max(max, item.displayOrder), 0) + 1;
    setContactWidgetField("items", [...contactWidget.items, { id: `contact-${Date.now()}`, type: "CALL", label: "New contact", value: "", color: "#003893", enabled: true, displayOrder: nextOrder }]);
  }
  function moveContactItem(id: string, direction: -1 | 1) {
    const ordered = [...contactWidget.items].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const currentOrder = ordered[index].displayOrder;
    ordered[index] = { ...ordered[index], displayOrder: ordered[target].displayOrder };
    ordered[target] = { ...ordered[target], displayOrder: currentOrder };
    setContactWidgetField("items", ordered);
  }
  async function saveAll() {
    setError("");
    const invalid = colorFields.find(([key]) => !validHex(String(design[key])));
    if (invalid) {
      setError(`${invalid[1]} must be a valid six-digit HEX color.`);
      setPanel("colors");
      return;
    }
    const invalidAnnouncement = marquee.messages.find((item) => {
      if (item.active && !item.message.trim()) return true;
      if (item.displayOrder < 0 || !Number.isInteger(item.displayOrder)) return true;
      if (item.startDate && item.endDate && new Date(item.endDate) <= new Date(item.startDate)) return true;
      if (!item.linkUrl?.trim()) return false;
      const url = item.linkUrl.trim();
      return url.startsWith("//") || (!url.startsWith("/") && !/^https?:\/\//i.test(url));
    });
    if (invalidAnnouncement) {
      setError("Check each announcement: active messages need text, order must be a whole number, dates must be valid, and links must be local paths or HTTP(S) URLs.");
      setPanel("marquee");
      return;
    }
    if (marquee.enabled && !marquee.messages.some((item) => item.active && item.message.trim())) {
      setError("Add at least one active announcement message before enabling the bar.");
      setPanel("marquee");
      return;
    }
    if (marquee.height < 28 || marquee.height > 64 || marquee.fontSize < 11 || marquee.fontSize > 18) {
      setError("Announcement height must be 28–64 px and font size must be 11–18 px.");
      setPanel("marquee");
      return;
    }
    setSaving(true);
    try {
      await saveAdminSetting(
        "website.design",
        {
          value: JSON.stringify(design),
          group: "website-design",
          isPublic: true,
          description:
            "Customer website design tokens and safe interaction defaults.",
        },
        token(),
        superAdmin,
      );
      await saveAdminSetting(
        "website.marquee",
        {
          value: JSON.stringify(marquee),
          group: "website-design",
          isPublic: true,
          description: "Customer announcement marquee configuration.",
        },
        token(),
        superAdmin,
      );
      await saveAdminSetting(
        "website.contactWidget",
        {
          value: JSON.stringify(contactWidget),
          group: "website-design",
          isPublic: true,
          description: "Floating customer contact widget configuration.",
        },
        token(),
        superAdmin,
      );
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Website design saved.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Website design could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  function addMessage() {
    const id = `message-${Date.now()}`;
    setMarqueeField("messages", [
      ...marquee.messages,
      {
        id,
        message: "",
        displayOrder: marquee.messages.length + 1,
        direction: "LEFT",
        speed: "SLOW",
        pauseOnHover: true,
        active: true,
      },
    ]);
  }
  function updateMessage(id: string, patch: Partial<AnnouncementMessage>) {
    setMarqueeField(
      "messages",
      marquee.messages.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(
      next.map((item, rowIndex) => ({
        ...item,
        displayOrder: (rowIndex + 1) * 10,
      })),
    );
  }
  async function saveSection(section: AdminHomepageSection) {
    setSectionSaving(section.id);
    try {
      const updated = await updateAdminHomepageSection(
        section.id,
        {
          sectionKey: section.sectionKey,
          title: section.title,
          contentJson: section.contentJson,
          displayOrder: section.displayOrder,
          enabled: section.enabled,
        },
        token(),
        superAdmin,
      );
      setSections((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.displayOrder - b.displayOrder),
      );
      toast.success(`${section.title} saved.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Section could not be saved.",
      );
    } finally {
      setSectionSaving("");
    }
  }
  async function saveAllSections() {
    setSectionSaving("all");
    try {
      const updated = await Promise.all(
        sections.map((section) =>
          updateAdminHomepageSection(
            section.id,
            {
              sectionKey: section.sectionKey,
              title: section.title,
              contentJson: section.contentJson,
              displayOrder: section.displayOrder,
              enabled: section.enabled,
            },
            token(),
            superAdmin,
          ),
        ),
      );
      setSections(updated.sort((a, b) => a.displayOrder - b.displayOrder));
      toast.success("Homepage section order saved.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Homepage section order could not be saved.",
      );
    } finally {
      setSectionSaving("");
    }
  }
  const logoFilePreview = useMemo(
    () => logoFile ? URL.createObjectURL(logoFile) : "",
    [logoFile],
  );
  useEffect(() => () => {
    if (logoFilePreview) URL.revokeObjectURL(logoFilePreview);
  }, [logoFilePreview]);
  function openWebsitePreview() {
    const previewId = window.crypto.randomUUID();
    const storageKey = `anhh-design-preview:${previewId}`;
    window.localStorage.setItem(storageKey, JSON.stringify({ design, marquee, contactWidget, logoUrl, createdAt: Date.now() }));
    const previewTab = window.open(`/?designPreview=${encodeURIComponent(previewId)}`, "_blank");
    if (!previewTab) {
      window.localStorage.removeItem(storageKey);
      toast.error("The preview tab was blocked. Allow pop-ups for this site and try again.");
    } else {
      previewTab.opener = null;
    }
  }
  function chooseLogo(candidate?: File) {
    setLogoError("");
    if (!candidate) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"];
    if (!allowedTypes.includes(candidate.type)) {
      setLogoError("Choose a JPG, PNG, WebP, GIF, BMP, or AVIF logo image.");
      return;
    }
    if (candidate.size > 8 * 1024 * 1024) {
      setLogoError("Logo images must be 8 MB or smaller.");
      return;
    }
    setLogoFile(candidate);
  }
  async function uploadLogo() {
    if (!logoFile) {
      setLogoError("Choose an image before uploading.");
      return;
    }
    setLogoSaving(true);
    setLogoProgress(0);
    setLogoError("");
    try {
      const asset = await uploadAdminMedia(logoFile, "LOGO", "Website logo", true, token(), superAdmin, setLogoProgress);
      await saveAdminSetting("website.logoUrl", {
        value: asset.url,
        group: "website-branding",
        isPublic: true,
        description: "Public managed media URL for the customer website logo.",
      }, token(), superAdmin);
      setLogoUrl(asset.url);
      setLogoFile(null);
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Website logo uploaded and saved.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The logo could not be uploaded.";
      setLogoError(message);
      toast.error(message);
    } finally {
      setLogoSaving(false);
    }
  }
  async function removeLogo() {
    setLogoSaving(true);
    setLogoError("");
    try {
      await saveAdminSetting("website.logoUrl", {
        value: "",
        group: "website-branding",
        isPublic: true,
        description: "Public managed media URL for the customer website logo.",
      }, token(), superAdmin);
      setLogoUrl("");
      window.dispatchEvent(new Event("anhh:site-config-changed"));
      toast.success("Logo removed from the website. The media file remains available in the library.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The logo could not be removed.";
      setLogoError(message);
      toast.error(message);
    } finally {
      setLogoSaving(false);
      setRemoveLogoOpen(false);
    }
  }
  const previewMessages = useMemo(
    () => marquee.messages.filter((item) => item.active && item.message.trim()),
    [marquee.messages],
  );
  if (loading)
    return (
      <AdminShell superAdmin={superAdmin}>
        <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Loading design settings…
        </div>
      </AdminShell>
    );
  return (
    <AdminShell superAdmin={superAdmin}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={superAdmin ? "/superadmin/website" : "/admin"}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)]"
          >
            <ArrowLeft size={16} />
            Website control
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            Design settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Tune the customer website’s colors, typography, motion,
            announcements and homepage order. Every value is stored in the
            database.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            variant="ghost"
            onClick={() => {
              setDesign(defaultSiteDesign);
              setMarquee(defaultMarquee);
              toast.success("Default design loaded. Save changes to apply it.");
            }}
          >
            Reset defaults
          </Button>
          <Button variant="outline" onClick={openWebsitePreview}>
            <Eye size={16} />
            Preview website
          </Button>
          <Button onClick={() => void saveAll()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save size={16} />}
            Save changes
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-7 grid gap-6 xl:grid-cols-[210px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardContent className="grid gap-1 p-3">
            {(
              [
                ["branding", "Website logo"],
                ["colors", "Colors"],
                ["typography", "Typography"],
                ["interactions", "Hover & header"],
                ["contact", "Contact widget"],
                ["marquee", "Announcement bar"],
                ["sections", "Homepage sections"],
              ] as [Panel, string][]
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={panel === value ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setPanel(value)}
              >
                {label}
              </Button>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-6">
          {panel === "branding" && (
            <Card>
              <CardHeader>
                <CardTitle>Website logo</CardTitle>
                <p className="text-sm text-slate-500">
                  Upload a public logo used in the customer website header and footer. The logo and its managed-media URL are saved to the database.
                </p>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="grid min-h-60 place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  {logoFilePreview || logoUrl ? (
                    <Image
                      src={resolveMediaUrl(logoFilePreview || logoUrl) ?? ""}
                      alt={logoFile ? "Selected website logo preview" : "Current website logo"}
                      width={480}
                      height={240}
                      unoptimized
                      className="max-h-48 w-full max-w-md object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-2xl font-black text-slate-300">LOGO</div>
                      <p className="mt-3 text-sm font-bold text-slate-700">No website logo configured</p>
                      <p className="mt-1 text-xs text-slate-500">Choose a logo file to add one.</p>
                    </div>
                  )}
                </div>
                <div className="grid content-start gap-4">
                  <div className={`rounded-xl border p-4 ${logoUrl ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                    <p className={`text-sm font-extrabold ${logoUrl ? "text-emerald-800" : "text-amber-900"}`}>
                      {logoUrl ? "Current logo is active" : "No logo is currently displayed"}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-600">Managed media location</p>
                    <code className="mt-1 block break-all rounded-lg bg-white/80 p-2 text-[11px] text-slate-700">
                      {logoUrl || "No public media URL saved"}
                    </code>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif"
                    className="sr-only"
                    aria-label="Choose website logo image"
                    onChange={(event) => chooseLogo(event.target.files?.[0])}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoSaving}>
                      {logoUrl ? "Choose replacement" : "Choose logo"}
                    </Button>
                    <Button type="button" onClick={() => void uploadLogo()} disabled={!logoFile || logoSaving}>
                      {logoSaving ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                      {logoSaving ? `Saving ${logoProgress}%` : "Upload and save logo"}
                    </Button>
                    {logoUrl && <Button type="button" variant="outline" onClick={() => setRemoveLogoOpen(true)} disabled={logoSaving}>Remove logo</Button>}
                  </div>
                  {logoFile && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs">
                      <span className="min-w-0 truncate font-bold text-blue-900">Selected: {logoFile.name} · {(logoFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoFile(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}>Clear</Button>
                    </div>
                  )}
                  {logoSaving && <div className="grid gap-2" aria-live="polite"><div className="flex justify-between text-xs font-semibold text-slate-600"><span>Uploading and saving logo…</span><span>{logoProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-700 transition-[width]" style={{ width: `${logoProgress}%` }} /></div></div>}
                  <p className="text-xs leading-5 text-slate-500">JPG, PNG, WebP, GIF, BMP, or AVIF · maximum 8 MB. Removing the logo clears its website assignment; the original media asset remains recoverable in the media library.</p>
                  {logoError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{logoError}</p>}
                </div>
              </CardContent>
            </Card>
          )}
          {panel === "colors" && (
            <Card>
              <CardHeader>
                <CardTitle>Semantic color palette</CardTitle>
                <p className="text-sm text-slate-500">
                  Use HEX values only. Components consume these shared tokens.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {colorFields.map(([key, label]) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={`color-${key}`}>{label}</Label>
                    <div className="flex gap-2">
                      <input
                        id={`color-${key}`}
                        type="color"
                        value={
                          validHex(String(design[key]))
                            ? String(design[key])
                            : "#ffffff"
                        }
                        onChange={(event) =>
                          setDesignField(key, event.target.value as never)
                        }
                        className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                      />
                      <Input
                        value={String(design[key])}
                        onChange={(event) =>
                          setDesignField(key, event.target.value as never)
                        }
                        aria-label={`${label} HEX`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {panel === "typography" && (
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <p className="text-sm text-slate-500">
                  Safe, curated values keep the customer site readable.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Site-wide font</Label>
                  <p className="mt-1 text-xs text-slate-500">Choose one font for the customer site and every protected workspace.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {fontOptions.map((font) => {
                      const selected = design.fontFamily === font.value;
                      const previewFamily = font.value === "Geist" ? "var(--font-geist-sans), Arial, sans-serif" : font.value === "Inter" ? "var(--font-inter), Arial, sans-serif" : font.value;
                      return <button key={font.value} type="button" aria-pressed={selected} onClick={() => setDesignField("fontFamily", font.value)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#003893] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`} style={{ fontFamily: previewFamily }}><span className="flex items-center justify-between gap-3"><span className="text-sm font-extrabold">{font.label}</span>{selected && <Badge>Selected</Badge>}</span><span className="mt-2 block text-lg font-semibold text-slate-900">{font.sample}</span><span className="mt-1 block text-xs text-slate-500" style={{ fontFamily: "var(--font-inter), Arial, sans-serif" }}>{font.description}</span></button>;
                    })}
                  </div>
                </div>
                <NumberField
                  label="Base font size"
                  value={design.baseFontSize}
                  min={14}
                  max={18}
                  onChange={(value) => setDesignField("baseFontSize", value)}
                />
                <NumberField
                  label="Heading weight"
                  value={design.headingWeight}
                  min={400}
                  max={800}
                  step={100}
                  onChange={(value) => setDesignField("headingWeight", value)}
                />
                <NumberField
                  label="Body weight"
                  value={design.bodyWeight}
                  min={300}
                  max={600}
                  step={100}
                  onChange={(value) => setDesignField("bodyWeight", value)}
                />
                <NumberField
                  label="Button weight"
                  value={design.buttonWeight}
                  min={400}
                  max={800}
                  step={100}
                  onChange={(value) => setDesignField("buttonWeight", value)}
                />
                <Field label="Heading letter spacing">
                  <Input
                    value={design.headingLetterSpacing}
                    onChange={(event) =>
                      setDesignField("headingLetterSpacing", event.target.value)
                    }
                  />
                </Field>
                <NumberField
                  label="Body line height"
                  value={design.bodyLineHeight}
                  min={1.2}
                  max={2}
                  step={0.05}
                  onChange={(value) => setDesignField("bodyLineHeight", value)}
                />
                <NumberField
                  label="Heading line height"
                  value={design.headingLineHeight}
                  min={1}
                  max={1.5}
                  step={0.05}
                  onChange={(value) =>
                    setDesignField("headingLineHeight", value)
                  }
                />
                <Field label="Text animation">
                  <Select
                    value={design.heroTextAnimation}
                    onChange={(event) =>
                      setDesignField("heroTextAnimation", event.target.value)
                    }
                  >
                    {textAnimations.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Image animation">
                  <Select
                    value={design.heroImageAnimation}
                    onChange={(event) =>
                      setDesignField("heroImageAnimation", event.target.value)
                    }
                  >
                    {imageAnimations.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <NumberField
                  label="Text duration (ms)"
                  value={design.textDuration}
                  min={0}
                  max={2000}
                  step={50}
                  onChange={(value) => setDesignField("textDuration", value)}
                />
                <NumberField
                  label="Text delay (ms)"
                  value={design.textDelay}
                  min={0}
                  max={1000}
                  step={50}
                  onChange={(value) => setDesignField("textDelay", value)}
                />
                <NumberField
                  label="Image duration (ms)"
                  value={design.imageDuration}
                  min={0}
                  max={2000}
                  step={50}
                  onChange={(value) => setDesignField("imageDuration", value)}
                />
                <NumberField
                  label="Image delay (ms)"
                  value={design.imageDelay}
                  min={0}
                  max={1000}
                  step={50}
                  onChange={(value) => setDesignField("imageDelay", value)}
                />
                <Field label="Animation easing">
                  <Select
                    value={design.animationEasing}
                    onChange={(event) =>
                      setDesignField(
                        "animationEasing",
                        event.target
                          .value as SiteDesignSettings["animationEasing"],
                      )
                    }
                  >
                    {[
                      "ease",
                      "ease-in",
                      "ease-out",
                      "ease-in-out",
                      "linear",
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                </Field>
              </CardContent>
            </Card>
          )}
          {panel === "interactions" && (
            <Card>
              <CardHeader>
                <CardTitle>Hover and header defaults</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Hover style">
                  <Select
                    value={design.hoverStyle}
                    onChange={(event) =>
                      setDesignField(
                        "hoverStyle",
                        event.target.value as SiteDesignSettings["hoverStyle"],
                      )
                    }
                  >
                    {[
                      "NONE",
                      "COLOR_CHANGE",
                      "UNDERLINE",
                      "LIFT",
                      "SOFT_SCALE",
                      "BORDER_HIGHLIGHT",
                      "IMAGE_ZOOM",
                      "COMBINED_SUBTLE",
                    ].map((item) => (
                      <option key={item}>{item.replaceAll("_", " ")}</option>
                    ))}
                  </Select>
                </Field>
                <NumberField
                  label="Hover duration (ms)"
                  value={design.hoverDuration}
                  min={0}
                  max={500}
                  step={50}
                  onChange={(value) => setDesignField("hoverDuration", value)}
                />
                <NumberField
                  label="Hover scale"
                  value={design.hoverScale}
                  min={1}
                  max={1.05}
                  step={0.01}
                  onChange={(value) => setDesignField("hoverScale", value)}
                />
                <NumberField
                  label="Button radius (px)"
                  value={design.buttonRadius}
                  min={0}
                  max={24}
                  onChange={(value) => setDesignField("buttonRadius", value)}
                />
                <NumberField
                  label="Button height (px)"
                  value={design.buttonHeight}
                  min={36}
                  max={56}
                  onChange={(value) => setDesignField("buttonHeight", value)}
                />
                <NumberField
                  label="Card radius (px)"
                  value={design.cardRadius}
                  min={0}
                  max={28}
                  onChange={(value) => setDesignField("cardRadius", value)}
                />
                <Field label="Card shadow">
                  <Select
                    value={design.cardShadow}
                    onChange={(event) =>
                      setDesignField(
                        "cardShadow",
                        event.target.value as SiteDesignSettings["cardShadow"],
                      )
                    }
                  >
                    <option>NONE</option>
                    <option>SOFT</option>
                    <option>MEDIUM</option>
                  </Select>
                </Field>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <Checkbox
                    checked={design.headerSticky}
                    onChange={(event) =>
                      setDesignField("headerSticky", event.target.checked)
                    }
                  />
                  <Label>Keep the customer header sticky</Label>
                </div>
                <div className="grid gap-2">
                  <Label>Header background</Label>
                  <Input
                    type="color"
                    value={design.headerBackground}
                    onChange={(event) =>
                      setDesignField("headerBackground", event.target.value)
                    }
                  />
                </div>
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4">
                  <Label>Management side navigation</Label>
                  <p className="mt-1 text-xs text-slate-500">This applies to SuperAdmin, Admin, Supervisor, Pharmacist and Delivery workspaces.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(["LEFT", "RIGHT"] as const).map((position) => <button key={position} type="button" aria-pressed={design.sideNavPosition === position} onClick={() => setDesignField("sideNavPosition", position)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${design.sideNavPosition === position ? "border-[#003893] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200"}`}><span className={`flex h-12 w-20 gap-1 rounded-lg border border-slate-200 bg-white p-1 ${position === "RIGHT" ? "flex-row-reverse" : ""}`}><span className="w-4 rounded bg-[#003893]" /><span className="flex-1 rounded bg-slate-100" /></span><span><span className="block text-sm font-extrabold">{position === "LEFT" ? "Left side" : "Right side"}</span><span className="text-xs text-slate-500">{design.sideNavPosition === position ? "Selected" : "Use this layout"}</span></span></button>)}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Header active color</Label>
                  <Input
                    type="color"
                    value={design.headerActive}
                    onChange={(event) =>
                      setDesignField("headerActive", event.target.value)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {panel === "contact" && (
            <Card>
              <CardHeader>
                <CardTitle>Floating contact widget</CardTitle>
                <p className="text-sm text-slate-500">
                  Configure the fixed contact buttons shown on the customer website. Items are stacked with no gap and remain visible while scrolling.
                </p>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold">
                    <Checkbox checked={contactWidget.enabled} onChange={(event) => setContactWidgetField("enabled", event.target.checked)} />
                    Enable widget
                  </label>
                  <Field label="Screen side">
                    <Select value={contactWidget.side} onChange={(event) => setContactWidgetField("side", event.target.value as ContactWidgetSettings["side"])}>
                      <option value="LEFT">Left</option>
                      <option value="RIGHT">Right</option>
                    </Select>
                  </Field>
                  <Field label="Vertical position">
                    <Select value={contactWidget.verticalPosition} onChange={(event) => setContactWidgetField("verticalPosition", event.target.value as ContactWidgetSettings["verticalPosition"])}>
                      <option value="CENTER">Center of screen</option>
                      <option value="BOTTOM">Near bottom</option>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900">Contact buttons</h3>
                      <p className="mt-1 text-xs text-slate-500">Use phone numbers, email addresses or service links. Blank destinations are shown disabled until configured.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addContactItem}><Plus size={16} />Add contact</Button>
                  </div>
                  {contactWidget.items.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((item, index, ordered) => (
                    <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[110px_1fr_1.4fr_1fr_110px_auto] lg:items-end">
                      <Field label="Type">
                        <Select value={item.type} onChange={(event) => updateContactItem(item.id, { type: event.target.value })}>
                          <option value="CALL">Call</option>
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="EMAIL">Email</option>
                          <option value="MESSAGE">Message</option>
                          <option value="VIBER">Viber</option>
                        </Select>
                      </Field>
                      <Field label="Label"><Input value={item.label} onChange={(event) => updateContactItem(item.id, { label: event.target.value })} placeholder="Call us" /></Field>
                      <Field label={item.type.toUpperCase() === "EMAIL" || item.type.toUpperCase() === "MESSAGE" ? "Email address" : item.type.toUpperCase() === "WHATSAPP" ? "WhatsApp number or chat link" : item.type.toUpperCase() === "VIBER" ? "Mobile number" : "Phone number"}><Input value={item.value} onChange={(event) => updateContactItem(item.id, { value: event.target.value })} placeholder={item.type.toUpperCase() === "EMAIL" ? "hello@example.com" : item.type.toUpperCase() === "WHATSAPP" ? "9800000000 or https://wa.me/9779800000000" : "9800000000"} /></Field>
                      <Field label={item.type.toUpperCase() === "WHATSAPP" ? "Pre-filled message" : item.type.toUpperCase() === "EMAIL" || item.type.toUpperCase() === "MESSAGE" ? "Email subject" : "Optional message"}><Input value={item.type.toUpperCase() === "WHATSAPP" ? item.message ?? "" : item.subject ?? ""} onChange={(event) => updateContactItem(item.id, item.type.toUpperCase() === "WHATSAPP" ? { message: event.target.value } : { subject: event.target.value })} /></Field>
                      <Field label="Button color"><Input type="color" value={item.color || "#16A9DB"} onChange={(event) => updateContactItem(item.id, { color: event.target.value })} className="h-10 cursor-pointer p-1" /></Field>
                      <div className="flex items-center justify-end gap-1">
                        <Checkbox checked={item.enabled} onChange={(event) => updateContactItem(item.id, { enabled: event.target.checked })} aria-label={`Enable ${item.label || item.type}`} />
                        <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveContactItem(item.id, -1)} aria-label={`Move ${item.label || item.type} up`} title="Move up"><ArrowUp size={15} /></Button>
                        <Button type="button" variant="ghost" size="icon" disabled={index === ordered.length - 1} onClick={() => moveContactItem(item.id, 1)} aria-label={`Move ${item.label || item.type} down`} title="Move down"><ArrowDown size={15} /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setContactWidgetField("items", contactWidget.items.filter((row) => row.id !== item.id))} aria-label={`Remove ${item.label || item.type}`} title="Remove"><Trash2 size={15} /></Button>
                      </div>
                    </div>
                  ))}
                  {!contactWidget.items.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No contact buttons configured.</p>}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">Live preview</h3>
                  <p className="mt-1 text-xs text-slate-500">This uses the same widget component rendered on the customer site.</p>
                  <div className="relative mt-3 min-h-56 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50">
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 bottom-5 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Customer website preview</div>
                    <FloatingContactWidget settings={contactWidget} preview />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {panel === "marquee" && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Announcement bar / marquee</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    The bar stays hidden until an active, saved message exists.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addMessage}>
                  <Plus size={16} />
                  Add message
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={marquee.enabled}
                      onChange={(event) =>
                        setMarqueeField("enabled", event.target.checked)
                      }
                    />
                    <Label>Enable bar</Label>
                  </div>
                  <Field label="Display mode">
                    <Select
                      value={marquee.mode}
                      onChange={(event) =>
                        setMarqueeField(
                          "mode",
                          event.target.value as MarqueeSettings["mode"],
                        )
                      }
                    >
                      <option value="SCROLL">Scrolling</option>
                      <option value="STATIC">Static</option>
                    </Select>
                  </Field>
                  <ColorSetting
                    label="Background"
                    value={marquee.backgroundColor}
                    onChange={(value) =>
                      setMarqueeField("backgroundColor", value)
                    }
                  />
                  <ColorSetting
                    label="Text"
                    value={marquee.textColor}
                    onChange={(value) => setMarqueeField("textColor", value)}
                  />
                  <ColorSetting
                    label="Link"
                    value={marquee.linkColor}
                    onChange={(value) => setMarqueeField("linkColor", value)}
                  />
                  <NumberField
                    label="Height (px)"
                    value={marquee.height}
                    min={28}
                    max={64}
                    onChange={(value) => setMarqueeField("height", value)}
                  />
                  <NumberField
                    label="Font size (px)"
                    value={marquee.fontSize}
                    min={11}
                    max={18}
                    onChange={(value) => setMarqueeField("fontSize", value)}
                  />
                  <Field label="Separator">
                    <Select
                      value={marquee.separator}
                      onChange={(event) =>
                        setMarqueeField(
                          "separator",
                          event.target.value as MarqueeSettings["separator"],
                        )
                      }
                    >
                      <option value="DIVIDER">Divider</option>
                      <option value="DOT">Dot</option>
                    </Select>
                  </Field>
                </div>
                {marquee.messages.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-3"
                  >
                    <div className="sm:col-span-2 xl:col-span-3">
                    <Field label="Announcement message">
                      <Input
                        value={item.message}
                        maxLength={180}
                        placeholder="Write the message customers will see"
                        onChange={(event) =>
                          updateMessage(item.id, {
                            message: event.target.value,
                          })
                        }
                      />
                    </Field>
                    </div>
                    <Field label="Link URL">
                      <Input
                        value={item.linkUrl ?? ""}
                        placeholder="/prescription"
                        onChange={(event) =>
                          updateMessage(item.id, {
                            linkUrl: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Link text">
                      <Input
                        value={item.linkText ?? ""}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            linkText: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Speed">
                      <Select
                        value={item.speed}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            speed: event.target
                              .value as AnnouncementMessage["speed"],
                          })
                        }
                      >
                        <option>SLOW</option>
                        <option>MEDIUM</option>
                        <option>FAST</option>
                      </Select>
                    </Field>
                    <Field label="Order">
                      <Input
                        type="number"
                        min={0}
                        value={item.displayOrder}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            displayOrder: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Direction">
                      <Select
                        value={item.direction}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            direction: event.target
                              .value as AnnouncementMessage["direction"],
                          })
                        }
                      >
                        <option>LEFT</option>
                        <option>RIGHT</option>
                      </Select>
                    </Field>
                    <Field label="Starts">
                      <Input
                        type="datetime-local"
                        value={utcToDateTimeInput(item.startDate)}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            startDate: event.target.value
                              ? dateTimeInputToUtc(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label="Ends">
                      <Input
                        type="datetime-local"
                        value={utcToDateTimeInput(item.endDate)}
                        onChange={(event) =>
                          updateMessage(item.id, {
                            endDate: event.target.value
                              ? dateTimeInputToUtc(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 sm:col-span-2 xl:col-span-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Checkbox checked={item.active} onChange={(event) => updateMessage(item.id, { active: event.target.checked })} />
                        Display this message
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Checkbox checked={item.pauseOnHover} onChange={(event) => updateMessage(item.id, { pauseOnHover: event.target.checked })} aria-label="Pause announcement on hover" />
                        Pause while hovered
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Remove announcement"
                        onClick={() =>
                          setMarqueeField(
                            "messages",
                            marquee.messages.filter(
                              (row) => row.id !== item.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} />
                        Remove message
                      </Button>
                    </div>
                  </div>
                ))}
                {previewMessages.length > 0 && (
                  <div className="overflow-hidden rounded-lg">
                    <AnnouncementPreview
                      marquee={{ ...marquee, messages: previewMessages }}
                    />
                  </div>
                )}
                {!marquee.messages.length && (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No announcements configured.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {panel === "sections" && (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Homepage sections</CardTitle>
                  <p className="text-sm text-slate-500">
                    Move sections with the arrows, then save the whole order.
                    Disabled sections are omitted from the customer page.
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={sectionSaving === "all" || !sections.length}
                  onClick={() => void saveAllSections()}
                >
                  {sectionSaving === "all" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  Save order
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[24px_1fr_auto_auto] sm:items-center"
                  >
                    <GripVertical className="text-slate-400" size={18} />
                    <div>
                      <Badge variant="secondary">{section.sectionKey}</Badge>
                      <Input
                        className="mt-2"
                        value={section.title}
                        onChange={(event) =>
                          setSections((current) =>
                            current.map((item) =>
                              item.id === section.id
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={section.enabled}
                        onChange={(event) =>
                          setSections((current) =>
                            current.map((item) =>
                              item.id === section.id
                                ? { ...item, enabled: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      <span className="text-xs font-semibold">Active</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => moveSection(index, -1)}
                      >
                        Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === sections.length - 1}
                        onClick={() => moveSection(index, 1)}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        disabled={sectionSaving === section.id}
                        onClick={() => void saveSection(section)}
                      >
                        {sectionSaving === section.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Save size={15} />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
                {!sections.length && (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No homepage sections are available.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Card
        className="mt-6 overflow-hidden"
        style={{ backgroundColor: design.surface, borderColor: design.border }}
      >
        <CardHeader>
          <CardTitle>Live style preview</CardTitle>
          <p className="text-sm text-slate-500">
            This preview uses unsaved values from the form. Save changes to
            publish them.
          </p>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{
              backgroundColor: design.primary,
              color: "#FFFFFF",
              fontFamily: design.fontFamily,
              lineHeight: design.bodyLineHeight,
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: design.primaryLight }}
            >
              All Nepal Healthy Home
            </p>
            <h2
              className="mt-3 text-2xl font-bold"
              style={{ color: "#FFFFFF" }}
            >
              Professional pharmacy care, closer to home.
            </h2>
            <p
              className="mt-2 max-w-xl text-sm"
              style={{ color: design.primaryLight }}
            >
              A restrained preview of your saved palette, typography, button
              shape and interaction defaults.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 text-sm font-bold"
                style={{
                  minHeight: design.buttonHeight,
                  borderRadius: design.buttonRadius,
                  backgroundColor: design.secondary,
                  color: "#FFFFFF",
                }}
              >
                Primary action
              </button>
              <button
                type="button"
                className="border px-4 text-sm font-bold"
                style={{
                  minHeight: design.buttonHeight,
                  borderRadius: design.buttonRadius,
                  borderColor: design.primaryLight,
                  backgroundColor: "transparent",
                  color: "#FFFFFF",
                }}
              >
                Secondary action
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={removeLogoOpen} onOpenChange={setRemoveLogoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the website logo?</AlertDialogTitle>
            <AlertDialogDescription>This removes the logo from the public website. The uploaded file remains in the media library and can be assigned again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoSaving}>Keep logo</AlertDialogCancel>
            <AlertDialogAction disabled={logoSaving} onClick={() => void removeLogo()} className="bg-rose-700 text-white hover:bg-rose-800">Remove logo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

export default DesignSettingsPage;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}
function ColorSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="color"
        value={validHex(value) ? value : "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
function AnnouncementPreview({ marquee }: { marquee: MarqueeSettings }) {
  const messages = marquee.messages
    .filter((item) => item.active && item.message.trim())
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const first = messages[0];
  if (!first) return null;
  const isScrolling = marquee.enabled && marquee.mode !== "STATIC";
  const duration = first.speed === "FAST" ? 22 : first.speed === "MEDIUM" ? 32 : 44;
  const content = messages.map((item) => (
    <span key={item.id} className="inline-flex items-center gap-3 whitespace-nowrap px-6">
      <span>{item.message}</span>
      {item.linkText && item.linkUrl && (
        <span className="font-bold underline underline-offset-4" style={{ color: marquee.linkColor }}>
          {item.linkText}
        </span>
      )}
      <span aria-hidden="true" className="opacity-50">{marquee.separator === "DIVIDER" ? "|" : "•"}</span>
    </span>
  ));
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: marquee.backgroundColor,
        color: marquee.textColor,
        minHeight: marquee.height,
        fontSize: marquee.fontSize,
        fontWeight: marquee.fontWeight,
      }}
      aria-label="Announcement bar preview"
    >
      {!marquee.enabled && <div className="py-2 text-center text-xs font-bold">Bar disabled · Preview only</div>}
      {marquee.enabled && (isScrolling ? (
        <div
          className={`announcement-track flex min-w-max items-center py-2 ${first.direction === "RIGHT" ? "announcement-track-right" : ""} ${first.pauseOnHover ? "announcement-pause-on-hover" : ""}`}
          style={{ animationDuration: `${duration}s`, animationDirection: first.direction === "RIGHT" ? "reverse" : "normal" }}
        >
          {content}
          <span aria-hidden="true">{content}</span>
        </div>
      ) : <div className="flex min-h-full flex-wrap items-center justify-center py-2">{content}</div>)}
    </div>
  );
}
