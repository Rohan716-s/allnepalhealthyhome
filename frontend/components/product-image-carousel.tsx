"use client";

import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/components/animated";

export function ProductImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [selection, setSelection] = useState({ imageSetKey: "", index: 0 });
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const safeImages = images.filter(Boolean).slice(0, 5);
  const imageSetKey = JSON.stringify(safeImages);
  const active = safeImages.length && selection.imageSetKey === imageSetKey
    ? selection.index % safeImages.length
    : 0;
  useEffect(() => {
    if (paused || reducedMotion || safeImages.length < 2) return;
    const timer = window.setInterval(() => setSelection(current => {
      const currentIndex = current.imageSetKey === imageSetKey ? current.index : 0;
      return { imageSetKey, index: (currentIndex + 1) % safeImages.length };
    }), 5000);
    return () => window.clearInterval(timer);
  }, [imageSetKey, paused, reducedMotion, safeImages.length]);
  if (!safeImages.length) return <div className="flex min-h-[320px] items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ImageOff size={32} /></div>;
  const move = (delta: number) => setSelection(current => {
    const currentIndex = current.imageSetKey === imageSetKey ? current.index : 0;
    return { imageSetKey, index: (currentIndex + delta + safeImages.length) % safeImages.length };
  });
  return <div className="grid gap-3">
    <div className="relative min-h-[320px] overflow-hidden rounded-2xl bg-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {safeImages.map((image, index) => <img key={`${image}-${index}`} src={resolveMediaUrl(image)} alt={index === active ? alt : ""} aria-hidden={index !== active} className={`absolute inset-0 h-full w-full object-contain p-6 mix-blend-multiply transition-opacity duration-700 ${index === active ? "opacity-100" : "pointer-events-none opacity-0"}`} />)}
      {safeImages.length > 1 && <>
        <Button type="button" variant="outline" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-sm" onClick={() => move(-1)} aria-label="Previous product image"><ChevronLeft size={18} /></Button>
        <Button type="button" variant="outline" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-sm" onClick={() => move(1)} aria-label="Next product image"><ChevronRight size={18} /></Button>
      </>}
    </div>
    {safeImages.length > 1 && <div className="flex justify-center gap-2" role="tablist" aria-label="Product images">{safeImages.map((image, index) => <button key={`${image}-dot`} type="button" role="tab" aria-selected={index === active} aria-label={`Show product image ${index + 1}`} onClick={() => setSelection({ imageSetKey, index })} className={`h-2 rounded-full transition-all ${index === active ? "w-6 bg-teal-700" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />)}</div>}
  </div>;
}
