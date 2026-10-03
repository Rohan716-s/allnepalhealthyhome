"use client";

import { Mail, Phone, Send } from "lucide-react";
import { defaultContactWidget, type ContactWidgetItem, type ContactWidgetSettings } from "@/lib/site-design";

function iconFor(type: ContactWidgetItem["type"]) {
  switch (type.toUpperCase()) {
    case "CALL": return Phone;
    case "EMAIL": return Mail;
    default: return Send;
  }
}

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.02 3.2A12.76 12.76 0 0 0 5.13 22.61L3.4 28.8l6.52-1.72A12.8 12.8 0 1 0 16.02 3.2Zm0 23.2c-1.97 0-3.9-.52-5.59-1.51l-.4-.24-3.87 1.02 1.03-3.77-.26-.41a10.36 10.36 0 1 1 9.09 4.91Zm6.1-8.35c-.34-.17-2.02-1-2.33-1.11-.31-.11-.54-.17-.77.17-.23.34-.88 1.11-1.08 1.34-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.69-2.02-1.89-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.08-.17-.77-1.86-1.05-2.55-.28-.67-.56-.58-.77-.59h-.66c-.23 0-.6.09-.91.43-.31.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.42 3.69 5.86 5.17.82.36 1.46.58 1.96.74.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.3-1.62.28-.8.28-1.49.2-1.63-.08-.14-.31-.23-.66-.4Z" />
    </svg>
  );
}

function ViberIcon({ size }: { size: number }) {
  return <img src="/viber-logo.png" width={size} height={size} alt="" aria-hidden="true" className="object-contain" />;
}

function linkFor(item: ContactWidgetItem) {
  const value = item.value.trim();
  if (!value) return undefined;
  switch (item.type.toUpperCase()) {
    case "CALL": return `tel:${value.replace(/[^+\d]/g, "")}`;
    case "WHATSAPP": {
      const configuredUrl = /^(?:https:\/\/)?(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(value)
        ? new URL(value.startsWith("https://") ? value : `https://${value}`)
        : null;
      if (configuredUrl) {
        if (configuredUrl.protocol !== "https:") return undefined;
        if (item.message?.trim()) configuredUrl.searchParams.set("text", item.message.trim());
        return configuredUrl.toString();
      }
      if (/^https?:\/\//i.test(value)) return undefined;
      const digits = value.replace(/\D/g, "");
      const number = value.startsWith("+") || digits.startsWith("977")
        ? digits
        : digits.startsWith("0")
          ? `977${digits.slice(1)}`
          : digits.length === 10
            ? `977${digits}`
            : digits;
      return number ? `https://wa.me/${number}${item.message?.trim() ? `?text=${encodeURIComponent(item.message.trim())}` : ""}` : undefined;
    }
    case "EMAIL":
    case "MESSAGE": {
      const query = item.subject?.trim() ? `?subject=${encodeURIComponent(item.subject.trim())}` : "";
      return `mailto:${value}${query}`;
    }
    case "VIBER": return `viber://chat?number=${encodeURIComponent(value)}`;
    default: return value.startsWith("http") ? value : undefined;
  }
}

export function FloatingContactWidget({ settings = defaultContactWidget, preview = false }: { settings?: ContactWidgetSettings; preview?: boolean }) {
  const items = settings.enabled ? settings.items.filter(item => item.enabled).sort((a, b) => a.displayOrder - b.displayOrder) : [];
  if (!items.length) return null;
  const position = preview ? `absolute top-1/2 -translate-y-1/2 ${settings.side === "RIGHT" ? "right-3" : "left-3"}` : settings.verticalPosition === "BOTTOM" ? `fixed bottom-8 z-50 ${settings.side === "RIGHT" ? "right-0" : "left-0"}` : `fixed top-1/2 z-50 -translate-y-1/2 ${settings.side === "RIGHT" ? "right-0" : "left-0"}`;
  return <div className={`${position} floating-contact-widget flex flex-col overflow-hidden rounded-r-sm shadow-lg ${settings.side === "RIGHT" && !preview ? "rounded-l-sm rounded-r-none" : ""}`} data-side={settings.side.toLowerCase()} data-preview={preview} data-vertical-position={settings.verticalPosition.toLowerCase()} aria-label="Contact options">{items.map(item => { const type = item.type.toUpperCase(); const whatsapp = type === "WHATSAPP"; const viber = type === "VIBER"; const Icon = iconFor(item.type); const href = linkFor(item); const content = <>{whatsapp ? <WhatsAppIcon size={22} /> : viber ? <ViberIcon size={28} /> : <Icon size={22} strokeWidth={2.2} aria-hidden="true" />}<span className="sr-only">{item.label || item.type}</span></>; return href ? <a key={item.id} href={href} title={item.label || item.type} aria-label={item.label || item.type} target={whatsapp || viber ? "_blank" : undefined} rel="noreferrer" className="flex h-10 w-10 items-center justify-center text-white transition duration-200 hover:brightness-110 hover:scale-105 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:h-11 sm:w-11" style={{ backgroundColor: item.color || "#003893" }}>{content}</a> : <span key={item.id} title={`${item.label || item.type} is not configured`} aria-label={`${item.label || item.type} is not configured`} className="flex h-10 w-10 cursor-not-allowed items-center justify-center bg-slate-300 text-white opacity-80 sm:h-11 sm:w-11">{content}</span>; })}</div>;
}
