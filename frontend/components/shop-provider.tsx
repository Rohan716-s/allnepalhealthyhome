"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type Product } from "@/lib/catalog";
import {
  addCustomerWishlist,
  addCustomerCartItem,
  clearCustomerCart,
  getCustomerCart,
  getCustomerWishlist,
  getProducts,
  removeCustomerCartItem,
  removeCustomerWishlist,
  setCustomerCartItemQuantity,
  ApiError,
  type CustomerCartLine,
  type Product as ApiProduct,
} from "@/services/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  dispatchHeaderAnimation,
  type HeaderAnimationTarget,
} from "@/lib/header-flying-animation";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { savePendingGuestAction } from "@/lib/pending-guest-action";
import { useSiteConfig } from "@/components/site-config-provider";
import { getOrderingCopy, getProductOrderingRule, ORDERING_SETTING_KEY, parseOrderingSettings } from "@/lib/ordering";

export type CartLine = {
  productId: string;
  quantity: number;
  prescriptionId?: string;
  prescriptionItemId?: string;
  prescribedQuantity?: number;
  extractedDosage?: string;
  pharmacistVerificationStatus?: string;
};
export type PrescriptionCartMetadata = Omit<CartLine, "productId" | "quantity">;
type ShopContextValue = {
  cart: CartLine[];
  wishlist: string[];
  catalogProducts: Product[];
  cartCount: number;
  cartSubtotal: number;
  hydrated: boolean;
  addToCart: (
    productId: string,
    quantity?: number,
    metadata?: PrescriptionCartMetadata,
    sourceElement?: HTMLElement | null,
    productOverride?: Product,
  ) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getProduct: (productId: string) => Product | undefined;
  toggleWishlist: (productId: string, sourceElement?: HTMLElement | null) => void;
  isWishlisted: (productId: string) => boolean;
};

const fallbackProducts: Product[] = [];

const ShopContext = createContext<ShopContextValue | null>(null);

