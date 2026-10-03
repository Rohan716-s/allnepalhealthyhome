"use client";

/* eslint-disable @next/next/no-img-element -- popup media URLs are database-managed and may use a configured CDN. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useSiteConfig } from "@/components/site-config-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveMediaUrl } from "@/services/api";
import { getPlatformDateInput } from "@/lib/platform-time-preferences";

type Popup = NonNullable<ReturnType<typeof useSiteConfig>["popups"]>[number];

function canShow(popup: Popup, loggedIn: boolean, mobile: boolean) {
  if (popup.audience === "GUESTS" && loggedIn || popup.audience === "LOGGED_IN" && !loggedIn) return false;
  if (mobile && !popup.mobileEnabled || !mobile && !popup.desktopEnabled) return false;
  if (popup.frequency === "ALWAYS") return true;
  const day = getPlatformDateInput();
  if (popup.frequency === "ONCE_PER_DAY") return window.localStorage.getItem(`anhh-popup-day-${popup.id}`) !== day;
  if (popup.frequency === "ONCE_PER_USER") return window.localStorage.getItem(`anhh-popup-user-${popup.id}`) !== "1";
  return window.sessionStorage.getItem(`anhh-popup-session-${popup.id}`) !== "1";
}

export function SitePopup() {
  const pathname = usePathname();
  const { popups = [] } = useSiteConfig();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/superadmin") || pathname.startsWith("/staff") || pathname.startsWith("/pharmacist") || pathname.startsWith("/delivery")) return;
    const loggedIn = Boolean(window.localStorage.getItem("anhh-access-token"));
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const next = popups.find(item => canShow(item, loggedIn, mobile));
    if (!next) return;
    const timer = window.setTimeout(() => { setPopup(next); setOpen(true); }, Math.max(0, next.delaySeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [pathname, popups]);

  function close() {
    if (!popup) return;
    const day = getPlatformDateInput();
    if (popup.frequency === "ONCE_PER_DAY") window.localStorage.setItem(`anhh-popup-day-${popup.id}`, day);
    else if (popup.frequency === "ONCE_PER_USER") window.localStorage.setItem(`anhh-popup-user-${popup.id}`, "1");
    else if (popup.frequency === "ONCE_PER_SESSION") window.sessionStorage.setItem(`anhh-popup-session-${popup.id}`, "1");
    setOpen(false);
  }

  if (!popup) return null;
  const isExternal = /^https?:\/\//i.test(popup.destination ?? "");
  return <Dialog open={open} onOpenChange={value => { if (!value) close(); else setOpen(true); }}><DialogContent className="max-w-xl overflow-hidden p-0"><div className="grid md:grid-cols-[.85fr_1.15fr]">{popup.imageUrl && <div className="hidden min-h-56 bg-slate-100 md:block"><img src={resolveMediaUrl(popup.imageUrl)} alt="" className="h-full w-full object-cover" /></div>}<div className="p-7"><DialogHeader><DialogTitle className="pr-6 text-2xl">{popup.title}</DialogTitle>{popup.description && <DialogDescription className="pt-2 leading-6">{popup.description}</DialogDescription>}</DialogHeader><DialogFooter className="mt-7 sm:justify-start"><DialogClose asChild><Button variant="outline" onClick={close}><X size={16} />Maybe later</Button></DialogClose>{popup.buttonText && popup.destination && (isExternal ? <a href={popup.destination} target="_blank" rel="noreferrer" onClick={close}><Button><ArrowRight size={16} />{popup.buttonText}</Button></a> : <Link href={popup.destination} onClick={close}><Button><ArrowRight size={16} />{popup.buttonText}</Button></Link>)}</DialogFooter></div></div></DialogContent></Dialog>;
}
