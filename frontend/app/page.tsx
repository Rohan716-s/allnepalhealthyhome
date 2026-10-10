"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  ChevronRight,
  HeartPulse,
  Leaf,
  Pill,
  Sparkles,
  Stethoscope,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { HeroSlider, type HeroSlideData } from "@/components/hero-slider";
import { ScrollReveal } from "@/components/animated";
import { ProductCard, SectionHeading } from "@/components/product-card";
import { HotHealthDealsCarousel } from "@/components/hot-health-deals-carousel";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n, useSiteConfig } from "@/components/site-config-provider";
import { type Product as CatalogProduct } from "@/lib/catalog";
import { localizedField } from "@/lib/i18n";
import {
  getCatalogBrands,
  getCatalogCategories,
  getProducts,
  getHotDealProducts,
  getTrendingProducts,
  getPublicHealthArticles,
  resolveMediaUrl,
  type AdminHealthArticle,
  type CatalogBrand,
  type CatalogCategory,
  type Product as ApiProduct,
  type TrendingProduct,
} from "@/services/api";

type HomepageSection = ReturnType<typeof useSiteConfig>["sections"][number];
type SectionContent = { description?: string; link?: string };
type TrustImageKey = "information" | "verification" | "delivery";

const defaultTrustImages: Record<TrustImageKey, string> = {
  information: "/trust-product-information.png",
  verification: "/trust-verification.png",
  delivery: "/trust-delivery-nepal.png",
};

const categoryVisuals: { Icon: LucideIcon; tone: string }[] = [
  { Icon: Pill, tone: "bg-blue-50 text-blue-700" },
  { Icon: HeartPulse, tone: "bg-rose-50 text-rose-700" },
  { Icon: Leaf, tone: "bg-blue-50 text-blue-700" },
  { Icon: Boxes, tone: "bg-amber-50 text-amber-700" },
  { Icon: Sparkles, tone: "bg-violet-50 text-violet-700" },
];

function toCatalogProduct(product: ApiProduct): CatalogProduct {
  const pricesVisible = product.pricesVisible !== false;
  return {
    // Keep the storefront identifier aligned with ShopProvider and product routes.
    // The API id is a UUID, while cart lines and `/products/[slug]` use the slug.
    id: product.slug,
    name: product.name,
    genericName: product.genericName,
    brand: product.brand,
    category: product.category,
    description: "",
    price: product.flashSalePrice ?? product.sellingPrice,
    mrp: pricesVisible ? (product.flashSalePrice ? product.sellingPrice : product.mrp) : undefined,
    badge: pricesVisible && product.flashSalePrice ? `${product.flashSaleDiscountPercent}% off` : undefined,
    wholesaleDiscountPercent: pricesVisible ? product.wholesaleDiscountPercent : undefined,
    bonusScheme: pricesVisible ? product.bonusScheme : undefined,
    stock: product.stockQuantity,
    unit: product.dosageForm ?? "Pack",
    sku: product.sku,
    prescriptionRequired: product.prescriptionRequired,
    pricesVisible,
    featured: product.isFeatured,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    visual: product.name.slice(0, 3).toUpperCase(),
    tone: "from-blue-50 to-slate-50",
  };
}

function toHotDealProduct(product: TrendingProduct): CatalogProduct {
  return { id: product.slug, name: product.name, genericName: "", brand: "", category: "", description: "", price: product.sellingPrice, stock: Math.max(0, product.stockQuantity ?? 0), unit: "Pack", sku: "", prescriptionRequired: false, featured: false, pricesVisible: product.pricesVisible !== false, imageUrl: product.imageUrl, imageUrls: product.imageUrls, visual: product.name.slice(0, 3).toUpperCase(), tone: "from-rose-50 to-amber-50" };
}

