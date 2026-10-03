export type SiteDesignSettings = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  fontFamily: "Inter" | "Geist" | "Arial" | "system-ui";
  sideNavPosition: "LEFT" | "RIGHT";
  baseFontSize: number;
  headingWeight: number;
  bodyWeight: number;
  buttonWeight: number;
  headingLetterSpacing: string;
  bodyLineHeight: number;
  headingLineHeight: number;
  hoverStyle:
    | "NONE"
    | "COLOR_CHANGE"
    | "UNDERLINE"
    | "LIFT"
    | "SOFT_SCALE"
    | "BORDER_HIGHLIGHT"
    | "IMAGE_ZOOM"
    | "COMBINED_SUBTLE";
  hoverDuration: number;
  hoverScale: number;
  buttonRadius: number;
  buttonHeight: number;
  cardRadius: number;
  cardShadow: "NONE" | "SOFT" | "MEDIUM";
  headerBackground: string;
  headerText: string;
  headerActive: string;
  headerSticky: boolean;
  headerHeight: number;
  heroTextAnimation: string;
  heroImageAnimation: string;
  heroTransition: string;
  textDuration: number;
  textDelay: number;
  imageDuration: number;
  imageDelay: number;
  animationEasing: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  animationsEnabled: boolean;
  animationIntensity: "SUBTLE" | "STANDARD" | "EXPRESSIVE";
  reducedMotionSupport: boolean;
  scrollReveal: string;
  scrollDuration: number;
  scrollStagger: number;
  buttonAnimation: string;
};

export const defaultSiteDesign: SiteDesignSettings = {
  primary: "#003893",
  primaryDark: "#002B6F",
  primaryLight: "#EAF1FF",
  secondary: "#2563EB",
  secondaryDark: "#1D4ED8",
  secondaryLight: "#EFF6FF",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceSecondary: "#F1F5F9",
  textPrimary: "#111827",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  success: "#2563EB",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
  fontFamily: "Inter",
  sideNavPosition: "LEFT",
  baseFontSize: 16,
  headingWeight: 700,
  bodyWeight: 400,
  buttonWeight: 700,
  headingLetterSpacing: "-0.02em",
  bodyLineHeight: 1.6,
  headingLineHeight: 1.15,
  hoverStyle: "COMBINED_SUBTLE",
  hoverDuration: 200,
  hoverScale: 1.02,
  buttonRadius: 8,
  buttonHeight: 44,
  cardRadius: 16,
  cardShadow: "SOFT",
  headerBackground: "#FFFFFF",
  headerText: "#111827",
  headerActive: "#003893",
  headerSticky: true,
  headerHeight: 72,
  heroTextAnimation: "FADE_UP",
  heroImageAnimation: "SOFT_SCALE",
  heroTransition: "CROSS_FADE",
  textDuration: 700,
  textDelay: 0,
  imageDuration: 700,
  imageDelay: 100,
  animationEasing: "ease-out",
  animationsEnabled: true,
  animationIntensity: "STANDARD",
  reducedMotionSupport: true,
  scrollReveal: "FADE_UP",
  scrollDuration: 650,
  scrollStagger: 90,
  buttonAnimation: "SOFT_SCALE",
};

export type AnnouncementMessage = {
  id: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
  displayOrder: number;
  direction: "LEFT" | "RIGHT";
  speed: "SLOW" | "MEDIUM" | "FAST";
  pauseOnHover: boolean;
  startDate?: string;
  endDate?: string;
  active: boolean;
};

export type MarqueeSettings = {
  enabled: boolean;
  mode: "STATIC" | "SCROLL";
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  height: number;
  fontSize: number;
  fontWeight: number;
  separator: "DOT" | "DIVIDER";
  messages: AnnouncementMessage[];
};

export type ContactWidgetItem = {
  id: string;
  type: "CALL" | "WHATSAPP" | "EMAIL" | "MESSAGE" | "VIBER" | string;
  label: string;
  value: string;
  message?: string;
  subject?: string;
  color: string;
  enabled: boolean;
  displayOrder: number;
};

export type ContactWidgetSettings = {
  enabled: boolean;
  side: "LEFT" | "RIGHT";
  verticalPosition: "CENTER" | "BOTTOM";
  items: ContactWidgetItem[];
};

export const defaultContactWidget: ContactWidgetSettings = {
  enabled: true,
  side: "LEFT",
  verticalPosition: "CENTER",
  items: [
    { id: "call", type: "CALL", label: "Call us", value: "01-5313958", color: "#003893", enabled: true, displayOrder: 1 },
    { id: "whatsapp", type: "WHATSAPP", label: "WhatsApp", value: "", message: "Hello All Nepal Healthy Home", color: "#2563EB", enabled: false, displayOrder: 2 },
    { id: "email", type: "EMAIL", label: "Email us", value: "hello@allnepalhealthyhome.com", subject: "All Nepal Healthy Home enquiry", color: "#003893", enabled: true, displayOrder: 3 },
    { id: "viber", type: "VIBER", label: "Viber", value: "9851310286", color: "#003893", enabled: true, displayOrder: 4 },
  ],
};

