"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import {
  Factory,
  Layers3,
  Loader2,
  Pencil,
  Pill,
  Plus,
  Tags,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AdminBrand,
  AdminCategory,
  AdminManufacturer,
  AdminMedicine,
  createAdminBrand,
  createAdminCategory,
  createAdminManufacturer,
  createAdminMedicine,
  getAdminBrands,
  getAdminCategories,
  getAdminManufacturers,
  getAdminMedicines,
  setAdminEntityStatus,
  updateAdminBrand,
  updateAdminCategory,
  updateAdminManufacturer,
  updateAdminMedicine,
} from "@/services/api";
import { ActiveStatusToggle } from "@/components/active-status-toggle";
import { FormSaveActions } from "@/components/form-save-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const blankCategory = { name: "", slug: "", description: "", isActive: true };
const blankBrand = { name: "", slug: "", isActive: true };
const blankManufacturer = { name: "", country: "" };
const blankMedicine = {
  name: "",
  genericName: "",
  strength: "",
  dosageForm: "",
  categoryId: "",
  manufacturerId: "",
  prescriptionRequired: false,
  isActive: true,
};

export type CatalogEntity = "category" | "brand" | "manufacturer" | "medicine";
type CatalogView = "embedded" | "list" | "form";

export function AdminCatalogTaxonomy({
  superAdmin = false,
  view = "embedded",
  entity,
  entityId,
}: {
  superAdmin?: boolean;
  view?: CatalogView;
  entity?: CatalogEntity;
  entityId?: string;
}) {
  const router = useRouter();
  const listPath = `${superAdmin ? "/superadmin" : "/admin"}/catalog`;
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [manufacturers, setManufacturers] = useState<AdminManufacturer[]>([]);
  const [medicines, setMedicines] = useState<AdminMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(blankCategory);
  const [brand, setBrand] = useState(blankBrand);
  const [manufacturer, setManufacturer] = useState(blankManufacturer);
  const [medicine, setMedicine] = useState(blankMedicine);
  const [editing, setEditing] = useState<{
    type: CatalogEntity;
    id: string;
  } | null>(null);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [saving, setSaving] = useState("");
  const token = () =>
    window.localStorage.getItem("anhh-staff-access-token") ?? "";
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAdminCategories(token(), superAdmin),
      getAdminBrands(token(), superAdmin),
      getAdminManufacturers(token(), superAdmin),
      getAdminMedicines(token(), superAdmin),
    ])
      .then(([categoryRows, brandRows, manufacturerRows, medicineRows]) => {
        setCategories(categoryRows);
        setBrands(brandRows);
        setManufacturers(manufacturerRows);
        setMedicines(medicineRows);
        if (view === "form" && entity && entityId) {
          setEditing({ type: entity, id: entityId });
          const categoryRow = categoryRows.find((item) => item.id === entityId);
          const brandRow = brandRows.find((item) => item.id === entityId);
          const manufacturerRow = manufacturerRows.find(
            (item) => item.id === entityId,
          );
          const medicineRow = medicineRows.find((item) => item.id === entityId);
          if (entity === "category" && categoryRow)
            setCategory({
              name: categoryRow.name,
              slug: categoryRow.slug,
              description: categoryRow.description ?? "",
              isActive: categoryRow.isActive,
            });
          if (entity === "brand" && brandRow)
            setBrand({
              name: brandRow.name,
              slug: brandRow.slug,
              isActive: brandRow.isActive,
            });
          if (entity === "manufacturer" && manufacturerRow)
            setManufacturer({
              name: manufacturerRow.name,
              country: manufacturerRow.country ?? "",
            });
          if (entity === "medicine" && medicineRow)
            setMedicine({
              name: medicineRow.name,
              genericName: medicineRow.genericName ?? "",
              strength: medicineRow.strength ?? "",
              dosageForm: medicineRow.dosageForm ?? "",
              categoryId: medicineRow.categoryId ?? "",
              manufacturerId: medicineRow.manufacturerId ?? "",
              prescriptionRequired: medicineRow.prescriptionRequired,
              isActive: medicineRow.isActive,
            });
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entity, entityId, superAdmin, view]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function reset() {
    setEditing(null);
    setCategory(blankCategory);
    setBrand(blankBrand);
    setManufacturer(blankManufacturer);
    setMedicine(blankMedicine);
  }
  function startEdit(type: CatalogEntity, id: string) {
    if (view !== "embedded") {
      const entityPath = type === "category" ? "categories" : `${type}s`;
      router.push(`${listPath}/${entityPath}/${id}/edit`);
      return;
    }
    setEditing({ type, id });
    if (type === "category") {
      const row = categories.find((x) => x.id === id);
      if (row)
        setCategory({
          name: row.name,
          slug: row.slug,
          description: row.description ?? "",
          isActive: row.isActive,
        });
    }
    if (type === "brand") {
      const row = brands.find((x) => x.id === id);
      if (row)
        setBrand({ name: row.name, slug: row.slug, isActive: row.isActive });
    }
    if (type === "manufacturer") {
      const row = manufacturers.find((x) => x.id === id);
      if (row) setManufacturer({ name: row.name, country: row.country ?? "" });
    }
    if (type === "medicine") {
      const row = medicines.find((x) => x.id === id);
      if (row)
        setMedicine({
          name: row.name,
          genericName: row.genericName ?? "",
          strength: row.strength ?? "",
          dosageForm: row.dosageForm ?? "",
          categoryId: row.categoryId ?? "",
          manufacturerId: row.manufacturerId ?? "",
          prescriptionRequired: row.prescriptionRequired,
          isActive: row.isActive,
        });
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
  function startCreate(type: CatalogEntity) {
    if (view !== "embedded") {
      const entityPath = type === "category" ? "categories" : `${type}s`;
      router.push(`${listPath}/${entityPath}/create`);
      return;
    }
    reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    await persistCategory();
  }
  async function persistCategory(saveAndAnother = false) {
    await save(
      "category",
      async () => {
        const result =
          editing?.type === "category"
            ? await updateAdminCategory(
                editing.id,
                category,
                token(),
                superAdmin,
              )
            : await createAdminCategory(category, token(), superAdmin);
        setCategories((rows) =>
          editing?.type === "category"
            ? rows.map((row) => (row.id === result.id ? result : row))
            : [result, ...rows],
        );
      },
      saveAndAnother,
    );
  }
  async function saveBrand(event: FormEvent) {
    event.preventDefault();
    await persistBrand();
  }
  async function persistBrand(saveAndAnother = false) {
    await save(
      "brand",
      async () => {
        const result =
          editing?.type === "brand"
            ? await updateAdminBrand(editing.id, brand, token(), superAdmin)
            : await createAdminBrand(brand, token(), superAdmin);
        setBrands((rows) =>
          editing?.type === "brand"
            ? rows.map((row) => (row.id === result.id ? result : row))
            : [result, ...rows],
        );
      },
      saveAndAnother,
    );
  }
  async function saveManufacturer(event: FormEvent) {
    event.preventDefault();
    await persistManufacturer();
  }
  async function persistManufacturer(saveAndAnother = false) {
    await save(
      "manufacturer",
      async () => {
        const result =
          editing?.type === "manufacturer"
            ? await updateAdminManufacturer(
                editing.id,
                manufacturer,
                token(),
                superAdmin,
              )
            : await createAdminManufacturer(manufacturer, token(), superAdmin);
        setManufacturers((rows) =>
          editing?.type === "manufacturer"
            ? rows.map((row) => (row.id === result.id ? result : row))
            : [result, ...rows],
        );
      },
      saveAndAnother,
    );
  }
  async function saveMedicine(event: FormEvent) {
    event.preventDefault();
    await persistMedicine();
  }
  async function persistMedicine(saveAndAnother = false) {
    await save(
      "medicine",
      async () => {
        const input = {
          ...medicine,
          name: medicine.name.trim(),
          genericName: medicine.genericName.trim() || undefined,
          strength: medicine.strength.trim() || undefined,
          dosageForm: medicine.dosageForm.trim() || undefined,
          categoryId: medicine.categoryId || undefined,
          manufacturerId: medicine.manufacturerId || undefined,
        };
        const result =
          editing?.type === "medicine"
            ? await updateAdminMedicine(editing.id, input, token(), superAdmin)
            : await createAdminMedicine(input, token(), superAdmin);
        setMedicines((rows) =>
          editing?.type === "medicine"
            ? rows.map((row) => (row.id === result.id ? result : row))
            : [result, ...rows],
        );
      },
      saveAndAnother,
    );
  }
  async function save(
    type: string,
    action: () => Promise<void>,
    saveAndAnother = false,
  ) {
    setSaving(type);
    setError("");
    try {
      await action();
      toast.success(`${type[0].toUpperCase()}${type.slice(1)} saved`);
      if (view === "embedded" || saveAndAnother) reset();
      else router.push(listPath);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The catalog record could not be saved.",
      );
    } finally {
      setSaving("");
    }
  }
  async function toggleStatus(
    type: "category" | "brand" | "medicine",
    id: string,
    isActive: boolean,
  ) {
    try {
      await setAdminEntityStatus(type, id, isActive, token(), superAdmin);
      if (type === "category")
        setCategories((rows) =>
          rows.map((row) => (row.id === id ? { ...row, isActive } : row)),
        );
      if (type === "brand")
        setBrands((rows) =>
          rows.map((row) => (row.id === id ? { ...row, isActive } : row)),
        );
      if (type === "medicine")
        setMedicines((rows) =>
          rows.map((row) => (row.id === id ? { ...row, isActive } : row)),
        );
      toast.success(
        `${type[0].toUpperCase()}${type.slice(1)} is now ${isActive ? "active" : "inactive"}`,
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Status could not be updated.";
      setError(message);
      toast.error(message);
    }
  }
  const editingType = editing?.type;
  const isListView = view === "list";
  const isFormView = view === "form";
  function cancelForm() {
    if (view === "embedded") reset();
    else router.push(listPath);
  }
  const matchesStatus = (isActive: boolean) =>
    status === "all" || isActive === (status === "active");
  const visibleCategories = categories.filter((row) =>
    matchesStatus(row.isActive),
  );
  const visibleBrands = brands.filter((row) => matchesStatus(row.isActive));
  const visibleMedicines = medicines.filter((row) =>
    matchesStatus(row.isActive),
  );
  return (
    <section className="mt-10 border-t border-slate-200 pt-10">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003893]">
          Catalog foundations
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          {entity ? `${entity === "manufacturer" ? "Company" : entity === "medicine" ? "Generic / medicine" : entity === "category" ? "Drug category" : "Brand"} setup` : "Categories, brands and medicines"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Maintain the linked taxonomy used by product creation, search and
          prescription matching.
        </p>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      {loading ? (
        <div className="flex items-center justify-center p-10 text-sm text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Loading catalog foundations…
        </div>
      ) : (
        <>
          {!isListView && (
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {(!entity || entity === "category") && (!isFormView || entity === "category") ? (
                <TaxonomyCard
                  icon={<Layers3 size={18} />}
                  title="Categories"
                  editing={editingType === "category"}
                  onCancel={cancelForm}
                >
                  <form
                    onSubmit={saveCategory}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Name"
                      value={category.name}
                      onChange={(value) =>
                        setCategory({ ...category, name: value })
                      }
                      required
                    />
                    <Field
                      label="Slug"
                      value={category.slug}
                      onChange={(value) =>
                        setCategory({ ...category, slug: value })
                      }
                      required
                    />
                    <Field
                      label="Description"
                      value={category.description}
                      onChange={(value) =>
                        setCategory({ ...category, description: value })
                      }
                    />
                    <Toggle
                      label="Active"
                      checked={category.isActive}
                      onChange={(value) =>
                        setCategory({ ...category, isActive: value })
                      }
                    />
                    <SaveButton
                      busy={saving === "category"}
                      editing={editingType === "category"}
                      onCancel={cancelForm}
                      onSaveAndAnother={() => void persistCategory(true)}
                    />
                  </form>
                </TaxonomyCard>
              ) : null}
              {(!entity || entity === "brand") && (!isFormView || entity === "brand") ? (
                <TaxonomyCard
                  icon={<Tags size={18} />}
                  title="Brands"
                  editing={editingType === "brand"}
                  onCancel={cancelForm}
                >
                  <form
                    onSubmit={saveBrand}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Name"
                      value={brand.name}
                      onChange={(value) => setBrand({ ...brand, name: value })}
                      required
                    />
                    <Field
                      label="Slug"
                      value={brand.slug}
                      onChange={(value) => setBrand({ ...brand, slug: value })}
                      required
                    />
                    <Toggle
                      label="Active"
                      checked={brand.isActive}
                      onChange={(value) =>
                        setBrand({ ...brand, isActive: value })
                      }
                    />
                    <SaveButton
                      busy={saving === "brand"}
                      editing={editingType === "brand"}
                      onCancel={cancelForm}
                      onSaveAndAnother={() => void persistBrand(true)}
                    />
                  </form>
                </TaxonomyCard>
              ) : null}
              {(!entity || entity === "manufacturer") && (!isFormView || entity === "manufacturer") ? (
                <TaxonomyCard
                  icon={<Factory size={18} />}
                  title="Manufacturers"
                  editing={editingType === "manufacturer"}
                  onCancel={cancelForm}
                >
                  <form
                    onSubmit={saveManufacturer}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Name"
                      value={manufacturer.name}
                      onChange={(value) =>
                        setManufacturer({ ...manufacturer, name: value })
                      }
                      required
                    />
                    <Field
                      label="Country"
                      value={manufacturer.country}
                      onChange={(value) =>
                        setManufacturer({ ...manufacturer, country: value })
                      }
                    />
                    <SaveButton
                      busy={saving === "manufacturer"}
                      editing={editingType === "manufacturer"}
                      onCancel={cancelForm}
                      onSaveAndAnother={() => void persistManufacturer(true)}
                    />
                  </form>
                </TaxonomyCard>
              ) : null}
              {(!entity || entity === "medicine") && (!isFormView || entity === "medicine") ? (
                <TaxonomyCard
                  icon={<Pill size={18} />}
                  title="Medicines"
                  editing={editingType === "medicine"}
                  onCancel={cancelForm}
                >
                  <form
                    onSubmit={saveMedicine}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Name"
                      value={medicine.name}
                      onChange={(value) =>
                        setMedicine({ ...medicine, name: value })
                      }
                      required
                    />
                    <Field
                      label="Generic name"
                      value={medicine.genericName}
                      onChange={(value) =>
                        setMedicine({ ...medicine, genericName: value })
                      }
                    />
                    <Field
                      label="Strength"
                      value={medicine.strength}
                      onChange={(value) =>
                        setMedicine({ ...medicine, strength: value })
                      }
                      placeholder="500 mg"
                    />
                    <Field
                      label="Dosage form"
                      value={medicine.dosageForm}
                      onChange={(value) =>
                        setMedicine({ ...medicine, dosageForm: value })
                      }
                      placeholder="Tablet"
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="taxonomy-medicine-category">
                        Category
                      </Label>
                      <Select
                        id="taxonomy-medicine-category"
                        value={medicine.categoryId}
                        onChange={(event) =>
                          setMedicine({
                            ...medicine,
                            categoryId: event.target.value,
                          })
                        }
                      >
                        <option value="">No category</option>
                        {categories
                          .filter(
                            (row) =>
                              row.isActive || row.id === medicine.categoryId,
                          )
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="taxonomy-medicine-manufacturer">
                        Manufacturer
                      </Label>
                      <Select
                        id="taxonomy-medicine-manufacturer"
                        value={medicine.manufacturerId}
                        onChange={(event) =>
                          setMedicine({
                            ...medicine,
                            manufacturerId: event.target.value,
                          })
                        }
                      >
                        <option value="">No manufacturer</option>
                        {manufacturers.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Toggle
                      label="Prescription required"
                      checked={medicine.prescriptionRequired}
                      onChange={(value) =>
                        setMedicine({
                          ...medicine,
                          prescriptionRequired: value,
                        })
                      }
                    />
                    <Toggle
                      label="Active"
                      checked={medicine.isActive}
                      onChange={(value) =>
                        setMedicine({ ...medicine, isActive: value })
                      }
                    />
                    <SaveButton
                      busy={saving === "medicine"}
                      editing={editingType === "medicine"}
                      onCancel={cancelForm}
                      onSaveAndAnother={() => void persistMedicine(true)}
                    />
                  </form>
                </TaxonomyCard>
              ) : null}
            </div>
          )}
        </>
      )}{" "}
      {!loading && !isFormView && (
        <>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Label
              htmlFor="catalog-status"
              className="text-sm font-semibold text-slate-600"
            >
              Status
            </Label>
            <Select
              id="catalog-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
              className="w-36"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="mt-3 grid gap-6 xl:grid-cols-2">
            {(!entity || entity === "category") && <TaxonomyTable
              title="Categories"
              icon={<Layers3 size={16} />}
              headers={["Name", "Slug", "Status"]}
              rows={visibleCategories.map((row) => [
                row.name,
                row.slug,
                <ActiveStatusToggle
                  key="status"
                  checked={row.isActive}
                  onChange={(isActive) =>
                    toggleStatus("category", row.id, isActive)
                  }
                  label={`category ${row.name}`}
                  confirmOnDeactivate
                />,
              ])}
              ids={visibleCategories.map((row) => row.id)}
              onEdit={(id) => startEdit("category", id)}
              onAdd={() => startCreate("category")}
            />}
            {(!entity || entity === "brand") && <TaxonomyTable
              title="Brands"
              icon={<Tags size={16} />}
              headers={["Name", "Slug", "Status"]}
              rows={visibleBrands.map((row) => [
                row.name,
                row.slug,
                <ActiveStatusToggle
                  key="status"
                  checked={row.isActive}
                  onChange={(isActive) =>
                    toggleStatus("brand", row.id, isActive)
                  }
                  label={`brand ${row.name}`}
                  confirmOnDeactivate
                />,
              ])}
              ids={visibleBrands.map((row) => row.id)}
              onEdit={(id) => startEdit("brand", id)}
              onAdd={() => startCreate("brand")}
            />}
            {(!entity || entity === "manufacturer") && <TaxonomyTable
              title="Manufacturers"
              icon={<Factory size={16} />}
              headers={["Name", "Country"]}
              rows={manufacturers.map((row) => [row.name, row.country || "—"])}
              ids={manufacturers.map((row) => row.id)}
              onEdit={(id) => startEdit("manufacturer", id)}
              onAdd={() => startCreate("manufacturer")}
            />}
            {(!entity || entity === "medicine") && <TaxonomyTable
              title="Medicines"
              icon={<Pill size={16} />}
              headers={["Name", "Strength", "Status"]}
              rows={visibleMedicines.map((row) => [
                row.name,
                row.strength || "—",
                <ActiveStatusToggle
                  key="status"
                  checked={row.isActive}
                  onChange={(isActive) =>
                    toggleStatus("medicine", row.id, isActive)
                  }
                  label={`medicine ${row.name}`}
                  confirmOnDeactivate
                />,
              ])}
              ids={visibleMedicines.map((row) => row.id)}
              onEdit={(id) => startEdit("medicine", id)}
              onAdd={() => startCreate("medicine")}
            />}
          </div>
        </>
      )}
    </section>
  );
}

function TaxonomyCard({
  icon,
  title,
  editing,
  onCancel,
  children,
}: {
  icon: ReactNode;
  title: string;
  editing: boolean;
  onCancel: () => void;
  children: ReactNode;
}) {
  const singular =
    title === "Categories"
      ? "Category"
      : title === "Manufacturers"
        ? "Manufacturer"
        : title.slice(0, -1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2 text-[#003893]">
            {icon}
            {editing ? `Edit ${singular}` : `Add ${singular}`}
          </span>
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Cancel editing ${title}`}
              title="Cancel editing"
              onClick={onCancel}
            >
              <X size={16} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `${useId()}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
function SaveButton({
  busy,
  editing,
  onCancel,
  onSaveAndAnother,
}: {
  busy: boolean;
  editing: boolean;
  onCancel: () => void;
  onSaveAndAnother: () => void;
}) {
  return (
    <FormSaveActions
      mode={editing ? "edit" : "create"}
      busy={busy}
      onCancel={onCancel}
      onSaveAndAnother={onSaveAndAnother}
      saveLabel={editing ? "Save Changes" : "Save & List"}
    />
  );
}
function TaxonomyTable({
  title,
  icon,
  headers,
  rows,
  ids,
  onEdit,
  onAdd,
}: {
  title: string;
  icon: ReactNode;
  headers: string[];
  rows: ReactNode[][];
  ids: string[];
  onEdit: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#003893]">
          {icon}
          {title}
          <Badge variant="outline" className="ml-auto">
            {rows.length}
          </Badge>
          {onAdd && (
            <Button type="button" size="sm" variant="outline" onClick={onAdd}>
              <Plus size={14} />
              Add
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={ids[index]}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${ids[index]}-${cellIndex}`}>
                      {cell}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${title} record`}
                      title={`Edit ${title} record`}
                      onClick={() => onEdit(ids[index])}
                    >
                      <Pencil size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length + 1}
                    className="text-center text-sm text-slate-500"
                  >
                    No records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
