"use client";

/* eslint-disable react-hooks/set-state-in-effect -- synchronize pagination with the persisted SuperAdmin preference and changing datasets. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSiteConfig } from "@/components/site-config-provider";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getStoredTablePageSize,
  normalizeTablePageSize,
  TABLE_PAGE_SIZE_CHANGED_EVENT,
  TABLE_PAGE_SIZE_KEY,
} from "@/lib/table-preferences";

export function useGlobalTablePageSize() {
  const { settings } = useSiteConfig();
  const configured = normalizeTablePageSize(
    settings[TABLE_PAGE_SIZE_KEY] ?? DEFAULT_TABLE_PAGE_SIZE,
  );
  const [pageSize, setPageSize] = useState(configured);

  useEffect(() => {
    const stored = window.localStorage.getItem(TABLE_PAGE_SIZE_KEY);
    setPageSize(stored === null ? configured : getStoredTablePageSize());
  }, [configured]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      setPageSize(normalizeTablePageSize(value));
    };
    window.addEventListener(TABLE_PAGE_SIZE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(TABLE_PAGE_SIZE_CHANGED_EVENT, onChange);
  }, []);

  return pageSize;
}

export function useTablePagination<T>(items: T[], pageSizeOverride?: number) {
  const globalPageSize = useGlobalTablePageSize();
  const pageSize = normalizeTablePageSize(pageSizeOverride ?? globalPageSize);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, items.length]);

  const goToPage = useCallback(
    (next: number) => setPage(Math.min(totalPages, Math.max(1, next))),
    [totalPages],
  );
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return {
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
    pageItems,
    goToPage,
  };
}
