import { resolveMediaUrl } from "@/services/api";
import type { Product } from "@/lib/catalog";

export type HeaderAnimationTarget = "cart" | "wishlist";

export type HeaderAnimationDetail = {
  target: HeaderAnimationTarget;
  mode: "flight" | "pop";
  imageUrl?: string;
  visual: string;
  sourceRect?: { left: number; top: number; width: number; height: number };
};

export function dispatchHeaderAnimation(
  target: HeaderAnimationTarget,
  product: Product,
  sourceElement?: HTMLElement | null,
  mode: HeaderAnimationDetail["mode"] = "flight",
) {
  if (typeof window === "undefined") return;
  const rect = sourceElement?.getBoundingClientRect();
  window.dispatchEvent(
    new CustomEvent<HeaderAnimationDetail>("anhh:header-animation", {
      detail: {
        target,
        mode,
        imageUrl: resolveMediaUrl(product.imageUrl),
        visual: product.visual,
        sourceRect: rect
          ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          : undefined,
      },
    }),
  );
}
