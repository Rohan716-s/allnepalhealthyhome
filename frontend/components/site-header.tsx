"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Heart,
  Languages,
  Loader2,
  LayoutGrid,
  Menu,
  Moon,
  Pill,
  Scale,
  ShoppingBag,
  Sun,
  Tags,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { useShop } from "@/components/shop-provider";
import { AnnouncementMarquee } from "@/components/announcement-marquee";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { AccountProfileMenu } from "@/components/account-profile-menu";
import { MessagingLink } from "@/components/messaging-link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useI18n,
  useSiteConfig,
  useSiteValue,
} from "@/components/site-config-provider";
import {
  localeLabels,
  localizedField,
  type Locale,
  type Translate,
} from "@/lib/i18n";
import {
  getCatalogBrands,
  getCatalogCategories,
  getPublicHealthArticles,
  ApiError,
  loginCustomer,
  loginStaff,
  type AdminHealthArticle,
  type CatalogBrand,
  type CatalogCategory,
} from "@/services/api";
import { resolveMediaUrl } from "@/services/api";
import type { HeaderAnimationDetail } from "@/lib/header-flying-animation";
import { resumePendingGuestAction } from "@/lib/pending-guest-action";

type PublicNavItem = { label: string; url: string; openInNewTab?: boolean };
type MenuKind =
  "shop" | "categories" | "brands" | "articles" | "prescription" | "health";
type HeaderData = {
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  articles: AdminHealthArticle[];
  failed: boolean;
};

type HeaderFlight = HeaderAnimationDetail & {
  id: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
};

function ResilientSiteLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span role="img" aria-label={`${alt} unavailable`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#003893] text-white">
      <Pill size={20} aria-hidden="true" />
    </span>;
  }
  return <Image src={src} alt={alt} width={240} height={80} unoptimized onError={() => setFailed(true)} className={className} />;
}

type HeaderDemoAccount = {
  label: string;
  email: string;
  password: string;
  kind: "customer" | "staff";
  path: string;
};

type CustomerHeaderSession = {
  fullName: string;
  email: string;
  accountType?: string;
};

const headerDemoAccounts: HeaderDemoAccount[] = [
  {
    label: "Personal",
    email: "customer@example.com",
    password: "Customer!123",
    kind: "customer",
    path: "/account",
  },
  {
    label: "Pharmacy",
    email: "pharmacy@example.com",
    password: "Pharmacy!123",
    kind: "customer",
    path: "/account",
  },
  {
    label: "Pharmacist",
    email: "pharmacist@example.com",
    password: "Pharmacist!123",
    kind: "staff",
    path: "/pharmacist",
  },
  {
    label: "Delivery",
    email: "delivery@example.com",
    password: "Delivery!123",
    kind: "staff",
    path: "/delivery",
  },
  {
    label: "Supervisor",
    email: "supervisor@example.com",
    password: "Supervisor!123",
    kind: "staff",
    path: "/supervisor",
  },
  {
    label: "Accountant",
    email: "accountant@example.com",
    password: "Accountant!123",
    kind: "staff",
    path: "/accounts",
  },
  {
    label: "Admin",
    email: "admin@example.com",
    password: "Admin!123",
    kind: "staff",
    path: "/admin",
  },
  {
    label: "SuperAdmin",
    email: "superadmin@example.com",
    password: "SuperAdmin!123",
    kind: "staff",
    path: "/superadmin",
  },
];

