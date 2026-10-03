"use client";

import { useEffect } from "react";
import { useSiteConfig } from "@/components/site-config-provider";

function setMeta(name: string, content?: string) {
  if (!content) return;
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function setProperty(property: string, content?: string) {
  if (!content) return;
  let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function SiteSeo() {
  const { seo, settings } = useSiteConfig();

  useEffect(() => {
    const title = seo?.title || settings["website.name"];
    if (title) document.title = title;
    setMeta("description", seo?.metaDescription);
    setMeta("keywords", seo?.keywords);
    setMeta("robots", seo?.robots);
    setProperty("og:title", seo?.ogTitle || seo?.title);
    setProperty("og:description", seo?.ogDescription || seo?.metaDescription);
    setProperty("og:image", seo?.ogImageUrl);
    setProperty("og:url", seo?.canonicalUrl);
    if (seo?.canonicalUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = seo.canonicalUrl;
    }
  }, [seo, settings]);

  return null;
}
