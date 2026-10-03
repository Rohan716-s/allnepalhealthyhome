"use client";

import { useEffect, useState } from "react";
import { getPublicSiteConfig } from "@/services/api";
import { DEFAULT_TABLE_PAGE_SIZE, normalizeTablePageSize, TABLE_PAGE_SIZE_CHANGED_EVENT, TABLE_PAGE_SIZE_KEY } from "@/lib/table-preferences";

const pagerClass = "anhh-table-pager";

function render(table: HTMLTableElement, pageSize: number) {
  if (table.dataset.anhhPaginated === "true") return;
  const body = table.tBodies[0];
  if (!body) return;
  const rows = Array.from(body.rows);
  const wrapper = table.parentElement;
  if (!wrapper) return;
  wrapper.classList.add("table-scroll-container");
  const existing = wrapper.querySelector<HTMLElement>(`:scope > .${pagerClass}`);
  existing?.remove();
  rows.forEach((row) => {
    row.style.display = "";
  });
  if (rows.length <= pageSize) return;

  const currentPage = Number(table.dataset.anhhPage ?? "1");
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  rows.forEach((row, index) => {
    row.style.display = index >= (page - 1) * pageSize && index < page * pageSize ? "" : "none";
  });
  table.dataset.anhhPage = String(page);
  table.dataset.anhhRenderedPageSize = String(pageSize);
  table.dataset.anhhRowCount = String(rows.length);
  const pager = document.createElement("div");
  pager.className = `${pagerClass} mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4`;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, rows.length);
  const summary = document.createElement("p");
  summary.className = "text-xs font-semibold text-slate-500";
  summary.textContent = `Showing ${first}–${last} of ${rows.length}`;
  const controls = document.createElement("div");
  controls.className = "flex items-center gap-1";
  const addButton = (label: string, disabled: boolean, nextPage: number, aria: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50";
    button.disabled = disabled;
    button.textContent = label;
    button.setAttribute("aria-label", aria);
    button.addEventListener("click", () => {
      table.dataset.anhhPage = String(nextPage);
      render(table, pageSize);
    });
    controls.appendChild(button);
  };
  addButton("Previous", page <= 1, page - 1, "Previous page");
  for (let number = 1; number <= totalPages; number += 1) {
    if (totalPages > 7 && number !== 1 && number !== totalPages && Math.abs(number - page) > 1) continue;
    addButton(String(number), number === page, number, `Go to page ${number}`);
  }
  addButton("Next", page >= totalPages, page + 1, "Next page");
  pager.append(summary, controls);
  wrapper.appendChild(pager);
}

export function GlobalTablePagination() {
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    getPublicSiteConfig().then((config) => setPageSize(normalizeTablePageSize(config.settings[TABLE_PAGE_SIZE_KEY]))).catch(() => undefined);
    const onChange = (event: Event) => setPageSize(normalizeTablePageSize((event as CustomEvent<number>).detail));
    window.addEventListener(TABLE_PAGE_SIZE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(TABLE_PAGE_SIZE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLTableElement>("table:not([data-anhh-paginated='true'])").forEach((table) => {
        const rowCount = table.tBodies[0]?.rows.length ?? 0;
        if (table.dataset.anhhRenderedPageSize === String(pageSize) && table.dataset.anhhRowCount === String(rowCount)) return;
        table.dataset.anhhPage = "1";
        table.dataset.anhhRenderedPageSize = "";
        render(table, pageSize);
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pageSize]);

  return null;
}