function clearExpiredCustomerSession(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  window.localStorage.removeItem("anhh-access-token");
  window.localStorage.removeItem("anhh-customer");
  window.dispatchEvent(new Event("anhh-auth-changed"));
  return true;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function fromApiProduct(product: ApiProduct): Product {
  const category = product.category.toLowerCase();
  const tone = category.includes("medicine")
    ? "from-blue-100 to-blue-50"
    : category.includes("vitamin")
      ? "from-amber-100 to-amber-50"
      : category.includes("device")
        ? "from-teal-100 to-cyan-50"
        : "from-rose-100 to-rose-50";
  const price = product.flashSalePrice ?? product.sellingPrice;
  return {
    id: product.slug,
    name: product.name,
    genericName: product.genericName,
    brand: product.brand,
    category: product.category,
    description: "Product details are maintained in the pharmacy catalog.",
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

export function ShopProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { settings, locale } = useSiteConfig();
  const ordering = useMemo(() => parseOrderingSettings(settings[ORDERING_SETTING_KEY]), [settings]);
  const orderingCopy = getOrderingCopy(ordering, locale);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [catalogProducts, setCatalogProducts] =
    useState<Product[]>(fallbackProducts);
  const [hydrated, setHydrated] = useState(false);
  const cartRef = useRef<CartLine[]>([]);
  const guestRedirectTimer = useRef<number | null>(null);
  const customerLoadRef = useRef(0);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  function syncCartFromServer(response: { items: CustomerCartLine[] }) {
    setCatalogProducts((current) => {
      const products = new Map(current.map((product) => [product.id, product]));
      response.items.forEach((item) => {
        const existing = products.get(item.productSlug);
        const category = existing?.category ?? "Healthcare";
        const tone = existing?.tone ?? "from-slate-100 to-slate-50";
        products.set(item.productSlug, {
          id: item.productSlug,
          name: item.productName,
          genericName: existing?.genericName ?? item.productName,
          brand: existing?.brand ?? "Pharmacy catalog",
          category,
          description: existing?.description ?? "Product details are maintained in the pharmacy catalog.",
          price: item.sellingPrice,
          mrp: existing?.mrp,
          stock: Math.max(0, item.availableQuantity),
          unit: existing?.unit ?? "1 item",
          sku: item.productCode,
          prescriptionRequired: item.prescriptionRequired,
          featured: existing?.featured,
          badge: existing?.badge,
          wholesaleDiscountPercent: existing?.wholesaleDiscountPercent,
          bonusScheme: existing?.bonusScheme,
          imageUrl: item.imageUrl ?? existing?.imageUrl,
          imageUrls: item.imageUrl ? [item.imageUrl] : existing?.imageUrls,
          visual: existing?.visual ?? item.productName.slice(0, 5).toUpperCase(),
          tone,
        });
      });
      return Array.from(products.values());
    });
    setCart((current) => response.items.map((item) => {
      const existing = current.find((line) => line.productId === item.productSlug);
      return {
        productId: item.productSlug,
        quantity: item.quantity,
        prescriptionId: existing?.prescriptionId,
        prescriptionItemId: existing?.prescriptionItemId,
        prescribedQuantity: existing?.prescribedQuantity,
        extractedDosage: existing?.extractedDosage,
        pharmacistVerificationStatus: existing?.pharmacistVerificationStatus,
      };
    }));
  }

  const announceHeaderAnimation = useCallback((
    target: HeaderAnimationTarget,
    product: Product,
    sourceElement?: HTMLElement | null,
    mode: "flight" | "pop" = "flight",
  ) => {
    dispatchHeaderAnimation(target, product, sourceElement, mode);
  }, []);

  const showCartError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : "The cart could not be updated. Please try again.");
  }, []);

  const redirectGuestAfterAnimation = useCallback((kind: "cart" | "wishlist", product: Product, quantity: number, sourceElement?: HTMLElement | null) => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    savePendingGuestAction({ kind, productId: product.id, quantity, returnTo });
    announceHeaderAnimation(kind, product, sourceElement);
    if (guestRedirectTimer.current !== null) window.clearTimeout(guestRedirectTimer.current);
    guestRedirectTimer.current = window.setTimeout(() => {
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, 650);
  }, [announceHeaderAnimation, router]);

  const rememberStockNotification = useCallback((product: Product) => {
    const current = readStorage<string[]>("anhh-stock-notifications", []);
    if (!current.includes(product.id)) window.localStorage.setItem("anhh-stock-notifications", JSON.stringify([...current, product.id]));
  }, []);

  const requestLowStockConfirmation = useCallback((product: Product, requestedQuantity: number, token: string, sourceElement?: HTMLElement | null, availableOverride?: number) => {
    const available = Math.max(0, availableOverride ?? product.stock);
    const hasSomeStock = available > 0;
    requestSiteConfirmation({
      title: hasSomeStock ? "Stock is limited" : "This product is out of stock",
      message: hasSomeStock
        ? `Only ${available} unit${available === 1 ? "" : "s"} of ${product.name} ${available === 1 ? "is" : "are"} currently available, but you requested ${requestedQuantity}.`
        : `${product.name} is not currently available to add to your cart.`,
      description: hasSomeStock ? "You can add the available quantity now or browse similar products." : "We can remember this request on this device and you can browse similar products instead.",
      checkboxLabel: "Notify me when this product is available",
      cancelLabel: hasSomeStock ? "Keep shopping" : "Not now",
      confirmLabel: hasSomeStock ? `Add ${available} available` : "View alternatives",
      tone: "default",
      onConfirm: async (checked) => {
        if (checked) rememberStockNotification(product);
        if (hasSomeStock) {
          try {
            const response = await addCustomerCartItem(product.sku, available, token);
            if (window.localStorage.getItem("anhh-access-token") !== token) return;
            syncCartFromServer(response);
            announceHeaderAnimation("cart", product, sourceElement);
            toast.success(`${product.name} added to cart`, { description: `${available} available unit${available === 1 ? "" : "s"} added.` });
          } catch (error) {
            showCartError(error);
          }
        } else {
          router.push(`/products?category=${encodeURIComponent(product.category)}`);
        }
      },
    });
  }, [announceHeaderAnimation, rememberStockNotification, router, showCartError]);

  useEffect(() => {
    const loadCatalog = () => {
      const loadId = ++customerLoadRef.current;
      const token = window.localStorage.getItem("anhh-access-token");
      const isCurrentLoad = () => loadId === customerLoadRef.current
        && window.localStorage.getItem("anhh-access-token") === token;

      // Never carry cart or wishlist state across an authentication change.
      // The authenticated API response below is the only source of truth.
      setCart([]);
      setWishlist([]);

      const loadCustomerState = (liveProducts: Product[]) => {
        if (!token || !isCurrentLoad()) return;
        getCustomerWishlist(token)
          .then((items) => {
            if (!isCurrentLoad()) return;
            setWishlist(items.map((item) => liveProducts.find((product) => product.sku === item.productCode)?.id).filter((id): id is string => Boolean(id)));
          })
          .catch((error) => {
            if (!isCurrentLoad()) return;
            clearExpiredCustomerSession(error);
            setWishlist([]);
          });
        getCustomerCart(token)
          .then((response) => { if (isCurrentLoad()) syncCartFromServer(response); })
          .catch((error) => {
            if (!isCurrentLoad()) return;
            setCart([]);
            if (!clearExpiredCustomerSession(error)) showCartError(error);
          });
      };
      getProducts({ pageSize: 100 })
        .then((response) => {
          const liveProducts = response.items.map(fromApiProduct);
          setCatalogProducts(liveProducts);
          loadCustomerState(liveProducts);
        })
        .catch(() => {
          if (isCurrentLoad()) loadCustomerState(fallbackProducts);
        });
    };
    const timer = window.setTimeout(() => {
      setCart([]);
      setWishlist([]);
      setHydrated(true);
      loadCatalog();
    }, 0);
    window.addEventListener("anhh-auth-changed", loadCatalog);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("anhh-auth-changed", loadCatalog);
    };
  }, [showCartError]);

  const productLookup = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts],
  );
  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  const cartSubtotal = cart.reduce((total, line) => {
    const product = productLookup.get(line.productId);
    return total + (product?.price ?? 0) * line.quantity;
  }, 0);

  const value = useMemo<ShopContextValue>(
    () => ({
      cart,
      wishlist,
      catalogProducts,
      cartCount,
      cartSubtotal,
      hydrated,
      getProduct: (productId) => productLookup.get(productId),
      addToCart: (productId, quantity = 1, metadata, sourceElement, productOverride) => {
        const product = productLookup.get(productId) ?? productOverride;
        if (!product) {
          toast.error("This product is still loading. Please try again in a moment.");
          return;
        }
        if (!productLookup.has(productId)) {
          setCatalogProducts((current) => current.some((item) => item.id === productId) ? current : [...current, product]);
        }
        let requestedQuantity = Math.max(1, quantity);
        const alreadyInCart = cart.find((line) => line.productId === productId)?.quantity ?? 0;
        const productRule = getProductOrderingRule(ordering, product.sku, product.id);
        const canSingle = ordering.mode !== "BULK_ONLY" && productRule.allowSingle;
        const canBulk = ordering.mode !== "SINGLE_ONLY" && productRule.allowBulk;
        const minimumBulkQuantity = Math.max(ordering.minimumBulkQuantity, productRule.minimumQuantity);
        const unavailable = (bulk: boolean) => requestSiteConfirmation({
          title: bulk ? orderingCopy.bulkUnavailableTitle : orderingCopy.bulkMode,
          message: bulk ? orderingCopy.bulkUnavailableMessage : orderingCopy.singleUnavailableMessage,
          confirmLabel: orderingCopy.dialogOkay,
          cancelLabel: orderingCopy.dialogOkay,
        });
        if (!canSingle) {
          if (!canBulk) {
            unavailable(ordering.mode === "BULK_ONLY");
            return;
          }
          const remainingStock = Math.max(0, product.stock - alreadyInCart);
          if (product.stock < minimumBulkQuantity || alreadyInCart + remainingStock < minimumBulkQuantity) {
            unavailable(true);
            return;
          }
          requestedQuantity = Math.max(requestedQuantity, minimumBulkQuantity - alreadyInCart);
        }
        const token = window.localStorage.getItem("anhh-access-token");
        if (!token) {
          redirectGuestAfterAnimation("cart", product, requestedQuantity, sourceElement);
          return;
        }
        const remainingStock = Math.max(0, product.stock - alreadyInCart);
        if (product.stock < 1 || requestedQuantity > remainingStock) {
          requestLowStockConfirmation(product, requestedQuantity, token, sourceElement, remainingStock);
          return;
        }
        const safeQuantity = Math.min(product.stock, requestedQuantity);
        if (token) {
          void addCustomerCartItem(product.sku, safeQuantity, token)
            .then((response) => {
              if (window.localStorage.getItem("anhh-access-token") !== token) return;
              syncCartFromServer(response);
              announceHeaderAnimation("cart", product, sourceElement);
              toast.success(`${product.name} added to cart`, { description: "Your saved cart was updated." });
            })
            .catch((error) => {
              if (window.localStorage.getItem("anhh-access-token") === token) showCartError(error);
            });
          return;
        }
        setCart((current) => current.some((line) => line.productId === productId)
          ? current.map((line) => line.productId === productId ? { ...line, quantity: Math.min(product.stock, line.quantity + safeQuantity), ...metadata } : line)
          : [...current, { productId, quantity: safeQuantity, ...metadata }]);
        announceHeaderAnimation("cart", product, sourceElement);
        toast.success(`${product.name} added to cart`, { description: "You can review it from your cart." });
      },
      updateQuantity: (productId, quantity) => {
        const product = productLookup.get(productId);
        const safeQuantity = Math.min(product?.stock ?? 0, Math.max(0, quantity));
        const token = window.localStorage.getItem("anhh-access-token");
        const previous = cartRef.current;
        setCart((current) => safeQuantity === 0 ? current.filter((line) => line.productId !== productId) : current.map((line) => line.productId === productId ? { ...line, quantity: safeQuantity } : line));
        if (token && product) void setCustomerCartItemQuantity(product.sku, safeQuantity, token)
          .then((response) => { if (window.localStorage.getItem("anhh-access-token") === token) syncCartFromServer(response); })
          .catch((error) => { if (window.localStorage.getItem("anhh-access-token") === token) { setCart(previous); showCartError(error); } });
      },
      removeFromCart: (productId) => {
        const product = productLookup.get(productId);
        const token = window.localStorage.getItem("anhh-access-token");
        const previous = cartRef.current;
        setCart((current) => current.filter((line) => line.productId !== productId));
        if (token && product) void removeCustomerCartItem(product.sku, token)
          .then((response) => { if (window.localStorage.getItem("anhh-access-token") === token) syncCartFromServer(response); })
          .catch((error) => { if (window.localStorage.getItem("anhh-access-token") === token) { setCart(previous); showCartError(error); } });
      },
      clearCart: () => {
        const token = window.localStorage.getItem("anhh-access-token");
        setCart([]);
        if (token) void clearCustomerCart(token).catch(showCartError);
      },
      toggleWishlist: (productId, sourceElement) => {
        const product = productLookup.get(productId);
        if (!product) return;
        const removing = wishlist.includes(productId);
        const token = window.localStorage.getItem("anhh-access-token");
        if (!token && !removing) {
          redirectGuestAfterAnimation("wishlist", product, 1, sourceElement);
          return;
        }
        const previous = wishlist;
        setWishlist((current) => removing
          ? current.filter((id) => id !== productId)
          : current.includes(productId) ? current : [...current, productId]);
        if (token && product) {
          void (removing
            ? removeCustomerWishlist(product.sku, token)
            : addCustomerWishlist(product.sku, token)
          ).then(() => {
            announceHeaderAnimation("wishlist", product, sourceElement, removing ? "pop" : "flight");
            toast.success(removing ? "Removed from wishlist" : "Saved to wishlist", { description: product.name });
          }).catch((error) => {
            setWishlist(previous);
            toast.error(error instanceof Error ? error.message : "The wishlist could not be updated. Please try again.");
          });
          return;
        }
        announceHeaderAnimation("wishlist", product, sourceElement, removing ? "pop" : "flight");
        toast.success(removing ? "Removed from wishlist" : "Saved to wishlist", { description: product.name });
      },
      isWishlisted: (productId) => wishlist.includes(productId),
    }),
    [
      cart,
      wishlist,
      catalogProducts,
      productLookup,
      cartCount,
      cartSubtotal,
      hydrated,
      announceHeaderAnimation,
      redirectGuestAfterAnimation,
      requestLowStockConfirmation,
      ordering,
      orderingCopy,
      showCartError,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside ShopProvider");
  return context;
}

export function lineProduct(
  line: CartLine,
  catalog: Product[] = fallbackProducts,
): Product | undefined {
  return catalog.find((product) => product.id === line.productId);
}
