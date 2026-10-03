import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { ShopProvider } from "@/components/shop-provider";
import { SiteConfigProvider } from "@/components/site-config-provider";
import { SitePopup } from "@/components/site-popup";
import { SiteSeo } from "@/components/site-seo";
import { ManagementThemeProvider } from "@/components/management-theme-provider";
import { AiPharmacyAssistant } from "@/components/ai-pharmacy-assistant";
import { ConfiguredToaster } from "@/components/configured-toaster";
import { ConfirmationModalHost } from "@/components/confirmation-modal";
import { NotificationRealtime } from "@/components/notification-realtime";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "All Nepal Healthy Home",
  description: "Nepal-focused online pharmacy and healthcare platform",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout(props: { children: React.ReactNode; modal: React.ReactNode }) {
  const children = props.children;
  const modal = props.modal;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${devanagari.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="anhh-color-mode-bootstrap" strategy="beforeInteractive">
          {`(function () {
            try {
              var mode = window.localStorage.getItem("anhh-color-mode");
              if (mode !== "light" && mode !== "dark") return;
              var root = document.documentElement;
              root.classList.toggle("dark", mode === "dark");
              root.dataset.theme = mode;
              root.dataset.colorMode = mode;
            } catch (_) {}
          })();`}
        </Script>
        <Script id="home-reload-scroll-reset" strategy="beforeInteractive">
          {`(function () {
            if (window.location.pathname !== "/" || window.location.hash) return;
            var root = document.documentElement;
            var previousBehavior = root.style.scrollBehavior;
            var previousAnchor = root.style.overflowAnchor;
            try {
              // Prevent the browser's restored scroll position from becoming
              // visible while the homepage is hydrating and changing height.
              root.setAttribute("data-home-reload", "true");
              root.style.scrollBehavior = "auto";
              root.style.overflowAnchor = "none";
              window.history.scrollRestoration = "manual";
              var reset = function () {
                root.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
              };
              reset();
              document.addEventListener("DOMContentLoaded", reset, { once: true });
              window.addEventListener("load", reset, { once: true });
              window.setTimeout(function () {
                reset();
                root.style.scrollBehavior = previousBehavior;
                root.style.overflowAnchor = previousAnchor;
                root.removeAttribute("data-home-reload");
              }, 180);
            } catch (_) {
              root.style.scrollBehavior = previousBehavior;
              root.style.overflowAnchor = previousAnchor;
              root.removeAttribute("data-home-reload");
            }
          })();`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteConfigProvider>
          <ManagementThemeProvider>
            <SiteSeo />
            <ShopProvider>
              <NotificationRealtime />
              {children}
              <SitePopup />
              {modal}
              <AiPharmacyAssistant />
              <ConfirmationModalHost />
            </ShopProvider>
            <ConfiguredToaster />
          </ManagementThemeProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
