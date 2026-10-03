export const TABLE_PAGE_SIZE_KEY = "system.tablePageSize";
export const TABLE_PAGE_SIZE_CHANGED_EVENT = "anhh:table-page-size-changed";
export const DEFAULT_TABLE_PAGE_SIZE = 25;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function normalizeTablePageSize(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TABLE_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.round(parsed)));
}

export function getStoredTablePageSize() {
  if (typeof window === "undefined") return DEFAULT_TABLE_PAGE_SIZE;
  return normalizeTablePageSize(
    window.localStorage.getItem(TABLE_PAGE_SIZE_KEY) ?? undefined,
  );
}

export function publishTablePageSize(value: string | number) {
  const normalized = normalizeTablePageSize(value);
  if (typeof window === "undefined") return normalized;
  window.localStorage.setItem(TABLE_PAGE_SIZE_KEY, String(normalized));
  window.dispatchEvent(
    new CustomEvent(TABLE_PAGE_SIZE_CHANGED_EVENT, {
      detail: normalized,
    }),
  );
  return normalized;
}
