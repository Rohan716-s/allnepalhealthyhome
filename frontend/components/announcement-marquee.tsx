"use client";

import Link from "next/link";
import { useState } from "react";
import { useSiteConfig } from "@/components/site-config-provider";
import { localizedField } from "@/lib/i18n";

export function AnnouncementMarquee() {
  const { marquee, locale, t } = useSiteConfig();
  const [now] = useState(() => Date.now());
  const messages = marquee.messages
    .filter(
      (item) =>
        item.active &&
        item.message.trim().length > 0 &&
        (!item.startDate || new Date(item.startDate).getTime() <= now) &&
        (!item.endDate || new Date(item.endDate).getTime() >= now),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  if (!marquee.enabled || messages.length === 0) return null;
  const isScrolling = marquee.mode !== "STATIC";
  const duration =
    messages[0].speed === "FAST"
      ? 22
      : messages[0].speed === "MEDIUM"
        ? 32
        : 44;
  const content = messages.map((item) => (
    <span
      key={item.id}
      className="inline-flex items-center gap-5 whitespace-nowrap px-8"
    >
      <span>{localizedField(item as unknown as Record<string, unknown>, "message", locale) ?? item.message}</span>
      {((localizedField(item as unknown as Record<string, unknown>, "linkText", locale) ?? item.linkText) && item.linkUrl) && (
        <Link
          href={item.linkUrl}
          className="font-bold underline underline-offset-4"
          style={{ color: marquee.linkColor }}
        >
          {localizedField(item as unknown as Record<string, unknown>, "linkText", locale) ?? item.linkText}
        </Link>
      )}
      <span aria-hidden="true" className="opacity-50">
        {marquee.separator === "DIVIDER" ? "|" : "•"}
      </span>
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
      aria-label={t("header.announcements")}
    >
      {isScrolling ? (
        <div
          className={`announcement-track flex min-w-max items-center py-2 ${messages[0].direction === "RIGHT" ? "announcement-track-right" : ""} ${messages[0].pauseOnHover ? "announcement-pause-on-hover" : ""}`}
          style={{
            animationDuration: `${duration}s`,
            animationDirection:
              messages[0].direction === "RIGHT" ? "reverse" : "normal",
          }}
        >
          {content}
          <span aria-hidden="true">{content}</span>
        </div>
      ) : (
        <div className="flex min-h-full flex-wrap items-center justify-center py-2">
          {content}
        </div>
      )}
    </div>
  );
}
