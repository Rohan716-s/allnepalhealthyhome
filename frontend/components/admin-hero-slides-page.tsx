"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Film,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { FormSaveActions } from "@/components/form-save-actions";
import { HeroSlider, type HeroSlideData } from "@/components/hero-slider";
import { UniversalImageUploader } from "@/components/universal-image-uploader";
import { AdminSlideshowList } from "@/components/admin-slideshow-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  createAdminHeroSlide,
  deleteAdminHeroSlide,
  getAdminHeroSlide,
  getAdminHeroSlides,
  resolveMediaUrl,
  setAdminEntityStatus,
  updateAdminHeroSlide,
  uploadAdminMedia,
  uploadAdminHeroVideo,
  type AdminHeroSlide,
  type UpsertHeroSlideInput,
} from "@/services/api";
import {
  dateTimeInputToUtc,
  formatNepalDateTime,
  utcToDateTimeInput,
} from "@/lib/date-time";

const VIDEO_MAX_SIZE = 100 * 1024 * 1024;
const listPath = "/superadmin/website/hero-slides";
const heroVideoTypes: Record<string, string[]> = {
  ".mp4": ["video/mp4"],
  ".m4v": ["video/mp4", "video/x-m4v"],
  ".webm": ["video/webm"],
  ".mov": ["video/quicktime"],
  ".ogv": ["video/ogg", "application/ogg"],
};
const defaults: UpsertHeroSlideInput = {
  title: "",
  subtitle: "",
  description: "",
  buttonText: "Shop now",
  buttonUrl: "/products",
  secondaryButtonText: "",
  secondaryButtonUrl: "",
  desktopImage: "",
  mobileImage: "",
  videoUrl: "",
  customLabel: "",
  layoutVariant: "STANDARD",
  typingSpeedMs: 52,
  backgroundColor: "#F8F6F1",
  overlayOpacity: 35,
  textAlignment: "LEFT",
  contentPosition: "CENTER",
  backgroundPosition: "CENTER",
  animationType: "FADE_ZOOM",
  slideDuration: 5000,
  transitionDuration: 700,
  displayOrder: 1,
  isActive: true,
  autoplayEnabled: true,
  pauseOnHover: true,
  showNavigationArrows: true,
  showPaginationDots: true,
  loopSlides: true,
  randomizeSlides: false,
  respectSchedule: true,
  startDate: undefined,
  endDate: undefined,
};

function token() {
  return typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");
}
function toPreview(
  slide: UpsertHeroSlideInput | AdminHeroSlide,
): HeroSlideData {
  return {
    ...slide,
    id: "id" in slide ? slide.id : "preview",
    desktopImage: resolveMediaUrl(slide.desktopImage),
    mobileImage: resolveMediaUrl(slide.mobileImage),
    buttonUrl: slide.buttonUrl,
  };
}
function schedule(slide: AdminHeroSlide) {
  return `${slide.startDate ? formatNepalDateTime(slide.startDate) : "Immediately"} → ${slide.endDate ? formatNepalDateTime(slide.endDate) : "No end"}`;
}

function formatMediaDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function validateTypingSpeed(value: string) {
  if (value.trim() === "") {
    return "Enter 0 for an instant reveal or a whole number from 18 to 180.";
  }
  if (!/^\d+$/.test(value)) {
    return "Typing speed must be a whole number: 0 or at least 18 milliseconds per character.";
  }
  const speed = Number(value);
  if (speed === 0 || speed >= 18) return "";
  if (speed >= 1 && speed <= 17) {
    return "Use 0 for an instant reveal, or choose 18 milliseconds or more per character.";
  }
  return "Typing speed must be 0 or at least 18 milliseconds per character.";
}

