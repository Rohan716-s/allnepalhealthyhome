"use client";

/* eslint-disable react-hooks/set-state-in-effect -- this effect refreshes a remote delivery quote after address changes. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  LockKeyhole,
  MapPin,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { useShop } from "@/components/shop-provider";
import {
  ApiError,
  CouponValidation,
  DeliveryQuote,
  createCustomerOrder,
  getDeliveryQuote,
  getPublicBranches,
  type PublicBranch,
  validateCustomerCoupon,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatNPR } from "@/lib/catalog";
import { useSiteConfig } from "@/components/site-config-provider";
import { TypewriterText } from "@/components/ordering/typewriter-text";
import { requestSiteConfirmation } from "@/lib/confirmation-events";
import { getOrderingCopy, getProductOrderingText, getProductOrderingRule, orderingMessage, ORDERING_SETTING_KEY, parseOrderingSettings, type OrderChoice } from "@/lib/ordering";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartSubtotal, clearCart, getProduct, hydrated } = useShop();
  const { paymentMethods, deliverySlots = [], settings, locale } = useSiteConfig();
  const ordering = useMemo(() => parseOrderingSettings(settings[ORDERING_SETTING_KEY]), [settings]);
  const copy = getOrderingCopy(ordering, locale);
  const [submitted, setSubmitted] = useState<{ id: string; orderNumber: string } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY");
  const [deliverySlotId, setDeliverySlotId] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(
    null,
  );
  const [authChecked, setAuthChecked] = useState(false);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [orderChoice, setOrderChoice] = useState<OrderChoice>("SINGLE");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    province: "Bagmati",
    district: "Kathmandu",
    municipality: "Kathmandu",
    ward: "",
    address: "",
    landmark: "",
    note: "",
    notes: "",
  });
  const enabledPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.enabled),
    [paymentMethods],
  );
  const selectedPaymentMethod = enabledPaymentMethods.some(
    (method) => method.code === paymentMethod,
  )
    ? paymentMethod
    : (enabledPaymentMethods[0]?.code ?? paymentMethod);
  const selectedSlot = deliverySlots.find((slot) => slot.id === deliverySlotId);
  const pricesVisible = cart.length > 0 && cart.every((line) => getProduct(line.productId)?.pricesVisible === true);
  const delivery = deliveryQuote?.deliveryFee ?? 0;
  const total =
    Math.max(0, cartSubtotal - (coupon?.discountAmount ?? 0)) + delivery;
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    setOrderChoice(ordering.mode === "BULK_ONLY" ? "BULK" : "SINGLE");
  }, [ordering.mode]);

  useEffect(() => {
    if (!hydrated) return;
    const token = window.localStorage.getItem("anhh-access-token");
    if (!token) {
      router.replace("/auth?returnTo=/checkout");
      return;
    }
    setAuthChecked(true);
  }, [hydrated, router]);

  useEffect(() => {
    if (!authChecked) return;
    getPublicBranches().then((items) => { setBranches(items); setBranchId((current) => current || items[0]?.id || ""); }).catch(() => setBranches([]));
  }, [authChecked]);

  useEffect(() => {
    const token = window.localStorage.getItem("anhh-access-token");
    if (
      !authChecked ||
      !token ||
      cart.length === 0 ||
      !form.province ||
      !form.district ||
      !form.municipality ||
      !form.ward
    ) {
      setDeliveryQuote(null);
      return;
    }
    const timer = window.setTimeout(() => {
      getDeliveryQuote(
        {
          province: form.province,
          district: form.district,
          municipality: form.municipality,
          ward: form.ward,
          subtotal: cartSubtotal,
          branchId: branchId || undefined,
          items: cart.flatMap((line) => { const product = getProduct(line.productId); return product ? [{ productCode: product.sku, quantity: line.quantity }] : []; }),
        },
        token,
      )
        .then(setDeliveryQuote)
        .catch(() => setDeliveryQuote(null));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    authChecked,
    cartSubtotal,
    form.province,
    form.district,
    form.municipality,
    form.ward,
    cart,
    getProduct,
    pricesVisible,
    branchId,
  ]);

  async function applyCoupon() {
    setError("");
    const token = window.localStorage.getItem("anhh-access-token");
    if (!token) {
      setError("Please sign in before applying a coupon.");
      return;
    }
    if (!couponCode.trim()) {
      setError("Enter a coupon code.");
      return;
    }
    setCouponBusy(true);
    try {
      setCoupon(await validateCustomerCoupon(couponCode, cartSubtotal, token));
    } catch (err) {
      setCoupon(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "The coupon could not be validated.",
      );
    } finally {
      setCouponBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (![form.name, form.phone, form.email, form.province, form.district, form.municipality, form.ward, form.address].every((value) => value.trim())) {
      setError(copy.requiredFieldsMessage);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError(copy.invalidEmailMessage);
      return;
    }
    const activeChoice: OrderChoice = ordering.mode === "BULK_ONLY" ? "BULK" : ordering.mode === "SINGLE_ONLY" ? "SINGLE" : orderChoice;
    if (activeChoice === "SINGLE" && cart.length !== 1) {
      setError(copy.singleProductLimitMessage);
      return;
    }
    for (const line of cart) {
      const product = getProduct(line.productId);
      if (!product) continue;
      const rule = getProductOrderingRule(ordering, product.sku, product.id);
      const canBulk = ordering.mode !== "SINGLE_ONLY" && rule.allowBulk;
      const canSingle = ordering.mode !== "BULK_ONLY" && rule.allowSingle;
      if (activeChoice === "BULK" && !canBulk) {
        requestSiteConfirmation({ title: copy.bulkUnavailableTitle, message: copy.bulkUnavailableMessage, confirmLabel: copy.dialogOkay, cancelLabel: copy.dialogOkay });
        return;
      }
      if (activeChoice === "SINGLE" && !canSingle) {
        requestSiteConfirmation({ title: copy.singleMode, message: copy.singleUnavailableMessage, confirmLabel: copy.dialogOkay, cancelLabel: copy.dialogOkay });
        return;
      }
      const minimum = activeChoice === "BULK" ? Math.max(ordering.minimumBulkQuantity, rule.minimumQuantity) : rule.minimumQuantity;
      if (line.quantity < minimum) {
        setError(orderingMessage(copy.minimumQuantityMessage, { product: getProductOrderingText(ordering, product.sku, locale, product.id).name || product.name, minimum }));
        return;
      }
      if (activeChoice === "BULK" && (product.stock < minimum || product.stock < line.quantity)) {
        requestSiteConfirmation({ title: copy.bulkUnavailableTitle, message: copy.bulkUnavailableMessage, confirmLabel: copy.dialogOkay, cancelLabel: copy.dialogOkay });
        return;
      }
    }
    const token = window.localStorage.getItem("anhh-access-token");
    if (!token) {
      setError("Please sign in before placing an order.");
      return;
    }
    const items = cart
      .map((line) => {
        const product = getProduct(line.productId);
        return product
          ? { productCode: product.sku, quantity: line.quantity }
          : null;
      })
      .filter(
        (item): item is { productCode: string; quantity: number } =>
          item !== null,
      );
    const prescriptionId = cart.find(
      (line) => line.prescriptionId,
    )?.prescriptionId;
    setSubmitting(true);
    try {
      const order = await createCustomerOrder(
        {
          items,
          fullName: form.name,
          phone: form.phone,
          email: form.email,
          province: form.province,
          district: form.district,
          municipality: form.municipality,
          ward: form.ward,
          streetTole: form.address,
          landmark: form.landmark || undefined,
          deliveryInstructions: form.note || undefined,
          prescriptionId,
          couponCode: coupon?.code,
          paymentMethod: selectedPaymentMethod,
          deliverySlotId: deliverySlotId || undefined,
          branchId: branchId || undefined,
          orderMode: activeChoice,
          locale,
          notes: form.notes || undefined,
          latitude: deliveryLocation?.latitude,
          longitude: deliveryLocation?.longitude,
        },
        token,
      );
      setSubmitted({ id: order.id, orderNumber: order.orderNumber });
      clearCart();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Your order could not be placed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated || !authChecked)
    return (
      <div className="min-h-screen bg-[#f8fbfa]">
        <SiteHeader />
        <main className="mx-auto flex max-w-xl items-center justify-center px-4 py-32 text-center sm:px-6">
          <div>
            <Loader2 className="mx-auto animate-spin text-teal-700" size={30} />
            <h1 className="mt-5 text-2xl font-extrabold">{copy.pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">
              We are restoring your cart and account securely.
            </p>
          </div>
        </main>
      </div>
    );
  if (submitted)
    return (
      <div className="min-h-screen bg-[#f8fbfa]">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={34} />
          </div>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">
            {copy.successTitle}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">
            Thank you, {form.name.split(" ")[0]}.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            {orderingMessage(copy.successMessage, { orderNumber: submitted.orderNumber })}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href={`/orders/${submitted.id}`} className="primary-btn">
              Track order
            </Link>
            <Link href="/products" className="secondary-btn">
              Continue shopping
            </Link>
          </div>
        </main>
      </div>
    );
  if (!cart.length)
    return (
      <div className="min-h-screen bg-[#f8fbfa]">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-extrabold">{copy.emptyCart}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {copy.emptyCart}
          </p>
          <Link href="/products" className="primary-btn mt-6">
            Browse products
          </Link>
        </main>
      </div>
    );
  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"
        >
          <ArrowLeft size={15} /> Back to cart
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
          <form noValidate onSubmit={submit} className="surface p-6 sm:p-8">
            <section className="mb-7 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5">
              <p className="text-sm font-extrabold text-slate-900">{copy.chooseMode}</p>
              {ordering.mode === "BULK_AND_SINGLE" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["SINGLE", "BULK"] as const).map((choice) => {
                    const isSingle = choice === "SINGLE";
                    const title = isSingle ? copy.singleMode : copy.bulkMode;
                    const description = isSingle ? copy.singleModeDescription : `${copy.bulkModeDescription} ${copy.minimumQuantity}: ${ordering.minimumBulkQuantity}`;
                    return <button key={choice} type="button" aria-pressed={orderChoice === choice} onClick={() => setOrderChoice(choice)} className={`rounded-xl border p-4 text-left transition ${orderChoice === choice ? "border-blue-700 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300"}`}><span className="flex items-center gap-2 text-sm font-bold"><input type="radio" readOnly checked={orderChoice === choice} className="accent-blue-700" />{title}</span><span className="mt-2 block text-xs leading-5 text-slate-500">{description}</span></button>;
                  })}
                </div>
              ) : <p className="mt-2 text-sm font-bold text-blue-800">{ordering.mode === "BULK_ONLY" ? copy.bulkMode : copy.singleMode}{ordering.mode === "BULK_ONLY" ? ` · ${copy.minimumQuantity}: ${ordering.minimumBulkQuantity}` : ""}</p>}
              <p className="mt-4 border-t border-blue-100 pt-3 text-xs leading-5 text-slate-600"><TypewriterText text={copy.orderInstructions} /></p>
            </section>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <MapPin size={19} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                  {copy.pageTitle}
                </p>
                <h1 className="text-2xl font-extrabold">{copy.deliveryInstructions}</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {copy.pageDescription}
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <CheckoutField
                label={copy.customerName}
                value={form.name}
                required
                onChange={(value) => update("name", value)}
                placeholder={copy.customerName}
              />
              <CheckoutField
                label={copy.phone}
                value={form.phone}
                required
                onChange={(value) => update("phone", value)}
                placeholder="98XXXXXXXX"
              />
              <CheckoutField
                label={copy.email}
                value={form.email}
                type="email"
                required
                onChange={(value) => update("email", value)}
                placeholder="you@example.com"
              />
              <CheckoutField
                label={copy.province}
                value={form.province}
                required
                onChange={(value) => update("province", value)}
              />
              <CheckoutField
                label={copy.district}
                value={form.district}
                required
                onChange={(value) => update("district", value)}
              />
              <CheckoutField
                label={copy.municipality}
                value={form.municipality}
                required
                onChange={(value) => update("municipality", value)}
              />
              <CheckoutField
                label={copy.ward}
                value={form.ward}
                required
                onChange={(value) => update("ward", value)}
              />
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                {copy.address}
                <textarea
                  required
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className="field mt-2 min-h-24 resize-y"
                  placeholder={copy.address}
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => {
                  if (!navigator.geolocation) { setError("Location sharing is not available in this browser."); return; }
                  navigator.geolocation.getCurrentPosition(
                    (position) => { setDeliveryLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setError(""); },
                    () => setError("Location was not shared. You can still place the order; delivery verification may require a map location."),
                    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
                  );
                }} className="min-h-11"><MapPin size={15} />{deliveryLocation ? "Delivery location saved" : "Share delivery location (recommended)"}</Button>
                <p className="mt-2 text-xs text-slate-500">Your rider can use this location for delivery verification. Your browser will ask before sharing it.</p>
              </div>
              <CheckoutField label={copy.landmark} value={form.landmark} onChange={(value) => update("landmark", value)} />
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                {copy.deliveryInstructions}{" "}
                <textarea
                  value={form.note}
                  onChange={(event) => update("note", event.target.value)}
                  className="field mt-2 min-h-20 resize-y"
                  placeholder={copy.deliveryInstructions}
                />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                {copy.notes}
                <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} className="field mt-2 min-h-20 resize-y" placeholder={copy.notes} />
              </label>
            </div>
            {pricesVisible && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              {branches.length > 1 && <div className="mb-5"><div className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><MapPin size={17} className="text-teal-700" /> {copy.branch}</div><p className="mt-1 text-xs text-slate-500">Choose the branch that will reserve and fulfill this order.</p><Label htmlFor="branch" className="sr-only">{copy.branch}</Label><Select id="branch" required value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-3">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} · {branch.address}</option>)}</Select></div>}
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Clock3 size={17} className="text-teal-700" /> {copy.deliverySlot}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Select a window so the pharmacy can plan your handoff.
              </p>
              <Label htmlFor="delivery-slot" className="sr-only">
                {copy.deliverySlot}
              </Label>
              <Select
                id="delivery-slot"
                value={deliverySlotId}
                onChange={(event) => setDeliverySlotId(event.target.value)}
                className="mt-3"
              >
                <option value="">Choose a delivery window (optional)</option>
                {deliverySlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label} · {slot.startTime}–{slot.endTime}
                  </option>
                ))}
              </Select>
              {!deliverySlots.length && (
                <p className="mt-2 text-xs text-slate-500">
                  The pharmacy will confirm a delivery time after reviewing your
                  order.
                </p>
              )}
            </div>}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <BadgePercent size={17} className="text-teal-700" /> Have a
                coupon?
              </div>
              <div className="mt-3 flex gap-2">
                <Label htmlFor="coupon-code" className="sr-only">
                  Coupon code
                </Label>
                <Input
                  id="coupon-code"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value.toUpperCase());
                    setCoupon(null);
                  }}
                  placeholder="WELCOME10"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={couponBusy}
                  onClick={() => void applyCoupon()}
                >
                  {couponBusy ? <Loader2 className="animate-spin" /> : "Apply"}
                </Button>
              </div>
              {coupon && (
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  {coupon.code} applied — saving{" "}
                  {formatNPR(coupon.discountAmount)}
                </p>
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <CreditCard size={17} className="text-teal-700" /> {copy.paymentOption}
              </div>
              <div className="mt-3 grid gap-3">
                {enabledPaymentMethods.map((method) => (
                  <label
                    key={method.code}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedPaymentMethod === method.code ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.code}
                      checked={selectedPaymentMethod === method.code}
                      onChange={() => setPaymentMethod(method.code)}
                      className="mt-1 accent-teal-700"
                    />
                    <span>
                      <span className="block text-sm font-extrabold text-slate-900">
                        {method.displayName}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {method.instructions ??
                          "Payment instructions will be provided after order review."}
                      </span>
                      {method.requiresServerVerification && (
                        <span className="mt-2 block text-[11px] font-bold text-amber-700">
                          Payment remains pending until verified by the
                          pharmacy.
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              {!enabledPaymentMethods.length && (
                <p className="mt-3 text-xs font-semibold text-rose-700">
                  No payment methods are currently available. Please contact the
                  pharmacy.
                </p>
              )}
            </div>
            {error && (
              <p
                id="checkout-order-error"
                role="alert"
                className="mt-5 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={submitting || !enabledPaymentMethods.length}
              aria-busy={submitting}
              aria-describedby={error ? "checkout-order-error" : undefined}
              className="mt-7 w-full justify-center"
            >
              {submitting ? `${copy.placeOrder}…` : copy.placeOrder}
              <LockKeyhole size={15} />
            </Button>
          </form>
          <aside className="surface h-fit p-6">
            <h2 className="text-lg font-extrabold">{copy.orderSummary}</h2>
            <div className="mt-5 grid gap-4">
              {cart.map((line) => {
                const product = getProduct(line.productId);
                const display = product ? getProductOrderingText(ordering, product.sku, locale, product.id) : null;
                return (
                  product && (
                    <div
                      key={line.productId}
                      className="flex justify-between gap-3 text-xs"
                    >
                      <span className="text-slate-500">
                        {display?.name || product.name} × {line.quantity}
                      </span>
                      {pricesVisible && <span className="font-bold text-slate-900">
                        {formatNPR(product.price * line.quantity)}
                      </span>}
                      {display?.instructions && <span className="mt-2 block text-[11px] leading-4 text-slate-500">{display.instructions}</span>}
                    </div>
                  )
                );
              })}
            </div>
            {pricesVisible ? <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>{copy.subtotal}</span>
                <span>{formatNPR(cartSubtotal)}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({coupon.code})</span>
                  <span>-{formatNPR(coupon.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>{copy.deliveryFee}</span>
                <span>
                  {deliveryQuote
                    ? delivery
                      ? formatNPR(delivery)
                      : "Free"
                    : "Select address"}
                </span>
              </div>
              {selectedSlot && (
                <div className="flex justify-between gap-4 text-slate-500">
                  <span>Window</span>
                  <span className="text-right font-semibold">
                    {selectedSlot.label}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-base font-extrabold">
                <span>{copy.total}</span>
                <span>{formatNPR(total)}</span>
              </div>
            </div> : <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Pricing is hidden for your account. The secure payment amount and configured payment instructions are available after you submit your order.</p>}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function CheckoutField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = `checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id} className="text-xs font-bold text-slate-600">
      {label}
      <Input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
        placeholder={placeholder}
      />
    </label>
  );
}