function sectionContent(section?: HomepageSection): SectionContent {
  if (!section?.contentJson) return {};
  try {
    const parsed = JSON.parse(section.contentJson) as SectionContent;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function trustImages(section?: HomepageSection): Record<TrustImageKey, string> {
  if (!section?.contentJson) return defaultTrustImages;
  try {
    const parsed = JSON.parse(section.contentJson) as Record<string, unknown>;
    return {
      information: typeof parsed.imageInformation === "string" ? parsed.imageInformation : defaultTrustImages.information,
      verification: typeof parsed.imageVerification === "string" ? parsed.imageVerification : defaultTrustImages.verification,
      delivery: typeof parsed.imageDelivery === "string" ? parsed.imageDelivery : defaultTrustImages.delivery,
    };
  } catch {
    return defaultTrustImages;
  }
}

function initials(label: string) {
  return label.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function QuickServices() {
  const { t } = useI18n();
  const services = [
    { icon: Truck, title: t("header.delivering"), text: t("footer.tagline"), href: "/articles/delivering-across-nepal" },
    { icon: Stethoscope, title: t("menu.pharmacySupport"), text: t("menu.howVerificationWorks"), href: "/articles/pharmacy-support-and-verification" },
  ];
  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
      <div className="grid overflow-hidden rounded-3xl border border-slate-200/90 bg-slate-200/80 shadow-[0_20px_55px_-28px_rgba(15,23,42,0.4)] md:grid-cols-2">
        {services.map(({ icon: Icon, title, text, href }, index) => (
          <Link
            key={title}
            href={href}
            className="group relative isolate flex min-h-[142px] items-start gap-4 overflow-hidden bg-white p-5 transition duration-300 hover:bg-slate-50 sm:min-h-[156px] sm:gap-5 sm:p-7 lg:p-8"
          >
            <span className="pointer-events-none absolute -right-10 -top-16 -z-10 h-40 w-40 rounded-full bg-[var(--color-primary-light)]/60 blur-3xl transition duration-500 group-hover:scale-125" />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 text-[var(--color-primary)] shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:from-[var(--color-primary)] group-hover:to-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-900/15 sm:h-14 sm:w-14">
              <Icon size={22} strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col self-stretch">
              <span className="flex items-start justify-between gap-3">
                <span className="text-[15px] font-extrabold tracking-[-0.01em] text-slate-900 sm:text-base">{title}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-400 transition duration-300 group-hover:translate-x-1 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-[var(--color-primary)]">
                  <ChevronRight size={15} />
                </span>
              </span>
              <span className="mt-2 max-w-md text-xs leading-5 text-slate-500 sm:text-[13px] sm:leading-6">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CategoryGrid({ categories }: { categories: CatalogCategory[] }) {
  const { locale, t } = useI18n();
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{categories.slice(0, 10).map((category, index) => { const visual = categoryVisuals[index % categoryVisuals.length]; const label = localizedField(category as unknown as Record<string, unknown>, "name", locale) ?? category.name; return <Link key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`} className="site-category-card group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${visual.tone}`}><visual.Icon size={22} /></span><span className="mt-5 block truncate text-sm font-extrabold text-slate-900 group-hover:text-[var(--color-primary)]">{label}</span><span className="mt-1 block text-xs text-slate-400">{category.productCount} {category.productCount === 1 ? "item" : "items"}</span><span className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]">{t("menu.viewAllMedicines")} <ArrowRight size={13} /></span></Link>; })}</div>;
}

function BrandGrid({ brands }: { brands: CatalogBrand[] }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{brands.slice(0, 12).map((brand) => <Link key={brand.id} href={`/products?brand=${encodeURIComponent(brand.slug)}`} className="group flex min-h-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5"><span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-500 transition group-hover:bg-[var(--color-primary-light)] group-hover:text-[var(--color-primary)]">{initials(brand.name)}</span><span className="mt-3 line-clamp-1 text-sm font-extrabold text-slate-800">{brand.name}</span><span className="mt-1 text-[11px] text-slate-400">{brand.productCount} products</span></Link>)}</div>;
}

function QuickAccess() {
  const items = [
    { label: "Categories", description: "Browse products by health need", href: "/categories", Icon: Pill },
    { label: "Brands", description: "Shop trusted healthcare brands", href: "/brands", Icon: Tags },
    { label: "Articles", description: "Read practical health guidance", href: "/articles", Icon: BookOpen },
  ];
  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{items.map(({ label, description, href, Icon }) => <Link key={label} href={href} className="group flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#003893] hover:bg-[#003893] hover:shadow-lg hover:shadow-blue-900/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893] focus-visible:ring-offset-2 sm:p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf1ff] text-[#003893] transition-colors duration-200 group-hover:bg-white/15 group-hover:text-white"><Icon size={21} strokeWidth={2} /></span><span className="mt-5 flex items-center justify-between gap-3"><span className="text-sm font-extrabold text-slate-900 transition-colors duration-200 group-hover:text-white">{label}</span><ArrowRight size={16} className="shrink-0 text-slate-300 transition duration-200 group-hover:translate-x-1 group-hover:text-white" /></span><span className="mt-1 text-xs leading-5 text-slate-500 transition-colors duration-200 group-hover:text-white/75">{description}</span></Link>)}</div></section>;
}

function CategoryTabs({ categories }: { categories: CatalogCategory[] }) {
  const tabs = [{ label: "All medicines", href: "/products" }, ...categories.slice(0, 5).map((category) => ({ label: category.name, href: `/products?category=${encodeURIComponent(category.slug)}` }))];
  return <div className="mb-7 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">{tabs.map((tab, index) => <Link key={tab.href} href={tab.href} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${index === 0 ? "bg-[var(--color-primary)] text-white" : "bg-slate-50 text-slate-600 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"}`}>{tab.label}</Link>)}</div>;
}

function ProductShelf({ title, eyebrow, description, products, link = "/products", tone = "" }: { title: string; eyebrow?: string; description?: string; products: CatalogProduct[]; link?: string; tone?: string }) {
  if (!products.length) return null;
  return <section className={`px-4 py-16 sm:px-6 lg:px-8 ${tone}`}><div className="mx-auto max-w-7xl"><SectionHeading eyebrow={eyebrow} title={title} description={description} link={link} /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>;
}

function TrustStrip({ section }: { section?: HomepageSection }) {
  const { t } = useI18n();
  const images = trustImages(section);
  const items = [
    { image: images.information, title: "Clear product information", description: "Browse names, brands, strengths and stock clearly." },
    { image: images.verification, title: t("menu.howVerificationWorks"), description: t("menu.verificationDescription") },
    { image: images.delivery, title: t("header.delivering"), description: t("footer.tagline") },
  ];
  return <section className="site-trust-strip border-y border-slate-200 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8" aria-label="Why shop with All Nepal Healthy Home"><div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">{items.map(({ image, title, description }) => <Card key={title} className="site-trust-card border-slate-200 bg-white shadow-none"><CardContent className="flex gap-4 p-5 sm:items-center"><span className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--color-primary-light)] p-1 sm:h-32 sm:w-32"><img src={resolveMediaUrl(image)} alt={title} loading="lazy" className="h-full w-full object-contain" /></span><div><h3 className="text-sm font-extrabold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></CardContent></Card>)}</div></section>;
}

function ArticleShelf({ articles }: { articles: AdminHealthArticle[] }) {
  if (!articles.length) return null;
  return <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Health information" title="Useful reads for everyday care." link="/articles" /><div className="grid gap-5 md:grid-cols-3">{articles.slice(0, 3).map((article) => <Link key={article.id} href={`/articles/${article.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5"><div className="flex h-40 items-center justify-center overflow-hidden bg-[var(--color-primary-light)] text-[var(--color-primary)]">{article.featuredImageUrl ? <img src={resolveMediaUrl(article.featuredImageUrl)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <BookOpen size={42} strokeWidth={1.4} />}</div><div className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-secondary)]">{article.category ?? "Health guide"}</p><h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-6 text-slate-900 group-hover:text-[var(--color-primary)]">{article.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{article.excerpt ?? article.content}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]">Read article <ArrowRight size={13} /></span></div></Link>)}</div></div></section>;
}

function ResetHomeScrollOnReload() {
  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload" || window.location.hash) return;

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    window.history.scrollRestoration = "manual";
    root.style.scrollBehavior = "auto";
    const resetScroll = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetScroll();
    const frame = window.requestAnimationFrame(() => {
      resetScroll();
      root.style.scrollBehavior = previousScrollBehavior;
    });
    const settle = window.setTimeout(resetScroll, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      root.style.scrollBehavior = previousScrollBehavior;
    };
  }, []);

  return null;
}

function HomepageLoadingShell() {
  return <><ResetHomeScrollOnReload /><div className="min-h-screen bg-white"><SiteHeader /><main aria-busy="true"><section className="relative bg-white"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8"><div className="grid min-h-[520px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><div className="w-full max-w-xl animate-pulse space-y-4 px-8"><div className="h-3 w-28 rounded-full bg-slate-200" /><div className="h-12 w-4/5 rounded-xl bg-slate-200" /><div className="h-4 w-full rounded-full bg-slate-200" /><div className="h-4 w-3/4 rounded-full bg-slate-200" /><div className="h-11 w-32 rounded-lg bg-slate-200" /></div></div></div></section></main><SiteFooter /></div></>;
}

function LiveHome() {
  const { assets, sections, design, configLoaded } = useSiteConfig();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [danalacProducts, setDanalacProducts] = useState<ApiProduct[]>([]);
  const [newProducts, setNewProducts] = useState<ApiProduct[]>([]);
  const [articles, setArticles] = useState<AdminHealthArticle[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [hotDealProducts, setHotDealProducts] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getCatalogCategories(), getCatalogBrands(), getProducts({ pageSize: 24, sort: "popular" }), getProducts({ pageSize: 4, sort: "newest" }), getProducts({ search: "Danalac", pageSize: 8, sort: "popular" }), getPublicHealthArticles(), getTrendingProducts(), getHotDealProducts()]).then(([categoryResult, brandResult, productResult, newResult, danalacResult, articleResult, trendingResult, hotDealResult]) => {
      if (!active) return;
      if (categoryResult.status === "fulfilled") setCategories(categoryResult.value);
      if (brandResult.status === "fulfilled") setBrands(brandResult.value);
      if (productResult.status === "fulfilled") setProducts(productResult.value.items);
      if (newResult.status === "fulfilled") setNewProducts(newResult.value.items);
      if (danalacResult.status === "fulfilled") setDanalacProducts(danalacResult.value.items);
      if (articleResult.status === "fulfilled") setArticles(articleResult.value);
      if (trendingResult.status === "fulfilled") setTrendingProducts(trendingResult.value);
      if (hotDealResult.status === "fulfilled") setHotDealProducts(hotDealResult.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const orderedSections = useMemo(() => sections.slice().sort((a, b) => a.displayOrder - b.displayOrder), [sections]);
  const sectionMap = useMemo(() => new Map(orderedSections.map((section) => [section.sectionKey.toLowerCase(), section])), [orderedSections]);
  if (!configLoaded || loading) return <HomepageLoadingShell />;

  const configured = sections.length > 0;
  const isEnabled = (key: string) => !configured || sectionMap.get(key)?.enabled !== false;
  const sectionTitle = (key: string, fallback: string) => sectionMap.get(key)?.title || fallback;
  const content = (key: string) => sectionContent(sectionMap.get(key));
  const featuredProducts = products.filter((product) => product.isFeatured).map(toCatalogProduct);
  const offerProducts = products.filter((product) => Boolean(product.flashSalePrice) || product.sellingPrice < product.mrp).map(toCatalogProduct);
  const slides: HeroSlideData[] = assets.filter((asset) => asset.kind === "HERO" && asset.enabled).map((asset) => ({ ...asset, buttonUrl: asset.destination, desktopImage: asset.imageUrl, mobileImage: asset.mobileImageUrl, isActive: asset.enabled }));

  const sectionNodes: Record<string, ReactNode> = {
    hero: slides.length ? <section className="relative bg-white"><div className="mx-auto max-w-7xl px-0 pt-0 sm:px-6 sm:pt-5 lg:px-8"><HeroSlider slides={slides} trendingProducts={trendingProducts} /></div></section> : null,
    "quick-access": <QuickAccess />,
    "quick-services": <QuickServices />,
    promo: <HotHealthDealsCarousel products={hotDealProducts.map(toHotDealProduct)} />,
    categories: categories.length ? <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><SectionHeading eyebrow="Browse by need" title={sectionTitle("categories", "Shop by category")} description={content("categories").description ?? "Find everyday medicines and health essentials by category."} link={content("categories").link ?? "/categories"} /><CategoryTabs categories={categories} /><CategoryGrid categories={categories} /></section> : null,
    featured: featuredProducts.length ? <ProductShelf title={sectionTitle("featured", "Featured medicines")} eyebrow="Selected from the catalogue" description={content("featured").description ?? "Browse products currently marked as featured by the pharmacy team."} products={featuredProducts} /> : null,
    deals: offerProducts.length ? <ProductShelf title={sectionTitle("deals", "Current offers")} eyebrow="Live catalogue pricing" description={content("deals").description ?? "See products with a current price difference or active sale."} products={offerProducts} tone="bg-slate-50" /> : null,
    brands: brands.length ? <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><SectionHeading eyebrow="Browse by manufacturer" title={sectionTitle("brands", "Shop trusted brands")} link="/brands" /><BrandGrid brands={brands} /></section> : null,
    danalac: danalacProducts.length ? <ProductShelf title="Explore Danalac products" eyebrow="Danalac Nepal" description="Explore Danalac nutrition products available in our catalogue." products={danalacProducts.map(toCatalogProduct)} link="/products?search=Danalac" /> : null,
    prescription: null,
    "new-arrivals": newProducts.length ? <ProductShelf title={sectionTitle("new-arrivals", "New to the catalogue")} eyebrow="Recently published" description={content("new-arrivals").description} products={newProducts.map(toCatalogProduct)} tone="bg-slate-50" /> : null,
    trust: <TrustStrip section={sectionMap.get("trust")} />,
    articles: <ArticleShelf articles={articles} />,
  };
  const configuredOrder = orderedSections.map((section) => section.sectionKey.toLowerCase());
  const defaultOrder = ["hero", "promo", "quick-access", "quick-services", "categories", "featured", "deals", "brands", "danalac", "prescription", "new-arrivals", "trust", "articles"];
  const configuredBaseOrder = configured ? configuredOrder : defaultOrder;
  const brandIndex = configuredBaseOrder.indexOf("brands");
  const savedOrder = configuredBaseOrder.includes("danalac") || brandIndex < 0
    ? configuredBaseOrder
    : [...configuredBaseOrder.slice(0, brandIndex + 1), "danalac", ...configuredBaseOrder.slice(brandIndex + 1)];
  const orderWithoutQuickAccess = savedOrder.filter((key) => key !== "quick-access");
  const heroIndex = orderWithoutQuickAccess.indexOf("hero");
  const orderWithQuickAccess = heroIndex >= 0
    ? [...orderWithoutQuickAccess.slice(0, heroIndex + 1), "quick-access", ...orderWithoutQuickAccess.slice(heroIndex + 1)]
    : ["quick-access", ...orderWithoutQuickAccess];
  const heroPosition = orderWithQuickAccess.indexOf("hero");
  const order = orderWithQuickAccess.includes("promo")
    ? orderWithQuickAccess
    : (orderWithQuickAccess.includes("quick-access") || heroPosition >= 0)
      ? (() => {
          const anchor = orderWithQuickAccess.includes("quick-access") ? orderWithQuickAccess.indexOf("quick-access") : heroPosition;
          return [...orderWithQuickAccess.slice(0, anchor + 1), "promo", ...orderWithQuickAccess.slice(anchor + 1)];
        })()
      : ["promo", ...orderWithQuickAccess];

  return <><ResetHomeScrollOnReload /><div className="min-h-screen bg-white"><SiteHeader /><main>{order.map((key, index) => isEnabled(key) && sectionNodes[key] ? <ScrollReveal key={key} animation={key === "hero" ? "NONE" : design.scrollReveal} duration={design.scrollDuration} delay={(index % 3) * design.scrollStagger}>{sectionNodes[key]}</ScrollReveal> : null)}</main>{loading && <div className="sr-only" aria-live="polite">Loading catalogue</div>}<SiteFooter /></div></>;
}

export default function Home() {
  return <LiveHome />;
}
