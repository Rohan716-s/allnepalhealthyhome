import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "All Nepal Healthy Home", short_name: "Healthy Home", description: "Healthcare and staff workspace with offline support", start_url: "/", scope: "/", display: "standalone", background_color: "#f1f5f9", theme_color: "#0f766e", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