function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label
      className={`inline-flex items-center gap-1.5 ${mobile ? "text-xs" : "text-[11px]"}`}
    >
      <Languages size={mobile ? 15 : 14} aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("language.label")}
        className="cursor-pointer bg-transparent font-bold outline-none"
      >
        {(Object.entries(localeLabels) as [Locale, string][]).map(
          ([value, label]) => (
            <option key={value} value={value} className="text-slate-900">
              {value === "en" ? "EN" : label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

const fallbackHeaderNav: PublicNavItem[] = [
  { label: "Home", url: "/" },
  { label: "Medicines", url: "/products" },
  { label: "Categories", url: "/categories" },
  { label: "Brands", url: "/brands" },
  { label: "Prescription", url: "/prescription" },
  { label: "About us", url: "/about" },
  { label: "Contact", url: "/contact" },
  { label: "Track order", url: "/track-order" },
];

let headerDataPromise: Promise<HeaderData> | null = null;
let headerDataLoadedAt = 0;

function loadHeaderData() {
  if (headerDataPromise && Date.now() - headerDataLoadedAt < 60_000)
    return headerDataPromise;
  headerDataLoadedAt = Date.now();
  headerDataPromise = Promise.allSettled([
    getCatalogCategories(),
    getCatalogBrands(),
    getPublicHealthArticles(),
  ]).then(([categories, brands, articles]) => ({
    categories: categories.status === "fulfilled" ? categories.value : [],
    brands: brands.status === "fulfilled" ? brands.value : [],
    articles: articles.status === "fulfilled" ? articles.value : [],
    failed: [categories, brands, articles].every(
      (result) => result.status === "rejected",
    ),
  }));
  return headerDataPromise;
}

function resetHeaderDataCache() {
  headerDataPromise = null;
  headerDataLoadedAt = 0;
}

function getMenuKind(item: PublicNavItem): MenuKind | null {
  const value = `${item.label} ${item.url}`.toLowerCase();
  if (value.includes("categor")) return "categories";
  if (value.includes("brand")) return "brands";
  if (value.includes("article") || value.includes("blog")) return "articles";
  if (value.includes("prescription")) return "prescription";
  if (
    value.includes("health") ||
    value.includes("wellness") ||
    value.includes("fitness") ||
    value.includes("device") ||
    value.includes("personal care") ||
    value.includes("family care")
  )
    return "health";
  if (
    value.includes("medicine") ||
    value.includes("shop") ||
    value.includes("product")
  )
    return "shop";
  return null;
}

function localizedNavLabel(item: PublicNavItem, fallback: Translate) {
  const value = `${item.label} ${item.url}`.toLowerCase();
  if (item.url === "/") return fallback("nav.home");
  if (value.includes("categor")) return fallback("nav.categories");
  if (value.includes("brand")) return fallback("nav.brands");
  if (value.includes("article") || value.includes("blog"))
    return fallback("nav.articles");
  if (value.includes("prescription")) return fallback("nav.prescription");
  if (
    value.includes("medicine") ||
    value.includes("shop") ||
    value.includes("product")
  )
    return fallback("nav.medicines");
  if (value.includes("about")) return fallback("nav.about");
  if (value.includes("contact")) return fallback("nav.contact");
  return item.label;
}

function NavigationLink({
  item,
  className,
  onClick,
  ...props
}: {
  item: PublicNavItem;
  className?: string;
  onClick?: () => void;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = /^https?:\/\//i.test(item.url);
  return external ? (
    <a
      href={item.url}
      className={className}
      onClick={onClick}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noreferrer" : undefined}
      {...props}
    >
      {item.label}
    </a>
  ) : (
    <Link
      href={item.url}
      className={className}
      onClick={onClick}
      target={item.openInNewTab ? "_blank" : undefined}
      {...props}
    >
      {item.label}
    </Link>
  );
}

function MenuColumn({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#003893]">
        {icon}
        {title}
      </h3>
      <div className="mt-3 grid gap-1.5">{children}</div>
    </section>
  );
}

function MenuItemLink({
  href,
  children,
  onClick,
  muted = false,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition ${muted ? "text-slate-500 hover:bg-slate-50 hover:text-[#003893]" : "font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#003893]"}`}
    >
      {children}
      <ArrowRight
        size={14}
        className="shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </Link>
  );
}

function localizedName(record: unknown, locale: Locale, fallback: string) {
  return (
    localizedField(record as Record<string, unknown>, "name", locale) ??
    fallback
  );
}

function MegaMenuPanel({
  kind,
  data,
  onNavigate,
}: {
  kind: MenuKind;
  data: HeaderData;
  onNavigate: () => void;
}) {
  const { locale, t } = useI18n();
  if (kind === "shop")
    return (
      <div className="grid gap-8 p-5 sm:grid-cols-[1fr_1fr_1.25fr] sm:p-7">
        <MenuColumn title={t("menu.popular")} icon={<Pill size={14} />}>
          {[
            [t("menu.bestSellers"), "/products?sort=popular"],
            [t("menu.newArrivals"), "/products?sort=newest"],
            [t("menu.featuredMedicines"), "/products?sort=popular"],
            [t("menu.discountedMedicines"), "/products?sort=discount"],
          ].map(([label, href]) => (
            <MenuItemLink key={label} href={href} onClick={onNavigate}>
              {label}
            </MenuItemLink>
          ))}
        </MenuColumn>
        <MenuColumn title={t("menu.browseBy")} icon={<Tags size={14} />}>
          <MenuItemLink href="/products" onClick={onNavigate}>
            {t("menu.allMedicines")}
          </MenuItemLink>
          <MenuItemLink
            href="/products?prescriptionRequired=true"
            onClick={onNavigate}
          >
            {t("menu.prescriptionMedicines")}
          </MenuItemLink>
          <MenuItemLink
            href="/products?prescriptionRequired=false"
            onClick={onNavigate}
          >
            {t("menu.otcMedicines")}
          </MenuItemLink>
          <MenuItemLink href="/products" onClick={onNavigate}>
            {t("menu.healthProducts")}
          </MenuItemLink>
        </MenuColumn>
        <MenuColumn
          title={t("menu.popularCategories")}
          icon={<Pill size={14} />}
        >
          {data.categories.slice(0, 6).map((category) => (
            <MenuItemLink
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.slug)}`}
              onClick={onNavigate}
            >
              {localizedName(category, locale, category.name)}
            </MenuItemLink>
          ))}
          {!data.categories.length && (
            <p className="px-2.5 py-2 text-sm text-slate-400">
              {t("menu.noCategories")}
            </p>
          )}
          <MenuItemLink href="/products" onClick={onNavigate} muted>
            {t("menu.viewAllMedicines")}
          </MenuItemLink>
        </MenuColumn>
      </div>
    );

  if (kind === "categories")
    return (
      <div className="p-5 sm:p-7">
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.slice(0, 15).map((category) => (
            <MenuItemLink
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.slug)}`}
              onClick={onNavigate}
            >
              {localizedName(category, locale, category.name)}
            </MenuItemLink>
          ))}
        </div>
        {!data.categories.length && (
          <p className="py-4 text-sm text-slate-400">
            {t("menu.noCategories")}
          </p>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <MenuItemLink href="/categories" onClick={onNavigate} muted>
            {t("menu.viewAllCategories")}
          </MenuItemLink>
        </div>
      </div>
    );

  if (kind === "brands")
    return (
      <div className="p-5 sm:p-7">
        <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#003893]">
          <Tags size={14} />
          {t("nav.brands")}
        </h3>
        <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {data.brands.slice(0, 15).map((brand) => (
            <MenuItemLink
              key={brand.id}
              href={`/products?brand=${encodeURIComponent(brand.name)}`}
              onClick={onNavigate}
            >
              {localizedName(brand, locale, brand.name)}
            </MenuItemLink>
          ))}
        </div>
        {!data.brands.length && (
          <p className="py-4 text-sm text-slate-400">{t("menu.noBrands")}</p>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <MenuItemLink href="/brands" onClick={onNavigate} muted>
            {t("menu.viewAllBrands")}
          </MenuItemLink>
        </div>
      </div>
    );

  if (kind === "articles")
    return (
      <div className="grid gap-8 p-5 sm:grid-cols-[1.4fr_0.8fr] sm:p-7">
        <MenuColumn
          title={t("menu.latestArticles")}
          icon={<FileText size={14} />}
        >
          {data.articles.slice(0, 5).map((article) => (
            <MenuItemLink
              key={article.id}
              href={`/articles/${article.slug}`}
              onClick={onNavigate}
            >
              {localizedField(
                article as unknown as Record<string, unknown>,
                "title",
                locale,
              ) ?? article.title}
            </MenuItemLink>
          ))}
          {!data.articles.length && (
            <p className="px-2.5 py-2 text-sm text-slate-400">
              {t("menu.noArticles")}
            </p>
          )}
          <MenuItemLink href="/articles" onClick={onNavigate} muted>
            {t("nav.articles")}
          </MenuItemLink>
        </MenuColumn>
        <MenuColumn title={t("menu.healthLibrary")} icon={<Pill size={14} />}>
          <MenuItemLink href="/articles" onClick={onNavigate}>
            {t("menu.medicineInformation")}
          </MenuItemLink>
          <MenuItemLink href="/articles" onClick={onNavigate}>
            {t("menu.wellnessGuidance")}
          </MenuItemLink>
          <MenuItemLink href="/articles" onClick={onNavigate}>
            {t("menu.nutritionAdvice")}
          </MenuItemLink>
          <MenuItemLink href="/articles" onClick={onNavigate}>
            {t("menu.pharmacySupport")}
          </MenuItemLink>
        </MenuColumn>
      </div>
    );

  if (kind === "prescription")
    return (
      <div className="grid gap-8 p-5 sm:grid-cols-2 sm:p-7">
        <MenuColumn
          title={t("menu.prescriptionCare")}
          icon={<Upload size={14} />}
        >
          <MenuItemLink href="/prescription" onClick={onNavigate}>
            {t("menu.uploadPrescription")}
          </MenuItemLink>
          <MenuItemLink href="/account/prescriptions" onClick={onNavigate}>
            {t("menu.myPrescriptions")}
          </MenuItemLink>
          <MenuItemLink href="/account/prescriptions" onClick={onNavigate}>
            {t("menu.prescriptionStatus")}
          </MenuItemLink>
        </MenuColumn>
        <MenuColumn title={t("menu.needHelp")} icon={<FileText size={14} />}>
          <MenuItemLink href="/prescription" onClick={onNavigate}>
            {t("menu.howVerificationWorks")}
          </MenuItemLink>
          <p className="px-2.5 py-2 text-sm leading-6 text-slate-500">
            {t("menu.verificationDescription")}
          </p>
        </MenuColumn>
      </div>
    );

  return (
    <div className="p-5 sm:p-7">
      <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#003893]">
        <Pill size={14} />
        {t("menu.healthProducts")}
      </h3>
      <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {data.categories.slice(0, 15).map((category) => (
          <MenuItemLink
            key={category.id}
            href={`/products?category=${encodeURIComponent(category.slug)}`}
            onClick={onNavigate}
          >
            {localizedName(category, locale, category.name)}
          </MenuItemLink>
        ))}
      </div>
      {!data.categories.length && (
        <p className="py-4 text-sm text-slate-400">
          {t("menu.noHealthCategories")}
        </p>
      )}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <MenuItemLink href="/products" onClick={onNavigate} muted>
          {t("menu.viewAllHealthProducts")}
        </MenuItemLink>
      </div>
    </div>
  );
}

export function SiteHeader({ hero = false }: { hero?: boolean }) {
  const router = useRouter();
  const { cartCount, wishlist } = useShop();
  const {
    navigation = [],
    design,
    colorMode,
    toggleColorMode,
  } = useSiteConfig();
  const { t } = useI18n();
  const siteName = useSiteValue("website.name", "All Nepal Healthy Home");
  const siteLogo = useSiteValue("website.logoUrl", "");
  const signedInToast = useSiteValue(
    "notification.toast.signedIn",
    "Signed in successfully",
  );
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [customerSession, setCustomerSession] =
    useState<CustomerHeaderSession | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginKind, setLoginKind] =
    useState<HeaderDemoAccount["kind"]>("customer");
  const [loginDestination, setLoginDestination] = useState("/account");
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const wishlistTargetRef = useRef<HTMLAnchorElement | null>(null);
  const cartTargetRef = useRef<HTMLAnchorElement | null>(null);
  const [headerFlights, setHeaderFlights] = useState<HeaderFlight[]>([]);
  const [wishlistTargetPop, setWishlistTargetPop] = useState(false);
  const [wishlistCountPop, setWishlistCountPop] = useState(false);
  const [cartTargetPop, setCartTargetPop] = useState(false);
  const [cartCountPop, setCartCountPop] = useState(false);
  const [headerData, setHeaderData] = useState<HeaderData>({
    categories: [],
    brands: [],
    articles: [],
    failed: false,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const compactCategoriesKey = "compact-categories";
  const compactBrandsKey = "compact-brands";
  const configuredHeaderNav = navigation
    .filter((item) => item.menuKey === "header")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      label: item.label,
      url: item.url,
      openInNewTab: item.openInNewTab,
    }));
  const headerNav = configuredHeaderNav.length
    ? configuredHeaderNav
    : fallbackHeaderNav;
  const configuredMobileNav = navigation
    .filter((item) => item.menuKey === "mobile")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      label: item.label,
      url: item.url,
      openInNewTab: item.openInNewTab,
    }));
  const mobileNav = configuredMobileNav.length
    ? configuredMobileNav
    : headerNav;

  useEffect(() => {
    let mounted = true;
    loadHeaderData().then((result) => {
      if (mounted) {
        setHeaderData(result);
        setDataError(result.failed);
        setDataLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncCustomerSession = () => {
      const token = window.localStorage.getItem("anhh-access-token");
      const raw = window.localStorage.getItem("anhh-customer");
      if (!token || !raw) {
        setCustomerSession(null);
        return;
      }
      try {
        const customer = JSON.parse(raw) as CustomerHeaderSession;
        setCustomerSession({
          fullName: customer.fullName || "Customer",
          email: customer.email || "",
          accountType: customer.accountType,
        });
      } catch {
        setCustomerSession(null);
      }
    };
    syncCustomerSession();
    window.addEventListener("anhh-auth-changed", syncCustomerSession);
    return () =>
      window.removeEventListener("anhh-auth-changed", syncCustomerSession);
  }, []);

  useEffect(() => {
    const handleHeaderAnimation = (event: Event) => {
      const detail = (event as CustomEvent<HeaderAnimationDetail>).detail;
      if (!detail?.target) return;
      const targetRef =
        detail.target === "wishlist" ? wishlistTargetRef : cartTargetRef;
      const target = targetRef.current;
      const targetRect = target?.getBoundingClientRect();
      const fallbackTarget = document
        .querySelector<HTMLElement>(`[data-${detail.target}-target="mobile"]`)
        ?.getBoundingClientRect();
      const destination =
        targetRect && targetRect.width > 0 ? targetRect : fallbackTarget;
      if (!destination || destination.width === 0) return;
      const setTargetPop =
        detail.target === "wishlist" ? setWishlistTargetPop : setCartTargetPop;
      const setCountPop =
        detail.target === "wishlist" ? setWishlistCountPop : setCartCountPop;
      setTargetPop(true);
      setCountPop(true);
      window.setTimeout(() => setTargetPop(false), 540);
      window.setTimeout(() => setCountPop(false), 440);
      if (detail.mode !== "flight" || !detail.sourceRect) return;
      const sourceCenterX =
        detail.sourceRect.left + detail.sourceRect.width / 2;
      const sourceCenterY =
        detail.sourceRect.top + detail.sourceRect.height / 2;
      const destinationCenterX = destination.left + destination.width / 2;
      const destinationCenterY = destination.top + destination.height / 2;
      const id = Date.now() + Math.round(Math.random() * 1000);
      setHeaderFlights((current) => [
        ...current.slice(-7),
        {
          ...detail,
          id,
          startX: sourceCenterX - 24,
          startY: sourceCenterY - 24,
          deltaX: destinationCenterX - sourceCenterX,
          deltaY: destinationCenterY - sourceCenterY,
        },
      ]);
      window.setTimeout(
        () =>
          setHeaderFlights((current) =>
            current.filter((flight) => flight.id !== id),
          ),
        700,
      );
    };
    window.addEventListener("anhh:header-animation", handleHeaderAnimation);
    return () =>
      window.removeEventListener(
        "anhh:header-animation",
        handleHeaderAnimation,
      );
  }, []);

  useEffect(() => {
    const updateScrolled = () => setHeaderScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function closeMenuSoon() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 120);
  }
  function toggleMenu(key: string) {
    cancelClose();
    setOpenMenu((current) => (current === key ? null : key));
  }
  function closeAll() {
    setOpen(false);
    setOpenMenu(null);
  }
  function openLoginDialog() {
    cancelClose();
    setOpenMenu(null);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const returnTo =
      currentPath === "/login" || currentPath === "/auth"
        ? ""
        : `?returnTo=${encodeURIComponent(currentPath)}`;
    router.push(`/login${returnTo}`);
  }
  function openRegisterDialog() {
    cancelClose();
    setOpenMenu(null);
    setLoginOpen(false);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams();
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
      params.set("returnTo", returnTo);
    }
    params.set("cancelTo", currentPath === "/register" ? "/" : currentPath);
    router.push(`/register?${params.toString()}`);
  }
  function selectDemoAccount(account: HeaderDemoAccount) {
    setLoginEmail(account.email);
    setLoginPassword(account.password);
    setLoginKind(account.kind);
    setLoginDestination(account.path);
    setLoginError("");
  }
  async function signInWithHeaderCredentials(
    kind: HeaderDemoAccount["kind"],
    email: string,
    password: string,
    destination: string,
  ) {
    let finalDestination = destination;
    if (kind === "staff") {
      const response = await loginStaff({
        emailOrPhone: email,
        password,
      });
      localStorage.removeItem("anhh-access-token");
      localStorage.removeItem("anhh-customer");
      localStorage.setItem("anhh-staff-access-token", response.accessToken);
      localStorage.setItem("anhh-staff", JSON.stringify(response.staff));
    } else {
      const response = await loginCustomer({
        emailOrPhone: email,
        password,
      });
      localStorage.removeItem("anhh-staff-access-token");
      localStorage.removeItem("anhh-staff");
      localStorage.setItem("anhh-access-token", response.accessToken);
      localStorage.setItem("anhh-customer", JSON.stringify(response.customer));
      finalDestination =
        (await resumePendingGuestAction(response.accessToken))?.returnTo ??
        destination;
    }
    window.dispatchEvent(new Event("anhh-auth-changed"));
    if (rememberLogin) localStorage.setItem("anhh-remember-login", "true");
    else localStorage.removeItem("anhh-remember-login");
    setLoginOpen(false);
    toast.success(signedInToast);
    router.push(finalDestination);
  }
  async function signInAsDemo(account: HeaderDemoAccount) {
    selectDemoAccount(account);
    setLoginBusy(true);
    try {
      await signInWithHeaderCredentials(
        account.kind,
        account.email,
        account.password,
        account.path,
      );
    } catch (caught) {
      setLoginError(
        caught instanceof ApiError
          ? caught.message
          : "The API is unavailable. Please try again.",
      );
    } finally {
      setLoginBusy(false);
    }
  }
  async function submitHeaderLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      await signInWithHeaderCredentials(
        loginKind,
        loginEmail,
        loginPassword,
        loginDestination,
      );
    } catch (caught) {
      setLoginError(
        caught instanceof ApiError
          ? caught.message
          : "The API is unavailable. Please try again.",
      );
    } finally {
      setLoginBusy(false);
    }
  }
  function retryHeaderData() {
    resetHeaderDataCache();
    setDataError(false);
    setDataLoading(true);
    loadHeaderData().then((result) => {
      setHeaderData(result);
      setDataError(result.failed);
      setDataLoading(false);
    });
  }

  if (hero)
    return (
      <header className="absolute inset-x-0 top-0 z-30 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            {siteLogo ? (
              <ResilientSiteLogo src={resolveMediaUrl(siteLogo) ?? siteLogo} alt={`${siteName} logo`} className="h-10 w-36 object-contain sm:w-44" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white"><Pill size={21} /></span>
            )}
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-extrabold tracking-[0.12em]">
                {siteName}
              </span>
              <span className="block text-[10px] font-bold tracking-[0.2em] text-blue-200">
                PHARMACY CARE
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/80 lg:flex">
            {headerNav.slice(0, 7).map((item) => (
              <NavigationLink
                key={`${item.label}-${item.url}`}
                item={item}
                className="hover:text-blue-200"
              />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ButtonLink
              href="/auth"
              size="sm"
              className="hidden bg-[#2563EB] text-white shadow-lg shadow-blue-950/20 hover:bg-[#1D4ED8] sm:inline-flex"
            >
              {t("header.getStarted")}
            </ButtonLink>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label={t("header.toggleNavigation")}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="border-t border-white/10 bg-[#002B6F] px-4 py-4 lg:hidden">
            <nav className="mx-auto grid max-w-7xl gap-3 text-sm font-bold">
              {mobileNav.map((item) => (
                <NavigationLink
                  key={`${item.label}-${item.url}`}
                  item={{ ...item, label: localizedNavLabel(item, t) }}
                  onClick={() => setOpen(false)}
                />
              ))}
              <Link href="/auth" onClick={() => setOpen(false)}>
                {t("footer.loginRegister")}
              </Link>
            </nav>
          </div>
        )}
      </header>
    );

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
        aria-hidden="true"
      >
        {headerFlights.map((flight) => (
          <span
            key={flight.id}
            className="header-flying-item fixed grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl"
            style={
              {
                left: flight.startX,
                top: flight.startY,
                "--cart-dx": `${flight.deltaX}px`,
                "--cart-dy": `${flight.deltaY}px`,
              } as CSSProperties
            }
          >
            {flight.imageUrl ? (
              <span
                className="h-full w-full rounded-xl bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${flight.imageUrl}")` }}
              />
            ) : (
              <ShoppingBag size={22} className="text-[var(--color-primary)]" />
            )}
          </span>
        ))}
      </div>
      <div className="sticky top-0 z-50">
        <AnnouncementMarquee />
        <header
          className={`relative z-10 border-b backdrop-blur transition-shadow duration-200 ${headerScrolled ? "shadow-lg shadow-slate-900/10" : "shadow-sm"}`}
          style={{
            backgroundColor:
              colorMode === "dark"
                ? "color-mix(in srgb, #0f172a 95%, transparent)"
                : `color-mix(in srgb, ${design.headerBackground} 95%, transparent)`,
            color: colorMode === "dark" ? "#f8fafc" : design.headerText,
            borderColor: colorMode === "dark" ? "#334155" : design.border,
          }}
        >
          <div className="mx-auto flex min-h-[76px] w-full max-w-7xl flex-wrap items-center gap-3 overflow-visible px-4 py-3 sm:px-6 2xl:h-[76px] 2xl:max-w-[1600px] 2xl:flex-nowrap 2xl:gap-4 2xl:px-8 2xl:py-0">
            <Button
              variant="ghost"
              size="icon"
              className="2xl:hidden"
              onClick={() => {
                setOpen(!open);
                setOpenMenu(null);
              }}
              aria-label={t("header.toggleNavigation")}
            >
              {open ? <X /> : <Menu />}
            </Button>
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              {siteLogo ? (
                <ResilientSiteLogo src={resolveMediaUrl(siteLogo) ?? siteLogo} alt={`${siteName} logo`} className="h-10 w-32 object-contain sm:w-40" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: design.primary }}><Pill size={21} strokeWidth={2.2} /></span>
              )}
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-extrabold tracking-[0.14em] text-slate-900">
                  {siteName}
                </span>
                <span
                  className="block text-xs font-bold tracking-[0.2em]"
                  style={{ color: design.primary }}
                >
                  PHARMACY CARE
                </span>
              </span>
            </Link>
            <div
              className="relative hidden shrink-0 2xl:block"
              onMouseEnter={() => {
                cancelClose();
                setOpenMenu(compactCategoriesKey);
              }}
              onMouseLeave={closeMenuSoon}
              onFocus={() => {
                cancelClose();
                setOpenMenu(compactCategoriesKey);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  closeMenuSoon();
              }}
            >
              <Button
                type="button"
                onClick={() => {
                  cancelClose();
                  setOpenMenu(compactCategoriesKey);
                }}
                className="h-11 shrink-0 rounded-full border-2 border-[#003893] bg-white px-4 text-sm font-bold text-[#003893] shadow-sm transition-colors duration-200 hover:border-[#003893] hover:bg-[#003893] hover:text-white"
                aria-haspopup="menu"
                aria-expanded={openMenu === compactCategoriesKey}
              >
                <LayoutGrid size={17} />
                {t("nav.categories")}
                <ChevronDown
                  size={15}
                  className={`transition-transform ${openMenu === compactCategoriesKey ? "rotate-180" : ""}`}
                />
              </Button>
              <div
                className={`${openMenu === compactCategoriesKey ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-1 opacity-0"} absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl transition duration-150`}
                role="menu"
              >
                {dataLoading ? (
                  <div className="flex items-center gap-2 p-7 text-sm text-slate-500">
                    <Loader2
                      size={16}
                      className="animate-spin text-[#003893]"
                    />
                    {t("header.loadingMenu")}
                  </div>
                ) : dataError ? (
                  <div className="flex flex-wrap items-center gap-3 p-7 text-sm text-slate-600">
                    <span>{t("header.menuUnavailable")}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryHeaderData}
                    >
                      {t("header.retry")}
                    </Button>
                  </div>
                ) : (
                  <MegaMenuPanel
                    kind="categories"
                    data={headerData}
                    onNavigate={closeAll}
                  />
                )}
              </div>
            </div>
            <div
              className="relative hidden shrink-0 2xl:block"
              onMouseEnter={() => {
                cancelClose();
                setOpenMenu(compactBrandsKey);
              }}
              onMouseLeave={closeMenuSoon}
              onFocus={() => {
                cancelClose();
                setOpenMenu(compactBrandsKey);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  closeMenuSoon();
              }}
            >
              <Button
                type="button"
                onClick={() => {
                  cancelClose();
                  setOpenMenu(compactBrandsKey);
                }}
                className="h-11 shrink-0 rounded-full border-2 border-[#003893] bg-white px-4 text-sm font-bold text-[#003893] shadow-sm transition-colors duration-200 hover:border-[#003893] hover:bg-[#003893] hover:text-white"
                aria-haspopup="menu"
                aria-expanded={openMenu === compactBrandsKey}
              >
                <Tags size={17} />
                {t("nav.brands")}
                <ChevronDown
                  size={15}
                  className={`transition-transform ${openMenu === compactBrandsKey ? "rotate-180" : ""}`}
                />
              </Button>
              <div
                className={`${openMenu === compactBrandsKey ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-1 opacity-0"} absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl transition duration-150`}
                role="menu"
              >
                {dataLoading ? (
                  <div className="flex items-center gap-2 p-7 text-sm text-slate-500">
                    <Loader2
                      size={16}
                      className="animate-spin text-[#003893]"
                    />
                    {t("header.loadingMenu")}
                  </div>
                ) : dataError ? (
                  <div className="flex flex-wrap items-center gap-3 p-7 text-sm text-slate-600">
                    <span>{t("header.menuUnavailable")}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryHeaderData}
                    >
                      {t("header.retry")}
                    </Button>
                  </div>
                ) : (
                  <MegaMenuPanel
                    kind="brands"
                    data={headerData}
                    onNavigate={closeAll}
                  />
                )}
              </div>
            </div>
            <Link
              href="/track-order"
              className="hidden h-11 shrink-0 items-center rounded-full border-2 border-[#003893] bg-white px-4 text-sm font-bold text-[#003893] shadow-sm transition-colors duration-200 hover:border-[#003893] hover:bg-[#003893] hover:text-white 2xl:inline-flex"
            >
              Track order
            </Link>
            <Link
              href="/articles"
              className="hidden h-11 shrink-0 items-center rounded-full border-2 border-[#003893] bg-white px-4 text-sm font-bold text-[#003893] shadow-sm transition-colors duration-200 hover:border-[#003893] hover:bg-[#003893] hover:text-white 2xl:inline-flex"
            >
              <FileText size={16} />
              {t("nav.articles")}
            </Link>
            <div className="hidden items-center gap-1.5 2xl:flex">
              <ButtonLink
                href="/products"
                variant="outline"
                className="h-11 shrink-0 rounded-full border-2 border-[#003893] px-5 font-bold text-[#003893] hover:bg-[#003893] hover:text-white"
              >
                Shop Now
              </ButtonLink>
              <button
                type="button"
                onClick={toggleColorMode}
                className="header-icon-action"
                aria-label={
                  colorMode === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                title={
                  colorMode === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {colorMode === "dark" ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <MessagingLink accountType="customer" compact />
              {customerSession ? (
                <AccountProfileMenu
                  kind="customer"
                  name={customerSession.fullName}
                  email={customerSession.email}
                  accountTypeLabel={
                    customerSession.accountType === "PHARMACY"
                      ? "Pharmacy account"
                      : "Personal Use account"
                  }
                  links={[
                    { label: "My Account", href: "/account" },
                    { label: "My Orders", href: "/orders" },
                    { label: "Wishlist", href: "/wishlist" },
                  ]}
                />
              ) : (
                <button
                  type="button"
                  onClick={openLoginDialog}
                  className="header-icon-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893]/30"
                  aria-label="Sign in or create an account"
                  title="Sign in or create an account"
                  aria-haspopup="dialog"
                  aria-expanded={loginOpen}
                >
                  <UserRound size={20} />
                </button>
              )}
              <Link
                href="/products"
                className="header-icon-action relative"
                aria-label="Browse products"
                title="Browse products"
              >
                <Scale size={20} />
              </Link>
              <Link
                href="/wishlist"
                ref={wishlistTargetRef}
                data-wishlist-target="desktop"
                className={`header-icon-action relative ${wishlistTargetPop ? "header-target-pop" : ""}`}
                aria-label={t("header.wishlist")}
                title={t("header.wishlist")}
              >
                <Heart size={20} />
                {wishlist.length > 0 && (
                  <b
                    className={`count-badge ${wishlistCountPop ? "header-count-pop" : ""}`}
                  >
                    {wishlist.length}
                  </b>
                )}
              </Link>
              <Link
                href="/cart"
                ref={cartTargetRef}
                data-cart-target="desktop"
                className={`header-icon-action relative ${cartTargetPop ? "header-target-pop" : ""}`}
                aria-label={t("header.cart")}
                title={t("header.cart")}
              >
                <ShoppingBag size={21} />
                {cartCount > 0 && (
                  <b
                    className={`count-badge ${cartCountPop ? "header-count-pop" : ""}`}
                  >
                    {cartCount}
                  </b>
                )}
              </Link>
            </div>
          </div>
          <nav
            className={`${open ? "block" : "hidden"} border-t border-slate-100 2xl:hidden`}
            aria-label="Customer navigation"
          >
            <div className="relative mx-auto flex max-w-7xl flex-col items-stretch px-4 py-1 text-sm font-semibold text-slate-600 sm:px-6 2xl:px-8">
              {headerNav.map((item, index) => {
                const kind = getMenuKind(item);
                const key = `${item.label}-${item.url}-${index}`;
                const isOpen = openMenu === key;
                return (
                  <div
                    key={key}
                    className="relative"
                    onMouseEnter={() =>
                      kind && (cancelClose(), setOpenMenu(key))
                    }
                    onMouseLeave={closeMenuSoon}
                    onFocus={() => kind && (cancelClose(), setOpenMenu(key))}
                    onBlur={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      )
                        closeMenuSoon();
                    }}
                  >
                    <div className="flex items-center border-b border-slate-100">
                      <NavigationLink
                        item={{ ...item, label: localizedNavLabel(item, t) }}
                        className="nav-link flex min-h-11 flex-1 items-center 2xl:min-h-0"
                        onClick={() => {
                          if (open) closeAll();
                        }}
                        aria-haspopup={kind ? "menu" : undefined}
                        aria-expanded={kind ? isOpen : undefined}
                      />
                      {kind && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className=""
                          onClick={() => toggleMenu(key)}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                          aria-expanded={isOpen}
                        >
                          <ChevronDown
                            size={15}
                            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </Button>
                      )}
                    </div>
                    {kind && (
                      <div
                        className={`${isOpen ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-1 opacity-0"} w-full overflow-hidden border-b border-slate-200 bg-white shadow-xl transition duration-150`}
                        role="menu"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-bold text-slate-500 2xl:hidden">
                          {localizedNavLabel(item, t)}
                          <button
                            type="button"
                            className="font-semibold text-[#003893]"
                            onClick={() => setOpenMenu(null)}
                          >
                            {t("header.close")}
                          </button>
                        </div>
                        {dataLoading ? (
                          <div className="flex items-center gap-2 p-7 text-sm text-slate-500">
                            <Loader2
                              size={16}
                              className="animate-spin text-[#003893]"
                            />
                            {t("header.loadingMenu")}
                          </div>
                        ) : dataError ? (
                          <div className="flex flex-wrap items-center gap-3 p-7 text-sm text-slate-600">
                            <span>{t("header.menuUnavailable")}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={retryHeaderData}
                            >
                              {t("header.retry")}
                            </Button>
                          </div>
                        ) : (
                          <MegaMenuPanel
                            kind={kind}
                            data={headerData}
                            onNavigate={closeAll}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
          <div className="overflow-x-auto border-t border-slate-100 px-4 py-2 2xl:hidden">
            <div className="mx-auto flex min-w-max max-w-7xl items-center justify-between gap-4 text-xs font-semibold text-slate-600">
              {customerSession ? (
                <AccountProfileMenu
                  kind="customer"
                  compact
                  name={customerSession.fullName}
                  email={customerSession.email}
                  accountTypeLabel={
                    customerSession.accountType === "PHARMACY"
                      ? "Pharmacy account"
                      : "Personal Use account"
                  }
                  links={[
                    { label: "My Account", href: "/account" },
                    { label: "My Orders", href: "/orders" },
                    { label: "Wishlist", href: "/wishlist" },
                  ]}
                />
              ) : (
                <button
                  type="button"
                  onClick={openLoginDialog}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
                >
                  <UserRound size={15} /> <span className="max-[360px]:hidden">{t("header.account")}</span>
                </button>
              )}
              <Link
                href="/wishlist"
                data-wishlist-target="mobile"
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap ${wishlistTargetPop ? "header-target-pop" : ""}`}
              >
                <Heart size={15} /> <span className="max-[360px]:hidden">{t("header.wishlist")}</span>{" "}
                <span className={wishlistCountPop ? "header-count-pop" : ""}>
                  ({wishlist.length})
                </span>
              </Link>
              <Link
                href="/cart"
                data-cart-target="mobile"
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap ${cartTargetPop ? "header-target-pop" : ""}`}
              >
                <ShoppingBag size={15} /> <span className="max-[360px]:hidden">{t("header.cart")}</span>{" "}
                <span className={cartCountPop ? "header-count-pop" : ""}>
                  ({cartCount})
                </span>
              </Link>
              {!customerSession && (
                <button
                  type="button"
                  onClick={openLoginDialog}
                  className="shrink-0 whitespace-nowrap font-bold text-[#003893]"
                >
                  {t("header.signIn")}
                </button>
              )}
              <LanguageSwitcher mobile />
            </div>
          </div>
        </header>
      </div>
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-[380px] rounded-[1.5rem] p-6 sm:p-7"
        >
          <DialogHeader className="border-b border-slate-200 pb-4 pr-2">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-[22px] font-bold tracking-tight text-slate-900">
                Sign in
              </DialogTitle>
              <button
                type="button"
                onClick={openRegisterDialog}
                className="text-sm font-medium text-[#003893] transition hover:text-[#002B6F]"
              >
                Create an Account
              </button>
            </div>
          </DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                Quick demo access
              </p>
              <span className="text-[10px] font-semibold text-slate-400">
                Click to open
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {headerDemoAccounts.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signInAsDemo(account)}
                  disabled={loginBusy}
                  className={`h-8 justify-start rounded-lg px-2.5 text-[11px] font-bold ${
                    loginEmail === account.email
                      ? "border-[#003893] bg-[#003893] text-white hover:bg-[#002B6F] hover:text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#003893] hover:bg-white hover:text-[#003893]"
                  }`}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
          <form onSubmit={submitHeaderLogin} className="grid gap-4 pt-1">
            <div className="grid gap-2">
              <Label
                htmlFor="header-login-email"
                className="text-sm font-medium text-slate-800"
              >
                Username or email address{" "}
                <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="header-login-email"
                type="text"
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="username"
                className="h-11 rounded-full border-slate-200 px-4 text-sm focus:border-[#003893] focus:ring-[#003893]/10"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="header-login-password"
                className="text-sm font-medium text-slate-800"
              >
                Password <span className="text-rose-600">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="header-login-password"
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-full border-slate-200 px-4 pr-11 text-sm focus:border-[#003893] focus:ring-[#003893]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:text-[#003893] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003893]/30"
                  aria-label={
                    showLoginPassword ? "Hide password" : "Show password"
                  }
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {loginError && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
              >
                {loginError}
              </p>
            )}
            <Button
              type="submit"
              disabled={loginBusy}
              className="h-11 rounded-full bg-[#003893] font-bold text-white shadow-none transition hover:bg-[#002B6F]"
            >
              {loginBusy ? "Signing in…" : "Log In"}
            </Button>
            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <Checkbox
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                />
                Remember me
              </label>
              <Link
                href="/contact"
                onClick={() => setLoginOpen(false)}
                className="font-medium text-[#003893] transition hover:text-[#002B6F]"
              >
                Lost your password?
              </Link>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SiteFooter() {
  const siteName = useSiteValue("website.name", "All Nepal Healthy Home");
  const siteLogo = useSiteValue("website.logoUrl", "");
  const phone = useSiteValue("website.contactPhone", "01-5313958");
  const email = useSiteValue(
    "website.contactEmail",
    "hello@allnepalhealthyhome.com",
  );
  const address = useSiteValue("website.address", "Kathmandu, Nepal");
  const { navigation = [] } = useSiteConfig();
  const { t } = useI18n();
  const configuredFooterNav = navigation
    .filter((item) => item.menuKey === "footer")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      label: item.label,
      url: item.url,
      openInNewTab: item.openInNewTab,
    }));
  const footerNav = configuredFooterNav.length
    ? configuredFooterNav
    : [
        { label: "Shop medicines", url: "/products" },
        { label: "Upload prescription", url: "/prescription" },
        { label: "Categories", url: "/categories" },
        { label: "Brands", url: "/brands" },
        { label: "Track order", url: "/track-order" },
      ];
  return (
    <footer className="mt-20 bg-[#002B6F] text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5 lg:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 text-white">
            {siteLogo ? (
              <ResilientSiteLogo src={resolveMediaUrl(siteLogo) ?? siteLogo} alt={`${siteName} logo`} className="h-9 w-36 object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white"><Pill size={18} /></span>
            )}
            <span className="text-sm font-extrabold tracking-wider">
              {siteName}
            </span>
          </div>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/50">
            {t("footer.tagline")}
          </p>
          <p className="mt-5 text-xs leading-5 text-white/50">
            {phone}
            <br />
            {email}
            <br />
            {address}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            {t("footer.quickLinks")}
          </h3>
          <div className="mt-4 grid gap-3 text-sm">
            {footerNav.map((item) => (
              <NavigationLink key={`${item.label}-${item.url}`} item={item} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            {t("footer.myAccount")}
          </h3>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/login">{t("footer.loginRegister")}</Link>
            <Link href="/orders">{t("footer.myOrders")}</Link>
            <Link href="/wishlist">{t("header.wishlist")}</Link>
            <Link href="/orders">{t("footer.trackOrder")}</Link>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            {t("footer.company")}
          </h3>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/about">{t("nav.about")}</Link>
            <Link href="/contact">{t("nav.contact")}</Link>
            <Link href="/about">{t("footer.ourValues")}</Link>
            <Link href="/contact">{t("footer.support")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/40 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <span>
            © 2026 {siteName}. {t("footer.copyright")}
          </span>
          <span>{t("footer.legal")}</span>
        </div>
      </div>
    </footer>
  );
}
