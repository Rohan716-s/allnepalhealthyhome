"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  FileText,
  Heart,
  ImageOff,
  ShoppingBag,
} from "lucide-react";
import { type Product } from "@/lib/catalog";
import { formatNPRLocale } from "@/lib/i18n";
import { resolveMediaUrl } from "@/services/api";
import { useShop } from "@/components/shop-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { useI18n, useSiteConfig } from "@/components/site-config-provider";
import { getOrderingCopy, getProductOrderingText, ORDERING_SETTING_KEY, parseOrderingSettings } from "@/lib/ordering";

export function ProductVisual({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const images = product.imageUrls?.filter(Boolean).slice(0, 5) ?? (product.imageUrl ? [product.imageUrl] : []);
  const primaryImage = images[0] ?? product.imageUrl;
  const primaryImageSrc = primaryImage ? resolveMediaUrl(primaryImage) : undefined;
  const primaryImageFailed = primaryImageSrc !== undefined && failedImage === primaryImageSrc;
  const secondaryImage = images[1];
  return (
    <div
      className={`relative flex ${large ? "min-h-[320px]" : "h-48"} items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${product.tone} dark:from-slate-800/80 dark:to-slate-900/90`}
    >
      {(product.imageUrl || images.length) && !primaryImageFailed ? (
        <>
        <img src={primaryImageSrc} alt="" onError={() => primaryImageSrc && setFailedImage(primaryImageSrc)} className={`h-full w-full object-contain p-5 mix-blend-multiply dark:mix-blend-normal transition-opacity duration-500 ${secondaryImage ? "group-hover:opacity-0" : ""}`} />
        {secondaryImage && <img src={resolveMediaUrl(secondaryImage)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain p-5 mix-blend-multiply dark:mix-blend-normal opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
        </>
      ) : (
        <>
          <div className="absolute -right-9 -top-10 h-32 w-32 rounded-full border-[18px] border-white/30 dark:border-slate-700/30" />
          <div className="absolute -bottom-16 -left-6 h-36 w-36 rounded-full bg-white/30 dark:bg-slate-700/30" />
          <div className="relative grid place-items-center gap-2 text-slate-500/70 dark:text-slate-400">
            <ImageOff size={26} strokeWidth={1.5} />
            <span
              className={`${large ? "text-5xl" : "text-3xl"} font-black tracking-[0.14em]`}
            >
              {product.visual}
            </span>
          </div>
        </>
      )}
      {product.badge && (
        <Badge className="absolute left-3 top-3 border-0 bg-white/90 text-[10px] uppercase tracking-wide text-slate-600 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
          {product.badge}
        </Badge>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const { locale, t } = useI18n();
  const { settings } = useSiteConfig();
  const ordering = parseOrderingSettings(settings[ORDERING_SETTING_KEY]);
  const copy = getOrderingCopy(ordering, locale);
  const productCopy = getProductOrderingText(ordering, product.sku, locale, product.id);
  const bulkRequired = ordering.mode === "BULK_ONLY" || !productCopy.rule.allowSingle;
  const displayProduct = {
    ...product,
    name: productCopy.name || product.name,
    description: productCopy.description || product.description,
  };
  const wishlisted = isWishlisted(product.id);
  const pricesVisible = product.pricesVisible !== false;
  const discount = pricesVisible && product.mrp
    ? Math.round((1 - product.price / product.mrp) * 100)
    : 0;
  const pharmacyOffer = typeof product.wholesaleDiscountPercent === "number";

  return (
    <Card className="site-product-card group relative p-3 shadow-sm transition dark:bg-slate-900 dark:border-slate-800">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(event) => toggleWishlist(product.id, event.currentTarget)}
        aria-label={
          wishlisted ? t("product.removeWishlist") : t("product.addWishlist")
        }
        className={`absolute right-5 top-5 z-10 rounded-full bg-white/90 shadow-sm backdrop-blur dark:bg-slate-800/90 dark:border dark:border-slate-700 ${wishlisted ? "text-rose-500 hover:text-rose-600" : "text-slate-400 hover:text-rose-500"}`}
      >
        <Heart fill={wishlisted ? "currentColor" : "none"} />
      </Button>
      <Link href={`/products/${product.id}`}>
        <ProductVisual product={displayProduct} />
        <div className="px-2 pb-2 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)] dark:text-blue-400">
            {product.brand}
          </p>
          <h3 className="mt-1 min-h-11 text-sm font-bold leading-5 text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-primary)] dark:group-hover:text-blue-400">
            {displayProduct.name}
          </h3>
          {productCopy.description && <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500 dark:text-slate-400">{productCopy.description}</p>}
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">
            {product.unit} · {product.genericName}
          </p>
          {pricesVisible ? <div className="mt-3 flex items-end gap-2">
            <span className="text-lg font-extrabold text-slate-950 dark:text-slate-50">
              {formatNPRLocale(product.price, locale)}
            </span>
            {pharmacyOffer && product.mrp && product.mrp > product.price && (
              <>
                <span className="text-xs text-slate-400 line-through dark:text-slate-500">
                  {formatNPRLocale(product.mrp, locale)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {product.wholesaleDiscountPercent ?? discount}%{" "}
                  {t("product.discountOff")}
                </span>
              </>
            )}
          </div> : <p className="mt-3 text-sm font-bold text-teal-800 dark:text-teal-400">Contact us for pricing</p>}
          {pricesVisible && pharmacyOffer && (
            <Badge
              variant="secondary"
              className="mt-2 border-emerald-100 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              {product.wholesaleDiscountPercent}% wholesale · Scheme: {product.bonusScheme || "Not configured"}
            </Badge>
          )}
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-3 dark:border-slate-800">
        <span
          className={`flex items-center gap-1 text-[11px] font-semibold ${product.stock < 10 ? "text-amber-600" : "text-emerald-600"}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {product.stock < 10
            ? `${product.stock} ${t("product.left")}`
            : t("product.inStock")}
        </span>
        {product.prescriptionRequired ? (
          <ButtonLink href="/prescription" variant="outline" size="sm">
            <FileText /> {t("product.rxRequired")}
          </ButtonLink>
        ) : (
          <Button size="sm" onClick={(event) => addToCart(product.id, 1, undefined, event.currentTarget, product)}>
            <ShoppingBag /> {productCopy.buttonLabel || (bulkRequired ? copy.bulkMode : copy.addToCart) || t("product.add")}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function SectionHeading({
  title,
  link,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl font-black leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-4xl">
          {title}
        </h2>
      </div>
      {link && (
        <Link
          href={link}
          className="hidden shrink-0 items-center gap-1 text-sm font-bold text-[var(--color-primary)] sm:flex"
        >
          View all <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
