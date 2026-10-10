"use client";

import { UniversalImageUploader } from "@/components/universal-image-uploader";
import { EntityListWorkspace, EntityListPanel, showEntityList, EntityFormPanel , entitySaveComplete } from "@/components/entity-list-panel";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Edit3,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { AdminShell } from "@/components/admin-shell";
import { FormSaveActions } from "@/components/form-save-actions";
import { TRANSPARENCY_PREVIEW_STYLE, validateImageFile } from "@/lib/image-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNPR } from "@/lib/catalog";
import {
  AdminBrand,
  AdminMedicine,
  AdminProduct,
  bulkUpdateAdminProductStatus,
  createAdminProduct,
  getAdminBrands,
  getAdminProduct,
  getAdminMedicines,
  getAdminProducts,
  setAdminEntityStatus,
  updateAdminProduct,
  uploadAdminMedia,
  resolveMediaUrl,
} from "@/services/api";

const blank = {
  name: "",
  slug: "",
  sku: "",
  medicineId: "",
  brandId: "",
  mrp: "",
  sellingPrice: "",
  imageUrl: "",
  barcode: "",
  packSize: "",
  taxRate: "0",
  discountPercent: "0",
  bonusScheme: "",
  searchKeywords: "",
  isFeatured: false,
  isActive: true,
  isBestSeller: false,
  isNewArrival: false,
  isTrending: false,
  isHotDeal: false,
  companyCode: "",
  companyName: "",
  imageSourceUrl: "",
  imageVerificationStatus: "MISSING",
  imageSourceReference: "",
  imageSourceWebsite: "",
  imageSourcePageUrl: "",
  imageMatchingNotes: "",
  demandScore: "0",
  demandBasis: "NO_HISTORY",
  demandSourceUrl: "",
  demandSourceReference: "",
  displayOrder: "0",
};
type ProductFormValues = typeof blank;
type ProductImageDraft = { url: string; preview: string; file?: File };
const token = () =>
  typeof window === "undefined"
    ? ""
    : (window.localStorage.getItem("anhh-staff-access-token") ?? "");

