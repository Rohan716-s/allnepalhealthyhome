"use client";

import { Toaster } from "sonner";
import { useSiteConfig, useSiteValue } from "@/components/site-config-provider";

const positions = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"] as const;
type ToastPosition = (typeof positions)[number];

function parsePosition(value: string): ToastPosition {
  return positions.includes(value as ToastPosition) ? value as ToastPosition : "top-right";
}

function parseDuration(value: string) {
  const duration = Number(value);
  return Number.isFinite(duration) ? Math.min(10000, Math.max(1500, duration)) : 4000;
}

export function ConfiguredToaster() {
  const { colorMode } = useSiteConfig();
  const position = parsePosition(useSiteValue("notification.toast.position", "top-right"));
  const duration = parseDuration(useSiteValue("notification.toast.duration", "4000"));
  return <Toaster theme={colorMode} position={position} duration={duration} closeButton richColors />;
}
