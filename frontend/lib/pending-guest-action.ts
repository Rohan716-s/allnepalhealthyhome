import {
  addCustomerCartItem,
  addCustomerWishlist,
} from "@/services/api";

const STORAGE_KEY = "anhh-pending-guest-action";

export type PendingGuestAction = {
  kind: "cart" | "wishlist";
  productId: string;
  quantity?: number;
  returnTo: string;
};

export function savePendingGuestAction(action: PendingGuestAction) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

export function readPendingGuestAction(): PendingGuestAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingGuestAction;
    if ((value.kind !== "cart" && value.kind !== "wishlist") || !value.productId || !value.returnTo) return null;
    return value;
  } catch {
    return null;
  }
}

export async function resumePendingGuestAction(token: string) {
  const action = readPendingGuestAction();
  if (!action) return null;
  try {
    if (action.kind === "cart") await addCustomerCartItem(action.productId, Math.max(1, action.quantity ?? 1), token);
    else await addCustomerWishlist(action.productId, token);
    window.localStorage.removeItem(STORAGE_KEY);
    return action;
  } catch {
    return null;
  }
}