// Older deployments stored a mix of crimson, purple, teal, and green values.
// Preserve intentionally chosen future values, while translating only the known
// legacy brand colours so existing sites receive the blue storefront immediately.
const legacyBrandColorMap: Record<string, string> = {
  "#dc143c": "#2563EB",
  "#b01030": "#1D4ED8",
  "#fff0f2": "#EFF6FF",
  "#15803d": "#2563EB",
  "#16a9db": "#003893",
  "#20c86b": "#2563EB",
  "#7029db": "#003893",
};

function normalizeLegacyBrandColor(color: string, fallback: string) {
  const normalized = color.trim().toLowerCase();
  return legacyBrandColorMap[normalized] ?? (normalized ? color : fallback);
}

export function parseContactWidget(value?: string): ContactWidgetSettings {
  if (!value) return defaultContactWidget;
  try {
    const parsed = JSON.parse(value) as Partial<ContactWidgetSettings>;
    return {
      ...defaultContactWidget,
      ...parsed,
      side: parsed.side === "RIGHT" ? "RIGHT" : "LEFT",
      verticalPosition: parsed.verticalPosition === "BOTTOM" ? "BOTTOM" : "CENTER",
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            ...item,
            color: item.type.toUpperCase() === "VIBER" && item.color?.trim().toLowerCase() === "#665cac"
              ? "#003893"
              : normalizeLegacyBrandColor(item.color ?? "", "#003893"),
          }))
        : defaultContactWidget.items,
    };
  } catch {
    return defaultContactWidget;
  }
}

export const defaultMarquee: MarqueeSettings = {
  enabled: true,
  mode: "SCROLL",
  backgroundColor: "#003893",
  textColor: "#FFFFFF",
  linkColor: "#FFFFFF",
  height: 36,
  fontSize: 13,
  fontWeight: 600,
  separator: "DIVIDER",
  messages: [],
};

export function parseSiteDesign(value?: string): SiteDesignSettings {
  if (!value) return defaultSiteDesign;
  try {
    const parsed = JSON.parse(value) as Partial<SiteDesignSettings>;
    return {
      ...defaultSiteDesign,
      ...parsed,
      secondary: normalizeLegacyBrandColor(parsed.secondary ?? "", defaultSiteDesign.secondary),
      secondaryDark: normalizeLegacyBrandColor(parsed.secondaryDark ?? "", defaultSiteDesign.secondaryDark),
      secondaryLight: normalizeLegacyBrandColor(parsed.secondaryLight ?? "", defaultSiteDesign.secondaryLight),
      success: normalizeLegacyBrandColor(parsed.success ?? "", defaultSiteDesign.success),
    };
  } catch {
    return defaultSiteDesign;
  }
}

export function parseMarquee(value?: string): MarqueeSettings {
  if (!value) return defaultMarquee;
  try {
    const parsed = JSON.parse(value) as Partial<MarqueeSettings>;
    return {
      ...defaultMarquee,
      ...parsed,
      backgroundColor: normalizeLegacyBrandColor(parsed.backgroundColor ?? "", defaultMarquee.backgroundColor),
      textColor: normalizeLegacyBrandColor(parsed.textColor ?? "", defaultMarquee.textColor),
      linkColor: normalizeLegacyBrandColor(parsed.linkColor ?? "", defaultMarquee.linkColor),
      mode: parsed.mode === "STATIC" ? "STATIC" : "SCROLL",
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return defaultMarquee;
  }
}

export function themeStyle(theme: SiteDesignSettings): CSSProperties {
  const fontFamily = theme.fontFamily === "Inter"
    ? "var(--font-inter, Inter), Arial, sans-serif"
    : theme.fontFamily === "Geist"
      ? "var(--font-geist-sans, Geist), Arial, sans-serif"
      : theme.fontFamily;
  return {
    "--color-primary": theme.primary,
    "--color-primary-dark": theme.primaryDark,
    "--color-primary-light": theme.primaryLight,
    "--color-secondary": theme.secondary,
    "--color-secondary-dark": theme.secondaryDark,
    "--color-secondary-light": theme.secondaryLight,
    "--color-background": theme.background,
    "--color-surface": theme.surface,
    "--color-surface-secondary": theme.surfaceSecondary,
    "--color-text-primary": theme.textPrimary,
    "--color-text-secondary": theme.textSecondary,
    "--color-border": theme.border,
    "--color-success": theme.success,
    "--color-warning": theme.warning,
    "--color-danger": theme.danger,
    "--color-info": theme.info,
    "--font-family": fontFamily,
    "--font-size-base": `${theme.baseFontSize}px`,
    "--font-heading-weight": theme.headingWeight,
    "--font-body-weight": theme.bodyWeight,
    "--font-button-weight": theme.buttonWeight,
    "--heading-letter-spacing": theme.headingLetterSpacing,
    "--body-line-height": theme.bodyLineHeight,
    "--heading-line-height": theme.headingLineHeight,
    "--hover-duration": `${theme.hoverDuration}ms`,
    "--hover-scale": theme.hoverScale,
    "--button-radius": `${theme.buttonRadius}px`,
    "--button-height": `${theme.buttonHeight}px`,
    "--card-radius": `${theme.cardRadius}px`,
    "--header-background": theme.headerBackground,
    "--header-text": theme.headerText,
    "--header-active": theme.headerActive,
    "--header-height": `${theme.headerHeight}px`,
  } as CSSProperties;
}
import type { CSSProperties } from "react";
