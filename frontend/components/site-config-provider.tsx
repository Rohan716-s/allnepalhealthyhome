"use client";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate the persisted storefront preference after client mount. */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { GlobalTablePagination } from "@/components/global-table-pagination";
import { FloatingContactWidget } from "@/components/floating-contact-widget";
import { getPublicSiteConfig, PublicSiteConfig } from "@/services/api";
import { translate, type Locale, type Translate } from "@/lib/i18n";
import { configurePlatformTimePreferences } from "@/lib/platform-time-preferences";
import { DEFAULT_ORDERING_SETTINGS, ORDERING_SETTING_KEY } from "@/lib/ordering";
import {
  defaultMarquee,
  defaultSiteDesign,
  parseMarquee,
  defaultContactWidget,
  parseContactWidget,
  parseSiteDesign,
  themeStyle,
  type MarqueeSettings,
  type SiteDesignSettings,
} from "@/lib/site-design";

const defaults: PublicSiteConfig = {
  settings: {
    "website.name": "All Nepal Healthy Home",
    "website.tagline": "Trusted pharmacy care, delivered home",
    "website.contactPhone": "01-5313958",
    "website.contactEmail": "hello@allnepalhealthyhome.com",
    "website.address": "Kathmandu, Nepal",
    "workspace.banner.message": "Trusted healthcare operations · Accurate stock, sales and reports",
    "workspace.footer.developer": "Developed for {company_name}",
    "workspace.footer.contact": "Pharmacy Management Workspace",
    "workspace.footer.version": "PMC Workspace",
    "workspace.header.right": "ALL NEPAL",
    "workspace.labels": "{}",
    "workspace.menuOrder": "[\"Sales-Department\",\"Purchase-Department\",\"Reports-Inventory\",\"Reports-Account\",\"Catalogue\",\"Utility\",\"Setup\"]",
    "system.dateFormat": "AD",
    "system.timeFormat": "12",
    "system.timezone": "Asia/Kathmandu",
    "system.tablePageSize": "25",
    "website.contactWidget": JSON.stringify(defaultContactWidget),
    "notification.toast.position": "top-right",
    "notification.toast.duration": "4000",
    "notification.toast.signedIn": "Signed in successfully",
    "notification.toast.accountCreated": "Account created successfully",
    "notification.toast.staffSignedIn": "Secure staff sign-in complete",
    [ORDERING_SETTING_KEY]: JSON.stringify(DEFAULT_ORDERING_SETTINGS),
  },
  sections: [],
  assets: [],
  faqs: [],
  paymentMethods: [
    {
      code: "CASH_ON_DELIVERY",
      displayName: "Cash on Delivery",
      instructions: "Pay when your order arrives.",
      displayOrder: 10,
      enabled: true,
      requiresServerVerification: false,
    },
  ],
  navigation: [],
  popups: [],
  deliverySlots: [],
};
type SiteConfigValue = PublicSiteConfig & {
  design: SiteDesignSettings;
  marquee: MarqueeSettings;
  configLoaded: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  dateFormat: "AD" | "BS";
  timeFormat: "12" | "24";
  timeZone: string;
  colorMode: "light" | "dark";
  toggleColorMode: () => void;
  designPreview: boolean;
};
const SiteConfigContext = createContext<SiteConfigValue>({
  ...defaults,
  design: defaultSiteDesign,
  marquee: defaultMarquee,
  configLoaded: false,
  locale: "en",
  setLocale: () => undefined,
  t: (key) => key,
  dateFormat: "AD",
  timeFormat: "12",
  timeZone: "Asia/Kathmandu",
  colorMode: "light",
  toggleColorMode: () => undefined,
  designPreview: false,
});

