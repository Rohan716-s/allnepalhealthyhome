"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { AnimatedText, ScrollReveal, TypewriterText } from "@/components/animated";
import { useSiteConfig } from "@/components/site-config-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getAdminSettings, saveAdminSetting } from "@/services/api";
import { defaultSiteDesign, type SiteDesignSettings } from "@/lib/site-design";

const textAnimations = ["NONE", "FADE", "FADE_UP", "FADE_DOWN", "FADE_LEFT", "FADE_RIGHT", "SLIDE_UP", "SLIDE_DOWN", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_REVEAL", "BLUR_REVEAL", "ZOOM_IN", "WORD_REVEAL", "LETTER_REVEAL", "CHARACTER_REVEAL", "TYPEWRITER"];
const imageAnimations = ["NONE", "FADE", "FADE_UP", "FADE_DOWN", "FADE_LEFT", "FADE_RIGHT", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_SCALE", "ZOOM_IN", "ZOOM_OUT", "KEN_BURNS", "SUBTLE_PARALLAX", "SCALE_FADE"];
const transitions = ["CROSS_FADE", "FADE", "SLIDE_LEFT", "SLIDE_RIGHT", "SLIDE_UP", "SLIDE_DOWN", "SOFT_ZOOM", "SCALE_FADE", "BLUR_FADE", "KEN_BURNS"];
const scrollAnimations = ["NONE", "FADE", "FADE_UP", "FADE_DOWN", "SLIDE_LEFT", "SLIDE_RIGHT", "SOFT_SCALE", "BLUR_REVEAL"];
const buttonAnimations = ["NONE", "SOFT_SCALE", "SOFT_LIFT", "BORDER_HIGHLIGHT", "SHINE"];

function accessToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("anhh-staff-access-token") ?? "";
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SelectField({ label: fieldLabel, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="grid gap-2"><Label>{fieldLabel}</Label><Select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</Select></div>;
}

function NumberField({ label: fieldLabel, value, min, max, step = 50, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <div className="grid gap-2"><Label>{fieldLabel}</Label><input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

export default function AnimationSettingsPage() {
  const { design: liveDesign } = useSiteConfig();
  const [design, setDesign] = useState<SiteDesignSettings>(liveDesign);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => {
    getAdminSettings(accessToken()).then((settings) => {
      const saved = settings.find((item) => item.key === "website.design");
      if (saved) {
        try { setDesign({ ...defaultSiteDesign, ...JSON.parse(saved.value) }); } catch { /* keep defaults */ }
      }
    }).catch(() => toast.error("Animation settings could not be loaded.")).finally(() => setLoading(false));
  }, []);
  const setField = <K extends keyof SiteDesignSettings>(key: K, value: SiteDesignSettings[K]) => setDesign((current) => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true);
    try {
      await saveAdminSetting("website.design", { value: JSON.stringify(design), group: "website-design", isPublic: true, description: "Customer website motion and animation settings." }, accessToken());
      toast.success("Animation settings saved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Animation settings could not be saved."); } finally { setSaving(false); }
  }
  if (loading) return <AdminShell superAdmin><div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading animation settings…</div></AdminShell>;
  return <AdminShell superAdmin>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href="/superadmin/website/design" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)]"><ArrowLeft size={16} />Design settings</Link><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Animation settings</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Create a calm, modern motion language for the pharmacy website. Changes are stored with the existing website design settings.</p></div>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => { setDesign(defaultSiteDesign); setPreviewKey((key) => key + 1); toast.success("Default motion loaded. Save to apply it."); }}><RotateCcw size={16} />Reset</Button><Button variant="outline" onClick={() => window.open("/", "_blank")}><Eye size={16} />Preview website</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save size={16} />}Save changes</Button></div>
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles size={18} className="text-[var(--color-primary)]" />Global motion</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><Checkbox checked={design.animationsEnabled} onChange={(event) => setField("animationsEnabled", event.target.checked)} /><span><b className="block text-sm">Animations enabled</b><small className="text-xs text-slate-500">Turn off all non-essential motion for a still website.</small></span></label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><Checkbox checked={design.reducedMotionSupport} onChange={(event) => setField("reducedMotionSupport", event.target.checked)} /><span><b className="block text-sm">Respect reduced motion</b><small className="text-xs text-slate-500">Simplify motion when a visitor requests it.</small></span></label><SelectField label="Motion intensity" value={(design as SiteDesignSettings & { animationIntensity?: string }).animationIntensity ?? "STANDARD"} options={["SUBTLE", "STANDARD", "EXPRESSIVE"]} onChange={(value) => setDesign((current) => ({ ...current, animationIntensity: value } as SiteDesignSettings))} /><SelectField label="Easing" value={design.animationEasing} options={["ease", "ease-in", "ease-out", "ease-in-out", "linear"]} onChange={(value) => setField("animationEasing", value as SiteDesignSettings["animationEasing"])} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Hero motion</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><SelectField label="Heading animation" value={design.heroTextAnimation} options={textAnimations} onChange={(value) => setField("heroTextAnimation", value)} /><SelectField label="Product/image animation" value={design.heroImageAnimation} options={imageAnimations} onChange={(value) => setField("heroImageAnimation", value)} /><SelectField label="Slide transition" value={design.heroTransition} options={transitions} onChange={(value) => setField("heroTransition", value)} /><NumberField label="Text duration (ms)" value={design.textDuration} min={0} max={2000} onChange={(value) => setField("textDuration", value)} /><NumberField label="Text delay (ms)" value={design.textDelay} min={0} max={1000} onChange={(value) => setField("textDelay", value)} /><NumberField label="Image duration (ms)" value={design.imageDuration} min={0} max={3000} onChange={(value) => setField("imageDuration", value)} /><NumberField label="Image delay (ms)" value={design.imageDelay} min={0} max={1000} onChange={(value) => setField("imageDelay", value)} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Page motion</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><SelectField label="Section reveal" value={design.scrollReveal} options={scrollAnimations} onChange={(value) => setField("scrollReveal", value)} /><SelectField label="Button interaction" value={design.buttonAnimation} options={buttonAnimations} onChange={(value) => setField("buttonAnimation", value)} /><NumberField label="Reveal duration (ms)" value={design.scrollDuration} min={0} max={3000} onChange={(value) => setField("scrollDuration", value)} /><NumberField label="Stagger between sections (ms)" value={design.scrollStagger} min={0} max={1000} onChange={(value) => setField("scrollStagger", value)} /></CardContent></Card>
      </div>
      <Card className="h-fit overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Live preview</CardTitle><p className="mt-1 text-xs text-slate-500">Preview uses your unsaved values.</p></div><Button variant="outline" size="sm" onClick={() => setPreviewKey((key) => key + 1)}><RotateCcw size={14} />Replay</Button></CardHeader><CardContent><div key={previewKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--color-primary-light)] p-6"><AnimatedText text="Trusted care, delivered clearly" animation={design.heroTextAnimation} duration={design.textDuration} delay={design.textDelay} easing={design.animationEasing} className="block text-3xl font-black leading-tight text-[var(--color-primary-dark)]" /><AnimatedText text="Modern pharmacy care for every home." animation="FADE_UP" duration={design.textDuration} delay={design.textDelay + 140} easing={design.animationEasing} className="mt-3 block text-sm leading-6 text-[var(--color-text-secondary)]" /><div className="mt-5 flex flex-wrap gap-3"><Button className="site-primary-button">Shop now <Eye size={15} /></Button><Button variant="outline" className="site-secondary-button">Learn more</Button></div><ScrollReveal animation={design.scrollReveal} duration={design.scrollDuration} className="mt-7"><div className="h-24 rounded-xl bg-white/75 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Motion preview</p><p className="mt-2 text-sm font-semibold text-slate-700">Cards and sections reveal as they enter the viewport.</p></div></ScrollReveal>{design.heroTextAnimation === "TYPEWRITER" && <TypewriterText text="Unicode-safe typing for नेपाली and हिन्दी" duration={1000} delay={200} className="mt-5 block text-xs font-semibold text-[var(--color-primary)]" />}</div></CardContent></Card>
    </div>
  </AdminShell>;
}
