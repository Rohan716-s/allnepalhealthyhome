export const ORDERING_SETTING_KEY = "orders.configuration";

export type OrderMode = "BULK_ONLY" | "SINGLE_ONLY" | "BULK_AND_SINGLE";
export type OrderChoice = "BULK" | "SINGLE";
export type OrderingLocale = "en" | "ne";

export type OrderingCopy = {
  pageTitle: string;
  pageDescription: string;
  chooseMode: string;
  singleMode: string;
  singleModeDescription: string;
  bulkMode: string;
  bulkModeDescription: string;
  product: string;
  quantity: string;
  minimumQuantity: string;
  customerName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  address: string;
  landmark: string;
  deliveryInstructions: string;
  deliverySlot: string;
  branch: string;
  paymentOption: string;
  notes: string;
  placeOrder: string;
  orderSummary: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  addToCart: string;
  orderInstructions: string;
  bulkUnavailableTitle: string;
  bulkUnavailableMessage: string;
  singleUnavailableMessage: string;
  minimumQuantityMessage: string;
  singleProductLimitMessage: string;
  requiredFieldsMessage: string;
  invalidEmailMessage: string;
  outOfStock: string;
  successTitle: string;
  successMessage: string;
  emptyCart: string;
  dialogOkay: string;
};

export type ProductOrderingText = {
  name: string;
  description: string;
  instructions: string;
  buttonLabel: string;
};

export type ProductOrderingRule = {
  allowBulk: boolean;
  allowSingle: boolean;
  minimumQuantity: number;
  localized: Record<OrderingLocale, ProductOrderingText>;
};

export type OrderingSettings = {
  mode: OrderMode;
  minimumBulkQuantity: number;
  localized: Record<OrderingLocale, OrderingCopy>;
  products: Record<string, Partial<ProductOrderingRule>>;
};

export const DEFAULT_ORDERING_SETTINGS: OrderingSettings = {
  mode: "BULK_AND_SINGLE",
  minimumBulkQuantity: 10,
  localized: {
    en: {
      pageTitle: "Complete your order",
      pageDescription: "Choose how you would like to order, then add delivery and payment details.",
      chooseMode: "Choose order type",
      singleMode: "Single order",
      singleModeDescription: "Order one product with the quantity you need.",
      bulkMode: "Bulk order",
      bulkModeDescription: "Order at least the required wholesale quantity.",
      product: "Product",
      quantity: "Quantity",
      minimumQuantity: "Minimum quantity",
      customerName: "Full name",
      phone: "Phone number",
      email: "Email address",
      province: "Province",
      district: "District",
      municipality: "Municipality",
      ward: "Ward",
      address: "Street / tole address",
      landmark: "Landmark (optional)",
      deliveryInstructions: "Delivery details",
      deliverySlot: "Delivery time",
      branch: "Pharmacy branch",
      paymentOption: "Payment option",
      notes: "Order notes",
      placeOrder: "Place order",
      orderSummary: "Order summary",
      subtotal: "Subtotal",
      deliveryFee: "Delivery fee",
      total: "Total",
      addToCart: "Add to cart",
      orderInstructions: "Select your order type and confirm the minimum quantity before checkout.",
      bulkUnavailableTitle: "Bulk ordering unavailable",
      bulkUnavailableMessage: "Bulk ordering is not available for this product. Please contact the Admin.",
      singleUnavailableMessage: "Single ordering is not available for this product. Please contact the Admin.",
      minimumQuantityMessage: "The minimum order for {product} is {minimum}.",
      singleProductLimitMessage: "A single order can contain one product. Remove other products from your cart to continue.",
      requiredFieldsMessage: "Please complete all required customer and delivery details.",
      invalidEmailMessage: "Enter a valid email address.",
      outOfStock: "Out of stock",
      successTitle: "Order received",
      successMessage: "Your order {orderNumber} is pending confirmation. The pharmacy team will update the delivery workflow.",
      emptyCart: "Add products before checking out.",
      dialogOkay: "Okay",
    },
    ne: {
      pageTitle: "अर्डर पूरा गर्नुहोस्",
      pageDescription: "अर्डरको प्रकार छान्नुहोस् र डेलिभरी तथा भुक्तानी विवरण भर्नुहोस्।",
      chooseMode: "अर्डरको प्रकार छान्नुहोस्",
      singleMode: "एकल अर्डर",
      singleModeDescription: "आवश्यक परिमाणमा एउटा सामान अर्डर गर्नुहोस्।",
      bulkMode: "थोक अर्डर",
      bulkModeDescription: "तोकिएको न्यूनतम थोक परिमाण अर्डर गर्नुहोस्।",
      product: "सामान",
      quantity: "परिमाण",
      minimumQuantity: "न्यूनतम परिमाण",
      customerName: "पूरा नाम",
      phone: "फोन नम्बर",
      email: "इमेल ठेगाना",
      province: "प्रदेश",
      district: "जिल्ला",
      municipality: "नगरपालिका",
      ward: "वडा",
      address: "सडक / टोल ठेगाना",
      landmark: "चिन्ने ठाउँ (ऐच्छिक)",
      deliveryInstructions: "डेलिभरी विवरण",
      deliverySlot: "डेलिभरी समय",
      branch: "फार्मेसी शाखा",
      paymentOption: "भुक्तानी विकल्प",
      notes: "अर्डरसम्बन्धी टिप्पणी",
      placeOrder: "अर्डर गर्नुहोस्",
      orderSummary: "अर्डर सारांश",
      subtotal: "जम्मा",
      deliveryFee: "डेलिभरी शुल्क",
      total: "कुल",
      addToCart: "कार्टमा राख्नुहोस्",
      orderInstructions: "अर्डरको प्रकार छान्नुहोस् र चेकआउटअघि न्यूनतम परिमाण जाँच गर्नुहोस्।",
      bulkUnavailableTitle: "थोक अर्डर उपलब्ध छैन",
      bulkUnavailableMessage: "यस सामानको थोक अर्डर उपलब्ध छैन। कृपया एडमिनसँग सम्पर्क गर्नुहोस्।",
      singleUnavailableMessage: "यस सामानको एकल अर्डर उपलब्ध छैन। कृपया एडमिनसँग सम्पर्क गर्नुहोस्।",
      minimumQuantityMessage: "{product} को न्यूनतम अर्डर परिमाण {minimum} हो।",
      singleProductLimitMessage: "एकल अर्डरमा एउटा मात्र सामान राख्न मिल्छ। अगाडि बढ्न कार्टबाट अरू सामान हटाउनुहोस्।",
      requiredFieldsMessage: "कृपया ग्राहक र डेलिभरीका सबै आवश्यक विवरण भर्नुहोस्।",
      invalidEmailMessage: "कृपया मान्य इमेल ठेगाना राख्नुहोस्।",
      outOfStock: "स्टकमा छैन",
      successTitle: "अर्डर प्राप्त भयो",
      successMessage: "तपाईंको अर्डर {orderNumber} पुष्टि हुन बाँकी छ। फार्मेसी टोलीले डेलिभरीबारे जानकारी दिनेछ।",
      emptyCart: "चेकआउट गर्नुअघि सामान कार्टमा राख्नुहोस्।",
      dialogOkay: "ठीक छ",
    },
  },
  products: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeCopy(value: unknown, fallback: OrderingCopy): OrderingCopy {
  if (!isRecord(value)) return { ...fallback };
  const result = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof OrderingCopy)[]) {
    if (typeof value[key] === "string") result[key] = value[key] as string;
  }
  return result;
}

