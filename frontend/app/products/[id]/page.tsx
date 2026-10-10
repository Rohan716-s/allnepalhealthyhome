"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ProductImageCarousel } from "@/components/product-image-carousel";
import { BackButton } from "@/components/back-button";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { useShop } from "@/components/shop-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatNPR, type Product } from "@/lib/catalog";
import { getProductBySlug, type ProductDetail } from "@/services/api";
import { useI18n, useSiteConfig } from "@/components/site-config-provider";
import { TypewriterText } from "@/components/ordering/typewriter-text";
import { getOrderingCopy, getProductOrderingText, ORDERING_SETTING_KEY, parseOrderingSettings } from "@/lib/ordering";

function fromApiProduct(product: ProductDetail): Product {
  const category = product.category.toLowerCase();
  const tone = category.includes("medicine")
    ? "from-blue-100 to-blue-50"
    : category.includes("vitamin")
      ? "from-amber-100 to-amber-50"
      : category.includes("device")
        ? "from-teal-100 to-cyan-50"
        : "from-rose-100 to-rose-50";
  const price = product.flashSalePrice ?? product.sellingPrice;
  const description =
    product.description ||
    product.uses ||
    "Product details are maintained in the pharmacy catalog.";
  return {
    id: product.slug,
    name: product.name,
    genericName: product.genericName,
    brand: product.brand,
    category: product.category,
    description,
    price,
    mrp: product.flashSalePrice
      ? product.sellingPrice
      : product.mrp > product.sellingPrice
        ? product.mrp
        : undefined,
    stock: Math.max(0, product.stockQuantity),
    unit:
      [product.strength, product.dosageForm].filter(Boolean).join(" · ") ||
      "1 item",
    sku: product.sku,
    prescriptionRequired: product.prescriptionRequired,
    pricesVisible: product.pricesVisible !== false,
    featured: product.isFeatured,
    badge: product.pricesVisible !== false && product.flashSalePrice
      ? `Flash sale · ${product.flashSaleDiscountPercent}% off`
      : undefined,
    wholesaleDiscountPercent: product.pricesVisible === false ? undefined : product.wholesaleDiscountPercent,
    bonusScheme: product.pricesVisible === false ? undefined : product.bonusScheme,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    visual: product.name.slice(0, 5).toUpperCase(),
    tone,
  };
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { addToCart, toggleWishlist, isWishlisted, catalogProducts } =
    useShop();
  const { settings } = useSiteConfig();
  const { locale, t } = useI18n();
  const ordering = useMemo(() => parseOrderingSettings(settings[ORDERING_SETTING_KEY]), [settings]);
  const orderCopy = getOrderingCopy(ordering, locale);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      getProductBySlug(id, controller.signal)
        .then((row) => setProduct(fromApiProduct(row)))
        .catch((reason) => {
          if (!(reason instanceof DOMException && reason.name === "AbortError"))
            setError(
              reason instanceof Error
                ? reason.message
                : "Product details could not be loaded.",
            );
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [id]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#f8fbfa]">
        <SiteHeader />
        <main className="mx-auto flex max-w-3xl justify-center px-4 py-24">
          <Loader2
            className="animate-spin text-teal-700"
            aria-label="Loading product"
          />
        </main>
      </div>
    );
  if (!product)
    return (
      <div className="min-h-screen bg-[#f8fbfa]">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <div className="mb-6 text-left">
            <BackButton fallbackHref="/products" />
          </div>
          <h1 className="text-2xl font-extrabold">Product not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || "This product is no longer available."}
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  const related = catalogProducts
    .filter(
      (item) => item.category === product.category && item.id !== product.id,
    )
    .slice(0, 4);
  const wishlisted = isWishlisted(product.id);
  const productCopy = getProductOrderingText(ordering, product.sku, locale, product.id);
  const productName = productCopy.name || product.name;
  const productDescription = productCopy.description || product.description;
  const pharmacyOffer = typeof product.wholesaleDiscountPercent === "number";
  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/products" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <ProductImageCarousel images={product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []} alt={productName} />
          </div>
          <div className="pt-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">
              {product.brand} · {product.category}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              {productName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {product.genericName} · {product.unit}
            </p>
            {product.pricesVisible !== false ? <div className="mt-6 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-extrabold text-slate-950">
                {formatNPR(product.price)}
              </span>
              {pharmacyOffer && product.mrp && product.mrp > product.price && (
                <span className="pb-1 text-sm text-slate-400 line-through">
                  {formatNPR(product.mrp)}
                </span>
              )}
            </div> : <p className="mt-6 text-sm font-bold text-teal-800">Contact us for pricing</p>}
            {product.pricesVisible !== false && pharmacyOffer && <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-emerald-700"><span className="rounded-full bg-emerald-50 px-3 py-1">{product.wholesaleDiscountPercent}% wholesale discount</span><span className="rounded-full bg-emerald-50 px-3 py-1">Scheme: {product.bonusScheme || "Not configured"}</span></div>}
            <p className="mt-6 text-sm leading-7 text-slate-600">
              {productDescription}
            </p>
            <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900"><TypewriterText text={productCopy.instructions || orderCopy.orderInstructions} /></p>
            <div className={`mt-6 flex items-center gap-2 text-xs font-bold ${product.stock < 1 ? "text-rose-600" : product.stock < 10 ? "text-amber-600" : "text-emerald-700"}`}>
              <span className="h-2 w-2 rounded-full bg-current" />{" "}
              {product.stock < 1
                ? orderCopy.outOfStock
                : product.stock < 10
                  ? `${product.stock} ${t("product.left")}`
                  : t("product.inStock")}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label={`${orderCopy.quantity}: −`}
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-sm font-extrabold">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={product.stock < 1 || quantity >= product.stock}
                  onClick={() =>
                    setQuantity(Math.min(product.stock, quantity + 1))
                  }
                  aria-label={`${orderCopy.quantity}: +`}
                >
                  <Plus />
                </Button>
              </div>
              <Button
                size="lg"
                onClick={(event) => addToCart(product.id, quantity, undefined, event.currentTarget, product)}
                disabled={product.stock < 1}
              >
                <ShoppingBag />{" "}
                {product.stock < 1 ? orderCopy.outOfStock : productCopy.buttonLabel || orderCopy.addToCart}
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                onClick={(event) => toggleWishlist(product.id, event.currentTarget, product)}
                aria-label={
                  wishlisted ? "Remove from wishlist" : "Add to wishlist"
                }
              >
                <Heart fill={wishlisted ? "currentColor" : "none"} />
              </Button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <ShieldCheck size={18} className="text-teal-700" />
                  <h3 className="mt-3 text-xs font-extrabold">
                    Genuine & verified
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Sourced through trusted channels.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <Truck size={18} className="text-teal-700" />
                  <h3 className="mt-3 text-xs font-extrabold">
                    Delivery across Nepal
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    We’ll confirm your delivery area at checkout.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <section className="mt-20">
          <div className="mb-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">
              You may also like
            </p>
            <h2 className="mt-2 text-2xl font-extrabold">Related products</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
