"use client";

/* eslint-disable @next/next/no-img-element -- private local object URLs are used for upload previews. */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, FileCheck2, FileText, FileUp, Pencil, Plus, ShieldCheck, ShoppingCart, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { addPrescriptionItem, createPrescription, deletePrescriptionItem, submitPrescription, updatePrescriptionItem, uploadPrescriptionClarification, type Prescription, type PrescriptionItem } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShop } from "@/components/shop-provider";

type Stage = "idle" | "uploading" | "scanning" | "ready" | "error";
type EditableItem = {
  detectedName: string;
  strength: string;
  dosageForm: string;
  dosage: string;
  quantity: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
};

const emptyItem: EditableItem = { detectedName: "", strength: "", dosageForm: "", dosage: "", quantity: "", frequency: "", duration: "", timing: "", instructions: "" };
const availabilityCopy: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  PARTIALLY_AVAILABLE: { label: "Partially available", className: "border-amber-200 bg-amber-50 text-amber-800" },
  OUT_OF_STOCK: { label: "Out of stock", className: "border-rose-200 bg-rose-50 text-rose-800" },
  NOT_FOUND: { label: "Not found", className: "border-slate-200 bg-slate-50 text-slate-700" },
  NEEDS_REVIEW: { label: "Needs review", className: "border-blue-200 bg-blue-50 text-blue-800" },
};

function toEditable(item: PrescriptionItem): EditableItem {
  return {
    detectedName: item.detectedName,
    strength: item.strength ?? "",
    dosageForm: item.dosageForm ?? "",
    dosage: item.dosage ?? "",
    quantity: item.quantity?.toString() ?? "",
    frequency: item.frequency ?? "",
    duration: item.duration ?? "",
    timing: item.timing ?? "",
    instructions: item.instructions ?? "",
  };
}