export function parseOrderingSettings(value?: string): OrderingSettings {
  let parsed: Record<string, unknown> = {};
  try {
    const candidate: unknown = value ? JSON.parse(value) : {};
    if (isRecord(candidate)) parsed = candidate;
  } catch {
    // Keep storefront ordering available with safe defaults until settings are repaired.
  }
  const mode = parsed.mode;
  const localized = isRecord(parsed.localized) ? parsed.localized : {};
  const products = isRecord(parsed.products) ? parsed.products : {};
  const minimum = Number(parsed.minimumBulkQuantity);
  return {
    mode: mode === "BULK_ONLY" || mode === "SINGLE_ONLY" || mode === "BULK_AND_SINGLE" ? mode : DEFAULT_ORDERING_SETTINGS.mode,
    minimumBulkQuantity: Number.isFinite(minimum) ? Math.max(1, Math.min(999, Math.floor(minimum))) : DEFAULT_ORDERING_SETTINGS.minimumBulkQuantity,
    localized: {
      en: mergeCopy(localized.en, DEFAULT_ORDERING_SETTINGS.localized.en),
      ne: mergeCopy(localized.ne, DEFAULT_ORDERING_SETTINGS.localized.ne),
    },
    products: products as Record<string, Partial<ProductOrderingRule>>,
  };
}

export function normalizeProductKey(value: string) {
  return value.trim().toLocaleUpperCase("en-US");
}

export function getProductOrderingRule(
  settings: OrderingSettings,
  sku: string,
  slug?: string,
): ProductOrderingRule {
  const saved = settings.products[normalizeProductKey(sku)] ?? (slug ? settings.products[normalizeProductKey(slug)] : undefined) ?? {};
  const savedLocalized: Record<string, unknown> = isRecord(saved.localized) ? saved.localized : {};
  const localized = (locale: OrderingLocale): ProductOrderingText => {
    const candidate = savedLocalized[locale];
    const defaults: ProductOrderingText = { name: "", description: "", instructions: "", buttonLabel: "" };
    if (!isRecord(candidate)) return defaults;
    return {
      name: typeof candidate.name === "string" ? candidate.name : "",
      description: typeof candidate.description === "string" ? candidate.description : "",
      instructions: typeof candidate.instructions === "string" ? candidate.instructions : "",
      buttonLabel: typeof candidate.buttonLabel === "string" ? candidate.buttonLabel : "",
    };
  };
  const minimum = Number(saved.minimumQuantity);
  return {
    allowBulk: typeof saved.allowBulk === "boolean" ? saved.allowBulk : true,
    allowSingle: typeof saved.allowSingle === "boolean" ? saved.allowSingle : true,
    minimumQuantity: Number.isFinite(minimum) ? Math.max(1, Math.min(999, Math.floor(minimum))) : 1,
    localized: { en: localized("en"), ne: localized("ne") },
  };
}

export function getOrderingCopy(settings: OrderingSettings, locale: string) {
  return settings.localized[locale === "ne" ? "ne" : "en"];
}

export function getProductOrderingText(settings: OrderingSettings, sku: string, locale: string, slug?: string) {
  const rule = getProductOrderingRule(settings, sku, slug);
  const localized = rule.localized[locale === "ne" ? "ne" : "en"];
  return { rule, name: localized.name, description: localized.description, instructions: localized.instructions, buttonLabel: localized.buttonLabel };
}

export function orderingMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}