export function SiteConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<PublicSiteConfig>(defaults);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [locale, setLocaleState] = useState<Locale>("en");
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [designPreview, setDesignPreview] = useState(false);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  useEffect(() => {
    const saved = window.localStorage.getItem("anhh-locale");
    if (saved !== "en" && saved !== "ne" && saved !== "hi") return;
    const timer = window.setTimeout(() => setLocaleState(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem("anhh-color-mode");
    if (saved !== "light" && saved !== "dark") return;
    setColorMode(saved);
  }, []);
  useEffect(() => {
    // Keep the document root in sync with the persisted preference so Tailwind
    // dark: variants and the token-based global palette work everywhere, not
    // only inside the storefront wrapper.
    document.documentElement.classList.toggle("dark", colorMode === "dark");
    document.documentElement.dataset.theme = colorMode;
    document.documentElement.dataset.colorMode = colorMode;
  }, [colorMode]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
  }, [locale]);
  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("anhh-locale", next);
  }
  function toggleColorMode() {
    setColorMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("anhh-color-mode", next);
      return next;
    });
  }
  useEffect(() => {
    const load = () => {
      getPublicSiteConfig()
        .then((nextConfig) => {
          const previewId = new URLSearchParams(window.location.search).get("designPreview");
          const previewKey = previewId ? `anhh-design-preview:${previewId}` : "";
          const previewValue = previewKey ? window.localStorage.getItem(previewKey) : null;
          if (previewValue) {
            try {
              const preview = JSON.parse(previewValue) as {
                design?: unknown;
                marquee?: unknown;
                contactWidget?: unknown;
                logoUrl?: unknown;
                createdAt?: number;
              };
              if (!preview.createdAt || Date.now() - preview.createdAt > 24 * 60 * 60 * 1000) {
                window.localStorage.removeItem(previewKey);
                throw new Error("Design preview expired");
              }
              const settings = { ...nextConfig.settings };
              settings["website.design"] = JSON.stringify(parseSiteDesign(JSON.stringify(preview.design ?? {})));
              settings["website.marquee"] = JSON.stringify(parseMarquee(JSON.stringify(preview.marquee ?? {})));
              settings["website.contactWidget"] = JSON.stringify(parseContactWidget(JSON.stringify(preview.contactWidget ?? {})));
              if (typeof preview.logoUrl === "string" && (preview.logoUrl.startsWith("/") || /^https:\/\//i.test(preview.logoUrl)))
                settings["website.logoUrl"] = preview.logoUrl;
              setConfig({ ...nextConfig, settings });
              setDesignPreview(true);
              setConfigLoaded(true);
              return;
            } catch {
              window.localStorage.removeItem(previewKey);
            }
          }
          setDesignPreview(false);
          setConfig(nextConfig);
          setConfigLoaded(true);
        })
        .catch(() => setConfigLoaded(true));
    };
    load();
    window.addEventListener("anhh:site-config-changed", load);
    return () => window.removeEventListener("anhh:site-config-changed", load);
  }, []);
  useEffect(() => {
    const onTablePageSizeChanged = (event: Event) => {
      const value = String((event as CustomEvent<number>).detail ?? "25");
      setConfig((current) => ({
        ...current,
        settings: { ...current.settings, "system.tablePageSize": value },
      }));
    };
    window.addEventListener("anhh:table-page-size-changed", onTablePageSizeChanged);
    return () => window.removeEventListener("anhh:table-page-size-changed", onTablePageSizeChanged);
  }, []);
  const staffRoute =
    /^(\/admin|\/superadmin|\/staff|\/pharmacist|\/delivery)(\/|$)/.test(
      pathname,
    );
  const design = useMemo(
    () => parseSiteDesign(config.settings["website.design"]),
    [config.settings],
  );
  const marquee = useMemo(
    () => parseMarquee(config.settings["website.marquee"]),
    [config.settings],
  );
  const contactWidget = useMemo(
    () => {
      const saved = config.settings["website.contactWidget"];
      const parsed = parseContactWidget(saved);
      if (saved) return parsed;
      return {
        ...parsed,
        items: parsed.items.map((item) => item.type === "CALL"
          ? { ...item, value: config.settings["website.contactPhone"] ?? item.value }
          : item.type === "EMAIL"
            ? { ...item, value: config.settings["website.contactEmail"] ?? item.value }
            : item),
      };
    },
    [config.settings],
  );
  const maintenance =
    config.settings["maintenance.enabled"] === "true" && !staffRoute;
  const t: Translate = (key, values) => translate(locale, key, values);
  const dateFormat = config.settings["system.dateFormat"] === "BS" ? "BS" : "AD";
  const timeFormat = config.settings["system.timeFormat"] === "24" ? "24" : "12";
  const timeZone = config.settings["system.timezone"]?.trim() || "Asia/Kathmandu";
  const quietOverlayRoute = pathname === "/messages" || pathname === "/register";
  configurePlatformTimePreferences(timeZone, timeFormat);
  return (
      <SiteConfigContext.Provider value={{ ...config, design, marquee, configLoaded, locale, setLocale, t, dateFormat, timeFormat, timeZone, colorMode, toggleColorMode, designPreview }}>
      <div
        style={themeStyle(design)}
        className={`site-theme-root ${staffRoute ? "workspace-theme" : "storefront-blue-theme"} locale-${locale} site-hover-${design.hoverStyle.toLowerCase()} ${design.animationsEnabled === false ? "motion-off" : ""} ${colorMode === "dark" ? "site-color-dark" : ""}`}
        data-locale={locale}
        data-date-format={dateFormat}
        data-color-mode={colorMode}
      >
        {designPreview && (
          <div className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-950 shadow-sm" role="status">
            <span>Read-only design preview · Unsaved changes are temporary</span>
            <button type="button" className="rounded-md border border-amber-300 bg-white px-3 py-1 font-extrabold hover:bg-amber-50" onClick={() => { const previewId = new URLSearchParams(window.location.search).get("designPreview"); if (previewId) window.localStorage.removeItem(`anhh-design-preview:${previewId}`); setDesignPreview(false); router.replace("/", { scroll: false }); void getPublicSiteConfig().then(setConfig).catch(() => undefined); }}>Exit preview</button>
          </div>
        )}
        {maintenance ? (
          <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-center">
            <div className="max-w-lg">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Wrench size={30} aria-hidden="true" />
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950">
                We’ll be back shortly
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {config.settings["maintenance.message"] ||
                  "We are making a few improvements. Please check back shortly."}
              </p>
              <p className="mt-6 text-sm font-semibold text-slate-500">
                All Nepal Healthy Home
              </p>
            </div>
          </main>
        ) : (
          <>
            {designPreview ? (
              <div
                className="design-preview-readonly"
                onClickCapture={(event) => {
                  const target = event.target;
                  if (target instanceof Element && target.closest("button, input, select, textarea, [role=button]")) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
                onSubmitCapture={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {children}
              </div>
            ) : children}
            {!staffRoute && !quietOverlayRoute && <FloatingContactWidget settings={contactWidget} />}
            <GlobalTablePagination />
          </>
        )}
      </div>
    </SiteConfigContext.Provider>
  );
}
export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
export function useI18n() {
  const { locale, setLocale, t } = useContext(SiteConfigContext);
  return { locale, setLocale, t };
}
export function useSiteValue(key: string, fallback: string) {
  const { settings } = useSiteConfig();
  return useMemo(() => settings[key] ?? fallback, [settings, key, fallback]);
}