export default function PrescriptionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableItem>(emptyItem);
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [cartConfirmationItems, setCartConfirmationItems] = useState<PrescriptionItem[] | null>(null);
  const [deleteConfirmationItem, setDeleteConfirmationItem] = useState<PrescriptionItem | null>(null);
  const { addToCart } = useShop();

  const canSubmit = Boolean(prescription && ["Scanned", "Uploaded"].includes(prescription.status));
  const availableItems = prescription?.items.filter((item) => item.matches[0]?.availability === "AVAILABLE" && item.matches[0]?.productSlug && item.matches[0].stockQuantity > 0) ?? [];
  const filePreview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  function chooseFile(candidate?: File) {
    setError("");
    if (!candidate) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(candidate.type)) {
      setError("Please choose a JPG, PNG, WebP, or PDF file.");
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      setError("Prescription files must be 10 MB or smaller.");
      return;
    }
    setFile(candidate);
    setUploadProgress(0);
    setStage("idle");
    if (prescription?.status !== "Need Clarification") setPrescription(null);
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const accessToken = window.localStorage.getItem("anhh-access-token");
    if (!accessToken) {
      setError("Please sign in before uploading a prescription.");
      return;
    }
    if (!file) {
      setError("Choose a prescription file first.");
      return;
    }
    setStage("uploading");
    setUploadProgress(0);
    const onProgress = (percent: number) => {
      setUploadProgress(percent);
      if (percent >= 100) setStage("scanning");
    };
    try {
      const response = prescription?.status === "Need Clarification"
        ? await uploadPrescriptionClarification(prescription.id, file, note, accessToken, onProgress)
        : await createPrescription(file, note, accessToken, onProgress);
      setPrescription(response);
      setStage("ready");
      toast.success("Prescription uploaded", {
        description: response.items.length
          ? "Review each extracted detail and confirm before adding an available product to your cart."
          : "You can submit it for pharmacist review or add the medicine details manually.",
      });
    } catch (caught) {
      setStage("error");
      setError(caught instanceof Error ? caught.message : "We could not process this prescription.");
    }
  }

  function requestCartAddition(items: PrescriptionItem[]) {
    const eligible = items.filter((item) => item.matches[0]?.availability === "AVAILABLE" && item.matches[0]?.productSlug && item.matches[0].stockQuantity > 0);
    if (eligible.length) setCartConfirmationItems(eligible);
  }

  function confirmCartAddition() {
    if (!prescription || !cartConfirmationItems?.length) return;
    let added = 0;
    for (const item of cartConfirmationItems) {
      const match = item.matches[0];
      if (!match?.productSlug || match.availability !== "AVAILABLE" || match.stockQuantity <= 0) continue;
      addToCart(match.productSlug, Math.min(item.quantity ?? 1, match.stockQuantity), {
        prescriptionId: prescription.id,
        prescriptionItemId: item.id,
        prescribedQuantity: item.quantity,
        extractedDosage: [item.dosage, item.frequency, item.duration, item.timing, item.instructions].filter(Boolean).join(" · "),
        pharmacistVerificationStatus: "PENDING",
      });
      added++;
    }
    if (added) toast.success(`${added} medicine${added === 1 ? "" : "s"} added to cart`, { description: "A pharmacist must verify the prescription before dispensing." });
    setCartConfirmationItems(null);
  }

  function editItem(item: PrescriptionItem) {
    setEditingId(item.id);
    setEditing(toEditable(item));
  }

  async function saveItem() {
    if (!prescription || !editingId || !editing.detectedName.trim()) return;
    const accessToken = window.localStorage.getItem("anhh-access-token");
    if (!accessToken) return;
    setSaving(true);
    try {
      const response = await updatePrescriptionItem(prescription.id, editingId, {
        ...editing,
        quantity: editing.quantity ? Number(editing.quantity) : undefined,
      }, accessToken);
      setPrescription(response);
      setEditingId(null);
      toast.success("Detected medicine updated", { description: "Your correction is saved and the catalog match has been refreshed." });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The medicine could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function addManual() {
    if (!prescription || !manual.trim()) return;
    const accessToken = window.localStorage.getItem("anhh-access-token");
    if (!accessToken) return;
    setSaving(true);
    try {
      const response = await addPrescriptionItem(prescription.id, {
        ...emptyItem,
        detectedName: manual.trim(),
        quantity: undefined,
      }, accessToken);
      setPrescription(response);
      setManual("");
      toast.success("Medicine added", { description: "Review the product match before sending your prescription to the pharmacist." });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The medicine could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem() {
    if (!prescription || !deleteConfirmationItem) return;
    const accessToken = window.localStorage.getItem("anhh-access-token");
    if (!accessToken) return;
    setSaving(true);
    try {
      await deletePrescriptionItem(prescription.id, deleteConfirmationItem.id, accessToken);
      setPrescription({ ...prescription, items: prescription.items.filter((item) => item.id !== deleteConfirmationItem.id) });
      toast.success("Medicine removed from this prescription review.");
      setDeleteConfirmationItem(null);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The medicine could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!prescription || !canSubmit) return;
    const accessToken = window.localStorage.getItem("anhh-access-token");
    if (!accessToken) return;
    setSaving(true);
    try {
      setPrescription(await submitPrescription(prescription.id, note, accessToken));
      toast.success("Submitted for pharmacist verification");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The prescription could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  const ocrMessage = prescription?.ocrStatus === "not_configured"
    ? "Server OCR is unavailable. Your private file is saved; enter medicine details manually or submit it for pharmacist review."
    : prescription?.ocrStatus === "completed_no_text"
      ? "No readable medicine details were found. Check the original file, correct details manually, or submit it for pharmacist review."
      : prescription?.ocrStatus === "timeout"
        ? "Scanning timed out. Try a clearer/smaller file or submit the saved prescription for pharmacist review."
        : "OCR is an aid only. Confirm every extracted value against the original prescription.";

  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Pharmacy support</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">Upload your prescription</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-500">Upload a clear prescription and we’ll extract the written medicine details and check them against our catalog. A qualified pharmacist verifies every prescription before dispensing.</p>
            <div className="mt-8 grid gap-4">
              <Step number="1" title="Upload a clear file" text="JPG, PNG, WebP, or PDF up to 10 MB. Camera capture works on compatible mobile browsers." />
              <Step number="2" title="We scan and match" text="OCR extracts only visible text; catalog matches and stock status are shown for your review." />
              <Step number="3" title="Review and confirm" text="Correct any uncertain detail. You choose whether an available match is added to your cart." />
            </div>
            <Card className="mt-8 border-amber-200 bg-amber-50 shadow-none">
              <CardContent className="flex gap-3 p-5 text-xs leading-5 text-amber-900">
                <ShieldCheck className="mt-0.5 shrink-0" size={18} />
                <p>Scanning does not recommend treatment, change dosage, or approve a prescription. Follow the original prescription and pharmacist guidance.</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Prescription file</CardTitle>
              <p className="text-sm text-slate-500">Sign in is required so the private file is saved to your account.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={scan} className="grid gap-5">
                <label
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
                  className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition ${dragging ? "border-teal-500 bg-teal-50" : "border-teal-200 bg-teal-50/50 hover:border-teal-400"}`}
                >
                  <UploadCloud size={32} className="text-teal-600" />
                  <span className="mt-3 text-sm font-extrabold text-slate-800">{file ? file.name : "Drop your prescription here"}</span>
                  <span className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, or PDF · up to 10 MB · camera supported on mobile</span>
                  <input aria-label="Prescription file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
                </label>

                {file && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <FileText className="text-teal-700" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type === "application/pdf" ? "PDF document" : "Image"}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove selected file" onClick={() => { setFile(null); setStage("idle"); setUploadProgress(0); }}><Trash2 /></Button>
                  </div>
                )}

                {filePreview && (file?.type === "application/pdf"
                  ? <iframe title="Selected prescription PDF preview" src={filePreview} className="h-64 w-full rounded-xl border border-slate-200 bg-white" />
                  : <img src={filePreview} alt="Selected prescription preview" className="max-h-64 w-full rounded-xl border border-slate-200 bg-white object-contain" />)}

                {(stage === "uploading" || stage === "scanning") && (
                  <div className="grid gap-2" aria-live="polite">
                    <div className="flex justify-between gap-3 text-xs font-bold text-slate-600">
                      <span>{stage === "uploading" ? "Uploading prescription…" : "Upload complete · Reading and matching the file…"}</span>
                      <span>{stage === "uploading" ? `${uploadProgress}%` : "Scanning"}</span>
                    </div>
                    <Progress value={stage === "uploading" ? uploadProgress : undefined} />
                  </div>
                )}

                <div>
                  <Label htmlFor="customerNote">Additional note for pharmacist <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Textarea id="customerNote" value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24" placeholder="For example: please call if any detail is unclear." />
                </div>
                {error && <div role="alert" className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</div>}
                <Button type="submit" disabled={!file || stage === "uploading" || stage === "scanning"} className="w-full"><FileUp />{stage === "uploading" ? "Uploading…" : stage === "scanning" ? "Scanning…" : "Upload and scan prescription"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {prescription && (
          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Prescription analysis</p>
                <h2 className="mt-2 text-2xl font-extrabold">Review detected medicines</h2>
                <p className="mt-2 text-sm text-slate-500">{prescription.originalFileName} · {ocrMessage}</p>
              </div>
              <StatusBadge status={prescription.status} />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <span className="font-bold text-slate-800">{availableItems.length} of {prescription.items.length} detected medicines currently available</span>
              {availableItems.length > 0 && <Button type="button" variant="outline" onClick={() => requestCartAddition(availableItems)}><ShoppingCart size={15} /> Add available to cart</Button>}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
              <Card className="h-fit">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3"><FileCheck2 className="text-teal-700" /><div><p className="text-sm font-bold">Secure prescription record</p><p className="mt-1 break-all text-xs text-slate-500">{prescription.id}</p></div></div>
                  <p className="mt-5 text-xs leading-5 text-slate-500">Your original file is private and available to you and authorized pharmacy staff for verification.</p>
                </CardContent>
              </Card>

              <div className="grid content-start gap-4">
                {prescription.items.length ? prescription.items.map((item) => (
                  <MedicineResult
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    editing={editing}
                    setEditing={setEditing}
                    onEdit={() => editItem(item)}
                    onSave={() => void saveItem()}
                    onCancel={() => setEditingId(null)}
                    onRemove={() => setDeleteConfirmationItem(item)}
                    onShop={() => requestCartAddition([item])}
                    saving={saving}
                  />
                )) : (
                  <Card><CardContent className="p-8 text-center"><AlertCircle className="mx-auto text-amber-500" size={30} /><h3 className="mt-3 font-extrabold">No medicines confidently detected</h3><p className="mt-2 text-sm leading-6 text-slate-500">Check the original file, add medicine details manually, or submit it for pharmacist review.</p></CardContent></Card>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addManual(); } }} placeholder="Add medicine name manually" aria-label="Add a medicine manually" />
                  <Button type="button" variant="outline" onClick={() => void addManual()} disabled={!manual.trim() || saving}><Plus /> Add</Button>
                </div>
                <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-xs leading-5 text-teal-900"><div className="flex items-center gap-2 font-extrabold"><ShieldCheck size={16} /> Pharmacist verification required</div><p className="mt-1">OCR and customer corrections are not approval to dispense. A qualified pharmacist makes the final decision.</p></div>
                <Button type="button" onClick={() => void submitForReview()} disabled={!canSubmit || saving} className="w-full">{saving ? "Submitting…" : canSubmit ? "Submit for pharmacist verification" : "Prescription submitted for review"}</Button>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />

      <Dialog open={Boolean(cartConfirmationItems)} onOpenChange={(open) => { if (!open) setCartConfirmationItems(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm medicines to add to your cart</DialogTitle>
            <DialogDescription>Check the catalog products and quantities. This does not approve the prescription or authorize dispensing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {cartConfirmationItems?.map((item) => {
              const match = item.matches[0];
              const quantity = Math.min(item.quantity ?? 1, match?.stockQuantity ?? 0);
              return <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="min-w-0"><p className="font-bold text-slate-900">{match?.productName ?? item.detectedName}</p><p className="mt-1 text-xs text-slate-600">Prescription text: {item.detectedName}{item.strength ? ` · ${item.strength}` : ""}</p><p className="mt-1 text-xs text-amber-800">Pharmacist verification pending</p></div><span className="shrink-0 text-sm font-extrabold text-slate-900">Qty {quantity}</span></div>;
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCartConfirmationItems(null)}>Cancel</Button>
            <Button type="button" onClick={confirmCartAddition} disabled={!cartConfirmationItems?.length}><ShoppingCart size={16} />Confirm and add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteConfirmationItem)} onOpenChange={(open) => { if (!open && !saving) setDeleteConfirmationItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Remove this medicine?</DialogTitle><DialogDescription>This removes “{deleteConfirmationItem?.detectedName}” from this saved prescription review. It does not change the original uploaded file.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDeleteConfirmationItem(null)} disabled={saving}>Keep medicine</Button><Button type="button" variant="destructive" onClick={() => void removeItem()} disabled={saving}>{saving ? "Removing…" : "Remove medicine"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-extrabold text-teal-700">{number}</span><div><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>;
}

function MedicineResult({ item, editingId, editing, setEditing, onEdit, onSave, onCancel, onRemove, saving, onShop }: {
  item: PrescriptionItem;
  editingId: string | null;
  editing: EditableItem;
  setEditing: (value: EditableItem) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  saving: boolean;
  onShop: () => void;
}) {
  const match = item.matches[0];
  const availability = match ? availabilityCopy[match.availability] ?? availabilityCopy.NEEDS_REVIEW : availabilityCopy.NOT_FOUND;
  const canShop = Boolean(match?.productSlug && match.availability === "AVAILABLE" && match.stockQuantity > 0);
  const fields: [string, string | number | undefined][] = [
    ["Strength", item.strength],
    ["Dosage", item.dosage],
    ["Frequency", item.frequency],
    ["Duration", item.duration],
    ["Timing", item.timing],
    ["Quantity", item.quantity],
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-wide text-teal-700">Detected medicine</p><h3 className="mt-1 text-lg font-extrabold">{item.detectedName}</h3></div>
          <div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${availability.className}`}>{availability.label}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${item.detectedName}`} onClick={onEdit}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.detectedName}`} onClick={onRemove}><Trash2 /></Button></div>
        </div>

        <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value || <span className="font-normal text-slate-400">Not detected</span>}</dd></div>)}
        </dl>
        {item.instructions && <p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600"><strong>Original prescription text:</strong> {item.instructions}<br /><span className="font-bold text-amber-700">OCR reading only — verify against the original.</span></p>}

        {match?.productName ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Catalog match</p><p className="mt-1 text-sm font-bold text-slate-900">{match.productName}</p><p className="text-xs text-slate-600">{match.brand || "Brand not specified"}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Match confidence</p><p className="mt-1 text-sm font-bold text-slate-900">{match.confidence}%</p><p className="text-xs text-slate-600">{match.needsPharmacistReview ? "Pharmacist review required" : "High confidence; verify label"}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Price / stock</p><p className="mt-1 text-sm font-bold text-slate-900">{match.sellingPrice !== undefined ? `Rs. ${match.sellingPrice.toLocaleString("en-IN")}` : "Price unavailable"}</p><p className="text-xs text-slate-600">{match.stockQuantity} units available</p></div>
          </div>
        ) : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">No confident product match was found. Correct the medicine name or ask the pharmacist to review it; no product can be added from this match.</p>}

        {match && match.availability !== "AVAILABLE" && <p className="mt-3 text-xs font-semibold text-amber-800">This item is {availability.label.toLowerCase()}; it cannot be added to the cart from this result.</p>}
        {item.customerEdited && <p className="mt-3 text-xs font-bold text-amber-700">Customer corrected · pharmacist verification required</p>}
        {canShop && <Button type="button" className="mt-4" onClick={onShop}><ShoppingCart size={15} /> Add to Cart</Button>}

        {editingId === item.id && (
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <EditField label="Medicine name" value={editing.detectedName} onChange={(value) => setEditing({ ...editing, detectedName: value })} />
            <EditField label="Strength" value={editing.strength} onChange={(value) => setEditing({ ...editing, strength: value })} />
            <EditField label="Dosage form" value={editing.dosageForm} onChange={(value) => setEditing({ ...editing, dosageForm: value })} placeholder="As written, e.g. tablet" />
            <EditField label="Dosage" value={editing.dosage} onChange={(value) => setEditing({ ...editing, dosage: value })} placeholder="As written on prescription" />
            <EditField label="Quantity" value={editing.quantity} onChange={(value) => setEditing({ ...editing, quantity: value })} inputMode="numeric" />
            <EditField label="Frequency" value={editing.frequency} onChange={(value) => setEditing({ ...editing, frequency: value })} />
            <EditField label="Duration" value={editing.duration} onChange={(value) => setEditing({ ...editing, duration: value })} />
            <EditField label="Timing" value={editing.timing} onChange={(value) => setEditing({ ...editing, timing: value })} placeholder="As written, e.g. after food" />
            <div className="sm:col-span-2"><Label htmlFor={`instructions-${item.id}`}>Instructions exactly as written</Label><Textarea id={`instructions-${item.id}`} value={editing.instructions} onChange={(event) => setEditing({ ...editing, instructions: event.target.value })} className="mt-1 min-h-20" /></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="button" onClick={onSave} disabled={saving || !editing.detectedName.trim()}>{saving ? "Saving…" : "Save correction"}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditField({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "numeric" | "text" }) {
  return <div><Label>{label}</Label><Input value={value} inputMode={inputMode} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1" /></div>;
}
