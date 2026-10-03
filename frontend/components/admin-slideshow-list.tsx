"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  GripVertical,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { HeroSlider, type HeroSlideData } from "@/components/hero-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAdminHeroSlide,
  deleteAdminHeroSlide,
  getAdminHeroSlides,
  reorderAdminHeroSlides,
  resolveMediaUrl,
  setAdminEntityStatus,
  type AdminHeroSlide,
} from "@/services/api";
import { formatNepalDateTime } from "@/lib/date-time";

function token() {
  return typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");
}
function previewData(item: AdminHeroSlide): HeroSlideData {
  return {
    ...item,
    desktopImage: resolveMediaUrl(item.desktopImage),
    mobileImage: resolveMediaUrl(item.mobileImage),
    buttonUrl: item.buttonUrl,
  };
}

export function AdminSlideshowList({
  listPath = "/superadmin/website/hero-slides",
  superAdmin = true,
}: {
  listPath?: string;
  superAdmin?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AdminHeroSlide[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [draggedId, setDraggedId] = useState<string>();
  const [preview, setPreview] = useState<AdminHeroSlide>();
  const [pendingDelete, setPendingDelete] = useState<AdminHeroSlide>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAdminHeroSlides(token(), superAdmin));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Slideshow could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [superAdmin]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "ALL" ||
            (filter === "ACTIVE" && item.isActive) ||
            (filter === "INACTIVE" && !item.isActive)) &&
          `${item.title} ${item.subtitle ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [filter, items, query],
  );

  async function changeStatus(item: AdminHeroSlide, next: boolean) {
    setBusy(item.id);
    try {
      await setAdminEntityStatus("website-asset", item.id, next, token(), superAdmin);
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, isActive: next } : row,
        ),
      );
      toast.success(`${item.title} is now ${next ? "active" : "inactive"}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Status could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setBusy(item.id);
    try {
      await deleteAdminHeroSlide(item.id, token(), superAdmin);
      setItems((current) => current.filter((row) => row.id !== item.id));
      toast.success("Hero slide deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Slideshow item could not be removed.",
      );
    } finally {
      setBusy("");
      setPendingDelete(undefined);
    }
  }
  async function duplicate(item: AdminHeroSlide) {
    setBusy(item.id);
    try {
      const nextOrder =
        Math.max(0, ...items.map((row) => row.displayOrder)) + 1;
      const copy = await createAdminHeroSlide(
        {
          title: `${item.title} copy`,
          subtitle: item.subtitle,
          description: item.description,
          buttonText: item.buttonText,
          buttonUrl: item.buttonUrl,
          secondaryButtonText: item.secondaryButtonText,
          secondaryButtonUrl: item.secondaryButtonUrl,
          desktopImage: item.desktopImage,
          mobileImage: item.mobileImage,
          videoUrl: item.videoUrl,
          customLabel: item.customLabel,
          layoutVariant: item.layoutVariant,
          typingSpeedMs: item.typingSpeedMs,
          backgroundColor: item.backgroundColor,
          overlayOpacity: item.overlayOpacity,
          textAlignment: item.textAlignment,
          contentPosition: item.contentPosition,
          backgroundPosition: item.backgroundPosition,
          animationType: item.animationType,
          slideDuration: item.slideDuration,
          transitionDuration: item.transitionDuration,
          displayOrder: nextOrder,
          isActive: false,
          autoplayEnabled: item.autoplayEnabled,
          pauseOnHover: item.pauseOnHover,
          showNavigationArrows: item.showNavigationArrows,
          showPaginationDots: item.showPaginationDots,
          loopSlides: item.loopSlides,
          randomizeSlides: item.randomizeSlides,
          respectSchedule: item.respectSchedule,
          startDate: undefined,
          endDate: undefined,
        },
        token(),
        superAdmin,
      );
      setItems((current) =>
        [...current, copy].sort((a, b) => a.displayOrder - b.displayOrder),
      );
      toast.success("Draft copy created.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Slideshow item could not be duplicated.",
      );
    } finally {
      setBusy("");
    }
  }
  async function reorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    const ordered = next.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));
    setItems(ordered);
    setBusy("reorder");
    try {
      const saved = await reorderAdminHeroSlides(
        ordered.map((item) => ({
          id: item.id,
          displayOrder: item.displayOrder,
        })),
        token(),
        superAdmin,
      );
      setItems(saved);
      toast.success("Slideshow order saved.");
    } catch (error) {
      await load();
      toast.error(
        error instanceof Error
          ? error.message
          : "Slideshow order could not be saved.",
      );
    } finally {
      setBusy("");
      setDraggedId(undefined);
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
            Slideshow banners
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage database-backed promotional campaigns, order, scheduling, and
            motion.
          </p>
        </div>
        <Button onClick={() => router.push(`${listPath}/create`)}>
          Add slideshow
        </Button>
      </div>
      <Card className="mt-7">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Homepage campaigns</CardTitle>
            <div
              className="flex gap-2"
              role="group"
              aria-label="Filter slideshow banners"
            >
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map((value) => (
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
          </div>
          <div className="relative max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-slate-400"
            />
            <Input
              aria-label="Search slideshow banners"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or subtitle"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 animate-spin" />
              Loading slideshow…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Order",
                      "Preview",
                      "Title",
                      "Schedule",
                      "Status",
                      "Updated",
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
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedId(item.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() =>
                        draggedId && void reorder(draggedId, item.id)
                      }
                      className={`align-middle ${draggedId === item.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex cursor-grab items-center gap-2 rounded-md px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
                          aria-label={`Drag ${item.title} to reorder`}
                          title="Drag to reorder"
                        >
                          <GripVertical size={16} />
                          {item.displayOrder}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-14 w-24 overflow-hidden rounded-lg bg-slate-100">
                          {item.videoUrl ? (
                            <div className="relative h-full w-full bg-slate-950">
                              {item.desktopImage && (
                                <img
                                  src={resolveMediaUrl(item.desktopImage)}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-contain p-1"
                                />
                              )}
                              <span className="absolute bottom-1 right-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">Video</span>
                            </div>
                          ) : item.desktopImage ? (
                            <img
                              src={resolveMediaUrl(item.desktopImage)}
                              alt={item.title}
                              loading="lazy"
                              className="h-full w-full object-contain bg-white p-1"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-xs text-slate-400">
                              No image
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
                        <Badge variant="secondary" className="mt-2">
                          {item.animationType.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.startDate
                          ? formatNepalDateTime(item.startDate)
                          : "Immediately"}
                        <br />
                        {item.endDate
                          ? `→ ${formatNepalDateTime(item.endDate)}`
                          : "→ No end date"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActiveStatusToggle
                            checked={item.isActive}
                            disabled={busy === item.id || busy === "reorder"}
                            onChange={(next) => changeStatus(item, next)}
                            label={item.title}
                            confirmOnDeactivate
                          />
                          <span className="text-xs font-bold text-slate-600">
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatNepalDateTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Preview ${item.title}`}
                            title="Preview"
                            onClick={() => setPreview(item)}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${item.title}`}
                            title="Edit"
                            onClick={() =>
                              router.push(`${listPath}/${item.id}/edit`)
                            }
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Duplicate ${item.title}`}
                            title="Duplicate"
                            disabled={busy === item.id}
                            onClick={() => void duplicate(item)}
                          >
                            <Copy size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-rose-600"
                            aria-label={`Delete ${item.title}`}
                            title="Delete"
                            disabled={busy === item.id}
                            onClick={() => setPendingDelete(item)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-14 text-center text-sm text-slate-500"
                      >
                        No slideshow banners match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(undefined)}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Slideshow preview"}</DialogTitle>
          </DialogHeader>
          {preview && <HeroSlider slides={[previewData(preview)]} preview />}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hero slide?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” will be removed from the homepage and the
              slide list. Uploaded media remains in the media library in case
              another campaign uses it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(busy)}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 size={15} />}
              Delete slide
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