export function AdminHeroSlidesPage({
  view,
  slideId,
  mode,
  superAdmin = true,
}: {
  view: "list" | "form";
  slideId?: string;
  mode?: "create" | "edit";
  superAdmin?: boolean;
}) {
  const resolvedMode = mode ?? (slideId ? "edit" : "create");
  const listPath = `/${superAdmin ? "superadmin" : "admin"}/website/hero-slides`;
  return (
    <AdminShell superAdmin={superAdmin}>
      {view === "list" ? (
        <AdminSlideshowList listPath={listPath} superAdmin={superAdmin} />
      ) : (
        <HeroSlideForm
          key={`${resolvedMode}:${slideId ?? ""}`}
          slideId={slideId}
          mode={resolvedMode}
          listPath={listPath}
          superAdmin={superAdmin}
        />
      )}
    </AdminShell>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained as a fallback reference for the previous list implementation.
function HeroSlideList() {
  const router = useRouter();
  const [items, setItems] = useState<AdminHeroSlide[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<AdminHeroSlide>();
  useEffect(() => {
    getAdminHeroSlides(token())
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const visible = items.filter(
    (item) =>
      filter === "ALL" ||
      (filter === "ACTIVE" && item.isActive) ||
      (filter === "INACTIVE" && !item.isActive),
  );
  async function changeStatus(item: AdminHeroSlide, next: boolean) {
    try {
      await setAdminEntityStatus("website-asset", item.id, next, token(), true);
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, isActive: next } : row,
        ),
      );
      toast.success(`${item.title} ${next ? "Activated" : "Deactivated"}.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Status could not be updated.",
      );
      throw e;
    }
  }
  async function removeSlide() {
    if (!remove) return;
    try {
      await deleteAdminHeroSlide(remove.id, token());
      setItems((current) =>
        current.map((row) =>
          row.id === remove.id ? { ...row, isActive: false } : row,
        ),
      );
      toast.success(`${remove.title} Deactivated.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Hero slide could not be removed.",
      );
    } finally {
      setRemove(undefined);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
            Website · Homepage
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Hero slides
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage the database-backed homepage campaign sequence, images,
            scheduling, and motion.
          </p>
        </div>
        <Button onClick={() => router.push(`${listPath}/create`)}>
          <Plus />
          Add hero slide
        </Button>
      </div>
      {error && (
        <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      <Card className="mt-7">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Published campaigns</CardTitle>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Filter hero slides"
          >
            {["ALL", "ACTIVE", "INACTIVE"].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {value[0] + value.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 animate-spin" />
              Loading hero slides…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Preview",
                      "Title",
                      "Buttons",
                      "Order",
                      "Animation",
                      "Schedule",
                      "Status",
                      "Actions",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-bold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((item) => (
                    <tr key={item.id} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="h-14 w-24 overflow-hidden rounded-lg bg-slate-100">
                          {item.desktopImage ? (
                            <img
                              src={resolveMediaUrl(item.desktopImage)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-slate-400">
                              <ImagePlus size={18} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {item.subtitle ?? "No subtitle"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.buttonText ?? "—"}
                        <br />
                        {item.secondaryButtonText ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {item.displayOrder}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {item.animationType.replaceAll("_", " ")}
                        </Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.slideDuration} ms
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {schedule(item)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActiveStatusToggle
                            checked={item.isActive}
                            onChange={(next) => changeStatus(item, next)}
                            label={item.title}
                            confirmOnDeactivate
                          />
                          <span className="text-xs font-bold text-slate-600">
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            aria-label={`Edit ${item.title}`}
                            title="Edit"
                            variant="outline"
                            size="icon-sm"
                            onClick={() =>
                              router.push(`${listPath}/${item.id}/edit`)
                            }
                          >
                            <Pencil />
                          </Button>
                          <Button
                            aria-label={`Deactivate ${item.title}`}
                            title="Deactivate"
                            variant="outline"
                            size="icon-sm"
                            className="text-rose-600 hover:text-rose-700"
                            onClick={() => setRemove(item)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-14 text-center text-sm text-slate-500"
                      >
                        No hero slides match this filter. Add a campaign to
                        publish it on the homepage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={Boolean(remove)}
        onOpenChange={(open) => !open && setRemove(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this hero slide?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the campaign and its media history, but removes it from
              the customer homepage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => void removeSlide()}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeroSlideForm({
  slideId,
  mode,
  listPath,
  superAdmin,
}: {
  slideId?: string;
  mode: "create" | "edit";
  listPath: string;
  superAdmin: boolean;
}) {
  const router = useRouter();
  const normalizedSlideId = slideId?.trim() || undefined;
  const editing = mode === "edit";
  const [form, setForm] = useState<UpsertHeroSlideInput>(defaults);
  const [typingSpeedInput, setTypingSpeedInput] = useState(
    String(defaults.typingSpeedMs),
  );
  const [desktopFile, setDesktopFile] = useState<File>();
  const [mobileFile, setMobileFile] = useState<File>();
  const [videoFile, setVideoFile] = useState<File>();
  const [desktopPreview, setDesktopPreview] = useState("");
  const [mobilePreview, setMobilePreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(
    () => editing && Boolean(normalizedSlideId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [videoSelectionError, setVideoSelectionError] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === "create") {
      return;
    }
    if (!normalizedSlideId) {
      return;
    }
    let cancelled = false;
    getAdminHeroSlide(normalizedSlideId, token(), superAdmin)
      .then((item) => {
        if (cancelled) return;
        setForm({
          title: item.title,
          subtitle: item.subtitle ?? "",
          description: item.description ?? "",
          buttonText: item.buttonText ?? "",
          buttonUrl: item.buttonUrl ?? "",
          secondaryButtonText: item.secondaryButtonText ?? "",
          secondaryButtonUrl: item.secondaryButtonUrl ?? "",
          desktopImage: item.desktopImage ?? "",
          mobileImage: item.mobileImage ?? "",
          videoUrl: item.videoUrl ?? "",
          customLabel: item.customLabel ?? "",
          layoutVariant: item.layoutVariant ?? "STANDARD",
          typingSpeedMs: item.typingSpeedMs ?? 52,
          backgroundColor: item.backgroundColor ?? "#F8F6F1",
          overlayOpacity: item.overlayOpacity,
          textAlignment: item.textAlignment,
          contentPosition: item.contentPosition,
          backgroundPosition: item.backgroundPosition,
          animationType: item.animationType,
          slideDuration: item.slideDuration,
          transitionDuration: item.transitionDuration,
          displayOrder: item.displayOrder,
          isActive: item.isActive,
          autoplayEnabled: item.autoplayEnabled,
          pauseOnHover: item.pauseOnHover,
          showNavigationArrows: item.showNavigationArrows,
          showPaginationDots: item.showPaginationDots,
          loopSlides: item.loopSlides,
          randomizeSlides: item.randomizeSlides,
          respectSchedule: item.respectSchedule,
          startDate: item.startDate,
          endDate: item.endDate,
        });
        setTypingSpeedInput(String(item.typingSpeedMs ?? 52));
        setDesktopPreview(item.desktopImage ?? "");
        setMobilePreview(item.mobileImage ?? "");
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, normalizedSlideId, superAdmin]);
  useEffect(() => () => {
    if (videoPreview.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
  }, [videoPreview]);
  function setField<K extends keyof UpsertHeroSlideInput>(
    key: K,
    value: UpsertHeroSlideInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function upload(file: File, alt: string) {
    return (await uploadAdminMedia(file, "HERO", alt, true, token(), superAdmin)).url;
  }
  function chooseVideo(file?: File) {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const supportedMimeTypes = heroVideoTypes[extension];
    if (!supportedMimeTypes || (file.type && !supportedMimeTypes.includes(file.type.toLowerCase()))) {
      const message = "Unsupported video type. Choose an MP4, WebM, MOV, M4V, or OGV file.";
      setVideoSelectionError(message);
      setError(message);
      return;
    }
    if (file.size === 0 || file.size > VIDEO_MAX_SIZE) {
      const message = file.size === 0
        ? "This video file is empty. Choose a valid video."
        : "Video is too large. Maximum allowed size is 100 MB.";
      setVideoSelectionError(message);
      setError(message);
      return;
    }
    setVideoSelectionError("");
    setError("");
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoDurationSeconds(undefined);
  }
  async function persist(saveAnother = false) {
    setError("");
    if (videoSelectionError) {
      setError(videoSelectionError);
      return;
    }
    if (!form.title.trim()) {
      setError("Slide title is required.");
      return;
    }
    if (form.layoutVariant === "TYPEWRITER_GRAPHIC") {
      const typingSpeedError = validateTypingSpeed(typingSpeedInput);
      if (typingSpeedError) {
        setError(typingSpeedError);
        return;
      }
    }
    if (!desktopFile && !form.desktopImage) {
      setError("Choose a poster or fallback desktop image before saving.");
      return;
    }
    const start = form.startDate
      ? dateTimeInputToUtc(form.startDate)
      : undefined;
    const end = form.endDate ? dateTimeInputToUtc(form.endDate) : undefined;
    if ((form.startDate && !start) || (form.endDate && !end)) {
      setError("Enter valid Nepal date and time values.");
      return;
    }
    if (start && end && new Date(end) < new Date(start)) {
      setError("End date must be after start date.");
      return;
    }
    setSaving(true);
    try {
      const desktopImage = desktopFile
        ? await upload(desktopFile, form.title)
        : form.desktopImage;
      const mobileImage = mobileFile
        ? await upload(mobileFile, `${form.title} mobile`)
        : form.mobileImage;
      let videoUrl = form.videoUrl;
      if (videoFile) {
        setUploadProgress(0);
        videoUrl = (await uploadAdminHeroVideo(
            videoFile,
            form.title,
            token(),
            superAdmin,
            setUploadProgress,
          )).url;
      }
      const payload = {
        ...form,
        typingSpeedMs:
          form.layoutVariant === "TYPEWRITER_GRAPHIC"
            ? Number(typingSpeedInput)
            : form.typingSpeedMs,
        title: form.title.trim(),
        desktopImage,
        mobileImage,
        videoUrl,
        startDate: start,
        endDate: end,
      };
      const saved = editing
        ? await updateAdminHeroSlide(normalizedSlideId!, payload, token(), superAdmin)
        : await createAdminHeroSlide(payload, token(), superAdmin);
      toast.success(`${saved.title} ${editing ? "Updated" : "Saved"}.`);
      if (saveAnother) {
        setDesktopFile(undefined);
        setMobileFile(undefined);
        setVideoFile(undefined);
        setDesktopPreview("");
        setMobilePreview("");
        setVideoPreview("");
        setVideoDurationSeconds(undefined);
        setVideoSelectionError("");
        setUploadProgress(null);
        setTypingSpeedInput(String(defaults.typingSpeedMs));
        setForm({ ...defaults, displayOrder: saved.displayOrder + 1 });
      } else router.push(listPath);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Hero slide could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }
  const preview = useMemo(
    () =>
      toPreview({
        ...form,
        desktopImage: desktopPreview || form.desktopImage,
        mobileImage: mobilePreview || form.mobileImage,
        videoUrl: videoPreview || form.videoUrl,
      }),
    [desktopPreview, form, mobilePreview, videoPreview],
  );
  if (loading)
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 animate-spin" />
        Loading hero slide…
      </div>
    );
  const visibleError =
    error ||
    (editing && !normalizedSlideId ? "The hero slide ID is missing." : "");
  const typingSpeedError = validateTypingSpeed(typingSpeedInput);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={listPath}
            className="inline-flex items-center gap-1 text-sm font-bold text-[#003893]"
          >
            <ArrowLeft size={16} />
            Hero slides
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            {editing ? "Edit hero slide" : "Add hero slide"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Use the same campaign preview that appears on the customer homepage.
          </p>
        </div>
      </div>
      {visibleError && (
        <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {visibleError}
        </p>
      )}
      <form
        className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void persist(false);
        }}
      >
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Hero layout">
                <Select
                  value={form.layoutVariant}
                  onChange={(event) =>
                    setField("layoutVariant", event.target.value)
                  }
                >
                  <option value="STANDARD">Standard campaign</option>
                  <option value="TYPEWRITER_GRAPHIC">
                    Typewriter + right-side graphic
                  </option>
                </Select>
              </Field>
              <Field label="Background color">
                <Input
                  type="color"
                  value={form.backgroundColor}
                  onChange={(event) =>
                    setField("backgroundColor", event.target.value)
                  }
                  className="h-10 w-full cursor-pointer p-1"
                />
              </Field>
              {form.layoutVariant === "TYPEWRITER_GRAPHIC" && (
                <Field label="Typing speed (ms per character)">
                  <div>
                    <Input
                      id="hero-typing-speed"
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={typingSpeedInput}
                      aria-describedby={
                        typingSpeedError
                          ? "hero-typing-speed-hint hero-typing-speed-error"
                          : "hero-typing-speed-hint"
                      }
                      aria-invalid={Boolean(typingSpeedError)}
                      onInvalid={(event) =>
                        event.currentTarget.setCustomValidity(
                          typingSpeedError ||
                            "Enter 0 or a whole number of at least 18.",
                        )
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setTypingSpeedInput(value);
                        setError("");
                        event.currentTarget.setCustomValidity("");
                        if (!validateTypingSpeed(value)) {
                          setField("typingSpeedMs", Number(value));
                        }
                      }}
                    />
                    <p id="hero-typing-speed-hint" className="mt-1 text-xs text-slate-500">
                      Use 0 for an instant reveal, or 18 ms or more per character.
                    </p>
                    {typingSpeedError && (
                      <p
                        id="hero-typing-speed-error"
                        role="alert"
                        className="mt-1 text-xs font-semibold text-rose-700"
                      >
                        {typingSpeedError}
                      </p>
                    )}
                  </div>
                </Field>
              )}
              <Field label="Slide title" required>
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  maxLength={200}
                  required
                />
              </Field>
              <Field label="Custom badge / label">
                <Input
                  value={form.customLabel}
                  onChange={(e) => setField("customLabel", e.target.value)}
                  placeholder="Optional campaign label"
                />
              </Field>
              <Field label="Subtitle">
                <Input
                  value={form.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                />
              </Field>
              <Field label="Button text">
                <Input
                  value={form.buttonText}
                  onChange={(e) => setField("buttonText", e.target.value)}
                />
              </Field>
              <Field label="Button URL">
                <Input
                  value={form.buttonUrl}
                  onChange={(e) => setField("buttonUrl", e.target.value)}
                  placeholder="/products or https://…"
                />
              </Field>
              <Field label="Secondary button text">
                <Input
                  value={form.secondaryButtonText}
                  onChange={(e) =>
                    setField("secondaryButtonText", e.target.value)
                  }
                />
              </Field>
              <Field label="Secondary button URL">
                <Input
                  value={form.secondaryButtonUrl}
                  onChange={(e) =>
                    setField("secondaryButtonUrl", e.target.value)
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className="min-h-24"
                    maxLength={1000}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {form.videoUrl || videoFile ? "Poster and fallback images" : "Images"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <UniversalImageUploader
                label={form.videoUrl || videoFile ? "Poster / fallback image" : "Desktop image"}
                value={desktopPreview || form.desktopImage}
                onChange={(file) => {
                  setDesktopFile(file);
                  setDesktopPreview(URL.createObjectURL(file));
                }}
                onRemove={() => {
                  setDesktopFile(undefined);
                  setDesktopPreview("");
                  setField("desktopImage", "");
                }}
                required
                helperText="JPG, PNG, WebP, GIF, BMP, or AVIF · maximum 8 MB"
              />
              <UniversalImageUploader
                label="Mobile image"
                value={mobilePreview || form.mobileImage}
                onChange={(file) => {
                  setMobileFile(file);
                  setMobilePreview(URL.createObjectURL(file));
                }}
                onRemove={() => {
                  setMobileFile(undefined);
                  setMobilePreview("");
                  setField("mobileImage", "");
                }}
                helperText="Optional. Desktop image is used on mobile when empty."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film size={18} /> Hero video
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Video file">
                <Input
                  ref={videoInputRef}
                  type="file"
                  accept={Object.keys(heroVideoTypes).join(",")}
                  disabled={saving}
                  onChange={(event) => chooseVideo(event.target.files?.[0])}
                  className="h-auto min-h-11 cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-[#003893]"
                />
              </Field>
              <p className="text-xs leading-5 text-slate-500">
                MP4, WebM, MOV, M4V, or OGV · maximum 100 MB. Videos play muted,
                inline and continuously; native browser controls are hidden so the
                video remains clean on the homepage. The desktop image remains as
                the poster and fallback if playback is unsupported.
              </p>
              {videoSelectionError && (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  {videoSelectionError}
                </p>
              )}
              {(videoPreview || form.videoUrl) && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                  <video
                    key={videoPreview || form.videoUrl}
                    src={resolveMediaUrl(videoPreview || form.videoUrl)}
                    poster={resolveMediaUrl(desktopPreview || form.desktopImage)}
                    autoPlay
                    muted
                    controls={false}
                    loop
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        setVideoDurationSeconds(duration);
                      }
                    }}
                    className="max-h-64 w-full object-contain"
                  >
                    Your browser does not support this video. The poster image will be used on the homepage.
                  </video>
                  {videoDurationSeconds !== undefined && (
                    <p className="border-t border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">
                      Detected duration: {formatMediaDuration(videoDurationSeconds)}
                    </p>
                  )}
                </div>
              )}
              {videoFile && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{videoFile.name}</p>
                    <p className="text-xs text-slate-500">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB · uploads when you save</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setVideoFile(undefined);
                      setVideoPreview("");
                      setVideoDurationSeconds(undefined);
                      setVideoSelectionError("");
                      setField("videoUrl", "");
                      if (videoInputRef.current) videoInputRef.current.value = "";
                    }}
                  >
                    <X size={15} /> Remove video
                  </Button>
                </div>
              )}
              {uploadProgress !== null && saving && (
                <div aria-live="polite">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                    <span>Uploading hero video…</span><span>{uploadProgress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Hero video upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploadProgress}
                    className="h-2 overflow-hidden rounded-full bg-slate-200"
                  >
                    <div className="h-full rounded-full bg-[#003893] transition-[width]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Schedule and display</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date & time">
                <Input
                  type="datetime-local"
                  value={
                    form.startDate ? utcToDateTimeInput(form.startDate) : ""
                  }
                  onChange={(e) =>
                    setField(
                      "startDate",
                      e.target.value ? e.target.value : undefined,
                    )
                  }
                />
              </Field>
              <Field label="End date & time">
                <Input
                  type="datetime-local"
                  value={form.endDate ? utcToDateTimeInput(form.endDate) : ""}
                  onChange={(e) =>
                    setField(
                      "endDate",
                      e.target.value ? e.target.value : undefined,
                    )
                  }
                />
              </Field>
              <Field label="Display order">
                <Input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) =>
                    setField("displayOrder", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Overlay opacity">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={form.overlayOpacity}
                  onChange={(e) =>
                    setField("overlayOpacity", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Text alignment">
                <Select
                  value={form.textAlignment}
                  onChange={(e) => setField("textAlignment", e.target.value)}
                >
                  <option value="LEFT">Left</option>
                  <option value="CENTER">Center</option>
                  <option value="RIGHT">Right</option>
                </Select>
              </Field>
              <Field label="Content position">
                <Select
                  value={form.contentPosition}
                  onChange={(e) => setField("contentPosition", e.target.value)}
                >
                  <option value="TOP">Top</option>
                  <option value="CENTER">Center</option>
                  <option value="BOTTOM">Bottom</option>
                </Select>
              </Field>
              <Field label="Background position">
                <Select
                  value={form.backgroundPosition}
                  onChange={(e) =>
                    setField("backgroundPosition", e.target.value)
                  }
                >
                  <option value="CENTER">Center</option>
                  <option value="CENTER_TOP">Center top</option>
                  <option value="CENTER_BOTTOM">Center bottom</option>
                  <option value="LEFT">Left</option>
                  <option value="RIGHT">Right</option>
                </Select>
              </Field>
              <Field label="Animation">
                <Select
                  value={form.animationType}
                  onChange={(e) => setField("animationType", e.target.value)}
                >
                  <option value="FADE_ZOOM">Fade + subtle zoom</option>
                  <option value="FADE">Fade</option>
                  <option value="SLIDE_LEFT">Slide left</option>
                  <option value="SLIDE_RIGHT">Slide right</option>
                  <option value="SLIDE_UP">Slide up</option>
                  <option value="SUBTLE_ZOOM">Subtle zoom</option>
                </Select>
              </Field>
              <Field label="Slide duration (ms)">
                <Input
                  type="number"
                  min={1000}
                  max={30000}
                  value={form.slideDuration}
                  onChange={(e) =>
                    setField("slideDuration", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Transition duration (ms)">
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  value={form.transitionDuration}
                  onChange={(e) =>
                    setField("transitionDuration", Number(e.target.value))
                  }
                />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Slideshow settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["isActive", "Active on homepage"],
                  ["autoplayEnabled", "Autoplay enabled"],
                  ["pauseOnHover", "Pause on hover"],
                  ["showNavigationArrows", "Show navigation arrows"],
                  ["showPaginationDots", "Show pagination dots"],
                  ["loopSlides", "Loop slides"],
                  ["randomizeSlides", "Randomize slides"],
                  ["respectSchedule", "Respect schedule"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold"
                >
                  <Checkbox
                    checked={form[key]}
                    onChange={(e) => setField(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </CardContent>
          </Card>
          <FormSaveActions
            mode={editing ? "edit" : "create"}
            busy={saving}
            onCancel={() => router.push(listPath)}
            onSaveAndAnother={!editing ? () => void persist(true) : undefined}
          />
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
            </CardHeader>
            <CardContent>
              <HeroSlider slides={[preview]} preview />
              <p className="mt-3 text-xs leading-5 text-slate-500">
                This preview uses the same reusable hero component as the
                customer homepage.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </Label>
      {children}
    </div>
  );
}