export function AdminProductsPage({
  superAdmin = false,
}: {
  superAdmin?: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [sort, setSort] = useState("created");
  const [missingImages, setMissingImages] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (term = "", clearSelection = true, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const response = await getAdminProducts(
          token(),
          { search: term || undefined, company: companySearch || undefined, category: categorySearch || undefined, sort, page, pageSize: 50, missingImages: missingImages === "all" ? undefined : missingImages === "missing" },
          superAdmin,
          false,
          signal,
        );
        if (signal?.aborted) return;
        setProducts(response.items);
        setTotalPages(response.totalPages);
        if (clearSelection) setSelectedIds([]);
      } catch (e) {
        if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(
          e instanceof Error ? e.message : "Products could not be loaded.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [categorySearch, companySearch, missingImages, page, sort, superAdmin],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void load(search.trim(), true, controller.signal);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [load, search]);

  async function bulkStatus(isActive: boolean) {
    if (!selectedIds.length) return;
    setBulkSaving(true);
    try {
      const result = await bulkUpdateAdminProductStatus(
        selectedIds,
        isActive,
        token(),
        superAdmin,
      );
      await load(search, false);
      toast.success(
        `${result.updated} product${result.updated === 1 ? "" : "s"} updated`,
      );
     entitySaveComplete(); } catch (e) {
      setError(
        e instanceof Error ? e.message : "Products could not be updated.",
      );
    } finally {
      setBulkSaving(false);
    }
  }

  async function toggleStatus(product: AdminProduct, isActive: boolean) {
    try {
      await setAdminEntityStatus(
        "product",
        product.id,
        isActive,
        token(),
        superAdmin,
      );
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, isActive } : item,
        ),
      );
      toast.success(
        `${product.name} ${isActive ? "Activated" : "Deactivated"}`,
      );
     entitySaveComplete(); } catch (e) {
      const message =
        e instanceof Error ? e.message : "Product status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }

  const visibleProducts =
    status === "all"
      ? products
      : products.filter(
          (product) => product.isActive === (status === "active"),
        );
  const allSelected =
    visibleProducts.length > 0 &&
    visibleProducts.every((product) => selectedIds.includes(product.id));
  const selectedProducts = products.filter((product) =>
    selectedIds.includes(product.id),
  );
  const selectedActiveCount = selectedProducts.filter(
    (product) => product.isActive,
  ).length;
  const hasSelectedActive = selectedActiveCount > 0;
  const hasSelectedInactive = selectedProducts.length > selectedActiveCount;

  return (
    <AdminShell superAdmin={superAdmin}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
            Catalog
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Products
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage medicines and products in your pharmacy catalog.
          </p>
        </div>
        <Button
          type="button"
          onClick={() =>
            router.push(
              `${superAdmin ? "/superadmin" : "/admin"}/products/create`,
            )
          }
        >
          <Plus size={16} />
          Add product
        </Button>
      </div>
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageSearch size={18} className="text-[#003893]" />
            Product catalogue
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
                <Search
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <Input
                  aria-label="Search products"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products, SKU or medicine"
                  aria-describedby="product-search-status"
                />
              </div>
            <Input aria-label="Filter by company" value={companySearch} onChange={event => { setPage(1); setCompanySearch(event.target.value); }} placeholder="Company code or name" className="w-[190px]" />
            <Input aria-label="Filter by category" value={categorySearch} onChange={event => { setPage(1); setCategorySearch(event.target.value); }} placeholder="Category" className="w-[150px]" />
            <Select aria-label="Product ranking" value={sort} onChange={event => { setPage(1); setSort(event.target.value); }} className="w-[160px]"><option value="created">Recently imported</option><option value="demand">Demand first</option><option value="rank">Manual order</option><option value="name">Name</option></Select>
            <Select aria-label="Image verification filter" value={missingImages} onChange={event => { setPage(1); setMissingImages(event.target.value); }} className="w-[170px]"><option value="all">All images</option><option value="missing">Missing / pending</option><option value="verified">Verified only</option></Select>
            <span id="product-search-status" className="sr-only" aria-live="polite">
              {loading ? "Searching products" : `${products.length} products shown`}
            </span>
            <Select
              aria-label="Product status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
              className="w-[150px]"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="mr-2 text-xs font-bold text-slate-600">
              {selectedIds.length} selected
            </span>
            <Button
              size="sm"
              variant={hasSelectedInactive ? "default" : "outline"}
              disabled={!hasSelectedInactive || bulkSaving}
              onClick={() => void bulkStatus(true)}
            >
              {bulkSaving ? <Loader2 className="animate-spin" /> : null}Activate
            </Button>
            <Button
              size="sm"
              variant={hasSelectedActive ? "destructive" : "outline"}
              disabled={!hasSelectedActive || bulkSaving}
              onClick={() => void bulkStatus(false)}
            >
              Deactivate
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-10 text-sm text-slate-500">
              <Loader2 className="mr-2 animate-spin" size={18} />
              Loading products…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox
                        aria-label="Select all visible products"
                        checked={allSelected}
                        onChange={(event) =>
                          setSelectedIds(
                            event.target.checked
                              ? visibleProducts.map((product) => product.id)
                              : [],
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Demand</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Import</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${product.name}`}
                          checked={selectedIds.includes(product.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, product.id]
                                : current.filter((id) => id !== product.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-800">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {product.genericName}
                        </p>
                        {(product.companyCode || product.companyName) && <p className="text-[10px] text-slate-400">{product.companyCode ?? "—"} · {product.companyName ?? "Company not recorded"}</p>}
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.brand}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="font-bold">
                        {product.stock}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatNPR(product.sellingPrice)}
                      </TableCell>
                      <TableCell><span className="font-bold">{product.demandScore}</span><span className="block text-[10px] uppercase text-slate-400">{product.demandBasis.replaceAll("_", " ")}</span></TableCell>
                      <TableCell><Badge variant={product.missingImageStatus === "MISSING" ? "secondary" : "default"}>{product.missingImageStatus === "MISSING" ? "Missing" : "Verified"}</Badge></TableCell>
                      <TableCell><span className="text-[10px] font-bold uppercase text-slate-500">{product.importStatus.replaceAll("_", " ")}</span></TableCell>
                      <TableCell>
                        <ActiveStatusToggle
                          checked={product.isActive}
                          onChange={(isActive) =>
                            toggleStatus(product, isActive)
                          }
                          label={`product ${product.name}`}
                          confirmOnDeactivate
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${product.name}`}
                          title={`Edit ${product.name}`}
                          onClick={() =>
                            router.push(
                              `${superAdmin ? "/superadmin" : "/admin"}/products/${product.id}/edit`,
                            )
                          }
                        >
                          <Edit3 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!visibleProducts.length && (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No products match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm"><span className="text-slate-500">Page {page} of {Math.max(1, totalPages)}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(current => current + 1)}>Next</Button></div></div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}

export function AdminProductFormPage({
  productId,
  superAdmin = true,
}: {
  productId?: string;
  superAdmin?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(productId);
  const listPath = superAdmin ? "/superadmin/products" : "/admin/products";
  const [form, setForm] = useState<ProductFormValues>(blank);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [medicines, setMedicines] = useState<AdminMedicine[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getAdminMedicines(token(), superAdmin, !productId),
      getAdminBrands(token(), superAdmin, !productId),
      productId
        ? getAdminProduct(productId, token(), superAdmin)
        : Promise.resolve(null),
    ])
      .then(([medicineRows, brandRows, productResponse]) => {
        setMedicines(medicineRows);
        setBrands(brandRows);
        if (productId) {
          const product = productResponse;
          if (!product) throw new Error("Product could not be found.");
          setForm({
            ...blank,
            name: product.name,
            slug: product.slug,
            sku: product.sku,
            medicineId: product.medicineId,
            brandId: product.brandId,
            mrp: String(product.mrp),
            sellingPrice: String(product.sellingPrice),
            isActive: product.isActive,
            isTrending: product.isTrending,
            isHotDeal: Boolean(product.isHotDeal),
            imageUrl: product.imageUrl ?? "",
            bonusScheme: product.bonusScheme ?? "",
            companyCode: product.companyCode ?? "",
            companyName: product.companyName ?? "",
            imageSourceUrl: product.imageSourceUrl ?? "",
            imageVerificationStatus: product.imageVerificationStatus ?? "MISSING",
            imageSourceReference: product.imageSourceReference ?? "",
            imageSourceWebsite: product.imageSourceWebsite ?? "",
            imageSourcePageUrl: product.imageSourcePageUrl ?? "",
            imageMatchingNotes: product.imageMatchingNotes ?? "",
            demandScore: String(product.demandScore ?? 0),
            demandBasis: product.demandBasis ?? "NO_HISTORY",
            demandSourceUrl: product.demandSourceUrl ?? "",
            demandSourceReference: product.demandSourceReference ?? "",
            displayOrder: String(product.displayOrder ?? 0),
           });
          const urls = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
          setImages(urls.map(url => ({ url, preview: url })));
        }
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Product could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [productId, superAdmin]);

  function setField(key: keyof ProductFormValues, value: string | boolean) {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  }
  function setProductImages(next: ProductImageDraft[]) {
    setDirty(true);
    setImages(next);
    setForm(current => ({ ...current, imageUrl: next[0]?.url ?? "" }));
  }
  function addImageFiles(files: File[] | null) {
    if (!files?.length) return;
    const available = 5 - images.length;
    if (files.length > available) { setError(`A product can have up to 5 images. You can add ${available} more.`); return; }
    const next = [...images];
    for (const file of Array.from(files)) {
      const validationError = validateImageFile(file);
      if (validationError) { setError(validationError); return; }
      next.push({ url: "", preview: URL.createObjectURL(file), file });
    }
    setError("");
    setProductImages(next);
  }
  function removeImage(index: number) {
    const removed = images[index];
    if (removed?.file) URL.revokeObjectURL(removed.preview);
    setProductImages(images.filter((_, imageIndex) => imageIndex !== index));
  }
  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setProductImages(next);
  }
  async function save(saveAndAnother = false) {
    setSaving(true);
    setError("");
    try {
      if (images.length < 1 || images.length > 5) throw new Error("Add between 1 and 5 product images before saving.");
      const imageUrls = await Promise.all(images.map(async image => image.file ? (await uploadAdminMedia(image.file, "PRODUCT", form.name.trim(), true, token(), superAdmin)).url : image.url));
      const input = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim(),
        medicineId: form.medicineId,
        brandId: form.brandId,
        mrp: Number(form.mrp),
        sellingPrice: Number(form.sellingPrice),
        imageUrl: imageUrls[0],
        imageUrls,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        barcode: form.barcode || undefined,
        packSize: form.packSize || undefined,
        taxRate: Number(form.taxRate),
        discountPercent: Number(form.discountPercent),
        isBestSeller: form.isBestSeller,
        isNewArrival: form.isNewArrival,
        isTrending: form.isTrending,
        isHotDeal: form.isHotDeal,
        searchKeywords: form.searchKeywords || undefined,
        bonusScheme: form.bonusScheme || undefined,
        companyCode: form.companyCode || undefined,
        companyName: form.companyName || undefined,
        imageSourceUrl: form.imageSourceUrl || undefined,
        imageVerificationStatus: form.imageVerificationStatus,
        imageSourceReference: form.imageSourceReference || undefined,
        imageSourceWebsite: form.imageSourceWebsite || undefined,
        imageSourcePageUrl: form.imageSourcePageUrl || undefined,
        imageSearchedAtUtc: new Date().toISOString(),
        imageMatchingNotes: form.imageMatchingNotes || undefined,
        demandScore: Number(form.demandScore) || 0,
        demandBasis: form.demandBasis,
        demandSourceUrl: form.demandSourceUrl || undefined,
        demandSourceReference: form.demandSourceReference || undefined,
        displayOrder: Number(form.displayOrder) || 0,
      };
      const saved = await (editing
        ? updateAdminProduct(productId!, input, token(), superAdmin)
        : createAdminProduct(input, token(), superAdmin));
      toast.success(
        editing
          ? `${saved.name} updated successfully.`
          : saveAndAnother
            ? `${saved.name} created successfully. You can add another product.`
            : `${saved.name} created successfully.`,
      );
      setDirty(false);
      if (editing || !saveAndAnother) showEntityList(listPath);
      else {
        setForm(blank);
        images.forEach(image => { if (image.file) URL.revokeObjectURL(image.preview); });
        setImages([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
     entitySaveComplete(); } catch (e) {
      const message = e instanceof Error ? e.message : "Product could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }
  function cancel() {
    if (dirty) setDiscardOpen(true);
    else router.push(listPath);
  }

  return (
    <EntityListWorkspace title="Products"><AdminShell superAdmin={superAdmin}>
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={cancel}
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#003893]"
        >
          <ArrowLeft size={16} />
          Back to products
        </button>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
            Catalog
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {editing ? "Edit product" : "Create product"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {editing
              ? "Update the selected catalog record."
              : "Add a new medicine or product to the catalog."}
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
          >
            {error}
          </p>
        )}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading product form…
          </div>
        ) : (
          <EntityFormPanel formKey="0"><form onSubmit={submit} className="mt-7 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="product-name">Product name</Label>
                  <Input
                    id="product-name"
                    required
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input
                    id="product-sku"
                    required
                    value={form.sku}
                    onChange={(event) => setField("sku", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-slug">Slug</Label>
                  <Input
                    id="product-slug"
                    required
                    value={form.slug}
                    onChange={(event) => setField("slug", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-medicine">Medicine</Label>
                  <Select
                    id="product-medicine"
                    required
                    value={form.medicineId}
                    onChange={(event) =>
                      setField("medicineId", event.target.value)
                    }
                  >
                    <option value="">Select medicine</option>
                    {medicines
                      .filter(
                        (item) => item.isActive || item.id === form.medicineId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.strength ? ` · ${item.strength}` : ""}
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-brand">Brand</Label>
                  <Select
                    id="product-brand"
                    required
                    value={form.brandId}
                    onChange={(event) =>
                      setField("brandId", event.target.value)
                    }
                  >
                    <option value="">Select brand</option>
                    {brands
                      .filter(
                        (item) => item.isActive || item.id === form.brandId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pricing and merchandising</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-mrp">MRP</Label>
                  <Input
                    id="product-mrp"
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.mrp}
                    onChange={(event) => setField("mrp", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-price">Selling price</Label>
                  <Input
                    id="product-price"
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setField("sellingPrice", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-pack">Pack size</Label>
                  <Input
                    id="product-pack"
                    value={form.packSize}
                    onChange={(event) =>
                      setField("packSize", event.target.value)
                    }
                    placeholder="10 tablets"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-discount">Discount %</Label>
                  <Input
                    id="product-discount"
                    min="0"
                    max="100"
                    step="0.01"
                    type="number"
                    value={form.discountPercent}
                    onChange={(event) =>
                      setField("discountPercent", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-bonus-scheme">Pharmacy bonus / scheme</Label>
                  <Input id="product-bonus-scheme" value={form.bonusScheme} onChange={(event) => setField("bonusScheme", event.target.value)} placeholder="10+1 free" />
                </div>
                  <div className="grid gap-3 sm:col-span-2">
                    <div>
                      <Label htmlFor="product-images">Product images <span className="text-rose-600">*</span></Label>
                      <p className="mt-1 text-xs text-slate-500">Add 1–5 JPG, PNG, or WebP images. The first image is the listing image.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                      {images.map((image, index) => <div key={`${image.preview}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={TRANSPARENCY_PREVIEW_STYLE}>
                        <img src={image.file ? image.preview : resolveMediaUrl(image.preview)} alt={`Product image ${index + 1}`} onError={(event) => { const target = event.currentTarget; if (target.dataset.fallback) return; target.dataset.fallback = "true"; target.src = "/catalog-placeholder.svg"; }} className="aspect-square h-full w-full object-contain p-2 " />
                        <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <Button type="button" variant="secondary" size="icon-sm" disabled={index === 0} onClick={() => moveImage(index, -1)} aria-label={`Move image ${index + 1} left`}><ArrowUp size={14} /></Button>
                          <Button type="button" variant="secondary" size="icon-sm" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label={`Move image ${index + 1} right`}><ArrowDown size={14} /></Button>
                          <Button type="button" variant="destructive" size="icon-sm" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}><Trash2 size={14} /></Button>
                        </div>
                        {index === 0 && <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-white">Primary</span>}
                      </div>)}
                      {images.length < 5 && <UniversalImageUploader disabled={saving} uploadState={saving ? "uploading" : "idle"} key={images.length} label="Add product images" multiple maxFiles={5 - images.length} onFiles={addImageFiles} onChange={file => addImageFiles([file])} aspect="aspect-square" helperText="Up to 5 images. Square packshots recommended; full packaging remains visible." />}
                    </div>
                    {!images.length && <p className="text-xs font-semibold text-rose-700">At least one product image is required.</p>}
                  </div>
                <div className="flex flex-wrap gap-5 text-sm font-semibold sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isActive}
                      onChange={(event) =>
                        setField("isActive", event.target.checked)
                      }
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isFeatured}
                      onChange={(event) =>
                        setField("isFeatured", event.target.checked)
                      }
                    />
                    Featured
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isBestSeller}
                      onChange={(event) =>
                        setField("isBestSeller", event.target.checked)
                      }
                    />
                    Best seller
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isNewArrival}
                      onChange={(event) =>
                        setField("isNewArrival", event.target.checked)
                      }
                    />
                    New arrival
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isTrending}
                      onChange={(event) => setField("isTrending", event.target.checked)}
                    />
                    Trending in hero
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.isHotDeal}
                      onChange={(event) => setField("isHotDeal", event.target.checked)}
                    />
                    Hot health deal
                  </label>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Catalog provenance and ranking</CardTitle><p className="text-sm text-slate-500">Keep the source identity visible. Demand scores are evidence labels, not clinical or sales guarantees.</p></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="product-company-code">Company code</Label><Input id="product-company-code" value={form.companyCode} onChange={event => setField("companyCode", event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="product-company-name">Company name</Label><Input id="product-company-name" value={form.companyName} onChange={event => setField("companyName", event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="product-image-source">Exact image URL</Label><Input id="product-image-source" type="url" value={form.imageSourceUrl} onChange={event => setField("imageSourceUrl", event.target.value)} placeholder="Leave blank until verified" /></div>
                <div className="grid gap-2"><Label htmlFor="product-image-website">Source website</Label><Input id="product-image-website" value={form.imageSourceWebsite} onChange={event => setField("imageSourceWebsite", event.target.value)} placeholder="manufacturer.example" /></div>
                <div className="grid gap-2 sm:col-span-2"><Label htmlFor="product-image-page">Source product page URL</Label><Input id="product-image-page" type="url" value={form.imageSourcePageUrl} onChange={event => setField("imageSourcePageUrl", event.target.value)} placeholder="Exact product listing or manufacturer page" /></div>
                <div className="grid gap-2"><Label htmlFor="product-image-status">Image verification status</Label><Select id="product-image-status" value={form.imageVerificationStatus} onChange={event => setField("imageVerificationStatus", event.target.value)}><option value="MISSING">Missing / not verified</option><option value="VERIFIED_OFFICIAL">Verified official</option><option value="UNVERIFIED">Unverified</option></Select></div>
                <div className="grid gap-2 sm:col-span-2"><Label htmlFor="product-image-reference">Image source notes</Label><Input id="product-image-reference" value={form.imageSourceReference} onChange={event => setField("imageSourceReference", event.target.value)} placeholder="Manufacturer page, catalog reference, or verification note" /></div>
                <div className="grid gap-2 sm:col-span-2"><Label htmlFor="product-image-match-notes">Exact-match notes</Label><Input id="product-image-match-notes" value={form.imageMatchingNotes} onChange={event => setField("imageMatchingNotes", event.target.value)} placeholder="Confirm brand, strength, pack size, form, and packaging design" /></div>
                <div className="grid gap-2"><Label htmlFor="product-demand-score">Demand score (0–100)</Label><Input id="product-demand-score" type="number" min="0" max="100" step="0.01" value={form.demandScore} onChange={event => setField("demandScore", event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="product-display-order">Manual display order</Label><Input id="product-display-order" type="number" min="0" step="1" value={form.displayOrder} onChange={event => setField("displayOrder", event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="product-demand-basis">Demand basis</Label><Select id="product-demand-basis" value={form.demandBasis} onChange={event => setField("demandBasis", event.target.value)}><option value="NO_HISTORY">No sales/research evidence</option><option value="SALES_HISTORY">Website sales history</option><option value="MARKET_RESEARCH_PROXY">Market research proxy</option></Select></div>
                <div className="grid gap-2"><Label htmlFor="product-demand-source">Demand source URL</Label><Input id="product-demand-source" type="url" value={form.demandSourceUrl} onChange={event => setField("demandSourceUrl", event.target.value)} /></div>
                <div className="grid gap-2 sm:col-span-2"><Label htmlFor="product-demand-reference">Demand source/reference</Label><Input id="product-demand-reference" value={form.demandSourceReference} onChange={event => setField("demandSourceReference", event.target.value)} /></div>
              </CardContent>
            </Card>
            <FormSaveActions
              mode={editing ? "edit" : "create"}
              busy={saving}
              onCancel={cancel}
              onSaveAndAnother={!editing ? () => void save(true) : undefined}
              saveLabel={editing ? "Save changes" : "Save & list"}
            />
          </form></EntityFormPanel>
        )}
        <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your changes have not been saved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push(listPath)}>
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    <EntityListPanel formKey="0"><AdminProductsPage superAdmin={superAdmin} /></EntityListPanel></AdminShell></EntityListWorkspace>
  );
}
